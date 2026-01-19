# AiTer 登录系统与初始化配置设计

## 目录

1. [概述](#1-概述)
2. [系统架构](#2-系统架构)
3. [登录流程](#3-登录流程)
4. [初始化配置规范](#4-初始化配置规范)
5. [配置分发流程](#5-配置分发流程)
6. [安全考虑](#6-安全考虑)
7. [实现计划](#7-实现计划)

---

## 1. 概述

### 1.1 目标

为 AiTer 添加用户登录系统，实现：

1. **用户认证**：通过账号密码登录
2. **配置同步**：从服务端获取用户专属初始化配置
3. **自动配置**：根据配置自动完成以下设置：
   - 项目模板 (Templates)
   - 插件安装与配置 (Plugins)
   - 应用设置 (Settings)
   - 语音输入配置 (Voice Input)
   - AI CLI 工具本地配置文件 (Minto, Claude Code 等)

### 1.2 设计原则

- **渐进式**：登录可选，未登录用户仍可使用基础功能
- **离线优先**：配置下载后本地缓存，支持离线使用
- **非侵入式**：现有设置可被用户覆盖，配置同步不强制覆盖
- **安全性**：敏感信息（API Keys）加密存储，传输使用 HTTPS

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AiTer Client                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Login     │  │   Config    │  │  Settings   │  │   Plugin    ││
│  │   Manager   │──│   Applier   │──│   Manager   │──│   Manager   ││
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘│
│         │                │                                          │
│  ┌──────┴──────┐  ┌──────┴──────┐                                  │
│  │   Auth      │  │   CLI Tool  │                                  │
│  │   Store     │  │  Configurer │                                  │
│  └─────────────┘  └─────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AiTer Backend                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │    Auth     │  │   Config    │  │    User     │                 │
│  │   Service   │  │   Service   │  │   Service   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **LoginManager** | 处理登录/登出/Token 刷新 |
| **AuthStore** | 存储认证信息（Token、用户信息） |
| **ConfigApplier** | 解析并应用初始化配置 |
| **CLIToolConfigurer** | 创建 AI CLI 工具的本地配置文件 |

### 2.3 数据存储

```typescript
// auth-store.json (加密存储)
interface AuthStore {
  isLoggedIn: boolean
  user?: {
    id: string
    username: string
    email: string
    displayName: string
    avatar?: string
    plan: 'free' | 'pro' | 'enterprise'
    organization?: string
  }
  tokens?: {
    accessToken: string        // JWT, 短期有效
    refreshToken: string       // 长期有效，用于刷新 accessToken
    expiresAt: number          // accessToken 过期时间
  }
  lastConfigSync?: number      // 上次配置同步时间
  configVersion?: string       // 当前应用的配置版本
}
```

---

## 3. 登录流程

### 3.1 登录时序图

```
┌──────┐          ┌──────────────┐          ┌──────────────┐
│ User │          │    AiTer     │          │   Backend    │
└──┬───┘          └──────┬───────┘          └──────┬───────┘
   │                     │                         │
   │  1. 输入账号密码     │                         │
   │────────────────────>│                         │
   │                     │                         │
   │                     │  2. POST /auth/login    │
   │                     │────────────────────────>│
   │                     │                         │
   │                     │  3. 返回 Tokens + Config│
   │                     │<────────────────────────│
   │                     │                         │
   │                     │  4. 存储 Tokens         │
   │                     │─────┐                   │
   │                     │     │                   │
   │                     │<────┘                   │
   │                     │                         │
   │                     │  5. 应用初始化配置       │
   │                     │─────┐                   │
   │                     │     │ - Templates       │
   │                     │     │ - Plugins         │
   │                     │     │ - Settings        │
   │                     │     │ - CLI Configs     │
   │                     │<────┘                   │
   │                     │                         │
   │  6. 登录成功，进入主界面                       │
   │<────────────────────│                         │
   │                     │                         │
```

### 3.2 API 设计

#### 登录接口

```
POST /api/v1/auth/login

Request:
{
  "username": "string",      // 用户名或邮箱
  "password": "string",      // 密码 (客户端 hash 后传输)
  "deviceId": "string",      // 设备标识符
  "clientVersion": "string"  // AiTer 版本号
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "user_xxx",
      "username": "johndoe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatar": "https://...",
      "plan": "pro",
      "organization": "Acme Inc"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2...",
      "expiresIn": 3600  // 秒
    },
    "config": {
      // 完整的初始化配置（见第4节）
    }
  }
}
```

#### 刷新 Token

```
POST /api/v1/auth/refresh

Request:
{
  "refreshToken": "string"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

#### 获取最新配置

```
GET /api/v1/config

Headers:
  Authorization: Bearer <accessToken>

Query:
  ?currentVersion=1.0.0  // 当前配置版本，用于增量更新

Response:
{
  "success": true,
  "data": {
    "version": "1.0.1",
    "hasUpdate": true,
    "config": { ... }  // 完整或增量配置
  }
}
```

---

## 4. 初始化配置规范

### 4.1 配置总览

```typescript
/**
 * AiTer 初始化配置 (Initialization Config)
 *
 * 版本: 1.0.0
 * 用途: 定义用户登录后的完整初始化配置
 */
interface AiTerInitConfig {
  /** 配置版本号，用于增量更新 */
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

  /** 自定义脚本（高级） */
  scripts?: ScriptsConfig
}
```

### 4.2 模板配置 (TemplateConfig)

> **详细设计文档**: 完整的模板系统设计请参考 [TEMPLATE_SYSTEM_DESIGN.md](./TEMPLATE_SYSTEM_DESIGN.md)

模板是项目初始化的核心功能，支持完整的 AI CLI 配置生态系统：

- **AI CLI Plugins**: Agents, Skills, Commands, Hooks
- **MCP Servers**: 模型上下文协议服务器配置
- **项目规范**: CLAUDE.md / MINTO.md / AGENT.md
- **知识库**: 本地文档、示例代码、远程资源

```typescript
interface TemplateConfig {
  /** 是否启用模板同步 */
  enabled: boolean

  /** 同步策略 */
  syncPolicy: 'replace' | 'merge' | 'append'

  /** 模板列表 */
  templates: TemplateDefinition[]
}

interface TemplateDefinition {
  /** 模板 ID，唯一标识 */
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
  source: {
    /** 来源类型 */
    type: 'url' | 'git' | 'inline'

    /** URL 或 Git 仓库地址 */
    url?: string

    /** Git 分支/标签 */
    ref?: string

    /** 内联文件内容 (type=inline 时) */
    files?: Record<string, string>
  }

  /** 目标 AI CLI 工具 */
  targetCLI?: ('claude-code' | 'minto' | 'gemini')[]

  /** AI CLI 配置 (增强 v2 格式) */
  aiCli?: TemplateAICliConfig

  /** 知识库配置 */
  knowledge?: TemplateKnowledgeConfig

  /** 模板变量定义 */
  variables?: TemplateVariable[]

  /** 模板应用后的钩子脚本 */
  postApply?: string[]

  /** 项目依赖 */
  dependencies?: TemplateDependencies
}

interface TemplateVariable {
  name: string
  label: string
  type: 'string' | 'boolean' | 'select'
  default?: string | boolean
  options?: string[]  // type=select 时的选项
  required?: boolean
}

// AI CLI 配置 (详见 TEMPLATE_SYSTEM_DESIGN.md)
interface TemplateAICliConfig {
  plugins?: {
    agents?: TemplateAgentDefinition[]
    skills?: TemplateSkillDefinition[]
    commands?: TemplateCommandDefinition[]
    hooks?: TemplateHookDefinition[]
  }
  mcp?: { servers: TemplateMCPServer[] }
  prompts?: { system?: string; context?: string }
  memory?: { enabled: boolean; type: 'local' | 'cloud' }
  permissions?: { allowedTools?: string[]; bashWhitelist?: string[] }
}

// 知识库配置
interface TemplateKnowledgeConfig {
  enabled: boolean
  sources: Array<{
    type: 'local' | 'url' | 'git'
    path?: string
    url?: string
  }>
}
```

**示例：**

```json
{
  "templates": {
    "enabled": true,
    "syncPolicy": "merge",
    "templates": [
      {
        "id": "enterprise-research",
        "name": "企业研究模板",
        "description": "预配置的市场研究项目模板",
        "icon": "📊",
        "category": "enterprise",
        "order": 1,
        "source": {
          "type": "git",
          "url": "https://github.com/company/aiter-templates.git",
          "ref": "main"
        },
        "variables": [
          {
            "name": "PROJECT_NAME",
            "label": "项目名称",
            "type": "string",
            "required": true
          }
        ],
        "postApply": [
          "npm install"
        ]
      }
    ]
  }
}
```

### 4.3 插件配置 (PluginConfig)

```typescript
interface PluginConfig {
  /** 是否启用插件同步 */
  enabled: boolean

  /** 同步策略 */
  syncPolicy: 'replace' | 'merge' | 'append'

  /** 需要安装的插件列表 */
  install: PluginInstallConfig[]

  /** 需要禁用的插件列表 */
  disable?: string[]

  /** 需要移除的插件列表 */
  remove?: string[]
}

interface PluginInstallConfig {
  /** 插件 ID 或 npm 包名 */
  id: string

  /** 指定版本 (可选，默认 latest) */
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
```

**示例：**

```json
{
  "plugins": {
    "enabled": true,
    "syncPolicy": "merge",
    "install": [
      {
        "id": "minto",
        "enabled": true,
        "configuration": {
          "defaultModel": "gpt-4"
        },
        "priority": 1,
        "required": true
      },
      {
        "id": "@anthropic/claude-code",
        "version": "^1.0.0",
        "enabled": true,
        "priority": 2
      },
      {
        "id": "@company/internal-plugin",
        "version": "2.3.0",
        "enabled": true,
        "configuration": {
          "apiEndpoint": "https://internal.company.com/api"
        }
      }
    ],
    "disable": [
      "deprecated-plugin"
    ]
  }
}
```

### 4.4 应用设置 (SettingsConfig)

```typescript
interface SettingsConfig {
  /** 是否启用设置同步 */
  enabled: boolean

  /** 同步策略 */
  syncPolicy: 'replace' | 'merge'

  /** 要同步的设置项 (留空表示全部) */
  includeKeys?: (keyof AppSettings)[]

  /** 要排除的设置项 */
  excludeKeys?: (keyof AppSettings)[]

  /** 设置值 */
  values: Partial<AppSettings>
}

// AppSettings 扩展，包含敏感信息
interface AppSettingsWithSecrets extends AppSettings {
  /** 语音输入配置 (含 API Key) */
  voiceInput?: VoiceInputSettings & {
    qwenApiKey?: string
  }

  /** 其他 API Keys */
  apiKeys?: {
    openai?: string
    anthropic?: string
    google?: string
    custom?: Record<string, string>
  }
}
```

**示例：**

```json
{
  "settings": {
    "enabled": true,
    "syncPolicy": "merge",
    "excludeKeys": ["shortcuts"],
    "values": {
      "theme": "dark",
      "language": "zh-CN",
      "fontSize": 14,
      "terminalTheme": "dracula",
      "nodeSource": "builtin",
      "proxyMode": "off",

      "voiceInput": {
        "enabled": true,
        "provider": "qwen-asr",
        "qwenApiKey": "sk-xxx...",
        "qwenRegion": "cn",
        "language": "zh-CN",
        "pushToTalk": {
          "enabled": true,
          "triggerKey": "Alt",
          "minHoldDuration": 200
        }
      },

      "apiKeys": {
        "openai": "sk-xxx...",
        "anthropic": "sk-ant-xxx...",
        "custom": {
          "company-llm": "xxx..."
        }
      }
    }
  }
}
```

### 4.5 CLI 工具配置 (CLIToolsConfig)

```typescript
interface CLIToolsConfig {
  /** 是否启用 CLI 配置同步 */
  enabled: boolean

  /** 配置隔离模式 */
  isolation: {
    /** 是否启用隔离 */
    enabled: boolean
    /** 基础路径 (默认: ~/.aiter/config) */
    basePath?: string
  }

  /** CLI 工具配置列表 */
  tools: CLIToolConfig[]
}

interface CLIToolConfig {
  /** 工具 ID */
  id: 'minto' | 'claude' | 'gemini' | 'cursor' | string

  /** 是否启用此工具配置 */
  enabled: boolean

  /** 配置文件列表 */
  configFiles: CLIConfigFile[]

  /** 环境变量设置 */
  envVars?: Record<string, string>
}

interface CLIConfigFile {
  /** 目标路径 (支持变量: $HOME, $AITER_CONFIG, $XDG_CONFIG_HOME) */
  path: string

  /** 文件内容来源 */
  content: {
    /** 内容类型 */
    type: 'json' | 'yaml' | 'toml' | 'text' | 'template'

    /** 内联内容 */
    inline?: string | Record<string, unknown>

    /** 远程 URL */
    url?: string

    /** 模板变量 (type=template 时) */
    variables?: Record<string, string>
  }

  /** 文件权限 (Unix) */
  mode?: string  // e.g., '0600'

  /** 已存在时的处理策略 */
  existsPolicy: 'skip' | 'overwrite' | 'merge' | 'backup'

  /** 仅在特定平台创建 */
  platforms?: ('darwin' | 'win32' | 'linux')[]
}
```

**示例：**

```json
{
  "cliTools": {
    "enabled": true,
    "isolation": {
      "enabled": true,
      "basePath": "~/.aiter/config"
    },
    "tools": [
      {
        "id": "minto",
        "enabled": true,
        "configFiles": [
          {
            "path": "$AITER_CONFIG/minto/.minto.json",
            "content": {
              "type": "json",
              "inline": {
                "version": "1.0",
                "defaultModel": "gpt-4-turbo",
                "mcpServers": {
                  "brightdata": {
                    "command": "npx",
                    "args": ["-y", "@anthropic/mcp-server-brightdata"],
                    "env": {
                      "API_TOKEN": "{{BRIGHTDATA_TOKEN}}",
                      "no_proxy": "*"
                    }
                  }
                },
                "providers": {
                  "openai": {
                    "apiKey": "{{OPENAI_API_KEY}}"
                  }
                }
              }
            },
            "existsPolicy": "merge",
            "mode": "0600"
          }
        ],
        "envVars": {
          "MINTO_CONFIG_DIR": "$AITER_CONFIG/minto"
        }
      },
      {
        "id": "claude",
        "enabled": true,
        "configFiles": [
          {
            "path": "$AITER_CONFIG/claude/settings.json",
            "content": {
              "type": "json",
              "inline": {
                "apiKey": "{{ANTHROPIC_API_KEY}}",
                "model": "claude-3-opus-20240229",
                "maxTokens": 4096
              }
            },
            "existsPolicy": "merge",
            "mode": "0600"
          },
          {
            "path": "$AITER_CONFIG/claude/CLAUDE.md",
            "content": {
              "type": "template",
              "url": "https://config.aiter.app/templates/claude/CLAUDE.md",
              "variables": {
                "ORGANIZATION": "{{user.organization}}",
                "USERNAME": "{{user.displayName}}"
              }
            },
            "existsPolicy": "skip"
          }
        ],
        "envVars": {
          "CLAUDE_CONFIG_DIR": "$AITER_CONFIG/claude"
        }
      },
      {
        "id": "gemini",
        "enabled": false,
        "configFiles": [
          {
            "path": "$HOME/.gemini/config.json",
            "content": {
              "type": "json",
              "inline": {
                "apiKey": "{{GOOGLE_API_KEY}}"
              }
            },
            "existsPolicy": "skip",
            "mode": "0600"
          }
        ]
      }
    ]
  }
}
```

### 4.6 自定义脚本 (ScriptsConfig)

```typescript
interface ScriptsConfig {
  /** 是否启用脚本执行 */
  enabled: boolean

  /** 允许的脚本类型 */
  allowedTypes: ('shell' | 'node' | 'python')[]

  /** 脚本列表 */
  scripts: ScriptDefinition[]
}

interface ScriptDefinition {
  /** 脚本 ID */
  id: string

  /** 脚本名称 */
  name: string

  /** 执行时机 */
  trigger: 'onLogin' | 'onConfigApply' | 'onPluginInstall' | 'manual'

  /** 脚本类型 */
  type: 'shell' | 'node' | 'python'

  /** 脚本内容 */
  content: string

  /** 工作目录 */
  cwd?: string

  /** 超时时间 (秒) */
  timeout?: number

  /** 执行条件 */
  condition?: {
    platform?: ('darwin' | 'win32' | 'linux')[]
    onlyIfMissing?: string[]  // 文件路径列表
  }
}
```

**示例：**

```json
{
  "scripts": {
    "enabled": true,
    "allowedTypes": ["shell", "node"],
    "scripts": [
      {
        "id": "setup-git-config",
        "name": "配置 Git 用户信息",
        "trigger": "onLogin",
        "type": "shell",
        "content": "git config --global user.name '{{user.displayName}}' && git config --global user.email '{{user.email}}'",
        "condition": {
          "onlyIfMissing": ["~/.gitconfig"]
        }
      },
      {
        "id": "install-global-tools",
        "name": "安装全局 CLI 工具",
        "trigger": "onConfigApply",
        "type": "shell",
        "content": "npm install -g typescript ts-node",
        "timeout": 120
      }
    ]
  }
}
```

### 4.7 完整配置示例

```json
{
  "version": "1.0.0",
  "updatedAt": "2024-01-19T10:00:00Z",
  "minClientVersion": "0.2.0",

  "templates": {
    "enabled": true,
    "syncPolicy": "merge",
    "templates": [
      {
        "id": "enterprise-research",
        "name": "企业研究模板",
        "description": "预配置的市场研究项目模板",
        "icon": "📊",
        "category": "enterprise",
        "source": {
          "type": "git",
          "url": "https://github.com/company/aiter-templates.git",
          "ref": "v1.0.0"
        }
      }
    ]
  },

  "plugins": {
    "enabled": true,
    "syncPolicy": "merge",
    "install": [
      {
        "id": "minto",
        "enabled": true,
        "priority": 1,
        "required": true
      },
      {
        "id": "@company/internal-plugin",
        "version": "2.3.0",
        "enabled": true,
        "configuration": {
          "apiEndpoint": "https://internal.company.com/api"
        }
      }
    ]
  },

  "settings": {
    "enabled": true,
    "syncPolicy": "merge",
    "values": {
      "theme": "dark",
      "language": "zh-CN",
      "fontSize": 14,
      "terminalTheme": "dracula",

      "voiceInput": {
        "enabled": true,
        "provider": "qwen-asr",
        "qwenApiKey": "sk-xxx...",
        "qwenRegion": "cn",
        "language": "zh-CN"
      },

      "apiKeys": {
        "openai": "sk-xxx...",
        "anthropic": "sk-ant-xxx..."
      }
    }
  },

  "cliTools": {
    "enabled": true,
    "isolation": {
      "enabled": true,
      "basePath": "~/.aiter/config"
    },
    "tools": [
      {
        "id": "minto",
        "enabled": true,
        "configFiles": [
          {
            "path": "$AITER_CONFIG/minto/.minto.json",
            "content": {
              "type": "json",
              "inline": {
                "defaultModel": "gpt-4-turbo",
                "providers": {
                  "openai": {
                    "apiKey": "{{OPENAI_API_KEY}}"
                  }
                }
              }
            },
            "existsPolicy": "merge",
            "mode": "0600"
          }
        ],
        "envVars": {
          "MINTO_CONFIG_DIR": "$AITER_CONFIG/minto"
        }
      },
      {
        "id": "claude",
        "enabled": true,
        "configFiles": [
          {
            "path": "$AITER_CONFIG/claude/settings.json",
            "content": {
              "type": "json",
              "inline": {
                "apiKey": "{{ANTHROPIC_API_KEY}}"
              }
            },
            "existsPolicy": "merge",
            "mode": "0600"
          }
        ],
        "envVars": {
          "CLAUDE_CONFIG_DIR": "$AITER_CONFIG/claude"
        }
      }
    ]
  },

  "scripts": {
    "enabled": false,
    "allowedTypes": ["shell"],
    "scripts": []
  }
}
```

---

## 5. 配置分发流程

### 5.1 流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Config Apply Flow                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  解析配置 JSON   │
                    └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  版本兼容检查    │ ──── 不兼容 ───▶ 提示升级
                    └────────┬────────┘
                              │ 兼容
                              ▼
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 1. 应用 Settings│  │ 2. 安装 Plugins │  │ 3. 配置 CLI     │
│   (同步)        │  │   (异步+进度)   │  │   (异步)        │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    ▼                    │
         │           ┌─────────────────┐           │
         │           │ 4. 下载 Templates│           │
         │           │   (异步+进度)   │           │
         │           └────────┬────────┘           │
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ 5. 执行 Scripts │
                    │   (如果启用)    │
                    └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  6. 完成，保存   │
                    │  configVersion  │
                    └─────────────────┘
```

### 5.2 变量替换

配置中支持以下变量：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{{user.id}}` | 用户 ID | `user_xxx` |
| `{{user.username}}` | 用户名 | `johndoe` |
| `{{user.email}}` | 邮箱 | `john@example.com` |
| `{{user.displayName}}` | 显示名称 | `John Doe` |
| `{{user.organization}}` | 组织名 | `Acme Inc` |
| `{{OPENAI_API_KEY}}` | OpenAI API Key | `sk-xxx` |
| `{{ANTHROPIC_API_KEY}}` | Anthropic API Key | `sk-ant-xxx` |
| `{{GOOGLE_API_KEY}}` | Google API Key | `xxx` |
| `{{BRIGHTDATA_TOKEN}}` | BrightData Token | `xxx` |
| `$HOME` | 用户主目录 | `/Users/john` |
| `$AITER_CONFIG` | AiTer 配置目录 | `~/.aiter/config` |
| `$XDG_CONFIG_HOME` | XDG 配置目录 | `~/.config` |

### 5.3 错误处理

```typescript
interface ConfigApplyResult {
  success: boolean
  version: string
  results: {
    settings: ApplyStepResult
    plugins: ApplyStepResult
    cliTools: ApplyStepResult
    templates: ApplyStepResult
    scripts: ApplyStepResult
  }
  errors: ConfigApplyError[]
}

interface ApplyStepResult {
  status: 'success' | 'partial' | 'failed' | 'skipped'
  itemsProcessed: number
  itemsFailed: number
  details?: string[]
}

interface ConfigApplyError {
  step: 'settings' | 'plugins' | 'cliTools' | 'templates' | 'scripts'
  item: string
  error: string
  recoverable: boolean
}
```

---

## 6. 安全考虑

### 6.1 敏感信息处理

1. **传输安全**
   - 所有 API 通信使用 HTTPS
   - 密码在客户端使用 PBKDF2 + Salt 哈希后传输

2. **本地存储**
   - API Keys 使用 `safeStorage` (Electron) 加密存储
   - Token 存储在独立的加密文件中
   - 配置文件权限设置为 `0600` (仅用户可读)

3. **内存安全**
   - 敏感信息使用后及时清除
   - 不在日志中输出敏感信息

### 6.2 脚本执行安全

1. **白名单限制**
   - 仅允许 `shell`, `node`, `python` 类型
   - 脚本需要用户确认才能执行

2. **沙箱执行**
   - 脚本在受限环境中执行
   - 设置执行超时

3. **审计日志**
   - 记录所有脚本执行历史
   - 支持回滚

### 6.3 Token 管理

1. **Access Token**
   - 短期有效 (1小时)
   - 每次 API 请求都携带
   - 过期后自动使用 Refresh Token 刷新

2. **Refresh Token**
   - 长期有效 (30天)
   - 仅用于刷新 Access Token
   - 支持撤销

---

## 7. 实现计划

### Phase 1: 基础登录 (MVP)

- [ ] 登录 UI 组件
- [ ] LoginManager 实现
- [ ] AuthStore 实现
- [ ] 基础 API 集成
- [ ] Token 管理

### Phase 2: 配置同步

- [ ] ConfigApplier 实现
- [ ] Settings 同步
- [ ] Plugin 自动安装
- [ ] CLI 配置文件创建

### Phase 3: 高级功能

- [ ] Template 同步
- [ ] Scripts 执行
- [ ] 增量配置更新
- [ ] 离线缓存

### Phase 4: 企业功能

- [ ] SSO 集成
- [ ] 组织级配置
- [ ] 审计日志
- [ ] 配置版本控制

---

## 附录

### A. 类型定义文件位置

创建新文件：
- `src/types/auth.ts` - 认证相关类型
- `src/types/initConfig.ts` - 初始化配置类型
- `src/main/auth/LoginManager.ts` - 登录管理器
- `src/main/auth/AuthStore.ts` - 认证存储
- `src/main/config/ConfigApplier.ts` - 配置应用器
- `src/main/config/CLIToolConfigurer.ts` - CLI 配置器

### B. IPC 通道命名

```typescript
// Auth
'auth:login'
'auth:logout'
'auth:refresh'
'auth:getStatus'
'auth:onStatusChanged'

// Config
'config:apply'
'config:getLatest'
'config:reset'
'config:onApplyProgress'
```

### C. 事件命名

```typescript
// Auth events
'auth:logged-in'
'auth:logged-out'
'auth:token-refreshed'
'auth:session-expired'

// Config events
'config:apply-started'
'config:apply-progress'
'config:apply-completed'
'config:apply-failed'
```
