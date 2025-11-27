import { createContext } from 'react'
import { Project, Terminal, AppSettings, EditorTab } from '../../types'

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
}

export type AppAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string }
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
    cursorStyle: 'block'
  },
  terminalDataBuffer: new Map()
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
      const newActiveId =
        state.activeTerminalId === action.payload
          ? newTerminals.length > 0
            ? newTerminals[newTerminals.length - 1].id
            : undefined
          : state.activeTerminalId

      return {
        ...state,
        terminals: newTerminals,
        tabOrder: state.tabOrder.filter(id => id !== `terminal-${action.payload}`),
        activeTerminalId: newActiveId
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
      const existing = state.editorTabs.find(t => t.filePath === action.payload.filePath)
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
      const newActiveId =
        state.activeEditorTabId === action.payload
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1].id
            : undefined
          : state.activeEditorTabId

      return {
        ...state,
        editorTabs: newTabs,
        tabOrder: state.tabOrder.filter(id => id !== `editor-${action.payload}`),
        activeEditorTabId: newActiveId
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
