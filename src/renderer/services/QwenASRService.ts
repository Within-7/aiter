import type { VoiceRecognitionService, RecognitionOptions } from '../../types/voiceInput'

interface QwenASROptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  onError: (error: string) => void
}

export class QwenASRService implements VoiceRecognitionService {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private isRunning = false
  private accumulatedText = ''
  private options: QwenASROptions
  private interimCallback: ((text: string) => void) | null = null
  private finalCallback: ((text: string) => void) | null = null
  private errorCallback: ((error: string) => void) | null = null

  private readonly model = 'qwen2-audio-asr-realtime'

  constructor(options: QwenASROptions) {
    this.options = options
    this.interimCallback = options.onInterimResult
    this.finalCallback = options.onFinalResult
    this.errorCallback = options.onError
  }

  private getBaseUrl(): string {
    return this.options.region === 'intl'
      ? 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime'
      : 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'
  }

  async start(options?: RecognitionOptions): Promise<void> {
    if (this.isRunning) {
      console.warn('QwenASR is already running')
      return
    }

    this.isRunning = true
    this.accumulatedText = ''

    try {
      // 1. 先获取麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      // 2. 建立 WebSocket 连接
      const url = `${this.getBaseUrl()}?model=${this.model}`
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[QwenASR] WebSocket connected')
        this.sendSessionUpdate(options?.language || this.options.language || 'zh')
        this.startAudioCapture()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (e) {
          console.error('[QwenASR] Failed to parse message:', e)
        }
      }

      this.ws.onerror = (err) => {
        console.error('[QwenASR] WebSocket error:', err)
        this.errorCallback?.('WebSocket 连接错误')
        this.cleanup()
      }

      this.ws.onclose = (event) => {
        console.log('[QwenASR] WebSocket closed:', event.code, event.reason)
        this.cleanup()
      }
    } catch (error) {
      console.error('[QwenASR] Start error:', error)
      this.errorCallback?.(error instanceof Error ? error.message : '启动失败')
      this.cleanup()
    }
  }

  stop(): void {
    if (!this.isRunning) return

    console.log('[QwenASR] Stopping...')
    this.isRunning = false

    // 发送结束信号
    if (this.ws?.readyState === WebSocket.OPEN) {
      const commitEvent = {
        event_id: `event_commit_${Date.now()}`,
        type: 'input_audio_buffer.commit'
      }
      this.ws.send(JSON.stringify(commitEvent))

      // 给服务器一点时间处理最后的音频
      setTimeout(() => {
        this.cleanup()
      }, 500)
    } else {
      this.cleanup()
    }
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

  private sendSessionUpdate(language: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    const sessionConfig = {
      event_id: 'event_session',
      type: 'session.update',
      session: {
        modalities: ['text'],
        input_audio_format: 'pcm',
        sample_rate: 16000,
        input_audio_transcription: {
          language: language
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 500
        }
      }
    }

    // 先发送鉴权
    const authHeader = {
      event_id: 'event_auth',
      type: 'session.update',
      session: {
        ...sessionConfig.session
      }
    }

    // Qwen ASR 使用 Authorization header，但 WebSocket 不支持自定义 header
    // 所以通过 URL 参数或首条消息发送
    this.ws.send(JSON.stringify({
      ...sessionConfig,
      authorization: `Bearer ${this.options.apiKey}`
    }))
  }

  private startAudioCapture(): void {
    if (!this.mediaStream) return

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // 使用 ScriptProcessor 获取 PCM 数据
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.processor.onaudioprocess = (event) => {
        if (!this.isRunning || this.ws?.readyState !== WebSocket.OPEN) return

        const inputData = event.inputBuffer.getChannelData(0)
        const pcm16 = this.floatTo16BitPCM(inputData)
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

        // 发送音频数据
        const appendEvent = {
          event_id: `event_audio_${Date.now()}`,
          type: 'input_audio_buffer.append',
          audio: base64Audio
        }
        this.ws?.send(JSON.stringify(appendEvent))
      }

      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      console.log('[QwenASR] Audio capture started')
    } catch (error) {
      console.error('[QwenASR] Audio capture error:', error)
      this.errorCallback?.('音频采集失败')
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        console.log('[QwenASR] Session ready')
        break

      case 'conversation.item.input_audio_transcription.delta':
        if (data.delta) {
          this.accumulatedText += data.delta
          this.interimCallback?.(this.accumulatedText)
        }
        break

      case 'conversation.item.input_audio_transcription.completed':
        if (data.transcript) {
          this.finalCallback?.(data.transcript)
        } else if (this.accumulatedText) {
          this.finalCallback?.(this.accumulatedText)
        }
        break

      case 'error':
        const errorMsg = data.error?.message || '识别错误'
        console.error('[QwenASR] Error:', errorMsg)
        this.errorCallback?.(errorMsg)
        break

      default:
        console.log('[QwenASR] Unhandled message type:', data.type)
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

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Normal closure')
      }
      this.ws = null
    }

    this.isRunning = false
    this.accumulatedText = ''
  }

  // 检查服务是否正在运行
  isActive(): boolean {
    return this.isRunning
  }
}
