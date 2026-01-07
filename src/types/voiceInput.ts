// 语音识别引擎类型
export type VoiceProvider = 'system' | 'qwen-asr'

// 语音输入状态
export type VoiceInputState = 'idle' | 'recording' | 'processing' | 'error'

// 识别结果
export interface RecognitionResult {
  text: string
  isFinal: boolean
  confidence?: number
}

// 识别选项
export interface RecognitionOptions {
  language: string
  continuous?: boolean
  interimResults?: boolean
}

// 语音识别服务接口
export interface VoiceRecognitionService {
  start(options: RecognitionOptions): Promise<void>
  stop(): void
  onInterimResult(callback: (text: string) => void): void
  onFinalResult(callback: (text: string) => void): void
  onError(callback: (error: string) => void): void
}

// Qwen-ASR 配置
export interface QwenASRConfig {
  apiKey: string
  region: 'cn' | 'intl'
  model?: string
}

// Push-to-Talk 配置
export interface PushToTalkConfig {
  enabled: boolean
  triggerKey: 'Alt' | 'Meta' | 'Control' | string
  minHoldDuration: number
}

// 切换模式配置
export interface ToggleModeConfig {
  enabled: boolean
  shortcut: {
    key: string
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  }
}

// 语音输入设置（将集成到 AppSettings）
export interface VoiceInputSettings {
  enabled: boolean
  provider: VoiceProvider
  pushToTalk: PushToTalkConfig
  toggleMode: ToggleModeConfig
  language: string
  interimResults: boolean
  autoExecuteInTerminal: boolean
  enableVoiceCommands: boolean
  qwenApiKey?: string
  qwenRegion?: 'cn' | 'intl'
  silenceTimeout: number
}

// 默认语音输入设置
export const defaultVoiceInputSettings: VoiceInputSettings = {
  enabled: false,
  provider: 'qwen-asr',
  pushToTalk: {
    enabled: true,
    triggerKey: 'Alt',
    minHoldDuration: 200
  },
  toggleMode: {
    enabled: false,
    shortcut: {
      key: 'v',
      metaKey: true,
      shiftKey: true
    }
  },
  language: 'zh-CN',
  interimResults: true,
  autoExecuteInTerminal: false,
  enableVoiceCommands: true,
  qwenRegion: 'cn',
  silenceTimeout: 1500
}
