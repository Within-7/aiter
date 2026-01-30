import { createContext } from 'react'
import { Project, Terminal, AppSettings, EditorTab, ShortcutConfig, VoiceTranscription } from '../../types'
import { combinedReducer } from './reducers'

// Default keyboard shortcuts (labels are translated via i18n in SettingsPanel)
const defaultShortcuts: ShortcutConfig[] = [
  { action: 'newTerminal', label: 'New Terminal', shortcut: { key: 't', metaKey: true }, enabled: true },
  { action: 'newScratchpad', label: 'New Scratchpad', shortcut: { key: 't', ctrlKey: true }, enabled: true },
  { action: 'closeTab', label: 'Close Tab', shortcut: { key: 'w', metaKey: true }, enabled: true },
  { action: 'saveFile', label: 'Save File', shortcut: { key: 's', metaKey: true }, enabled: true },
  { action: 'openSettings', label: 'Open Settings', shortcut: { key: ',', metaKey: true }, enabled: true },
  { action: 'newWindow', label: 'New Window', shortcut: { key: 'n', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'toggleSidebar', label: 'Toggle Sidebar', shortcut: { key: 'b', metaKey: true }, enabled: true },
  { action: 'nextTab', label: 'Next Tab', shortcut: { key: ']', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'prevTab', label: 'Previous Tab', shortcut: { key: '[', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'focusTerminal', label: 'Focus Terminal', shortcut: { key: '`', ctrlKey: true }, enabled: true },
  { action: 'focusEditor', label: 'Focus Editor', shortcut: { key: 'e', metaKey: true, shiftKey: true }, enabled: true }
]

export type SidebarView = 'explorer' | 'git' | 'search'

export interface AppState {
  projects: Project[]
  terminals: Terminal[]
  editorTabs: EditorTab[]
  tabOrder: string[] // Array of tab IDs in display order (e.g., ['editor-xxx', 'terminal-yyy'])
  activeTerminalId?: string
  activeProjectId?: string
  activeEditorTabId?: string
  selectedTabIds: Set<string> // Multi-selected tab IDs for batch operations
  lastSelectedTabId?: string // Last clicked tab for Shift+Click range selection
  settings: AppSettings
  terminalDataBuffer: Map<string, string>
  showPluginPanel: boolean
  showAboutPanel: boolean
  showSettingsPanel: boolean
  showWorkspaceManager: boolean
  showVoicePanel: boolean
  sidebarView: SidebarView
  // Voice transcription history (shared between inline and panel modes)
  voiceTranscriptions: VoiceTranscription[]
}

export type AppAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'REORDER_PROJECTS'; payload: Project[] }
  | { type: 'SET_ACTIVE_PROJECT'; payload: string }
  | { type: 'ADD_TERMINAL'; payload: Terminal }
  | { type: 'REMOVE_TERMINAL'; payload: string }
  | { type: 'SET_ACTIVE_TERMINAL'; payload: string }
  | { type: 'UPDATE_TERMINAL_NAME'; payload: { id: string; name: string } }
  | { type: 'REORDER_TERMINALS'; payload: Terminal[] }
  | { type: 'ADD_EDITOR_TAB'; payload: EditorTab }
  | { type: 'ADD_SCRATCHPAD_TAB' }
  | { type: 'UPDATE_SCRATCHPAD_TYPE'; payload: { id: string; fileType: EditorTab['fileType'] } }
  | { type: 'REMOVE_EDITOR_TAB'; payload: string }
  | { type: 'SET_ACTIVE_EDITOR_TAB'; payload: string }
  | { type: 'REORDER_EDITOR_TABS'; payload: EditorTab[] }
  | { type: 'REORDER_TABS'; payload: string[] }
  | { type: 'UPDATE_EDITOR_CONTENT'; payload: { id: string; content: string } }
  | { type: 'MARK_TAB_DIRTY'; payload: { id: string; isDirty: boolean } }
  | { type: 'MARK_TAB_SAVED'; payload: { id: string; content: string } }  // After save: update originalContent
  | { type: 'PIN_EDITOR_TAB'; payload: string }
  | { type: 'TERMINAL_DATA'; payload: { id: string; data: string } }
  | { type: 'TERMINAL_EXIT'; payload: { id: string; exitCode: number } }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'TOGGLE_PLUGIN_PANEL' }
  | { type: 'SET_PLUGIN_PANEL'; payload: boolean }
  | { type: 'TOGGLE_ABOUT_PANEL' }
  | { type: 'SET_ABOUT_PANEL'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS_PANEL' }
  | { type: 'SET_SETTINGS_PANEL'; payload: boolean }
  | { type: 'TOGGLE_WORKSPACE_MANAGER' }
  | { type: 'SET_WORKSPACE_MANAGER'; payload: boolean }
  | { type: 'TOGGLE_VOICE_PANEL' }
  | { type: 'SET_VOICE_PANEL'; payload: boolean }
  | { type: 'ADD_VOICE_TRANSCRIPTION'; payload: VoiceTranscription }
  | { type: 'UPDATE_VOICE_TRANSCRIPTION'; payload: { id: string; text: string } }
  | { type: 'DELETE_VOICE_TRANSCRIPTION'; payload: string }
  | { type: 'CLEAR_VOICE_TRANSCRIPTIONS' }
  | { type: 'SET_VOICE_TRANSCRIPTIONS'; payload: VoiceTranscription[] }
  | { type: 'SET_SIDEBAR_VIEW'; payload: SidebarView }
  | { type: 'SELECT_TAB'; payload: { tabId: string; shiftKey: boolean; ctrlKey: boolean } }
  | { type: 'CLEAR_TAB_SELECTION' }
  | { type: 'REORDER_TABS_BATCH'; payload: { tabIds: string[]; targetIndex: number } }

export const initialState: AppState = {
  projects: [],
  terminals: [],
  editorTabs: [],
  tabOrder: [],
  activeTerminalId: undefined,
  activeProjectId: undefined,
  activeEditorTabId: undefined,
  selectedTabIds: new Set(),
  lastSelectedTabId: undefined,
  settings: {
    theme: 'dark',
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollbackLines: 1000,
    cursorBlink: true,
    cursorStyle: 'block',
    terminalTheme: 'homebrew',
    // Internationalization
    language: 'en',
    // Shell configuration
    shellLoginMode: true,
    // macOS-specific
    macOptionIsMeta: true,
    // Node.js configuration
    nodeSource: 'builtin',
    preserveVersionManagers: false,
    // Windows-specific
    windowsUseUtf8: true,
    // Keyboard shortcuts
    shortcuts: defaultShortcuts,
    // Terminal startup command
    enableStartupCommand: true,
    startupCommand: 'minto',
    // Proxy configuration
    proxyMode: 'off',
    proxyHost: '127.0.0.1',
    proxyPort: 1087,
    proxyProtocol: 'http',
    // Terminal behavior
    confirmTerminalClose: true,
    // Editor settings
    editorWordWrap: true,
    editorMinimap: false,
    editorLineNumbers: true,
    editorSuggestions: false,
    // Configuration isolation (default: disabled)
    configIsolation: {
      enabled: false,
      basePath: undefined,
      tools: []
    }
  },
  terminalDataBuffer: new Map(),
  showPluginPanel: false,
  showAboutPanel: false,
  showSettingsPanel: false,
  showWorkspaceManager: false,
  showVoicePanel: false,
  sidebarView: 'explorer',
  voiceTranscriptions: []
}

/**
 * Main app reducer - delegates to domain-specific reducers
 * @see combinedReducer for implementation details
 */
export const appReducer = combinedReducer

export interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => {}
})
