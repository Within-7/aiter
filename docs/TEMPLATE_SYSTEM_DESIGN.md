# AiTer Template System Design

## 概述

AiTer Template 系统是项目初始化的核心功能，提供完整的 AI CLI 配置生态系统支持。模板不仅包含基础项目文件，还包含 AI CLI 工具的完整配置体系。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Template System                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      │
│  │  Template   │   │   Project   │   │  AI CLI     │      │
│  │  Manager    │──▶│   Files     │   │  Config     │      │
│  └─────────────┘   └─────────────┘   └─────────────┘      │
│        │                                    │               │
│        │           ┌─────────────────────────┘              │
│        │           ▼                                        │
│        │    ┌─────────────────────────────────────┐        │
│        │    │         AI CLI Ecosystem            │        │
│        │    ├─────────────────────────────────────┤        │
│        │    │  ┌───────┐ ┌───────┐ ┌───────┐     │        │
│        │    │  │Plugins│ │ MCP   │ │ Hooks │     │        │
│        │    │  │Agents │ │Servers│ │       │     │        │
│        │    │  │Skills │ │       │ │       │     │        │
│        │    │  └───────┘ └───────┘ └───────┘     │        │
│        │    │  ┌───────┐ ┌───────┐ ┌───────┐     │        │
│        │    │  │Prompts│ │Memory │ │Permis-│     │        │
│        │    │  │       │ │       │ │sions  │     │        │
│        │    │  └───────┘ └───────┘ └───────┘     │        │
│        │    └─────────────────────────────────────┘        │
│        ▼                                                    │
│  ┌──────────────────────────────────────────────────┐      │
│  │              Project Spec Files                   │      │
│  ├──────────────────────────────────────────────────┤      │
│  │  CLAUDE.md │ MINTO.md │ AGENT.md │ RULES.md     │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 模板结构设计

### 完整模板目录结构

```
template-id/
├── template.json                    # 模板元数据和配置
├── files/                           # 项目文件模板
│   ├── CLAUDE.md                    # Claude Code CLI 项目规范
│   ├── MINTO.md                     # Minto CLI 项目规范
│   ├── AGENT.md                     # 通用 Agent 规范
│   ├── PROJECT_INDEX.md             # 项目索引
│   ├── README.md                    # 项目说明
│   └── ...                          # 其他项目文件
├── ai-cli/                          # AI CLI 配置
│   ├── plugins/                     # 插件配置
│   │   ├── agents/                  # Agent 定义
│   │   │   └── *.md                 # Agent prompt 文件
│   │   ├── skills/                  # Skill 定义
│   │   │   └── *.md                 # Skill prompt 文件
│   │   ├── commands/                # 自定义命令
│   │   │   └── *.json               # Command 配置
│   │   └── hooks/                   # Hook 脚本
│   │       └── *.sh / *.js          # Hook 实现
│   ├── mcp/                         # MCP Server 配置
│   │   └── mcp-config.json          # MCP 服务器配置
│   ├── prompts/                     # 系统提示词
│   │   ├── system.md                # 系统级提示
│   │   └── context.md               # 上下文提示
│   ├── memory/                      # 记忆配置
│   │   └── memory-config.json       # 记忆系统配置
│   └── permissions/                 # 权限配置
│       └── allowed-tools.json       # 工具权限
├── knowledge/                       # 知识库
│   ├── docs/                        # 文档知识
│   │   └── *.md                     # Markdown 文档
│   ├── examples/                    # 示例代码
│   │   └── *.*                      # 各种示例文件
│   └── references/                  # 参考资料
│       └── *.md                     # 参考文档
└── scripts/                         # 初始化脚本
    ├── setup.sh                     # Unix 安装脚本
    ├── setup.ps1                    # Windows 安装脚本
    └── post-apply.js                # 后处理脚本
```

## Template JSON Schema

### template.json 完整规范

