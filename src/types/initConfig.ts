/**
 * AiTer Initialization Configuration Types
 *
 * 用户登录后获取的初始化配置类型定义
 * 版本: 1.0.0
 */

import type { AppSettings, ShortcutConfig } from './index'
import type { VoiceInputSettings } from './voiceInput'

// ============================================================================
// Main Config Interface
// ============================================================================

/**
 * AiTer 初始化配置
 */
export interface AiTerInitConfig {
  /** 配置版本号 */
  version: string

  /** 配置更新时间 (ISO 8601) */
  updatedAt: string

  /** 配置适用的 AiTer 最低版本 */
  minClientVersion?: string

  /** 模板配置 */
  templates?: TemplateConfig

  /** 插件配置 */
  plugins?: PluginConfig

  /** 应用设置 */
  settings?: SettingsConfig

  /** AI CLI 工具配置 */
  cliTools?: CLIToolsConfig

  /** 自定义脚本 */
  scripts?: ScriptsConfig
}

// ============================================================================
// Template Config
// ============================================================================

/**
 * 同步策略
 */
export type SyncPolicy = 'replace' | 'merge' | 'append'

/**
 * 模板配置
 */
export interface TemplateConfig {
  /** 是否启用模板同步 */
  enabled: boolean

  /** 同步策略 */
  syncPolicy: SyncPolicy

  /** 模板列表 */
  templates: TemplateDefinition[]
}

/**
 * 模板来源类型
 */
export type TemplateSourceType = 'url' | 'git' | 'inline'

/**
 * 模板来源
 */
export interface TemplateSource {
  /** 来源类型 */
  type: TemplateSourceType

  /** URL 或 Git 仓库地址 */
  url?: string

  /** Git 分支/标签 */
  ref?: string

  /** 内联文件内容 (type=inline 时) */
  files?: Record<string, string>
}

/**
 * 模板变量类型
 */
export type TemplateVariableType = 'string' | 'boolean' | 'select'

/**
 * 模板变量定义
 */
export interface TemplateVariable {
  /** 变量名 */
  name: string

  /** 显示标签 */
  label: string

  /** 变量类型 */
  type: TemplateVariableType

  /** 默认值 */
  default?: string | boolean

  /** 选项 (type=select 时) */
  options?: string[]

  /** 是否必填 */
  required?: boolean
}

/**
 * 模板定义
 */
export interface TemplateDefinition {
  /** 模板 ID */
  id: string

  /** 模板名称 */
  name: string

  /** 模板描述 */
  description?: string

  /** 模板图标 (emoji 或 URL) */
  icon?: string

  /** 模板分类 */
  category?: string

  /** 排序权重 */
  order?: number

  /** 模板来源 */
  source: TemplateSource

  /** 模板变量定义 */
  variables?: TemplateVariable[]

  /** 模板应用后的钩子脚本 */
  postApply?: string[]
}

// ============================================================================
// Plugin Config
// ============================================================================

/**
 * 插件配置
 */
export interface PluginConfig {
  /** 是否启用插件同步 */
  enabled: boolean

  /** 同步策略 */
  syncPolicy: SyncPolicy

  /** 需要安装的插件列表 */
  install: PluginInstallConfig[]

  /** 需要禁用的插件列表 */
  disable?: string[]

  /** 需要移除的插件列表 */
  remove?: string[]
}

/**
 * 插件安装配置
 */
export interface PluginInstallConfig {
  /** 插件 ID 或 npm 包名 */
  id: string

  /** 指定版本 */
  version?: string

  /** 是否启用 */
  enabled?: boolean

  /** 插件配置 */
  configuration?: Record<string, unknown>

  /** 安装优先级 (数字越小越先安装) */
  priority?: number

  /** 是否必须安装成功才继续 */
  required?: boolean
}

// ============================================================================
// Settings Config
// ============================================================================

/**
 * 设置配置
 */
export interface SettingsConfig {
  /** 是否启用设置同步 */
  enabled: boolean

  /** 同步策略 */
  syncPolicy: 'replace' | 'merge'

  /** 要同步的设置项 */
  includeKeys?: (keyof AppSettings)[]

  /** 要排除的设置项 */
  excludeKeys?: (keyof AppSettings)[]

  /** 设置值 */
  values: SettingsValues
}

/**
 * API Keys 配置
 */
export interface ApiKeysConfig {
  /** OpenAI API Key */
  openai?: string

  /** Anthropic API Key */
  anthropic?: string

  /** Google API Key */
  google?: string

  /** 自定义 API Keys */
  custom?: Record<string, string>
}

/**
 * 扩展的设置值 (包含敏感信息)
 */
export interface SettingsValues extends Partial<AppSettings> {
  /** 语音输入配置 */
  voiceInput?: VoiceInputSettings

  /** API Keys */
  apiKeys?: ApiKeysConfig
}

// ============================================================================
// CLI Tools Config
// ============================================================================

/**
 * CLI 工具配置
 */
export interface CLIToolsConfig {
  /** 是否启用 CLI 配置同步 */
  enabled: boolean

  /** 配置隔离设置 */
  isolation: CLIIsolationConfig

  /** CLI 工具配置列表 */
  tools: CLIToolConfig[]
}

/**
 * CLI 配置隔离设置
 */
export interface CLIIsolationConfig {
  /** 是否启用隔离 */
  enabled: boolean

  /** 基础路径 */
  basePath?: string
}

/**
 * 预定义的 CLI 工具 ID
 */
