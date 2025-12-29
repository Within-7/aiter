# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AiTer is an Electron-based terminal client optimized for AI CLI tool collaboration (like Minto CLI, Claude Code CLI, Gemini CLI). It provides multi-project management, multi-terminal tabs, and HTML preview capabilities with a dedicated file server architecture.

**Key Technologies:**
- Electron 28 (Main/Renderer/Preload architecture)
- React 18 + TypeScript
- xterm.js + node-pty (terminal emulation)
- Express (file serving)
- electron-store (persistence)
- Monaco Editor (code editing)

## Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload

# Type Checking
npm run type-check       # TypeScript type checking without emitting
npm run lint            # ESLint code checking

# Building
npm run build           # Build for current platform
npm run build:mac       # Build for macOS (Intel + Apple Silicon)
npm run build:win       # Build for Windows
npm run build:all       # Build for all platforms
```

**Note:** During development (`npm run dev`), Vite runs two build processes:
1. Main/Preload processes (Electron backend)
2. Renderer process (React frontend)

Both processes hot-reload automatically. Watch for console output from both.

## Git Workflow Requirements

### Commit Policy: Auto-Commit, Manual Push

**每次完成新增、删除、修改等操作后，必须立即 commit。但只在用户明确要求时才 push 到远端。**

#### 自动 Commit 规则

✅ **每次操作完成后立即 commit：**
- 新增文件或功能
- 删除文件或代码
- 修改现有代码
- 重构或优化
- 修复 bug
- 更新配置或文档

#### 手动 Push 规则

⏸️ **只在用户明确要求时才 push：**
- "推送" / "push" / "同步远端"
- "发布" / "release"

这样做的好处：
- 每个操作都有独立的 commit 记录，便于追踪和回滚
- 用户可以在 push 前审查本地的所有 commits
- 支持批量 push 多个相关的 commits

### Commit Message Format

使用 Conventional Commits 格式，根据操作类型选择合适的前缀：

| 操作类型 | 前缀 | 示例 |
|---------|------|------|
| 新增功能 | `feat:` | `feat: Add user authentication` |
| 修复 bug | `fix:` | `fix: Resolve login timeout issue` |
| 删除代码/文件 | `remove:` | `remove: Delete deprecated API endpoints` |
| 重构 | `refactor:` | `refactor: Simplify error handling logic` |
| 文档更新 | `docs:` | `docs: Update API documentation` |
| 样式调整 | `style:` | `style: Fix button alignment` |
| 性能优化 | `perf:` | `perf: Optimize database queries` |
| 配置变更 | `chore:` | `chore: Update dependencies` |

```bash
git commit -m "<type>: <简洁描述>

<可选的详细说明>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**示例：**
```bash
# 新增功能
git commit -m "feat: Add dark mode toggle in settings"

# 修复 bug
git commit -m "fix: Resolve terminal resize issue on Windows"

# 删除文件
git commit -m "remove: Delete unused utility functions"

# 重构代码
git commit -m "refactor: Extract file server logic into separate module"
```

### What NOT to Commit

❌ **Never commit:**
- Broken/non-compiling code (unless explicitly creating a WIP checkpoint)
- Sensitive data (API keys, tokens, passwords)
- Large binary files (use .gitignore)
- `node_modules/`, `dist-electron/`, `dist-renderer/`, `release/` (already in .gitignore)

### Rollback Examples

```bash
# View commit history
git log --oneline -10

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert to specific commit
git reset --hard <commit-hash>

# Create a new commit that undoes a previous commit
git revert <commit-hash>
```

### Branch Strategy

- `main` branch: Stable, working code
- Feature branches: For experimental work (optional)
- Always ensure `main` branch is in working state before pushing

This workflow ensures every change is tracked and recoverable, enabling safe experimentation and easy rollback.

## Architecture

### Electron Process Model

AiTer follows standard Electron architecture with three isolated processes:

1. **Main Process** (`src/main/`)
   - Entry: `src/main/index.ts`
   - Manages app lifecycle, windows, native OS integration
   - Handles IPC communication via `src/main/ipc.ts`
   - Four core managers initialized on startup:
     - `StoreManager`: Persistent storage (electron-store)
     - `PTYManager`: Terminal process management (node-pty)
     - `ProjectServerManager`: File server orchestration
     - Window management via `createMainWindow()`

2. **Preload Process** (`src/preload/`)
   - Bridge between Main and Renderer (security layer)
   - Exposes safe APIs via `contextBridge.exposeInMainWorld('api', ...)`
   - Type-safe IPC interface defined in `src/preload/index.ts`