```json
{
  "$schema": "https://aiter.app/schemas/template-v2.json",
  "version": "2.0.0",
  "id": "string",
  "name": "string",
  "description": "string",
  "icon": "string (emoji or URL)",
  "category": "basic | work | development | enterprise",
  "order": "number",
  "author": "string",
  "license": "string",
  "tags": ["string"],
  "requiredLicense": "free | pro | enterprise",

  "targetCLI": ["claude-code", "minto", "gemini"],

  "files": {
    "include": ["**/*"],
    "exclude": ["*.tmp", "node_modules/**"],
    "rename": {
      "_gitignore": ".gitignore",
      "_env.template": ".env"
    }
  },

  "variables": [
    {
      "name": "PROJECT_NAME",
      "type": "string",
      "label": "Project Name",
      "default": "",
      "required": true,
      "description": "Name of the project"
    },
    {
      "name": "AUTHOR",
      "type": "string",
      "label": "Author",
      "default": "{{user.displayName}}",
      "required": false
    },
    {
      "name": "USE_TYPESCRIPT",
      "type": "boolean",
      "label": "Use TypeScript",
      "default": true
    },
    {
      "name": "FRAMEWORK",
      "type": "select",
      "label": "Framework",
      "options": ["react", "vue", "angular", "none"],
      "default": "react"
    }
  ],

  "aiCli": {
    "plugins": {
      "agents": [
        {
          "id": "code-reviewer",
          "name": "Code Reviewer",
          "description": "Reviews code for quality and best practices",
          "promptFile": "ai-cli/plugins/agents/code-reviewer.md",
          "tools": ["Read", "Glob", "Grep"]
        }
      ],
      "skills": [
        {
          "id": "commit",
          "name": "Git Commit",
          "description": "Smart git commit with conventional messages",
          "promptFile": "ai-cli/plugins/skills/commit.md",
          "trigger": "/commit"
        }
      ],
      "commands": [
        {
          "id": "test-coverage",
          "name": "Test Coverage",
          "description": "Run tests and report coverage",
          "configFile": "ai-cli/plugins/commands/test-coverage.json"
        }
      ],
      "hooks": [
        {
          "id": "pre-commit",
          "event": "beforeCommit",
          "scriptFile": "ai-cli/plugins/hooks/pre-commit.sh",
          "platforms": ["darwin", "linux"]
        }
      ]
    },

    "mcp": {
      "servers": [
        {
          "id": "filesystem",
          "name": "Filesystem MCP",
          "command": "npx",
          "args": ["-y", "@anthropic/mcp-server-filesystem", "{{PROJECT_PATH}}"],
          "enabled": true
        },
        {
          "id": "github",
          "name": "GitHub MCP",
          "command": "npx",
          "args": ["-y", "@anthropic/mcp-server-github"],
          "env": {
            "GITHUB_TOKEN": "{{apiKeys.github}}"
          },
          "enabled": false,
          "requiredKeys": ["apiKeys.github"]
        }
      ]
    },

    "prompts": {
      "system": "ai-cli/prompts/system.md",
      "context": "ai-cli/prompts/context.md"
    },

    "memory": {
      "enabled": true,
      "type": "local",
      "maxItems": 100,
      "persistPath": ".ai-memory/"
    },

    "permissions": {
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "deniedTools": [],
      "bashWhitelist": ["npm", "git", "node", "python"],
      "bashBlacklist": ["rm -rf /"],
      "autoApprove": {
        "fileOperations": true,
        "bashCommands": false
      }
    }
  },

  "knowledge": {
    "enabled": true,
    "sources": [
      {
        "type": "local",
        "path": "knowledge/docs/**/*.md",
        "description": "Project documentation"
      },
      {
        "type": "local",
        "path": "knowledge/examples/**/*",
        "description": "Code examples"
      },
      {
        "type": "url",
        "url": "https://docs.example.com/api.md",
        "cache": true,
        "description": "API Documentation"
      }
    ],
    "embeddings": {
      "enabled": false,
      "model": "text-embedding-3-small",
      "chunkSize": 1000
    }
  },

  "postApply": {
    "scripts": [
      {
        "type": "shell",
        "command": "npm install",
        "condition": "file:package.json",
        "platforms": ["darwin", "linux", "win32"]
      },
      {
        "type": "shell",
        "command": "git init && git add -A && git commit -m 'Initial commit from template'",
        "condition": "not:dir:.git"
      }
    ],
    "messages": [
      {
        "type": "info",
        "message": "Project created successfully! Run 'npm run dev' to start."
      }
    ]
  },

  "dependencies": {
    "npm": {
      "dependencies": {
        "lodash": "^4.17.21"
      },
      "devDependencies": {
        "typescript": "^5.0.0"
      }
    },
    "plugins": [
      {
        "id": "minto-cli",
        "version": "^2.0.0",
        "required": true
      }
    ]
  }
}
```