export type PredefinedCLIToolId = 'minto' | 'claude' | 'gemini' | 'cursor'

/**
 * CLI 工具配置
 */
export interface CLIToolConfig {
  /** 工具 ID */
  id: PredefinedCLIToolId | string

  /** 是否启用此工具配置 */
  enabled: boolean

  /** 配置文件列表 */
  configFiles: CLIConfigFile[]

  /** 环境变量设置 */
  envVars?: Record<string, string>
}

/**
 * CLI 配置文件内容类型
 */
export type CLIConfigContentType = 'json' | 'yaml' | 'toml' | 'text' | 'template'

/**
 * CLI 配置文件存在时的处理策略
 */
export type CLIConfigExistsPolicy = 'skip' | 'overwrite' | 'merge' | 'backup'

/**
 * CLI 配置文件内容
 */
export interface CLIConfigContent {
  /** 内容类型 */
  type: CLIConfigContentType

  /** 内联内容 */
  inline?: string | Record<string, unknown>

  /** 远程 URL */
  url?: string

  /** 模板变量 */
  variables?: Record<string, string>
}

/**
 * CLI 配置文件
 */
export interface CLIConfigFile {
  /** 目标路径 (支持变量) */
  path: string

  /** 文件内容 */
  content: CLIConfigContent

  /** 文件权限 (Unix) */
  mode?: string

  /** 已存在时的处理策略 */
  existsPolicy: CLIConfigExistsPolicy

  /** 仅在特定平台创建 */
  platforms?: NodeJS.Platform[]
}

// ============================================================================
// Scripts Config
// ============================================================================

/**
 * 脚本类型
 */
export type ScriptType = 'shell' | 'node' | 'python'

/**
 * 脚本触发时机
 */
export type ScriptTrigger = 'onLogin' | 'onConfigApply' | 'onPluginInstall' | 'manual'

/**
 * 脚本配置
 */
export interface ScriptsConfig {
  /** 是否启用脚本执行 */
  enabled: boolean

  /** 允许的脚本类型 */
  allowedTypes: ScriptType[]

  /** 脚本列表 */
  scripts: ScriptDefinition[]
}

/**
 * 脚本执行条件
 */
export interface ScriptCondition {
  /** 平台限制 */
  platform?: NodeJS.Platform[]

  /** 仅当文件不存在时执行 */
  onlyIfMissing?: string[]
}

/**
 * 脚本定义
 */
export interface ScriptDefinition {
  /** 脚本 ID */
  id: string

  /** 脚本名称 */
  name: string

  /** 执行时机 */
  trigger: ScriptTrigger

  /** 脚本类型 */
  type: ScriptType

  /** 脚本内容 */
  content: string

  /** 工作目录 */
  cwd?: string

  /** 超时时间 (秒) */
  timeout?: number

  /** 执行条件 */
  condition?: ScriptCondition
}

// ============================================================================
// Config Apply Result
// ============================================================================

/**
 * 单步应用状态
 */
export type ApplyStepStatus = 'success' | 'partial' | 'failed' | 'skipped'

/**
 * 单步应用结果
 */
export interface ApplyStepResult {
  /** 状态 */
  status: ApplyStepStatus

  /** 处理的项目数 */
  itemsProcessed: number

  /** 失败的项目数 */
  itemsFailed: number

  /** 详细信息 */
  details?: string[]
}

/**
 * 配置应用错误
 */
export interface ConfigApplyError {
  /** 步骤 */
  step: 'settings' | 'plugins' | 'cliTools' | 'templates' | 'scripts'

  /** 项目 */
  item: string

  /** 错误信息 */
  error: string

  /** 是否可恢复 */
  recoverable: boolean
}

/**
 * 配置应用结果
 */
export interface ConfigApplyResult {
  /** 是否成功 */
  success: boolean

  /** 配置版本 */
  version: string

  /** 各步骤结果 */
  results: {
    settings: ApplyStepResult
    plugins: ApplyStepResult
    cliTools: ApplyStepResult
    templates: ApplyStepResult
    scripts: ApplyStepResult
  }

  /** 错误列表 */
  errors: ConfigApplyError[]
}

/**
 * 配置应用进度
 */
export interface ConfigApplyProgress {
  /** 当前步骤 */
  step: 'settings' | 'plugins' | 'cliTools' | 'templates' | 'scripts'

  /** 当前项目 */
  item: string

  /** 进度 (0-100) */
  progress: number

  /** 状态信息 */
  message: string
}

// ============================================================================
// Variable Replacement
// ============================================================================

/**
 * 配置变量
 */
export interface ConfigVariables {
  /** 用户变量 */
  user: {
    id: string
    username: string
    email: string
    displayName: string
    organization?: string
  }

  /** API Keys */
  apiKeys: ApiKeysConfig

  /** 环境路径 */
  paths: {
    home: string
    aiterConfig: string
    xdgConfigHome: string
    xdgDataHome: string
  }

  /** 自定义变量 */
  custom?: Record<string, string>
}

/**
 * 路径变量
 * 用于 CLI 配置文件路径中的变量替换
 */
export const PATH_VARIABLES = {
  '$HOME': 'paths.home',
  '$AITER_CONFIG': 'paths.aiterConfig',
  '$XDG_CONFIG_HOME': 'paths.xdgConfigHome',
  '$XDG_DATA_HOME': 'paths.xdgDataHome'
} as const

/**
 * Mustache 风格变量
 * 用于配置内容中的变量替换
 */
export const MUSTACHE_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g
