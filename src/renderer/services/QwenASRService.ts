import type { VoiceRecognitionService, RecognitionOptions, VoiceBackup } from '../../types/voiceInput'

interface QwenASROptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  /** Called when VAD detects end of speech segment (but recording continues) */
  onSegmentComplete?: (text: string) => void
  onError: (error: string) => void
  /** Project path for audio backup (optional) */
  projectPath?: string
  /** Source of the recording */
  source?: 'inline' | 'panel'
}

/** Result returned when stopping recording */
export interface StopResult {
  text: string
  segments: string[]
  /** Backup ID if transcription failed and audio was saved */
  backupId?: string
  /** True if recording was done in offline mode and needs backup */
  needsBackup?: boolean
  /** Error message from offline mode */
  offlineError?: string
}

/**
 * QwenASRService - Client-side interface for Qwen-ASR via Electron IPC
 *
 * This service communicates with the main process WebSocket proxy to handle
 * Qwen-ASR authentication (which requires HTTP headers that browsers cannot set).
 */
export class QwenASRService implements VoiceRecognitionService {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private isRunning = false
  private accumulatedText = ''
  private allSegments: string[] = [] // Accumulate all completed segments
  private hasFinalResult = false // Track if we've already sent final result
  private userStopped = false // Track if user explicitly stopped recording
  private options: QwenASROptions
  private interimCallback: ((text: string) => void) | null = null
  private finalCallback: ((text: string) => void) | null = null
  private segmentCallback: ((text: string) => void) | null = null
  private errorCallback: ((error: string) => void) | null = null

  // IPC event cleanup functions
  private cleanupFunctions: Array<() => void> = []

  // Session ID from main process to isolate IPC events between rapid consecutive sessions
  // This is assigned by the main process QwenASRProxy and used to filter events
  private mainSessionId = 0

  // Track if cleanup has been called for current session to prevent double cleanup
  private cleanedUp = false

  // Promise resolve function for stop() to return final result
  private stopResolve: ((result: StopResult) => void) | null = null

  // Audio backup: accumulate PCM data during recording
  private accumulatedAudioChunks: Int16Array[] = []
  private recordingStartTime = 0

  // Streaming backup: write audio to disk as it's recorded
  private streamingBackupId: string | null = null
  private streamingBackupStarted = false

  // Offline mode: when WebSocket connection fails, continue recording locally
  private isOfflineMode = false
  private offlineError: string | null = null

  // Flag to indicate we're waiting for WebSocket connection
  // During this time, ignore IPC error events (we handle them in start())
  private isConnecting = false

  constructor(options: QwenASROptions) {
    this.options = options
    this.interimCallback = options.onInterimResult
    this.finalCallback = options.onFinalResult
    this.segmentCallback = options.onSegmentComplete || null
    this.errorCallback = options.onError
  }

