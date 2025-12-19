import { createContext } from 'react'
import { Project, Terminal, AppSettings, EditorTab, ShortcutConfig } from '../../types'

// Default keyboard shortcuts (same as store.ts)
const defaultShortcuts: ShortcutConfig[] = [
  { action: 'newTerminal', label: '新建终端', shortcut: { key: 't', metaKey: true }, enabled: true },
  { action: 'closeTab', label: '关闭标签页', shortcut: { key: 'w', metaKey: true }, enabled: true },
  { action: 'saveFile', label: '保存文件', shortcut: { key: 's', metaKey: true }, enabled: true },
  { action: 'openSettings', label: '打开设置', shortcut: { key: ',', metaKey: true }, enabled: true },
  { action: 'newWindow', label: '新窗口', shortcut: { key: 'n', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'toggleSidebar', label: '切换侧边栏', shortcut: { key: 'b', metaKey: true }, enabled: true },
  { action: 'nextTab', label: '下一个标签页', shortcut: { key: ']', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'prevTab', label: '上一个标签页', shortcut: { key: '[', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'focusTerminal', label: '聚焦终端', shortcut: { key: '`', ctrlKey: true }, enabled: true },
  { action: 'focusEditor', label: '聚焦编辑器', shortcut: { key: 'e', metaKey: true, shiftKey: true }, enabled: true }
]

export type SidebarView = 'explorer' | 'git'

export interface AppState {
  projects: Project[]
  terminals: Terminal[]
  editorTabs: EditorTab[]
  tabOrder: string[] // Array of tab IDs in display order (e.g., ['editor-xxx', 'terminal-yyy'])
  activeTerminalId?: string
  activeProjectId?: string
  activeEditorTabId?: string
  settings: AppSettings
  terminalDataBuffer: Map<string, string>
  showPluginPanel: boolean
  showAboutPanel: boolean
  showSettingsPanel: boolean
  sidebarView: SidebarView
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
  | { type: 'REMOVE_EDITOR_TAB'; payload: string }
  | { type: 'SET_ACTIVE_EDITOR_TAB'; payload: string }
  | { type: 'REORDER_EDITOR_TABS'; payload: EditorTab[] }
  | { type: 'REORDER_TABS'; payload: string[] }
  | { type: 'UPDATE_EDITOR_CONTENT'; payload: { id: string; content: string } }
  | { type: 'MARK_TAB_DIRTY'; payload: { id: string; isDirty: boolean } }
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
  | { type: 'SET_SIDEBAR_VIEW'; payload: SidebarView }

export const initialState: AppState = {
  projects: [],
  terminals: [],
  editorTabs: [],
  tabOrder: [],
  activeTerminalId: undefined,
  activeProjectId: undefined,
  activeEditorTabId: undefined,
  settings: {
    theme: 'dark',
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollbackLines: 1000,
    cursorBlink: true,
    cursorStyle: 'block',
    terminalTheme: 'homebrew',
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
    shortcuts: defaultShortcuts
  },
  terminalDataBuffer: new Map(),
  showPluginPanel: false,
  showAboutPanel: false,
  showSettingsPanel: false,
  sidebarView: 'explorer'
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload }

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] }

    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        activeProjectId:
          state.activeProjectId === action.payload
            ? undefined
            : state.activeProjectId
      }

    case 'REORDER_PROJECTS':
      return { ...state, projects: action.payload }

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.payload }

    case 'ADD_TERMINAL':
      return {
        ...state,
        terminals: [...state.terminals, action.payload],
        tabOrder: [...state.tabOrder, `terminal-${action.payload.id}`],
        activeTerminalId: action.payload.id,
        activeEditorTabId: undefined  // Clear editor selection when opening terminal
      }

    case 'REMOVE_TERMINAL': {
      const newTerminals = state.terminals.filter((t) => t.id !== action.payload)
      const removedTabId = `terminal-${action.payload}`
      const newTabOrder = state.tabOrder.filter(id => id !== removedTabId)

      // If this was the active terminal, find the previous tab in tabOrder
      let newActiveTerminalId = state.activeTerminalId
      let newActiveEditorTabId = state.activeEditorTabId

      if (state.activeTerminalId === action.payload) {
        // Find the index of the removed tab
        const removedIndex = state.tabOrder.indexOf(removedTabId)

        if (removedIndex > 0 && newTabOrder.length > 0) {
          // Get the previous tab in order
          const previousTabId = newTabOrder[removedIndex - 1]

          if (previousTabId.startsWith('terminal-')) {
            newActiveTerminalId = previousTabId.substring('terminal-'.length)
            newActiveEditorTabId = undefined
          } else if (previousTabId.startsWith('editor-')) {
            newActiveEditorTabId = previousTabId.substring('editor-'.length)
            newActiveTerminalId = undefined
          }
        } else if (newTabOrder.length > 0) {
          // If removed tab was first, activate the new first tab
          const nextTabId = newTabOrder[0]

          if (nextTabId.startsWith('terminal-')) {
            newActiveTerminalId = nextTabId.substring('terminal-'.length)
            newActiveEditorTabId = undefined
          } else if (nextTabId.startsWith('editor-')) {
            newActiveEditorTabId = nextTabId.substring('editor-'.length)
            newActiveTerminalId = undefined
          }
        } else {
          // No tabs left
          newActiveTerminalId = undefined
          newActiveEditorTabId = undefined
        }
      }

      return {
        ...state,
        terminals: newTerminals,
        tabOrder: newTabOrder,
        activeTerminalId: newActiveTerminalId,
        activeEditorTabId: newActiveEditorTabId
      }
    }

    case 'SET_ACTIVE_TERMINAL':
      return {
        ...state,
        activeTerminalId: action.payload,
        activeEditorTabId: undefined  // Clear editor selection when switching to terminal
      }

    case 'UPDATE_TERMINAL_NAME':
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === action.payload.id
            ? { ...t, name: action.payload.name }
            : t
        )
      }

    case 'REORDER_TERMINALS':
      return {
        ...state,
        terminals: action.payload
      }

    case 'ADD_EDITOR_TAB': {
      // Check if tab already exists for this file
      // For HTML files with serverUrl (which may have query params), compare both filePath and serverUrl
      // For regular files, just compare filePath
      const existing = state.editorTabs.find(t => {
        if (action.payload.serverUrl && t.serverUrl) {
          // Both have serverUrl, compare the full URL (includes query params)
          return t.serverUrl === action.payload.serverUrl
        }
        // No serverUrl, just compare filePath
        return t.filePath === action.payload.filePath
      })

      if (existing) {
        return {
          ...state,
          activeEditorTabId: existing.id,
          activeTerminalId: undefined  // Clear terminal selection when switching to editor
        }
      }
      return {
        ...state,
        editorTabs: [...state.editorTabs, action.payload],
        tabOrder: [...state.tabOrder, `editor-${action.payload.id}`],
        activeEditorTabId: action.payload.id,
        activeTerminalId: undefined  // Clear terminal selection when switching to editor
      }
    }

    case 'REMOVE_EDITOR_TAB': {
      const newTabs = state.editorTabs.filter(t => t.id !== action.payload)
      const removedTabId = `editor-${action.payload}`
      const newTabOrder = state.tabOrder.filter(id => id !== removedTabId)

      // If this was the active editor tab, find the previous tab in tabOrder
      let newActiveEditorTabId = state.activeEditorTabId
      let newActiveTerminalId = state.activeTerminalId

      if (state.activeEditorTabId === action.payload) {
        // Find the index of the removed tab
        const removedIndex = state.tabOrder.indexOf(removedTabId)

        if (removedIndex > 0 && newTabOrder.length > 0) {
          // Get the previous tab in order
          const previousTabId = newTabOrder[removedIndex - 1]

          if (previousTabId.startsWith('editor-')) {
            newActiveEditorTabId = previousTabId.substring('editor-'.length)
            newActiveTerminalId = undefined
          } else if (previousTabId.startsWith('terminal-')) {
            newActiveTerminalId = previousTabId.substring('terminal-'.length)
            newActiveEditorTabId = undefined
          }
        } else if (newTabOrder.length > 0) {
          // If removed tab was first, activate the new first tab
          const nextTabId = newTabOrder[0]

          if (nextTabId.startsWith('editor-')) {
            newActiveEditorTabId = nextTabId.substring('editor-'.length)
            newActiveTerminalId = undefined
          } else if (nextTabId.startsWith('terminal-')) {
            newActiveTerminalId = nextTabId.substring('terminal-'.length)
            newActiveEditorTabId = undefined
          }
        } else {
          // No tabs left
          newActiveEditorTabId = undefined
          newActiveTerminalId = undefined
        }
      }

      return {
        ...state,
        editorTabs: newTabs,
        tabOrder: newTabOrder,
        activeEditorTabId: newActiveEditorTabId,
        activeTerminalId: newActiveTerminalId
      }
    }

    case 'SET_ACTIVE_EDITOR_TAB':
      return {
        ...state,
        activeEditorTabId: action.payload,
        activeTerminalId: undefined  // Clear terminal selection when switching to editor
      }

    case 'REORDER_EDITOR_TABS':
      return {
        ...state,
        editorTabs: action.payload
      }

    case 'REORDER_TABS':
      return {
        ...state,
        tabOrder: action.payload
      }

    case 'UPDATE_EDITOR_CONTENT':
      return {
        ...state,
        editorTabs: state.editorTabs.map(tab =>
          tab.id === action.payload.id
            ? { ...tab, content: action.payload.content, isDirty: true }
            : tab
        )
      }

    case 'MARK_TAB_DIRTY':
      return {
        ...state,
        editorTabs: state.editorTabs.map(tab =>
          tab.id === action.payload.id
            ? { ...tab, isDirty: action.payload.isDirty }
            : tab
        )
      }

    case 'TERMINAL_DATA': {
      const newBuffer = new Map(state.terminalDataBuffer)
      const existing = newBuffer.get(action.payload.id) || ''
      newBuffer.set(action.payload.id, existing + action.payload.data)
      return { ...state, terminalDataBuffer: newBuffer }
    }

    case 'TERMINAL_EXIT':
      // Could show notification or handle cleanup
      console.log(
        `Terminal ${action.payload.id} exited with code ${action.payload.exitCode}`
      )
      return state

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

    case 'SET_SIDEBAR_VIEW':
      return { ...state, sidebarView: action.payload }

    default:
      return state
  }
}

export interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => {}
})
