/**
 * Central type exports - re-exports all domain-specific types for convenience.
 * Import from 'types' for cleaner imports.
 *
 * Types are organized by domain:
 * - project.ts: Project, FileNode
 * - editor.ts: EditorTab, EditorFileType
 * - terminal.ts: Terminal, ShellType, DetectedShell, VersionManagerInfo
 * - git.ts: GitCommit, GitStatus, GitRepository, FileChange
 * - settings.ts: AppSettings, ShortcutConfig, ConfigIsolationSettings
 * - search.ts: SearchOptions, SearchMatch, SearchResult
 * - workspace.ts: Workspace, WorkspaceSettings
 * - state.ts: AppState, WindowState, SessionState
 * - voiceInput.ts: VoiceInputSettings, etc.
 * - auth.ts: Authentication types
 * - ipc.ts: IPC communication types
 * - plugin.ts: Plugin system types
 */

// Project and file system
export * from './project'

// Editor
export * from './editor'

// Terminal
export * from './terminal'

// Git
export * from './git'

// Settings
export * from './settings'

// Search
export * from './search'

// Workspace
export * from './workspace'

// State
export * from './state'

// Voice input
export * from './voiceInput'

// Authentication
export * from './auth'

// Initialization config
export * from './initConfig'

// IPC types
export * from './ipc'

// Plugin types
export * from './plugin'
