import { AppState, AppAction } from '../AppContext'
import { removeTabAndActivateNext } from '../utils/tabManagement'
import type { EditorTab } from '../../../types'

// Counter for generating unique scratchpad names
let scratchpadCounter = 1

/**
 * Handles editor tab-related actions
 */
export function editorReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_SCRATCHPAD_TAB': {
      // Generate unique ID and name for the scratchpad
      const id = `scratchpad-${Date.now()}`
      const name = `Untitled-${scratchpadCounter++}`

      const scratchpadTab: EditorTab = {
        id,
        filePath: '', // Empty for scratchpad
        fileName: name,
        fileType: 'text',
        content: '',
        isDirty: false,
        isScratchpad: true
      }

      // Insert new tab after the current active tab
      const newTabId = `editor-${id}`
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
        editorTabs: [...state.editorTabs, scratchpadTab],
        tabOrder: newTabOrder,
        activeEditorTabId: id,
        activeTerminalId: undefined
      }
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

      // Insert new tab after the current active tab
      const newTabId = `editor-${action.payload.id}`
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
        editorTabs: [...state.editorTabs, action.payload],
        tabOrder: newTabOrder,
        activeEditorTabId: action.payload.id,
        activeTerminalId: undefined  // Clear terminal selection when switching to editor
      }
    }

    case 'UPDATE_SCRATCHPAD_TYPE': {
      // Only allow changing file type for scratchpad tabs
      const tab = state.editorTabs.find(t => t.id === action.payload.id)
      if (!tab?.isScratchpad) {
        return state
      }

      return {
        ...state,
        editorTabs: state.editorTabs.map(t =>
          t.id === action.payload.id
            ? { ...t, fileType: action.payload.fileType }
            : t
        )
      }
    }

    case 'REMOVE_EDITOR_TAB': {
      const newTabs = state.editorTabs.filter(t => t.id !== action.payload)
      const removedTabId = `editor-${action.payload}`
      const isActiveTab = state.activeEditorTabId === action.payload

      const { newTabOrder, newActiveTerminalId, newActiveEditorTabId } = removeTabAndActivateNext(
        removedTabId,
        state.tabOrder,
        state.activeTerminalId,
        state.activeEditorTabId,
        isActiveTab
      )

      return {
        ...state,
        editorTabs: newTabs,
        tabOrder: newTabOrder,
        activeEditorTabId: newActiveEditorTabId,
        activeTerminalId: newActiveTerminalId
      }
    }

    case 'SET_ACTIVE_EDITOR_TAB': {
      const tabId = `editor-${action.payload}`
      return {
        ...state,
        activeEditorTabId: action.payload,
        activeTerminalId: undefined,  // Clear terminal selection when switching to editor
        // Update selection state in a single dispatch to avoid double render
        selectedTabIds: new Set([tabId]),
        lastSelectedTabId: tabId
      }
    }

    case 'REORDER_EDITOR_TABS':
      return {
        ...state,
        editorTabs: action.payload
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

    default:
      return state
  }
}
