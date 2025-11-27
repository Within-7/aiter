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
  fileType: 'html' | 'markdown' | 'json' | 'javascript' | 'typescript' | 'css' | 'text' | 'other'
  content: string
  isDirty: boolean
  cursorPosition?: { line: number; column: number }
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

export interface AppSettings {
  theme: 'dark' | 'light'
  fontSize: number
  fontFamily: string
  shell?: string
  scrollbackLines: number
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
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
}

// Window state
export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}
