import type { VoiceRecognitionService, RecognitionOptions } from '../../types/voiceInput'

interface QwenASROptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  /** Called when VAD detects end of speech segment (but recording continues) */
  onSegmentComplete?: (text: string) => void
  onError: (error: string) => void
}

/** Result returned when stopping recording */
export interface StopResult {
  text: string
  segments: string[]
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

  constructor(options: QwenASROptions) {
    this.options = options
    this.interimCallback = options.onInterimResult
    this.finalCallback = options.onFinalResult
    this.segmentCallback = options.onSegmentComplete || null
    this.errorCallback = options.onError
  }

  async start(options?: RecognitionOptions): Promise<void> {
    console.log('[QwenASR] start() called')

    if (this.isRunning) {
      console.warn('QwenASR is already running')
      return
    }

    this.isRunning = true
    this.accumulatedText = ''
    this.allSegments = []
    this.hasFinalResult = false
    this.userStopped = false
    this.cleanedUp = false
    this.mainSessionId = 0  // Reset, will be set after start() returns

    try {
      // 1. Setup IPC event listeners BEFORE start() to catch all events
      // The listeners will dynamically check this.mainSessionId
      this.setupIPCListeners()

      // 2. Get microphone permission
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

      // 3. Start WebSocket connection via main process
      // This returns the session ID assigned by main process
      console.log('[QwenASR] Starting WebSocket via IPC...')
      const result = await window.api.voice.qwenAsr.start({
        apiKey: this.options.apiKey,
        region: this.options.region,
        language: options?.language || this.options.language || 'zh'
      })

      // Check if stopped while waiting for WebSocket connection
      if (!this.isRunning) {
        console.log('[QwenASR] Stopped while waiting for WebSocket, aborting')
        window.api.voice.qwenAsr.stop().catch(console.error)
        this.cleanup()
        return
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to start ASR')
      }

      // Store the session ID from main process - used by IPC listeners to filter events
      this.mainSessionId = result.sessionId || 0
      console.log('[QwenASR] Started via IPC proxy, main session ID:', this.mainSessionId)

      // 4. Start audio capture immediately after start() returns
      await this.startAudioCapture()
    } catch (error) {
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
      console.error('[QwenASR] Error from proxy:', data.error)
      this.errorCallback?.(data.error)
      this.cleanup()
    })
    this.cleanupFunctions.push(cleanupError)

    // Listen for connection closed
    // Note: With connection reuse, closed events may indicate reconnection, not an error
    const cleanupClosed = window.api.voice.qwenAsr.onClosed((data) => {
      if (!isEventForThisSession(data?.sessionId)) {
        console.log('[QwenASR] Ignoring closed event for session:', data?.sessionId, 'expected:', this.mainSessionId)
        return
      }
      console.log('[QwenASR] Connection closed for session:', this.mainSessionId, data.code, data.reason)

      // Only cleanup if we're still running (unexpected closure)
      // If user stopped, cleanup will be handled by stop()
      if (this.isRunning && !this.userStopped) {
        console.log('[QwenASR] Unexpected connection closure, cleaning up')
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
      console.log('[QwenASR] Stopping session:', stoppingSessionId)
      this.isRunning = false
      this.userStopped = true // Mark that user explicitly stopped
      this.stopResolve = resolve // Store resolve function for onFinal handler

      // Send commit signal via IPC to get final transcription
      window.api.voice.qwenAsr.commit().catch(console.error)

      // Give server time to process final audio
      // After timeout, resolve with whatever we have and cleanup
      setTimeout(() => {
        // Only process if this is still the same session (user hasn't started a new recording)
        if (this.mainSessionId !== stoppingSessionId) {
          console.log('[QwenASR] Skipping timeout cleanup for old session:', stoppingSessionId, 'current:', this.mainSessionId)
          // Still need to stop the old WebSocket connection
          window.api.voice.qwenAsr.stop().catch(console.error)
          // Resolve with empty result for old session
          resolve({ text: '', segments: [] })
          return
        }

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
          resolve(result)
        }
        // If hasFinalResult is true, resolve was already called by onFinal handler

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

      // Connect nodes
      console.log('[QwenASR] Connecting audio nodes...')
      this.sourceNode.connect(this.workletNode)
      // Don't connect to destination - we don't need audio output

      console.log('[QwenASR] Audio capture started with AudioWorklet')
    } catch (error) {
      console.error('[QwenASR] Audio capture error:', error)

      // Fallback to ScriptProcessor if AudioWorklet fails
      console.log('[QwenASR] Falling back to ScriptProcessor...')
      this.startAudioCaptureWithScriptProcessor()
    }
  }

  private startAudioCaptureWithScriptProcessor(): void {
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
          const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

          window.api.voice.qwenAsr.sendAudio(base64Audio).catch((err) => {
            console.error('[QwenASR] Failed to send audio:', err)
          })
        } catch (err) {
          console.error('[QwenASR] Audio processing error:', err)
        }
      }

      source.connect(processor)
      processor.connect(this.audioContext.destination)

      console.log('[QwenASR] Audio capture started with ScriptProcessor (fallback)')
    } catch (error) {
      console.error('[QwenASR] ScriptProcessor fallback error:', error)
      this.errorCallback?.('音频采集失败')
    }
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

    // Clean up IPC listeners
    this.cleanupIPCListeners()

    if (this.workletNode) {
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
    this.accumulatedText = ''
    this.allSegments = []
    this.userStopped = false
  }

  // Check if service is running
  isActive(): boolean {
    return this.isRunning
  }
}