## AI CLI 配置详解

### 1. Agents (智能代理)

Agent 是可以被调用执行特定任务的 AI 角色。

**Agent Prompt 文件格式 (*.md):**

```markdown
# Agent: Code Reviewer

## Description
专业代码审查员，负责检查代码质量、安全性和最佳实践。

## Capabilities
- 识别代码异味和反模式
- 检查安全漏洞
- 验证编码规范
- 提供改进建议

## Instructions
当审查代码时，你应该:

1. 首先理解代码的整体结构和目的
2. 检查以下方面:
   - 代码可读性和命名规范
   - 错误处理是否完善
   - 安全性考虑
   - 性能优化机会
   - 测试覆盖率

3. 输出格式:
   ```
   ## 代码审查报告

   ### 严重问题
   - [问题描述]

   ### 建议改进
   - [建议内容]

   ### 优点
   - [好的方面]
   ```

## Tools Available
- Read: 读取文件内容
- Glob: 查找文件
- Grep: 搜索代码
```

### 2. Skills (技能)

Skill 是可以通过斜杠命令触发的快捷操作。

**Skill Prompt 文件格式:**

```markdown
# Skill: /commit

## Trigger
/commit [message]

## Description
智能 Git 提交，自动分析变更并生成符合 Conventional Commits 规范的提交信息。

## Arguments
- message (optional): 自定义提交信息

## Workflow
1. 执行 `git status` 查看变更
2. 执行 `git diff --cached` 查看暂存的修改
3. 分析变更内容和范围
4. 生成符合规范的提交信息
5. 执行提交

## Output
提交成功后显示:
- 提交哈希
- 提交信息
- 变更文件列表
```

### 3. MCP Servers (模型上下文协议)

MCP 配置允许 AI CLI 工具连接外部服务。

**mcp-config.json 格式:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/project"],
      "enabled": true
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "{{GITHUB_TOKEN}}"
      },
      "enabled": true
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-postgres"],
      "env": {
        "DATABASE_URL": "{{DATABASE_URL}}"
      },
      "enabled": false
    }
  }
}
```

### 4. Hooks (钩子)

Hooks 在特定事件发生时自动执行。

**支持的 Hook 事件:**

| 事件 | 描述 | 触发时机 |
|------|------|----------|
| `beforeCommand` | 命令执行前 | 任何 AI 命令执行前 |
| `afterCommand` | 命令执行后 | AI 命令执行完成后 |
| `beforeCommit` | Git 提交前 | git commit 执行前 |
| `afterCommit` | Git 提交后 | git commit 执行完成后 |
| `beforeFileWrite` | 文件写入前 | 写入/创建文件前 |
| `afterFileWrite` | 文件写入后 | 文件写入完成后 |
| `onError` | 错误发生时 | 发生错误时 |

**Hook 脚本示例 (pre-commit.sh):**

```bash
#!/bin/bash
# Pre-commit hook: Run linter and tests

echo "Running pre-commit checks..."

# Run ESLint
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Linting failed. Please fix errors before committing."
    exit 1
fi

# Run tests
npm test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Please fix tests before committing."
    exit 1
fi

echo "✅ Pre-commit checks passed!"
exit 0
```

## 项目规范文件

### CLAUDE.md / MINTO.md / AGENT.md

这些文件定义了 AI CLI 在项目中的行为规范。

**标准结构:**

```markdown
# [TOOL_NAME].md

## Project Overview
项目的整体描述和目标。

## Core Rules
必须遵循的核心规则。

## Workflow
标准工作流程。

## Code Style
代码风格要求。

## Output Formats
输出格式模板。

