import { createContext } from 'react'
import { Project, Terminal, AppSettings, EditorTab, ShortcutConfig } from '../../types'

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
    startupCommand: 'minto'
  },
  terminalDataBuffer: new Map(),
  showPluginPanel: false,
  showAboutPanel: false,
  showSettingsPanel: false,
  showWorkspaceManager: false,
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
        // If existing tab is a preview tab, pin it (user explicitly opened the same file again)
        if (existing.isPreview) {
          return {
            ...state,
            editorTabs: state.editorTabs.map(t =>
              t.id === existing.id ? { ...t, isPreview: false } : t
            ),
            activeEditorTabId: existing.id,
            activeTerminalId: undefined
          }
        }
        return {
          ...state,
          activeEditorTabId: existing.id,
          activeTerminalId: undefined  // Clear terminal selection when switching to editor
        }
      }

      // Check if there's an existing preview tab that should be replaced
      const existingPreviewTab = state.editorTabs.find(t => t.isPreview)

      if (existingPreviewTab && action.payload.isPreview) {
        // Replace the existing preview tab with the new one
        const previewTabOrderId = `editor-${existingPreviewTab.id}`
        const newTabOrderId = `editor-${action.payload.id}`

        return {
          ...state,
          editorTabs: state.editorTabs
            .filter(t => t.id !== existingPreviewTab.id)
            .concat(action.payload),
          tabOrder: state.tabOrder.map(id =>
            id === previewTabOrderId ? newTabOrderId : id
          ),
          activeEditorTabId: action.payload.id,
          activeTerminalId: undefined
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
            ? { ...tab, content: action.payload.content, isDirty: true, isPreview: false }
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

    case 'PIN_EDITOR_TAB':
      return {
        ...state,
        editorTabs: state.editorTabs.map(tab =>
          tab.id === action.payload
            ? { ...tab, isPreview: false }
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

    case 'TOGGLE_WORKSPACE_MANAGER':
      return { ...state, showWorkspaceManager: !state.showWorkspaceManager }

    case 'SET_WORKSPACE_MANAGER':
      return { ...state, showWorkspaceManager: action.payload }

    case 'SET_SIDEBAR_VIEW':
      return { ...state, sidebarView: action.payload }

    case 'SELECT_TAB': {
      const { tabId, shiftKey, ctrlKey } = action.payload
      const newSelection = new Set(state.selectedTabIds)

      if (shiftKey && state.lastSelectedTabId) {
        // Shift+Click: Range selection from lastSelectedTabId to tabId
        const startIndex = state.tabOrder.indexOf(state.lastSelectedTabId)
        const endIndex = state.tabOrder.indexOf(tabId)

        if (startIndex !== -1 && endIndex !== -1) {
          const [from, to] = startIndex < endIndex
            ? [startIndex, endIndex]
            : [endIndex, startIndex]

          // Add all tabs in range to selection
          for (let i = from; i <= to; i++) {
            newSelection.add(state.tabOrder[i])
          }
        }

        return {
          ...state,
          selectedTabIds: newSelection
          // Don't update lastSelectedTabId on shift-click
        }
      } else if (ctrlKey) {
        // Ctrl/Cmd+Click: Toggle individual selection
        if (newSelection.has(tabId)) {
          newSelection.delete(tabId)
        } else {
          newSelection.add(tabId)
        }

        return {
          ...state,
          selectedTabIds: newSelection,
          lastSelectedTabId: tabId
        }
      } else {
        // Normal click: Clear selection and select only this tab
        return {
          ...state,
          selectedTabIds: new Set([tabId]),
          lastSelectedTabId: tabId
        }
      }
    }

    case 'CLEAR_TAB_SELECTION':
      return {
        ...state,
        selectedTabIds: new Set(),
        lastSelectedTabId: undefined
      }

    case 'REORDER_TABS_BATCH': {
      const { tabIds, targetIndex } = action.payload

      // Remove the dragged tabs from their current positions
      const remainingTabs = state.tabOrder.filter(id => !tabIds.includes(id))

      // Calculate the adjusted target index
      // Count how many dragged tabs were before the target position
      let adjustedIndex = targetIndex
      for (const id of tabIds) {
        const originalIndex = state.tabOrder.indexOf(id)
        if (originalIndex !== -1 && originalIndex < targetIndex) {
          adjustedIndex--
        }
      }

      // Ensure the adjusted index is within bounds
      adjustedIndex = Math.max(0, Math.min(adjustedIndex, remainingTabs.length))

      // Insert the dragged tabs at the target position (preserve their relative order)
      const orderedDraggedTabs = state.tabOrder.filter(id => tabIds.includes(id))
      const newTabOrder = [
        ...remainingTabs.slice(0, adjustedIndex),
        ...orderedDraggedTabs,
        ...remainingTabs.slice(adjustedIndex)
      ]

      return {
        ...state,
        tabOrder: newTabOrder
      }
    }

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