  async start(options?: RecognitionOptions): Promise<void> {
    console.log('[QwenASR] start() called')

    // Always cleanup any leftover audio resources from previous sessions
    // This ensures old AudioWorklet is stopped before starting new recording
    if (this.isRunning) {
      console.warn('[QwenASR] Already running, cleaning up first')
    }
    this.forceCleanup()

    this.isRunning = true
    this.accumulatedText = ''
    this.allSegments = []
    this.hasFinalResult = false
    this.userStopped = false
    this.cleanedUp = false
    this.mainSessionId = 0  // Reset, will be set after start() returns
    this.accumulatedAudioChunks = []  // Reset audio backup buffer
    this.recordingStartTime = Date.now()
    this.streamingBackupId = null
    this.streamingBackupStarted = false
    this.isOfflineMode = false
    this.offlineError = null
    this.isConnecting = false

    try {
      // 1. Get microphone permission FIRST - this is required for recording
      console.log('[QwenASR] Requesting microphone permission...')
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      console.log('[QwenASR] Microphone permission granted')

      // Check if stopped while waiting for permission
      if (!this.isRunning) {
        console.log('[QwenASR] Stopped while waiting for permission, aborting')
        this.cleanup()
        return
      }

      // 2. Start audio capture BEFORE WebSocket connection
      // This ensures we're recording even if network fails
      await this.startAudioCapture()

      // 3. Setup IPC event listeners for ASR results
      this.setupIPCListeners()

      // 4. Try to start WebSocket connection via main process
      // If this fails, we continue in offline mode
      console.log('[QwenASR] Starting WebSocket via IPC...')
      this.isConnecting = true  // Mark as connecting - ignore IPC errors during this time
      try {
        const result = await window.api.voice.qwenAsr.start({
          apiKey: this.options.apiKey,
          region: this.options.region,
          language: options?.language || this.options.language || 'zh'
        })
        this.isConnecting = false  // Connection attempt complete

        // Check if stopped while waiting for WebSocket connection
        if (!this.isRunning) {
          console.log('[QwenASR] Stopped while waiting for WebSocket, aborting')
          window.api.voice.qwenAsr.stop().catch(console.error)
          this.cleanup()
          return
        }

        if (!result.success) {
          // WebSocket connection failed - enter offline mode
          this.isOfflineMode = true
          this.offlineError = result.error || 'Failed to start ASR'
          console.warn('[QwenASR] WebSocket connection failed, entering offline mode:', this.offlineError)
          // Show a non-blocking notification to user (recording continues)
          this.interimCallback?.('⏺ 离线录音中...')
        } else {
          // Store the session ID from main process - used by IPC listeners to filter events
          this.mainSessionId = result.sessionId || 0
          console.log('[QwenASR] Started via IPC proxy, main session ID:', this.mainSessionId)
        }
      } catch (wsError) {
        this.isConnecting = false  // Connection attempt complete
        // Network error or other WebSocket connection failure - enter offline mode
        this.isOfflineMode = true
        this.offlineError = wsError instanceof Error ? wsError.message : 'Network error'
        console.warn('[QwenASR] WebSocket connection error, entering offline mode:', this.offlineError)
        // Show a non-blocking notification to user (recording continues)
        this.interimCallback?.('⏺ 离线录音中...')
      }
    } catch (error) {
      // Critical error (e.g., microphone permission denied) - cannot continue
      console.error('[QwenASR] Start error:', error)
      this.errorCallback?.(error instanceof Error ? error.message : '启动失败')
      this.cleanup()
    }
  }