3. **Renderer Process** (`src/renderer/`)
   - React application (UI layer)
   - State management via Context API (`src/renderer/context/AppContext.tsx`)
   - Cannot access Node.js APIs directly (must use `window.api.*`)

### State Management

**Global State** (`AppContext.tsx`):
- Managed via React Context + useReducer pattern
- Single source of truth for:
  - `projects`: Array of Project objects
  - `terminals`: Array of Terminal objects
  - `editorTabs`: Array of EditorTab objects
  - `tabOrder`: Unified tab order (e.g., `['editor-xxx', 'terminal-yyy']`)
  - `activeTerminalId`, `activeEditorTabId`: Active tab tracking

**Important:** Tabs are unified - both editor and terminal tabs exist in a single `tabOrder` array with prefixes:
- Editor tabs: `editor-{id}`
- Terminal tabs: `terminal-{id}`

This enables drag-and-drop reordering between different tab types.

### File Server Architecture

**Critical System:** Each project gets its own HTTP server for HTML preview.

**Three-Layer Design:**

1. **LocalFileServer** (`src/main/fileServer/LocalFileServer.ts`)
   - Express server per project
   - Random access token authentication
   - CORS enabled, path traversal protection
   - URL format: `http://localhost:{port}/{relativePath}?token={accessToken}`

2. **ProjectServerManager** (`src/main/fileServer/ProjectServerManager.ts`)
   - Orchestrates multiple project servers
   - **LRU eviction**: Max 10 active servers
   - **Auto-shutdown**: Closes servers idle >5 minutes
   - **Lazy loading**: Servers start on-demand

3. **PortManager** (`src/main/fileServer/PortManager.ts`)
   - Allocates ports in 3000-4000 range
   - Persists port mappings to disk
   - Ensures port stability across app restarts

**Why This Design:**
- Enables relative paths (`./`, `../`) in HTML files
- Supports query parameters (`?file=data.md`)
- No file modification required
- Works with complex web apps (ES modules, fetch, etc.)

See `docs/archive/FILE_SERVER_IMPLEMENTATION.md` for complete implementation details.

### IPC Communication Pattern

All Main ↔ Renderer communication follows this pattern:

```typescript
// 1. Renderer calls (src/preload/index.ts exposes these)
await window.api.{namespace}.{method}(args)

// 2. Preload forwards (src/preload/index.ts)
ipcRenderer.invoke('{namespace}:{method}', args)

// 3. Main handles (src/main/ipc.ts)
ipcMain.handle('{namespace}:{method}', async (_, args) => {
  // ... business logic
  return { success: boolean, data?, error? }
})

// 4. Main can send events to Renderer
window.webContents.send('event:name', payload)

// 5. Renderer listens (via preload callbacks)
window.api.{namespace}.onEvent((payload) => { ... })
```

**IPC Namespaces:**
- `projects:*`: Project CRUD operations
- `terminal:*`: Terminal lifecycle (create, write, resize, kill)
- `fs:*`: File system operations (readDir, readFile, writeFile)
- `fileServer:*`: File server management (getUrl, stop, getStats)
- `settings:*`: App settings persistence
- `dialog:*`: Native dialogs (file picker)

### Terminal System

**PTY Management** (`src/main/pty.ts`):
- Each terminal = `node-pty` spawned process
- Tracks command buffer for tab naming
- Terminal name format: `{projectName} | {lastCommand}`
- Automatically updates tab name on command execution

**Terminal Data Flow:**
1. User types → Renderer captures keypress
2. Renderer → `window.api.terminal.write(id, data)`
3. Main → PTY writes to shell process
4. Shell output → PTY captures
5. PTY → Main sends `terminal:data` event
6. Renderer receives via `onData` callback
7. xterm.js displays output

### Editor System

**Three Editor Types:**
1. **MonacoEditor** (`src/renderer/components/Editor/MonacoEditor.tsx`)
   - For code files (JS, TS, CSS, JSON, etc.)
   - Full Monaco editor with syntax highlighting

2. **MarkdownEditor** (`src/renderer/components/Editor/MarkdownEditor.tsx`)
   - Markdown files with live preview
   - Toggle between edit/preview modes

3. **HTMLPreview** (`src/renderer/components/Editor/HTMLPreview.tsx`)
   - HTML files with live preview via file server
   - Automatically requests server URL via `fileServer:getUrl`
   - Sandboxed iframe rendering

**File Type Detection** (`src/main/filesystem.ts`):
- Based on file extension
- Returns `fileType` property used to select appropriate editor

### Cross-Platform UI Considerations

**macOS Traffic Lights:**
- Non-fullscreen: Window controls appear top-left
- Fullscreen detection uses `window.innerHeight >= window.screen.height - 50`
- FILES header has conditional left margin (80px) when not fullscreen
- Class: `.has-traffic-lights` applied to `<h2>` in Sidebar

