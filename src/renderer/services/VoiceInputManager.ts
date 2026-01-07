import type {
  VoiceProvider,
  VoiceInputState,
  VoiceRecognitionService,
  RecognitionOptions,
  VoiceInputSettings
} from '../../types/voiceInput'
import { QwenASRService } from './QwenASRService'

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

    if (settings.provider === 'qwen-asr') {
      if (!settings.qwenApiKey) {
        console.warn('[VoiceInputManager] Qwen-ASR requires API key')
        return
      }

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
    } else if (settings.provider === 'system') {
      // TODO: 实现系统原生语音识别
      // 暂时使用 Web Speech API 作为后备
      console.warn('[VoiceInputManager] System provider not yet implemented, using Web Speech API')
      this.initWebSpeechAPI()
    }
  }

  private initWebSpeechAPI(): void {
    // Web Speech API 作为系统原生的临时后备方案
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.error('[VoiceInputManager] Web Speech API not supported')
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
      this.options.onError(event.error)
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

  stop(): void {
    if (this.currentState !== 'recording') {
      return
    }

    this.setState('processing')
    this.service?.stop()
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
