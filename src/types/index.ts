// Core data models

export interface Project {
  id: string
  name: string
  path: string
  addedAt: number
  lastAccessed?: number
  isExpanded?: boolean
  isGitRepo?: boolean
  color?: string
}

export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'clean'
  isGitIgnored?: boolean  // Whether the file/directory is in .gitignore
  size?: number
  modifiedTime?: number
}

export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  fileType: 'html' | 'markdown' | 'json' | 'javascript' | 'typescript' | 'css' | 'text' | 'other' | 'diff' | 'python' | 'java' | 'c' | 'cpp' | 'go' | 'rust' | 'ruby' | 'php' | 'shell' | 'sql' | 'yaml' | 'xml' | 'dockerfile' | 'image' | 'pdf' | 'word' | 'excel' | 'powerpoint'
  content: string
  isDirty: boolean
  isPreview?: boolean // Preview tab (VSCode-like behavior): replaced on next file click, unless pinned
  cursorPosition?: { line: number; column: number }
  serverUrl?: string // HTTP server URL for HTML preview
  // Diff view properties
  isDiff?: boolean
  diffContent?: string
  commitHash?: string
  commitMessage?: string
  projectPath?: string
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  timestamp: number
}

export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'untracked'
}

export interface GitStatus {
  isRepo: boolean
  currentBranch?: string
  hasChanges?: boolean
  ahead?: number
  behind?: number
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: string
  }
}

export interface GitRepository {
  projectId: string
  path: string
  currentBranch: string
  isRepo: boolean
  hasChanges: boolean
}

export interface Terminal {
  id: string
  projectId: string
  name: string
  cwd: string
  shell: string
  createdAt: number
  pid?: number
}

export type TerminalThemeName = 'homebrew' | 'vscode-dark' | 'dracula' | 'solarized-dark'

export interface AppSettings {
  theme: 'dark' | 'light'
  fontSize: number
  fontFamily: string
  shell?: string
  scrollbackLines: number
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
  terminalTheme: TerminalThemeName

  // Internationalization
  language: 'en' | 'zh-CN'          // Display language

  // Shell configuration
  shellLoginMode: boolean           // Whether to use login shell (-l/--login)

  // macOS-specific
  macOptionIsMeta: boolean          // Use Option key as Meta key (for Alt+key shortcuts)

  // Node.js configuration
  nodeSource: 'builtin' | 'system' | 'auto'  // Which Node.js to use
  preserveVersionManagers: boolean  // Keep nvm/fnm/asdf environment variables

  // Windows-specific
  windowsUseUtf8: boolean           // Enable UTF-8 encoding for Windows terminals

  // Keyboard shortcuts
  shortcuts?: ShortcutConfig[]      // Custom keyboard shortcuts

  // Terminal startup command
  enableStartupCommand: boolean     // Enable running a command when opening a new terminal
  startupCommand: string            // The command to run on terminal startup (e.g., 'minto', 'claude')
  mintoInstalled?: boolean          // Track if Minto CLI has been installed (legacy)

  // File handling preferences
  openExternally?: ExternalOpenConfig[]  // File types to open with external apps

  // Proxy configuration
  proxyMode: 'off' | 'manual' | 'system'  // Proxy mode: off=no proxy, manual=use custom proxy, system=inherit system proxy
  proxyHost?: string                      // Proxy host (e.g., 127.0.0.1)
  proxyPort?: number                      // Proxy port (e.g., 1087)
  proxyProtocol?: 'http' | 'socks5'       // Proxy protocol
}

// Configuration for opening files with external applications
export interface ExternalOpenConfig {
  fileType: string              // File type (e.g., 'pdf', 'word', 'image')
  enabled: boolean              // Whether to open externally
  application?: string          // Optional: specific application path
}

// Shell type identifier
export type ShellType = 'zsh' | 'bash' | 'fish' | 'powershell' | 'pwsh' | 'cmd' | 'gitbash' | 'wsl' | 'other'

// Detected shell information
export interface DetectedShell {
  name: string           // Display name (e.g., "Zsh", "PowerShell")
  path: string           // Full path to executable
  type: ShellType        // Shell type identifier
  isDefault: boolean     // Is this the system default shell
  configFiles: string[]  // Associated config files (e.g., ~/.zshrc)
}

// Version manager names
export type VersionManagerName = 'nvm' | 'fnm' | 'asdf' | 'pyenv' | 'rbenv' | 'volta'

// Version manager detection result
export interface VersionManagerInfo {
  name: VersionManagerName
  detected: boolean
  envVars: Record<string, string>  // Environment variables to preserve
}

export interface AppState {
  projects: Project[]
  terminals: Terminal[]
  activeTerminalId?: string
  activeProjectId?: string
  settings: AppSettings
}

