/**
 * Application state type definitions.
 */

import type { Project } from './project'
import type { Terminal } from './terminal'
import type { EditorTab } from './editor'
import type { AppSettings } from './settings'

/**
 * Main application state
 */
export interface AppState {
  projects: Project[]
  terminals: Terminal[]
  activeTerminalId?: string
  activeProjectId?: string
  settings: AppSettings
}

/**
 * Window state for persistence
 */
export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

/**
 * Session state for persistence across refreshes/restarts
 */
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