  private setupIPCListeners(): void {
    // Clean up any existing listeners from previous sessions
    this.cleanupIPCListeners()

    console.log('[QwenASR] Setting up IPC listeners')

    // Helper to check if this event is for the current session using main process session ID
    // Uses this.mainSessionId dynamically (not a closure-captured value)
    const isEventForThisSession = (eventSessionId: number | undefined) => {
      // If mainSessionId is not yet set (0), accept events for the session being started
      if (this.mainSessionId === 0) return true
      if (eventSessionId === undefined) return true // Backwards compatibility
      return eventSessionId === this.mainSessionId
    }

    // Listen for ready event (for logging, audio capture is started after start() returns)
    const cleanupReady = window.api.voice.qwenAsr.onReady((data) => {
      if (!isEventForThisSession(data?.sessionId)) {
        console.log('[QwenASR] Ignoring ready event for session:', data?.sessionId, 'expected:', this.mainSessionId)
        return
      }
      console.log('[QwenASR] Session ready event received for session:', data?.sessionId)
    })
    this.cleanupFunctions.push(cleanupReady)

    // Listen for interim results
    // Note: Qwen-ASR sends complete interim text in 'stash' field, not incremental deltas
    const cleanupInterim = window.api.voice.qwenAsr.onInterim((data) => {
      if (!isEventForThisSession(data?.sessionId)) return
      // stash contains the complete interim text for current segment
      this.accumulatedText = data.text
      // Combine with previous segments for display
      const allText = [...this.allSegments, this.accumulatedText].filter(s => s.trim()).join('\n')
      this.interimCallback?.(allText)
    })
    this.cleanupFunctions.push(cleanupInterim)

    // Listen for final results (VAD segment completion or user stop)
    const cleanupFinal = window.api.voice.qwenAsr.onFinal((data) => {
      if (!isEventForThisSession(data?.sessionId)) {
        console.log('[QwenASR] Ignoring final event for session:', data?.sessionId, 'expected:', this.mainSessionId)
        return
      }
      const text = data.text || this.accumulatedText
      console.log('[QwenASR] Server final result:', text, 'userStopped:', this.userStopped)

      if (this.userStopped) {
        // User explicitly stopped - send final result with all accumulated segments
        if (!this.hasFinalResult) {
          this.hasFinalResult = true
          // Combine all segments with the current text
          const segments = [...this.allSegments, text].filter(s => s.trim())
          const allText = segments.join('\n')
          console.log('[QwenASR] User stopped, final combined result:', allText)
          this.finalCallback?.(allText)

          // End streaming backup - mark as completed if we got text, pending if empty
          const transcriptionSucceeded = allText.trim().length > 0
          this.endStreamingBackup(transcriptionSucceeded, transcriptionSucceeded ? undefined : 'Empty transcription')

          // Resolve the stop() Promise with the result
          if (this.stopResolve) {
            const result: StopResult = { text: allText, segments }
            this.stopResolve(result)
            this.stopResolve = null
          }
        }
      } else {
        // VAD segment completion - accumulate and notify
        if (text.trim()) {
          this.allSegments.push(text)
          console.log('[QwenASR] VAD segment complete, segments:', this.allSegments.length)
          // Notify about segment completion (for UI update)
          this.segmentCallback?.(text)
          // Also update interim with accumulated text for display
          const allText = this.allSegments.join('\n')
          this.interimCallback?.(allText)
        }
        // Reset accumulated text for next segment
        this.accumulatedText = ''
      }
    })
    this.cleanupFunctions.push(cleanupFinal)

    // Listen for errors
    const cleanupError = window.api.voice.qwenAsr.onError((data) => {
      if (!isEventForThisSession(data?.sessionId)) {
        console.log('[QwenASR] Ignoring error event for session:', data?.sessionId, 'expected:', this.mainSessionId)
        return
      }

      // Ignore errors during connection phase - they're handled in start()
      // This prevents race condition where IPC error arrives before start() can handle it
      if (this.isConnecting) {
        console.log('[QwenASR] Ignoring error during connection phase (handled in start()):', data.error)
        return
      }

      console.error('[QwenASR] Error from proxy:', data.error)

      // End streaming backup with error status (pending for retry)
      this.endStreamingBackup(false, data.error)

      this.errorCallback?.(data.error)
      this.cleanup()
    })
    this.cleanupFunctions.push(cleanupError)

    // Listen for connection closed
    // Each recording session uses a new WebSocket connection (Qwen-ASR doesn't support buffer clearing)
    const cleanupClosed = window.api.voice.qwenAsr.onClosed((data) => {
      if (!isEventForThisSession(data?.sessionId)) {
        console.log('[QwenASR] Ignoring closed event for session:', data?.sessionId, 'expected:', this.mainSessionId)
        return
      }
      console.log('[QwenASR] Connection closed for session:', this.mainSessionId, data.code, data.reason)

      // Ignore close events during connection phase or in offline mode
      // Connection failures during connecting are handled in start() which enters offline mode
      if (this.isConnecting || this.isOfflineMode) {
        console.log('[QwenASR] Ignoring close event (connecting:', this.isConnecting, 'offline:', this.isOfflineMode, ')')
        return
      }

      // Only cleanup if we're still running (unexpected closure)
      // If user stopped, cleanup will be handled by stop()
      if (this.isRunning && !this.userStopped) {
        console.log('[QwenASR] Unexpected connection closure, cleaning up')

        // End streaming backup with error status (pending for retry)
        this.endStreamingBackup(false, '连接已断开')

        this.errorCallback?.('连接已断开')
        this.cleanup()
      }
    })
    this.cleanupFunctions.push(cleanupClosed)
  }

  private cleanupIPCListeners(): void {
    this.cleanupFunctions.forEach(cleanup => cleanup())
    this.cleanupFunctions = []
  }

  /**
   * Stop recording and return the final transcription result.
   * Returns a Promise that resolves when the server sends the final result
   * (or times out after 800ms).
   *
   * In offline mode, returns immediately with needsBackup flag set.
   */
  stop(): Promise<StopResult> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        console.log('[QwenASR] stop() called but not running')
        // Even if not running, return accumulated segments
        const allText = this.allSegments.join('\n')
        const result: StopResult = { text: allText, segments: [...this.allSegments] }