// IPC Event types
export interface IPCEvents {
  // Project events
  'project:add': { path: string; name?: string }
  'project:remove': { id: string }
  'project:open': { path: string }
  'projects:list': void
  'projects:updated': { projects: Project[] }

  // Terminal events
  'terminal:create': { cwd: string; shell?: string; projectId: string }
  'terminal:write': { id: string; data: string }
  'terminal:resize': { id: string; cols: number; rows: number }
  'terminal:kill': { id: string }
  'terminal:data': { id: string; data: string }
  'terminal:exit': { id: string; exitCode: number }
  'terminal:created': { terminal: Terminal }

  // File system events
  'dialog:openFolder': void
  'dialog:folderSelected': { path: string; name: string } | null

  // Settings events
  'settings:get': void
  'settings:update': Partial<AppSettings>
  'settings:updated': { settings: AppSettings }

  // App events
  'app:error': { message: string; stack?: string }
  'app:ready': void

  // Git events
  'git:getStatus': { projectPath: string }
  'git:getRecentCommits': { projectPath: string; count?: number }
  'git:initRepo': { projectPath: string }
  'git:getFileChanges': { projectPath: string }
  'git:commitAll': { projectPath: string; message: string }
}

// Window state
export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

// Plugin system types
export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  installed: boolean
  installedVersion?: string
  updateAvailable: boolean
  enabled: boolean
  config?: Record<string, unknown>
  tags?: string[]
  icon?: string
  homepage?: string
  isBuiltIn?: boolean
}

export interface PluginInstallProgress {
  pluginId: string
  status: 'downloading' | 'installing' | 'complete' | 'error'
  progress: number
  message?: string
}

export interface PluginUpdateProgress {
  pluginId: string
  status: 'checking' | 'downloading' | 'installing' | 'complete' | 'error'
  progress: number
  message?: string
  fromVersion?: string
  toVersion?: string
}

// Keyboard shortcut types
export type ShortcutAction =
  | 'newTerminal'      // 新建终端
  | 'closeTab'         // 关闭当前标签页
  | 'saveFile'         // 保存文件
  | 'openSettings'     // 打开设置
  | 'newWindow'        // 新窗口
  | 'toggleSidebar'    // 切换侧边栏
  | 'nextTab'          // 下一个标签页
  | 'prevTab'          // 上一个标签页
  | 'focusTerminal'    // 聚焦终端
  | 'focusEditor'      // 聚焦编辑器

export interface KeyboardShortcut {
  key: string              // 主键 (例如: 't', 's', 'n')
  ctrlKey?: boolean        // Ctrl 键
  metaKey?: boolean        // Cmd/Meta 键
  altKey?: boolean         // Alt/Option 键
  shiftKey?: boolean       // Shift 键
}

export interface ShortcutConfig {
  action: ShortcutAction
  label: string            // 显示名称
  shortcut: KeyboardShortcut
  enabled: boolean         // 是否启用
}

// Workspace system for multi-instance support
export interface Workspace {
  id: string
  name: string
  description?: string
  visibleProjectIds: string[]  // Empty array = show all projects
  color?: string
  createdAt: number
  lastUsedAt: number
}

export interface WorkspaceSettings {
  workspaces: Workspace[]
  lastUsedWorkspaceId?: string
}

// Search types
export interface SearchOptions {
  pattern: string                        // Search pattern
  searchType: 'filename' | 'content'     // Search type
  caseSensitive?: boolean                // Case sensitive matching
  useRegex?: boolean                     // Use regular expression
  includeIgnored?: boolean               // Include gitignored files
  maxResults?: number                    // Maximum results (default 100)
}

export interface SearchMatch {
  line: number                           // Line number (1-based)
  column: number                         // Column number (1-based)
  preview: string                        // Preview text with context
  contextBefore?: string                 // Line before match
  contextAfter?: string                  // Line after match
}

export interface SearchResult {
  filePath: string                       // Full file path
  fileName: string                       // File name
  relativePath: string                   // Path relative to project root
  projectId: string                      // Project ID
  projectName: string                    // Project name
  matches?: SearchMatch[]                // Content matches (for content search)
}

// Session state for persistence across refreshes/restarts
export interface SessionState {
  // Editor tabs to restore
  editorTabs: Array<{
    id: string
    filePath: string
    fileName: string
    fileType: EditorTab['fileType']
    serverUrl?: string
    projectPath?: string
    isDiff?: boolean
    commitHash?: string
    commitMessage?: string
  }>
  // Terminal info for restoration (actual PTY processes need to be recreated)
  terminals: Array<{
    id: string
    projectId: string
    name: string
    cwd: string
  }>
  // Tab order for restoring layout
  tabOrder: string[]
  // Active tab IDs
  activeTerminalId?: string
  activeEditorTabId?: string
  // Active project
  activeProjectId?: string
  // Timestamp for session age tracking
  savedAt: number
}
