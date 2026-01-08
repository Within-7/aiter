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
    if (this.isRunning) {
      console.warn('QwenASR is already running')
      return
    }

    this.isRunning = true
    this.accumulatedText = ''

    try {
      // 1. Setup IPC event listeners first
      this.setupIPCListeners()

      // 2. Get microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      // 3. Start WebSocket connection via main process
      const result = await window.api.voice.qwenAsr.start({
        apiKey: this.options.apiKey,
        region: this.options.region,
        language: options?.language || this.options.language || 'zh'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to start ASR')
      }

      console.log('[QwenASR] Started via IPC proxy')
    } catch (error) {
      console.error('[QwenASR] Start error:', error)
      this.errorCallback?.(error instanceof Error ? error.message : '启动失败')
      this.cleanup()
    }
  }

  private setupIPCListeners(): void {
    // Clean up any existing listeners
    this.cleanupIPCListeners()

    // Listen for ready event to start audio capture
    const cleanupReady = window.api.voice.qwenAsr.onReady(() => {
      console.log('[QwenASR] Session ready, starting audio capture')
      this.startAudioCapture()
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
      this.finalCallback?.(data.text || this.accumulatedText)
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
    if (!this.isRunning) return

    console.log('[QwenASR] Stopping...')
    this.isRunning = false

    // Send commit signal via IPC
    window.api.voice.qwenAsr.commit().catch(console.error)

    // Give server time to process final audio
    setTimeout(() => {
      window.api.voice.qwenAsr.stop().catch(console.error)
      this.cleanup()
    }, 500)
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

        const inputData = event.inputBuffer.getChannelData(0)
        const pcm16 = this.floatTo16BitPCM(inputData)
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

        // Send audio data via IPC
        window.api.voice.qwenAsr.sendAudio(base64Audio).catch(console.error)
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
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
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
