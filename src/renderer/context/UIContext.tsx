import { createContext, useContext, useReducer, ReactNode } from 'react'
import { AppSettings, ShortcutConfig } from '../../types'

// Default keyboard shortcuts (labels are translated via i18n in SettingsPanel)
const defaultShortcuts: ShortcutConfig[] = [
  { action: 'newTerminal', label: 'New Terminal', shortcut: { key: 't', metaKey: true }, enabled: true },
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

export interface UIState {
  settings: AppSettings
  showPluginPanel: boolean
  showAboutPanel: boolean
  showSettingsPanel: boolean
  showWorkspaceManager: boolean
  sidebarView: SidebarView
}

export type UIAction =
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
  | { type: 'SET_SIDEBAR_VIEW'; payload: SidebarView }

export const initialUIState: UIState = {
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
    // Configuration isolation (default: disabled)
    configIsolation: {
      enabled: false,
      basePath: undefined,
      tools: []
    }
  },
  showPluginPanel: false,
  showAboutPanel: false,
  showSettingsPanel: false,
  showWorkspaceManager: false,
  sidebarView: 'explorer'
}

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      }

    case 'TOGGLE_PLUGIN_PANEL':
      return { ...state, showPluginPanel: !state.showPluginPanel }

    case 'SET_PLUGIN_PANEL':
      return { ...state, showPluginPanel: action.payload }

    case 'TOGGLE_ABOUT_PANEL':
      return { ...state, showAboutPanel: !state.showAboutPanel }

    case 'SET_ABOUT_PANEL':
      return { ...state, showAboutPanel: action.payload }

    case 'TOGGLE_SETTINGS_PANEL':
      return { ...state, showSettingsPanel: !state.showSettingsPanel }

    case 'SET_SETTINGS_PANEL':
      return { ...state, showSettingsPanel: action.payload }

    case 'TOGGLE_WORKSPACE_MANAGER':
      return { ...state, showWorkspaceManager: !state.showWorkspaceManager }

    case 'SET_WORKSPACE_MANAGER':
      return { ...state, showWorkspaceManager: action.payload }

    case 'SET_SIDEBAR_VIEW':
      return { ...state, sidebarView: action.payload }

    default:
      return state
  }
}

export interface UIContextType {
  state: UIState
  dispatch: React.Dispatch<UIAction>
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialUIState)

  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUI must be used within UIProvider')
  }
  return context
}
