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

  // Shell configuration
  shellLoginMode: boolean           // Whether to use login shell (-l/--login)

  // macOS-specific
  macOptionIsMeta: boolean          // Use Option key as Meta key (for Alt+key shortcuts)

  // Node.js configuration
  nodeSource: 'builtin' | 'system' | 'auto'  // Which Node.js to use
  preserveVersionManagers: boolean  // Keep nvm/fnm/asdf environment variables

  // Windows-specific
  windowsUseUtf8: boolean           // Enable UTF-8 encoding for Windows terminals
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
