import type {
  VoiceProvider,
  VoiceInputState,
  VoiceRecognitionService,
  RecognitionOptions,
  VoiceInputSettings
} from '../../types/voiceInput'
import { QwenASRService, StopResult } from './QwenASRService'

interface VoiceInputManagerOptions {
  settings: VoiceInputSettings
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  onError: (error: string) => void
  onStateChange: (state: VoiceInputState) => void
}

export class VoiceInputManager {
  private service: VoiceRecognitionService | null = null
  private options: VoiceInputManagerOptions
  private currentState: VoiceInputState = 'idle'

  constructor(options: VoiceInputManagerOptions) {
    this.options = options
    this.initService()
  }

  private initService(): void {
    const { settings } = this.options

    // 清理旧服务
    this.service = null

    // 确定实际使用的 provider
    let actualProvider = settings.provider

    if (settings.provider === 'qwen-asr') {
      if (!settings.qwenApiKey) {
        console.warn('[VoiceInputManager] Qwen-ASR requires API key, falling back to system')
        actualProvider = 'system'
      } else {
        this.service = new QwenASRService({
          apiKey: settings.qwenApiKey,
          region: settings.qwenRegion || 'cn',
          language: settings.language,
          onInterimResult: (text) => {
            this.options.onInterimResult(text)
          },
          onFinalResult: (text) => {
            this.setState('idle')
            this.options.onFinalResult(text)
          },
          onError: (error) => {
            this.setState('error')
            this.options.onError(error)
          }
        })
        return
      }
    }

    if (actualProvider === 'system') {
      // 使用 Web Speech API 作为系统原生方案
      this.initWebSpeechAPI()
    }
  }

  private initWebSpeechAPI(): void {
    // Web Speech API 作为系统原生的临时后备方案
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.error('[VoiceInputManager] Web Speech API not supported')
      this.options.onError('浏览器不支持语音识别，请配置 Qwen-ASR API Key')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = this.options.settings.interimResults
    recognition.lang = this.options.settings.language

    // 包装为 VoiceRecognitionService 接口
    this.service = {
      start: async () => {
        recognition.start()
      },
      stop: () => {
        recognition.stop()
      },
      onInterimResult: (callback) => {
        // 已在构造函数中设置
      },
      onFinalResult: (callback) => {
        // 已在构造函数中设置
      },
      onError: (callback) => {
        // 已在构造函数中设置
      }
    }

    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex]
      const text = result[0].transcript

      if (result.isFinal) {
        this.setState('idle')
        this.options.onFinalResult(text)
      } else {
        this.options.onInterimResult(text)
      }
    }

    recognition.onerror = (event: any) => {
      this.setState('error')
      // 提供更友好的错误提示
      const errorMessages: Record<string, string> = {
        'network': '网络错误，请检查网络连接或配置 Qwen-ASR API Key',
        'not-allowed': '麦克风权限被拒绝，请在系统设置中允许访问麦克风',
        'no-speech': '未检测到语音',
        'audio-capture': '无法访问麦克风',
        'aborted': '识别被中断'
      }
      this.options.onError(errorMessages[event.error] || `语音识别错误: ${event.error}`)
    }

    recognition.onend = () => {
      if (this.currentState === 'recording') {
        // 意外结束，尝试重启
        console.log('[VoiceInputManager] Recognition ended unexpectedly')
      }
    }
  }

  private setState(state: VoiceInputState): void {
    this.currentState = state
    this.options.onStateChange(state)
  }

  async start(): Promise<void> {
    if (!this.service) {
      this.options.onError('语音识别服务未初始化')
      return
    }

    if (this.currentState === 'recording') {
      console.warn('[VoiceInputManager] Already recording')
      return
    }

    try {
      this.setState('recording')
      await this.service.start({
        language: this.options.settings.language,
        interimResults: this.options.settings.interimResults
      })
    } catch (error) {
      this.setState('error')
      this.options.onError(error instanceof Error ? error.message : '启动失败')
    }
  }

  /**
   * Stop recording and return the final transcription.
   * Returns a Promise that resolves with the final text when available.
   */
  async stop(): Promise<StopResult | null> {
    if (this.currentState !== 'recording') {
      return null
    }

    this.setState('processing')

    // QwenASRService.stop() returns a Promise<StopResult>
    // Web Speech API stop() returns void
    const stopResult = this.service?.stop()

    // If stop() returns a Promise (QwenASR), await it; otherwise return null (Web Speech)
    if (stopResult && typeof (stopResult as Promise<StopResult>).then === 'function') {
      const result = await (stopResult as Promise<StopResult>)
      return result || null
    }

    return null
  }

  // 切换引擎
  switchProvider(provider: VoiceProvider): void {
    this.options.settings.provider = provider
    this.initService()
  }

  // 更新设置
  updateSettings(settings: Partial<VoiceInputSettings>): void {
    this.options.settings = { ...this.options.settings, ...settings }

    // 如果切换了 provider，需要重新初始化服务
    if (settings.provider || settings.qwenApiKey || settings.qwenRegion) {
      this.initService()
    }
  }

  // 获取当前状态
  getState(): VoiceInputState {
    return this.currentState
  }

  // 检查是否可用
  isAvailable(): boolean {
    return this.service !== null
  }

  // 获取当前使用的引擎
  getProvider(): VoiceProvider {
    return this.options.settings.provider
  }

  // 销毁
  destroy(): void {
    if (this.currentState === 'recording') {
      this.service?.stop()
    }
    this.service = null
  }
}