**Windows Controls:**
- Window controls appear top-right
- Preview toggle button has conditional right margin (140px)
- Platform detection: `navigator.platform.toLowerCase().includes('win')`

**Important:** Do NOT use `window.outerHeight` for fullscreen detection in Electron - it always equals screen size. Use `window.innerHeight` instead.

## Key Files Reference

### Main Process Core
- `src/main/index.ts`: App initialization, manager setup
- `src/main/ipc.ts`: All IPC handlers (single source of truth)
- `src/main/pty.ts`: Terminal process management
- `src/main/store.ts`: Persistent storage (projects, settings)
- `src/main/filesystem.ts`: File operations (readDir, readFile, writeFile)

### File Server System
- `src/main/fileServer/ProjectServerManager.ts`: Server orchestration
- `src/main/fileServer/LocalFileServer.ts`: Per-project HTTP server
- `src/main/fileServer/PortManager.ts`: Port allocation

### Renderer Core
- `src/renderer/App.tsx`: Root component, global listeners setup
- `src/renderer/context/AppContext.tsx`: State management (reducer pattern)
- `src/renderer/components/Sidebar.tsx`: Project list, file tree
- `src/renderer/components/WorkArea.tsx`: Tab bar, editor/terminal switching
- `src/renderer/components/TerminalContainer.tsx`: Terminal tab management

### Type Definitions
- `src/types/index.ts`: All TypeScript interfaces
  - `Project`, `Terminal`, `EditorTab`, `FileNode`, `AppSettings`

## Common Patterns

### Adding New IPC Handler

