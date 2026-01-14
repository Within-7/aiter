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
  /** Stop recording and return final result. Returns Promise for async result retrieval. */
  stop(): void | Promise<unknown>
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

// 语音转录消息 (旧格式，保留用于向后兼容迁移)
export interface VoiceTranscription {
  id: string
  text: string
  timestamp: number  // Unix timestamp for serialization
  source: 'inline' | 'panel'  // 来源：内联录音或面板录音
  projectId?: string  // 关联的项目 ID
  insertedTo?: 'terminal' | 'editor'  // 插入到哪里
}

// 语音记录文件格式 (旧格式，保留用于向后兼容迁移)
export interface VoiceNotesFile {
  version: 1
  projectPath: string
  notes: VoiceTranscription[]
  lastUpdated: number
}

// 语音记录存储路径常量
export const VOICE_NOTES_DIR = '.aiter'
export const VOICE_NOTES_FILENAME = 'voice-notes.json'  // 旧文件名，用于迁移
export const VOICE_RECORDS_FILENAME = 'voice-records.json'  // 新的统一文件名
export const AUDIO_BACKUPS_DIR = 'audio-backups'

// 语音记录状态
export type VoiceRecordStatus = 'transcribed' | 'recording' | 'pending' | 'retrying' | 'failed'

// 统一的语音记录类型 (合并 VoiceTranscription 和 VoiceBackup)
export interface VoiceRecord {
  id: string                    // 唯一 ID (通常是时间戳)
  timestamp: number             // 创建时间
  source: 'inline' | 'panel'    // 来源：内联录音或面板录音
  projectId?: string            // 关联项目 ID
  status: VoiceRecordStatus     // 状态

  // 已转录的字段
  text?: string                 // 转录文本 (status === 'transcribed' 时有值)
  insertedTo?: 'terminal' | 'editor'  // 插入到哪里

  // 待转录的字段 (status !== 'transcribed' 时有值)
  duration?: number             // 录音时长(秒)
  sampleRate?: number           // 采样率 (16000)
  retryCount?: number           // 重试次数
  lastError?: string            // 最后一次错误信息
}

// 统一的语音记录文件格式 (存储在 .aiter/voice-records.json)
export interface VoiceRecordsFile {
  version: 2                    // 版本 2 表示统一格式
  projectPath: string
  records: VoiceRecord[]
  lastUpdated: number
}

// 音频备份状态 (旧格式，保留用于向后兼容)
export type VoiceBackupStatus = 'recording' | 'pending' | 'retrying' | 'failed' | 'completed'

// 音频备份元数据 (旧格式，保留用于向后兼容)
export interface VoiceBackup {
  id: string                    // 时间戳 ID
  timestamp: number             // 创建时间
  projectId?: string            // 关联项目
  source: 'inline' | 'panel'    // 来源
  duration: number              // 录音时长(秒)
  sampleRate: number            // 采样率 (16000)
  status: VoiceBackupStatus     // 状态
  retryCount: number            // 重试次数
  lastError?: string            // 最后一次错误信息
}

// 音频备份文件 (旧格式，保留用于向后兼容迁移)
export interface VoiceBackupsIndex {
  version: 1
  backups: VoiceBackup[]
  lastUpdated: number
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