## Tools & Permissions
可用工具和权限配置。

## Examples
使用示例。

## Forbidden Actions
禁止的操作。
```

## 知识库系统

### 知识库类型

1. **本地文档** - 项目内的 Markdown 文档
2. **代码示例** - 参考代码片段
3. **远程资源** - URL 引用的外部文档
4. **嵌入向量** - 预计算的文档嵌入 (可选)

### 知识库配置

```json
{
  "knowledge": {
    "enabled": true,
    "indexOnApply": true,
    "sources": [
      {
        "type": "local",
        "path": "knowledge/**/*.md",
        "tags": ["documentation"]
      },
      {
        "type": "url",
        "url": "https://api.example.com/docs",
        "cache": true,
        "refreshInterval": 86400
      }
    ],
    "search": {
      "maxResults": 10,
      "minScore": 0.7
    }
  }
}
```

## 与 InitConfig 的集成

### 从 InitConfig 同步模板

登录后获取的 `AiTerInitConfig` 可以包含自定义模板配置：

```typescript
interface AiTerInitConfig {
  // ... 其他配置

  templates?: {
    enabled: boolean
    syncPolicy: 'replace' | 'merge' | 'append'
    templates: EnhancedTemplateDefinition[]
  }
}

interface EnhancedTemplateDefinition {
  id: string
  name: string
  description?: string
  icon?: string
  category?: string
  order?: number

  // 模板来源
  source: {
    type: 'url' | 'git' | 'inline'
    url?: string
    ref?: string
    files?: Record<string, string>
  }

  // AI CLI 配置
  aiCli?: AICliConfig

  // 知识库
  knowledge?: KnowledgeConfig

  // 变量定义
  variables?: TemplateVariable[]

  // 后处理
  postApply?: string[]
}
```

## 模板应用流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Template Application Flow                 │
└─────────────────────────────────────────────────────────────┘

1. 用户选择模板
        │
        ▼
2. 收集变量输入
   ┌─────────────────────────────────────┐
   │ • PROJECT_NAME                      │
   │ • AUTHOR                            │
   │ • 其他自定义变量                      │
   └─────────────────────────────────────┘
        │
        ▼
3. 验证依赖和权限
   ┌─────────────────────────────────────┐
   │ • 检查 requiredLicense              │
   │ • 检查 API Keys                     │
   │ • 检查必要插件                        │
   └─────────────────────────────────────┘
        │
        ▼
4. 复制项目文件
   ┌─────────────────────────────────────┐
   │ • 从 files/ 复制到项目目录            │
   │ • 执行变量替换                        │
   │ • 处理文件重命名                      │
   └─────────────────────────────────────┘
        │
        ▼
5. 应用 AI CLI 配置
   ┌─────────────────────────────────────┐
   │ • 安装 Plugins (agents/skills/etc)  │
   │ • 配置 MCP Servers                  │
   │ • 设置 Prompts                      │
   │ • 配置 Permissions                  │
   │ • 安装 Hooks                        │
   └─────────────────────────────────────┘
        │
        ▼
6. 初始化知识库
   ┌─────────────────────────────────────┐
   │ • 复制本地文档                        │
   │ • 下载远程资源                        │
   │ • 建立索引 (如果启用)                 │
   └─────────────────────────────────────┘
        │
        ▼
7. 执行后处理脚本
   ┌─────────────────────────────────────┐
   │ • 运行 npm install                  │
   │ • 初始化 git                        │
   │ • 其他自定义脚本                      │
   └─────────────────────────────────────┘
        │
        ▼
8. 显示完成信息
   ┌─────────────────────────────────────┐
   │ ✅ 项目创建成功!                     │
   │ 📁 路径: /path/to/project           │
   │ 🚀 下一步: npm run dev              │
   └─────────────────────────────────────┘
```

## 预置模板示例

### 1. Web 开发模板

