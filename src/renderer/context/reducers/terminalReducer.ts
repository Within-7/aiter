import { AppState, AppAction } from '../AppContext'
import { removeTabAndActivateNext } from '../utils/tabManagement'

/**
 * Handles terminal-related actions
 */
export function terminalReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_TERMINAL': {
      // Insert new terminal tab after the current active tab
      const newTabId = `terminal-${action.payload.id}`
      let newTabOrder: string[]

      // Find current active tab position
      const activeTabId = state.activeEditorTabId
        ? `editor-${state.activeEditorTabId}`
        : state.activeTerminalId
        ? `terminal-${state.activeTerminalId}`
        : null

      if (activeTabId) {
        const activeIndex = state.tabOrder.indexOf(activeTabId)
        if (activeIndex !== -1) {
          // Insert after the active tab
          newTabOrder = [
            ...state.tabOrder.slice(0, activeIndex + 1),
            newTabId,
            ...state.tabOrder.slice(activeIndex + 1)
          ]
        } else {
          // Fallback: append to end
          newTabOrder = [...state.tabOrder, newTabId]
        }
      } else {
        // No active tab, append to end
        newTabOrder = [...state.tabOrder, newTabId]
      }

      return {
        ...state,
        terminals: [...state.terminals, action.payload],
        tabOrder: newTabOrder,
        activeTerminalId: action.payload.id,
        activeEditorTabId: undefined  // Clear editor selection when opening terminal
      }
    }

    case 'REMOVE_TERMINAL': {
      const newTerminals = state.terminals.filter((t) => t.id !== action.payload)
      const removedTabId = `terminal-${action.payload}`
      const isActiveTab = state.activeTerminalId === action.payload

      const { newTabOrder, newActiveTerminalId, newActiveEditorTabId } = removeTabAndActivateNext(
        removedTabId,
        state.tabOrder,
        state.activeTerminalId,
        state.activeEditorTabId,
        isActiveTab
      )

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

    default:
      return state
  }
}
