import type { VoiceRecognitionService, RecognitionOptions } from '../../types/voiceInput'

interface QwenASROptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  onError: (error: string) => void
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
  private processor: ScriptProcessorNode | null = null
  private isRunning = false
  private accumulatedText = ''
  private hasFinalResult = false // Track if we've already sent final result
  private options: QwenASROptions
  private interimCallback: ((text: string) => void) | null = null
  private finalCallback: ((text: string) => void) | null = null
  private errorCallback: ((error: string) => void) | null = null

  // IPC event cleanup functions
  private cleanupFunctions: Array<() => void> = []

  constructor(options: QwenASROptions) {
    this.options = options
    this.interimCallback = options.onInterimResult
    this.finalCallback = options.onFinalResult
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
    this.hasFinalResult = false

    try {
      // 1. Setup IPC event listeners first
      console.log('[QwenASR] Setting up IPC listeners...')
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
      // This will wait until session is ready before returning
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

      console.log('[QwenASR] Started via IPC proxy, starting audio capture')

      // 4. Start audio capture immediately after start() returns
      // (start() now waits for session to be ready)
      this.startAudioCapture()
    } catch (error) {
      console.error('[QwenASR] Start error:', error)
      this.errorCallback?.(error instanceof Error ? error.message : '启动失败')
      this.cleanup()
    }
  }

  private setupIPCListeners(): void {
    // Clean up any existing listeners
    this.cleanupIPCListeners()

    // Listen for ready event (for logging, audio capture is started after start() returns)
    const cleanupReady = window.api.voice.qwenAsr.onReady(() => {
      console.log('[QwenASR] Session ready event received')
    })
    this.cleanupFunctions.push(cleanupReady)

    // Listen for interim results
    const cleanupInterim = window.api.voice.qwenAsr.onInterim((data) => {
      this.accumulatedText += data.text
      this.interimCallback?.(this.accumulatedText)
    })
    this.cleanupFunctions.push(cleanupInterim)

    // Listen for final results
    const cleanupFinal = window.api.voice.qwenAsr.onFinal((data) => {
      if (!this.hasFinalResult) {
        this.hasFinalResult = true
        console.log('[QwenASR] Server final result:', data.text)
        this.finalCallback?.(data.text || this.accumulatedText)
      }
    })
    this.cleanupFunctions.push(cleanupFinal)

    // Listen for errors
    const cleanupError = window.api.voice.qwenAsr.onError((data) => {
      console.error('[QwenASR] Error from proxy:', data.error)
      this.errorCallback?.(data.error)
      this.cleanup()
    })
    this.cleanupFunctions.push(cleanupError)

    // Listen for connection closed
    const cleanupClosed = window.api.voice.qwenAsr.onClosed((data) => {
      console.log('[QwenASR] Connection closed:', data.code, data.reason)
      this.cleanup()
    })
    this.cleanupFunctions.push(cleanupClosed)
  }

  private cleanupIPCListeners(): void {
    this.cleanupFunctions.forEach(cleanup => cleanup())
    this.cleanupFunctions = []
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('[QwenASR] stop() called but not running')
      // Even if not running, trigger final callback to end "processing" state
      if (!this.hasFinalResult) {
        this.hasFinalResult = true
        this.finalCallback?.('')
      }
      return
    }

    console.log('[QwenASR] Stopping...')
    this.isRunning = false

    // Send commit signal via IPC to get final transcription
    window.api.voice.qwenAsr.commit().catch(console.error)

    // Give server time to process final audio
    // After timeout, trigger final result (if server hasn't already) and cleanup
    setTimeout(() => {
      // Only trigger if server hasn't sent final result
      if (!this.hasFinalResult) {
        this.hasFinalResult = true
        console.log('[QwenASR] Timeout final result:', this.accumulatedText || '(empty)')
        this.finalCallback?.(this.accumulatedText)
      }

      window.api.voice.qwenAsr.stop().catch(console.error)
      this.cleanup()
    }, 800) // Wait for server to send final result
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

  private startAudioCapture(): void {
    if (!this.mediaStream) return

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Use ScriptProcessor to get PCM data
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.processor.onaudioprocess = (event) => {
        if (!this.isRunning) return

        try {
          const inputData = event.inputBuffer.getChannelData(0)
          const pcm16 = this.floatTo16BitPCM(inputData)
          const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

          // Send audio data via IPC (fire and forget, don't await)
          window.api.voice.qwenAsr.sendAudio(base64Audio).catch((err) => {
            console.error('[QwenASR] Failed to send audio:', err)
          })
        } catch (err) {
          console.error('[QwenASR] Audio processing error:', err)
        }
      }

      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      console.log('[QwenASR] Audio capture started')
    } catch (error) {
      console.error('[QwenASR] Audio capture error:', error)
      this.errorCallback?.('音频采集失败')
    }
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
    // Use chunked approach to avoid call stack issues with large arrays
    const CHUNK_SIZE = 8192
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.byteLength))
      binary += String.fromCharCode.apply(null, chunk as unknown as number[])
    }
    return btoa(binary)
  }

  private cleanup(): void {
    console.log('[QwenASR] Cleaning up...')

    // Clean up IPC listeners
    this.cleanupIPCListeners()

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
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
  }

  // Check if service is running
  isActive(): boolean {
    return this.isRunning
  }
}