```json
{
  "id": "web-fullstack",
  "name": "Full-Stack Web Project",
  "description": "React + Node.js full-stack project with AI assistance",
  "icon": "🌐",
  "category": "development",
  "targetCLI": ["claude-code", "minto"],
  "aiCli": {
    "plugins": {
      "agents": [
        {"id": "frontend-developer", "promptFile": "agents/frontend-developer.md"},
        {"id": "backend-architect", "promptFile": "agents/backend-architect.md"},
        {"id": "code-reviewer", "promptFile": "agents/code-reviewer.md"}
      ],
      "skills": [
        {"id": "component", "trigger": "/component"},
        {"id": "api", "trigger": "/api"},
        {"id": "test", "trigger": "/test"}
      ]
    },
    "mcp": {
      "servers": [
        {"id": "filesystem", "enabled": true},
        {"id": "github", "enabled": true}
      ]
    }
  },
  "knowledge": {
    "sources": [
      {"type": "local", "path": "docs/**/*.md"},
      {"type": "url", "url": "https://react.dev/reference"}
    ]
  }
}
```

### 2. 研究分析模板

```json
{
  "id": "research-analysis-pro",
  "name": "Research & Analysis Pro",
  "description": "Advanced research project with web search and data analysis",
  "icon": "📊",
  "category": "work",
  "targetCLI": ["claude-code", "minto"],
  "aiCli": {
    "plugins": {
      "agents": [
        {"id": "research-analyst", "promptFile": "agents/research-analyst.md"},
        {"id": "data-scientist", "promptFile": "agents/data-scientist.md"}
      ],
      "skills": [
        {"id": "search", "trigger": "/search"},
        {"id": "analyze", "trigger": "/analyze"},
        {"id": "report", "trigger": "/report"}
      ]
    },
    "mcp": {
      "servers": [
        {"id": "web-search", "enabled": true},
        {"id": "brightdata", "enabled": false}
      ]
    }
  },
  "knowledge": {
    "sources": [
      {"type": "local", "path": "research-methods/**/*.md"}
    ]
  }
}
```

### 3. API 开发模板

```json
{
  "id": "api-development",
  "name": "API Development",
  "description": "REST/GraphQL API with OpenAPI documentation",
  "icon": "🔌",
  "category": "development",
  "targetCLI": ["claude-code"],
  "aiCli": {
    "plugins": {
      "agents": [
        {"id": "api-architect", "promptFile": "agents/api-architect.md"},
        {"id": "security-auditor", "promptFile": "agents/security-auditor.md"}
      ],
      "skills": [
        {"id": "endpoint", "trigger": "/endpoint"},
        {"id": "schema", "trigger": "/schema"},
        {"id": "docs", "trigger": "/docs"}
      ]
    }
  }
}
```

## 实现计划

### Phase 1: 类型定义更新
- [x] 更新 `src/types/initConfig.ts` 添加增强的模板类型
- [ ] 添加 AI CLI 配置相关类型

### Phase 2: ProjectTemplateManager 增强
- [ ] 支持加载 `template.json` v2 格式
- [ ] 实现 AI CLI 配置应用
- [ ] 实现知识库初始化
- [ ] 实现后处理脚本执行

### Phase 3: UI 支持
- [ ] 模板选择界面显示 AI CLI 配置
- [ ] 变量输入表单
- [ ] 应用进度显示

### Phase 4: 预置模板
- [ ] 创建增强版基础模板
- [ ] 创建 Web 开发模板
- [ ] 创建研究分析模板

## 兼容性说明

### 向后兼容

系统将同时支持:
- **v1 格式**: 现有的简单模板 (仅 `templateDir` 指向文件目录)
- **v2 格式**: 增强模板 (包含完整 `template.json`)

检测逻辑:
1. 如果模板目录下存在 `template.json`，使用 v2 格式解析
2. 否则使用 v1 格式 (直接复制目录内所有文件)

### CLI 工具兼容性

| CLI 工具 | Plugins | MCP | Hooks | Knowledge |
|---------|---------|-----|-------|-----------|
| Claude Code | ✅ | ✅ | ✅ | ✅ |
| Minto | ✅ | ✅ | ✅ | ✅ |
| Gemini CLI | ⚠️ 部分 | ✅ | ❌ | ⚠️ 部分 |

---

*文档版本: 2.0.0*
*最后更新: 2026-01-19*
