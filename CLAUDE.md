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

**CRITICAL:** All file operations MUST be committed to git for rollback capability.

### Commit After Every Logical Change

Create a git commit immediately after:
- Creating new files
- Modifying existing files
- Deleting files
- Moving/renaming files
- Completing a feature or fix
- Reverting changes

### Commit Message Format

```bash
git commit -m "Brief description of changes

Detailed explanation if needed:
- What was changed
- Why it was changed
- Any important notes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### When to Commit

✅ **DO commit:**
- After implementing a new component
- After fixing a bug
- After refactoring code
- After adding/modifying documentation
- Before attempting risky changes (safety checkpoint)
- After reverting unwanted changes

❌ **DON'T commit:**
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

- Preload script uses `contextBridge` (no `nodeIntegration`)
- File server uses random access tokens per project
- Path traversal protection in file operations
- HTML preview uses sandboxed iframes