        if (!this.hasFinalResult) {
          this.hasFinalResult = true
          this.finalCallback?.(allText)
        }
        resolve(result)
        return
      }

      const stoppingSessionId = this.mainSessionId
      const wasOffline = this.isOfflineMode
      const offlineErrorMsg = this.offlineError

      console.log('[QwenASR] Stopping session:', stoppingSessionId, 'offline:', wasOffline)
      this.isRunning = false
      this.userStopped = true // Mark that user explicitly stopped

      // If in offline mode, resolve immediately - no server to wait for
      if (wasOffline) {
        this.hasFinalResult = true
        const duration = this.getAccumulatedDuration()
        console.log('[QwenASR] Offline recording stopped, duration:', duration.toFixed(1), 's')

        // End streaming backup with 'pending' status (needs retry later)
        this.endStreamingBackup(false, offlineErrorMsg || 'Offline recording')

        // Return result indicating backup is needed
        const result: StopResult = {
          text: '', // No transcription in offline mode
          segments: [],
          needsBackup: true,
          offlineError: offlineErrorMsg || undefined
        }

        // Clear the interim text showing offline status
        this.finalCallback?.('')
        this.cleanup()
        resolve(result)
        return
      }

      // Online mode - wait for server response
      this.stopResolve = resolve // Store resolve function for onFinal handler

      // Send commit signal via IPC to get final transcription
      window.api.voice.qwenAsr.commit().catch(console.error)

      // Give server time to process final audio
      // After timeout, resolve with whatever we have and cleanup
      setTimeout(async () => {
        // Only trigger if server hasn't sent final result yet
        if (!this.hasFinalResult) {
          this.hasFinalResult = true
          // Combine all segments with current accumulated text
          const allText = [...this.allSegments, this.accumulatedText].filter(s => s.trim()).join('\n')
          console.log('[QwenASR] Timeout final result:', allText || '(empty)')
          const result: StopResult = {
            text: allText,
            segments: [...this.allSegments, this.accumulatedText].filter(s => s.trim())
          }
          this.finalCallback?.(allText)
          this.stopResolve = null

          // End streaming backup - mark as completed if we got text, pending if empty
          const transcriptionSucceeded = allText.trim().length > 0
          await this.endStreamingBackup(transcriptionSucceeded, transcriptionSucceeded ? undefined : 'Empty transcription')

          resolve(result)
        }
        // If hasFinalResult is true, resolve was already called by onFinal handler
        // In that case, streaming backup was already ended by the onFinal handler

        window.api.voice.qwenAsr.stop().catch(console.error)
        this.cleanup()
      }, 800) // Wait for server to send final result
    })
  }

  onInterimResult(callback: (text: string) => void): void {
    this.interimCallback = callback
  }

  onFinalResult(callback: (text: string) => void): void {
    this.finalCallback = callback
  }

  onError(callback: (error: string) => void): void {
    this.errorCallback = callback
  }

  private async startAudioCapture(): Promise<void> {
    if (!this.mediaStream) return

    try {
      // Create AudioContext with explicit sample rate
      // Use a standard sample rate that's well-supported
      this.audioContext = new AudioContext({ sampleRate: 48000 })
      console.log('[QwenASR] AudioContext created, sampleRate:', this.audioContext.sampleRate)

      // Wait for AudioContext to be ready
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Check if still running
      if (!this.isRunning) {
        console.log('[QwenASR] Stopped before audio capture started')
        return
      }

      // Create audio worklet processor inline as a Blob
      // Use smaller buffer (1024 samples = ~21ms at 48kHz) to reduce latency
      // and prevent losing audio at the start/end of recording
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            // Smaller buffer = less latency but more frequent messages
            // 1024 samples at 48kHz = ~21ms of audio
            this.bufferSize = 1024;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (!input || !input[0]) return true;

            const inputChannel = input[0];

            for (let i = 0; i < inputChannel.length; i++) {
              this.buffer[this.bufferIndex++] = inputChannel[i];

              if (this.bufferIndex >= this.bufferSize) {
                // Buffer is full, send to main thread
                this.port.postMessage({
                  type: 'audio',
                  data: this.buffer.slice()
                });
                this.bufferIndex = 0;
              }
            }

            return true;
          }
        }

        registerProcessor('audio-processor', AudioProcessor);
      `

      const blob = new Blob([workletCode], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)

      console.log('[QwenASR] Loading audio worklet...')
      await this.audioContext.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      // Check if still running after async operation
      if (!this.isRunning) {
        console.log('[QwenASR] Stopped while loading worklet')
        return
      }

      console.log('[QwenASR] Audio worklet loaded')

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor')

      let audioChunkCount = 0
      this.workletNode.port.onmessage = (event) => {
        if (!this.isRunning) return

        try {
          if (event.data.type === 'audio') {
            audioChunkCount++
            // Log every 50th chunk to reduce logging
            if (audioChunkCount % 50 === 1) {
              console.log('[QwenASR] Processing audio chunk:', audioChunkCount)
            }

            const inputData = event.data.data as Float32Array

            // Resample from 48kHz to 16kHz
            const audioData = this.resample(inputData, 48000, 16000)
            const pcm16 = this.floatTo16BitPCM(audioData)

            // Accumulate audio for backup (in-memory)
            this.accumulatedAudioChunks.push(new Int16Array(pcm16))

            // Append to streaming backup (writes to disk)
            this.appendToStreamingBackup(pcm16)

            const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

            // Send audio data via IPC (fire and forget, don't await)
            window.api.voice.qwenAsr.sendAudio(base64Audio).catch((err) => {
              console.error('[QwenASR] Failed to send audio:', err)
            })
          }
        } catch (err) {
          console.error('[QwenASR] Audio processing error:', err)
        }
      }

      // Start streaming backup BEFORE connecting audio nodes
      // This ensures the file stream is ready before any audio chunks arrive
      await this.startStreamingBackup()

      // Connect nodes
      console.log('[QwenASR] Connecting audio nodes...')
      this.sourceNode.connect(this.workletNode)
      // Don't connect to destination - we don't need audio output

      console.log('[QwenASR] Audio capture started with AudioWorklet')
    } catch (error) {
      console.error('[QwenASR] Audio capture error:', error)

      // Fallback to ScriptProcessor if AudioWorklet fails
      console.log('[QwenASR] Falling back to ScriptProcessor...')
      await this.startAudioCaptureWithScriptProcessor()
    }
  }

  private async startAudioCaptureWithScriptProcessor(): Promise<void> {
    if (!this.mediaStream || !this.audioContext) return

    try {
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Use ScriptProcessor as fallback
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      let audioChunkCount = 0
      processor.onaudioprocess = (event) => {
        if (!this.isRunning) return

        try {
          audioChunkCount++
          if (audioChunkCount % 50 === 1) {
            console.log('[QwenASR] Processing audio chunk (ScriptProcessor):', audioChunkCount)
          }

          const inputData = event.inputBuffer.getChannelData(0)
          const audioData = this.resample(inputData, this.audioContext!.sampleRate, 16000)
          const pcm16 = this.floatTo16BitPCM(audioData)

          // Accumulate audio for backup (in-memory)
          this.accumulatedAudioChunks.push(new Int16Array(pcm16))

          // Append to streaming backup (writes to disk)
          this.appendToStreamingBackup(pcm16)

          const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

          window.api.voice.qwenAsr.sendAudio(base64Audio).catch((err) => {
            console.error('[QwenASR] Failed to send audio:', err)
          })
        } catch (err) {
          console.error('[QwenASR] Audio processing error:', err)
        }
      }

      // Start streaming backup BEFORE connecting audio nodes
      // This ensures the file stream is ready before any audio chunks arrive
      await this.startStreamingBackup()

      source.connect(processor)
      processor.connect(this.audioContext.destination)

      console.log('[QwenASR] Audio capture started with ScriptProcessor (fallback)')
    } catch (error) {
      console.error('[QwenASR] ScriptProcessor fallback error:', error)
      this.errorCallback?.('音频采集失败')
    }
  }

  /**
   * Start streaming backup - creates file on disk and registers in index.
   * Called when recording starts, before any audio data is captured.
   */
  private async startStreamingBackup(): Promise<void> {
    const projectPath = this.options.projectPath
    if (!projectPath) {
      console.log('[QwenASR] No project path, skipping streaming backup')
      return
    }

    const backupId = this.recordingStartTime.toString()
    this.streamingBackupId = backupId

    const backup: VoiceBackup = {
      id: backupId,
      timestamp: this.recordingStartTime,
      projectId: projectPath,
      source: this.options.source || 'panel',
      duration: 0, // Will be updated on endStream
      sampleRate: 16000,
      status: 'recording',
      retryCount: 0
    }

    try {
      console.log('[QwenASR] Starting streaming backup:', backupId)
      const result = await window.api.voiceBackup.startStream(projectPath, backup)
      if (result.success) {
        this.streamingBackupStarted = true
        console.log('[QwenASR] Streaming backup started successfully')
      } else {
        console.error('[QwenASR] Failed to start streaming backup:', result.error)
        this.streamingBackupId = null
      }
    } catch (err) {
      console.error('[QwenASR] Error starting streaming backup:', err)
      this.streamingBackupId = null
    }
  }

  /**
   * Append audio chunk to streaming backup.
   * Called for each audio chunk during recording.
   */
  private appendToStreamingBackup(pcm16: Int16Array): void {
    if (!this.streamingBackupStarted || !this.streamingBackupId) return

    const base64Chunk = this.arrayBufferToBase64(pcm16.buffer)

    // Fire and forget - don't block audio processing
    window.api.voiceBackup.appendChunk(this.streamingBackupId, base64Chunk).catch(err => {
      console.error('[QwenASR] Failed to append chunk to backup:', err)
    })
  }

  /**
   * End streaming backup with final status.
   * Called when recording stops.
   *
   * @param transcriptionSucceeded - If true, marks as 'completed' and file will be deleted
   * @param error - Error message if transcription failed
   */
  private async endStreamingBackup(transcriptionSucceeded: boolean, error?: string): Promise<void> {
    const projectPath = this.options.projectPath
    if (!projectPath || !this.streamingBackupStarted || !this.streamingBackupId) {
      return
    }

    const duration = this.getAccumulatedDuration()
    const finalStatus = transcriptionSucceeded ? 'completed' : 'pending'

    try {
      console.log('[QwenASR] Ending streaming backup:', this.streamingBackupId, 'status:', finalStatus)
      await window.api.voiceBackup.endStream(projectPath, this.streamingBackupId, finalStatus, duration, error)
      console.log('[QwenASR] Streaming backup ended successfully')
    } catch (err) {
      console.error('[QwenASR] Error ending streaming backup:', err)
    }

    // Reset streaming state
    this.streamingBackupId = null
    this.streamingBackupStarted = false
  }

  /**
   * Abort streaming backup - called when recording is aborted unexpectedly.
   * Deletes incomplete file.
   */
  private async abortStreamingBackup(): Promise<void> {
    const projectPath = this.options.projectPath
    if (!projectPath || !this.streamingBackupId) {
      return
    }

    try {
      console.log('[QwenASR] Aborting streaming backup:', this.streamingBackupId)
      await window.api.voiceBackup.abortStream(projectPath, this.streamingBackupId)
    } catch (err) {
      console.error('[QwenASR] Error aborting streaming backup:', err)
    }

    this.streamingBackupId = null
    this.streamingBackupStarted = false
  }

  private resample(inputData: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return inputData

    const ratio = fromRate / toRate
    const newLength = Math.round(inputData.length / ratio)
    const result = new Float32Array(newLength)
    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio)
      result[i] = inputData[srcIndex]
    }
    return result
  }

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16Array
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer)
    // Build binary string byte by byte to avoid stack overflow
    // This is slower but safe for any buffer size
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private cleanup(): void {
    // Prevent double cleanup
    if (this.cleanedUp) {
      console.log('[QwenASR] Already cleaned up, skipping')
      return
    }
    this.cleanedUp = true

    console.log('[QwenASR] Cleaning up session:', this.mainSessionId)
    this.cleanupResources()
  }

  /**
   * Force cleanup regardless of cleanedUp flag.
   * Used when starting a new session to ensure old resources are released.
   */
  private forceCleanup(): void {
    console.log('[QwenASR] Force cleanup')
    this.cleanupResources()
  }

  /**
   * Internal resource cleanup - releases all audio resources.
   */
  private cleanupResources(): void {
    // Clean up IPC listeners
    this.cleanupIPCListeners()

    if (this.workletNode) {
      this.workletNode.port.onmessage = null  // Remove message handler to stop processing
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(console.error)
      this.audioContext = null
    }

    this.isRunning = false
    this.isConnecting = false
    this.accumulatedText = ''
    this.allSegments = []
    this.userStopped = false
    // Note: Don't clear accumulatedAudioChunks here - it may still be needed for backup
  }

  // Check if service is running
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Get the accumulated audio data as a single base64 encoded string.
   * This combines all recorded chunks into one PCM buffer.
   */
  getAccumulatedAudioBase64(): string {
    if (this.accumulatedAudioChunks.length === 0) return ''

    // Calculate total length
    const totalLength = this.accumulatedAudioChunks.reduce((sum, chunk) => sum + chunk.length, 0)

    // Combine all chunks
    const combined = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of this.accumulatedAudioChunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    return this.arrayBufferToBase64(combined.buffer)
  }

  /**
   * Get the duration of accumulated audio in seconds.
   */
  getAccumulatedDuration(): number {
    const totalSamples = this.accumulatedAudioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    // Sample rate is 16kHz after resampling
    return totalSamples / 16000
  }

  /**
   * Save accumulated audio as a backup for retry.
   * Returns the backup ID if successful.
   */
  async saveBackup(projectPath: string, error?: string): Promise<string | null> {
    if (!projectPath || this.accumulatedAudioChunks.length === 0) {
      console.log('[QwenASR] No audio to backup or no project path')
      return null
    }

    const audioData = this.getAccumulatedAudioBase64()
    if (!audioData) return null

    const backupId = this.recordingStartTime.toString()
    const duration = this.getAccumulatedDuration()

    const backup: VoiceBackup = {
      id: backupId,
      timestamp: this.recordingStartTime,
      projectId: projectPath,
      source: this.options.source || 'panel',
      duration,
      sampleRate: 16000,
      status: 'pending',
      retryCount: 0,
      lastError: error
    }

    try {
      console.log('[QwenASR] Saving audio backup:', backupId, 'duration:', duration.toFixed(1), 's')
      const result = await window.api.voiceBackup.save(projectPath, backup, audioData)
      if (result.success) {
        console.log('[QwenASR] Audio backup saved successfully')
        return backupId
      } else {
        console.error('[QwenASR] Failed to save audio backup:', result.error)
        return null
      }
    } catch (err) {
      console.error('[QwenASR] Error saving audio backup:', err)
      return null
    }
  }

  /**
   * Delete a backup after successful transcription.
   */
  async deleteBackup(projectPath: string, backupId: string): Promise<void> {
    try {
      await window.api.voiceBackup.delete(projectPath, backupId)
      console.log('[QwenASR] Audio backup deleted:', backupId)
    } catch (err) {
      console.error('[QwenASR] Error deleting audio backup:', err)
    }
  }

  /**
   * Retry transcription with previously saved audio data.
   * This creates a new WebSocket session and sends the audio for transcription.
   *
   * @param audioBase64 - Base64 encoded 16-bit PCM audio at the specified sample rate
   * @param sampleRate - Sample rate of the audio (default 16000)
   * @param onInterim - Optional callback for real-time interim results
   * @returns Promise resolving to the transcribed text, or null on failure
   */
  async retryTranscription(
    audioBase64: string,
    sampleRate: number = 16000,
    onInterim?: (text: string) => void
  ): Promise<string | null> {
    console.log('[QwenASR] Starting retry transcription, audio length:', audioBase64.length)

    try {
      // Start a new WebSocket session
      const startResult = await window.api.voice.qwenAsr.start({
        apiKey: this.options.apiKey,
        region: this.options.region,
        language: this.options.language || 'zh'
      })

      if (!startResult.success) {
        throw new Error(startResult.error || 'Failed to start ASR session')
      }

      console.log('[QwenASR] Retry session started, session ID:', startResult.sessionId)

      // External reference to startIdleDetection function (set inside Promise constructor)
      let startIdleDetection: (() => void) | null = null

      // Create a promise that resolves when we get a final result
      const transcriptionPromise = new Promise<string>((resolve, reject) => {
        let resultText = ''
        let interimText = ''
        let allSegments: string[] = []
        let lastInterimTime = 0
        let audioSentComplete = false
        let idleTimeout: NodeJS.Timeout | null = null

        // Helper to get final text
        const getFinalText = () => {
          return allSegments.length > 0
            ? allSegments.join('\n')
            : (resultText || interimText)
        }

        // Helper to resolve with current text
        const resolveWithText = (reason: string) => {
          cleanup()
          const finalText = getFinalText()
          console.log(`[QwenASR] Retry ${reason}, returning:`, finalText)
          resolve(finalText)
        }

        // Start idle detection after audio is sent - assign to external variable
        startIdleDetection = () => {
          audioSentComplete = true
          // Check every 500ms if we've been idle (no new interim) for 1.5 seconds
          const checkIdle = () => {
            if (!audioSentComplete) return
            const idleTime = Date.now() - lastInterimTime
            if (lastInterimTime > 0 && idleTime >= 1500) {
              // No new interim for 1.5 seconds after audio sent - transcription likely done
              resolveWithText('idle timeout (1.5s no new text)')
            } else {
              idleTimeout = setTimeout(checkIdle, 500)
            }
          }
          idleTimeout = setTimeout(checkIdle, 500)
        }

        // Fallback timeout - 30 seconds max
        const maxTimeout = setTimeout(() => {
          const finalText = getFinalText()
          if (finalText) {
            resolveWithText('max timeout')
          } else {
            cleanup()
            reject(new Error('Transcription timeout - no text received'))
          }
        }, 30000)

        // Setup listeners for this retry session
        // Listen for interim results - these contain the transcription in progress
        const cleanupInterim = window.api.voice.qwenAsr.onInterim((data) => {
          if (data?.sessionId !== startResult.sessionId) return
          interimText = data.text || ''
          lastInterimTime = Date.now()
          console.log('[QwenASR] Retry interim:', interimText)
          // Call the interim callback for real-time display
          if (onInterim && interimText) {
            onInterim(interimText)
          }
        })

        const cleanupFinal = window.api.voice.qwenAsr.onFinal((data) => {
          if (data?.sessionId !== startResult.sessionId) return
          const text = data.text || interimText
          console.log('[QwenASR] Retry got final result:', text)
          if (text.trim()) {
            allSegments.push(text)
            resultText = text
            // Call interim callback with accumulated text
            if (onInterim) {
              onInterim(allSegments.join('\n'))
            }
          }
          // Reset interim for next segment
          interimText = ''
          lastInterimTime = Date.now()
        })

        const cleanupError = window.api.voice.qwenAsr.onError((data) => {
          if (data?.sessionId !== startResult.sessionId) return
          cleanup()
          reject(new Error(data.error))
        })

        const cleanupClosed = window.api.voice.qwenAsr.onClosed((data) => {
          if (data?.sessionId !== startResult.sessionId) return
          console.log('[QwenASR] Retry session closed')
          resolveWithText('session closed')
        })

        const cleanup = () => {
          clearTimeout(maxTimeout)
          if (idleTimeout) clearTimeout(idleTimeout)
          cleanupInterim()
          cleanupFinal()
          cleanupError()
          cleanupClosed()
        }
      })

      // Send all the audio data
      // For large audio, we may need to send in chunks
      const CHUNK_SIZE = 32000 // ~32KB per chunk (smaller than typical WebSocket frame limit)

      // Decode base64 to bytes
      const binaryString = atob(audioBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Send in chunks
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, bytes.length)
        const chunk = bytes.slice(offset, end)

        // Convert chunk back to base64
        let binary = ''
        for (let i = 0; i < chunk.length; i++) {
          binary += String.fromCharCode(chunk[i])
        }
        const chunkBase64 = btoa(binary)

        await window.api.voice.qwenAsr.sendAudio(chunkBase64)
        console.log('[QwenASR] Sent retry audio chunk:', offset, '-', end, 'of', bytes.length)
      }

      // Commit to signal end of audio
      await window.api.voice.qwenAsr.commit()

      // Start idle detection now that all audio is sent
      startIdleDetection?.()

      // Wait for result
      const result = await transcriptionPromise

      // Stop the session
      await window.api.voice.qwenAsr.stop()

      return result || null
    } catch (error) {
      console.error('[QwenASR] Retry transcription error:', error)
      // Make sure to stop the session on error
      await window.api.voice.qwenAsr.stop().catch(() => {})
      throw error
    }
  }
}