1. Add handler in `src/main/ipc.ts`:
```typescript
ipcMain.handle('namespace:method', async (_, args) => {
  try {
    const result = await doSomething(args)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

2. Expose in `src/preload/index.ts`:
```typescript
namespace: {
  method: (args) => ipcRenderer.invoke('namespace:method', args)
}
```

3. Add TypeScript types in preload API interface.

### Adding State to AppContext

1. Add to `AppState` interface
2. Add action type to `AppAction` union
3. Add case in `appReducer` switch statement
4. Components dispatch: `dispatch({ type: 'ACTION_NAME', payload: data })`

### File Watching Pattern

Use `chokidar` for file watching (already used in FileTree component):
```typescript
const watcher = chokidar.watch(projectPath, {
  ignored: /(^|[\/\\])\../,
  persistent: true
})
watcher.on('change', path => { /* handle change */ })
```

## Testing

Currently no test suite configured. When adding tests:
- Use `npm run type-check` to catch type errors
- Manual testing required for Electron features
- Test both macOS and Windows window control behaviors

## Build Output

- `dist-electron/`: Compiled main/preload processes
- `dist-renderer/`: Compiled React app
- `release/`: Final packaged applications (.dmg, .exe, etc.)

## Performance Notes

- File server system uses ~60MB average (2-3 active servers)
- LRU eviction prevents memory bloat (max 10 servers)
- PTY processes are lightweight but accumulate with many terminals
- Monaco Editor loads ~15MB per instance (consider lazy loading)

## Security

AiTer implements defense-in-depth security measures:

### Core Security Layers

1. **Electron Security**
   - Preload script uses `contextBridge` (no `nodeIntegration`)
   - HTML preview uses sandboxed iframes
   - Context isolation enabled by default

2. **File System Security** (`src/main/filesystem.ts`)
   - **Path traversal protection**: All file operations validated against allowed project roots
   - **Allowed roots whitelist**: Only registered project directories can be accessed
   - **File size limits**: 50MB max for write operations (DoS prevention)

3. **File Server Security** (`src/main/fileServer/LocalFileServer.ts`)
   - Random access token per project (cryptographically secure)
   - **Timing-safe token comparison** using `crypto.timingSafeEqual()`
   - Session-based authentication after initial token validation
   - **Referer validation for sub-resources only** (HTML pages always require token/session)
   - **Security headers**: X-Content-Type-Options, X-XSS-Protection
   - dotfiles denied (prevents .env, .git exposure)
   - Note: X-Frame-Options not set (required for iframe preview functionality)

4. **Shell/PTY Security** (`src/main/pty.ts`)
   - **Shell whitelist**: Only known safe shells allowed
   - Validates shell path exists and is in standard directories
   - Prevents shell command injection via path manipulation

5. **External URL Security** (`src/main/ipc.ts`)
   - URL scheme validation for `shell.openExternal`
   - Only `http:`, `https:`, `mailto:` protocols allowed

### Security Guidelines for Development

- Never trust user input without validation
- Use `path.resolve()` and check against allowed roots for file operations
- Use timing-safe comparisons for security tokens
- Validate all external URLs before opening

## Plugin System

AiTer includes a plugin management system for AI CLI tools:

### Plugin Architecture (`src/main/plugins/`)

- **PluginManager**: Central orchestrator for plugin lifecycle
- **NpmPluginInstaller**: Handles npm-based plugin installation
- **Built-in Plugins**: Minto CLI, Claude Code CLI, Gemini CLI

### Plugin Features

- **Auto-installation**: Minto CLI installed on first launch (configurable)
- **Auto-start**: Terminal can auto-run Minto on creation (configurable via settings)
- **Dev/Prod Isolation**: Separate plugin registries for development and production

### Plugin Settings (`AppSettings`)

```typescript
{
  autoStartMinto: boolean,     // Auto-run minto command in new terminals
  mintoInstalled?: boolean,    // Track if Minto was installed
}
```

## Auto-Update System

AiTer uses `electron-updater` for automatic updates:

### Update Configuration

- **Update source**: GitHub Releases (`Within-7/aiter`)
- **Differential updates**: Disabled for unsigned builds
- **Network error handling**: Silent retry without user notification

### Platform-specific Notes

- **macOS unsigned builds**: Uses `forceDevUpdateConfig` to bypass signature verification
- **Windows**: Standard NSIS installer with auto-update support

See `docs/CODE_SIGNING.md` for signing configuration.

## MCP (Model Context Protocol) Compatibility

AiTer supports AI CLI tools that use MCP for extended functionality:

### Supported AI CLI Tools

| Tool | Node.js Required | MCP Support |
|------|------------------|-------------|
| Minto CLI | 18+ | Yes |
| Claude Code CLI | 18+ | Yes |
| Gemini CLI | 20+ | Yes |

### Node.js Version Strategy

AiTer bundles Node.js 22.x LTS for maximum compatibility:
- All AI CLI tools work with Node.js 20+
- LTS support until April 2027
- Latest ES features and performance

### Proxy Compatibility Issues

**Known Issue:** Node.js 22 has a proxy compatibility issue with `axios` + `http-proxy-agent` (llhttp stricter parsing). This affects some MCP services when running through a system proxy.

**Symptoms:**
- MCP connection works in development but fails in production
- Error: "stream has been aborted" or similar axios errors
- Works when system proxy is disabled

**Root Cause:**
- Production AiTer (launched from Finder) inherits system proxy settings
- Development AiTer (launched from terminal) may not use system proxy
- Node.js 22's stricter HTTP parsing conflicts with some proxy agents

### Troubleshooting MCP Connection Failures

**Solution 1: Disable proxy for specific MCP service**

Add `no_proxy` to the MCP configuration in `~/.minto.json` (or equivalent config):

```json
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-brightdata"],
      "env": {
        "API_TOKEN": "your-token",
        "no_proxy": "*",
        "NO_PROXY": "*"
      }
    }
  }
}
```

This disables proxy only for that specific MCP service, not the entire terminal.

**Solution 2: Check system proxy settings**

If all MCP services fail:
1. Check if you're using a proxy tool (e.g., ShadowsocksX-NG, Clash)
2. Verify if the proxy uses PAC (auto-configuration)
3. Try disabling system proxy temporarily to confirm the issue

**Solution 3: Use terminal proxy commands**

If you need proxy for some operations but not MCP:
```bash
# In terminal, disable proxy temporarily
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY

# Or use no_proxy for specific domains
export no_proxy="localhost,127.0.0.1,.local"
```

### Architecture Note

AiTer uses a layered proxy approach:
- **Electron main process**: Uses system proxy (for auto-updates, web requests)
- **PTY terminals**: Inherit system proxy environment (configurable per-command)
- **MCP services**: Should use `no_proxy=*` if they have compatibility issues

## Documentation Structure

```
docs/
├── README.md                 # Documentation center navigation
├── index.html                # Product website
├── USER_MANUAL.md            # User manual
├── CONSULTING_WORKFLOW.md    # Consulting workflow guide
├── BEST_PRACTICES.md         # Best practices guide
├── RELEASE_GUIDE.md          # Release process guide
├── CODE_SIGNING.md           # Code signing configuration
├── TEAM_DOWNLOAD_GUIDE.md    # Team download instructions
└── archive/                  # Archived development docs
    ├── README.md             # Archive index
    ├── PRD.md                # Product requirements
    ├── FILE_SERVER_IMPLEMENTATION.md
    ├── NODEJS_INTEGRATION.md
    └── ...                   # Other historical docs
```
