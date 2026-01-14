import { useContext, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import { useKeyboardShortcuts, ShortcutHandler } from '../hooks/useKeyboardShortcuts'
import { ShortcutAction } from '../../types'

export const KeyboardShortcutsHandler: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)

  const handleShortcut: ShortcutHandler = useCallback(async (action: ShortcutAction) => {
    switch (action) {
      case 'newTerminal': {
        // Create new terminal for active project
        const activeProject = state.projects.find(p => p.id === state.activeProjectId)
        if (activeProject) {
          const result = await window.api.terminal.create(
            activeProject.path,
            activeProject.id,
            activeProject.name,
            state.settings?.shell
          )
          if (result.success && result.terminal) {
            dispatch({ type: 'ADD_TERMINAL', payload: result.terminal })
          }
        }
        break
      }

      case 'closeTab': {
        // Close active tab (terminal or editor)
        if (state.activeEditorTabId) {
          dispatch({ type: 'REMOVE_EDITOR_TAB', payload: state.activeEditorTabId })
        } else if (state.activeTerminalId) {
          // Dispatch event to let WorkArea handle terminal close with confirmation
          window.dispatchEvent(new CustomEvent('close-terminal-request', {
            detail: { terminalId: state.activeTerminalId }
          }))
        }
        break
      }

      case 'saveFile': {
        // Save is handled by individual editors, but we can dispatch an event
        // This is a placeholder - editors handle Cmd+S directly
        break
      }

      case 'openSettings': {
        dispatch({ type: 'SET_SETTINGS_PANEL', payload: true })
        break
      }

      case 'newWindow': {
        // Open a new window
        await window.api.window.create()
        break
      }

      case 'toggleSidebar': {
        // Toggle sidebar visibility - dispatch a custom event
        window.dispatchEvent(new CustomEvent('toggle-sidebar'))
        break
      }

      case 'nextTab': {
        // Switch to next tab
        if (state.tabOrder.length > 1) {
          const currentTabId = state.activeEditorTabId
            ? `editor-${state.activeEditorTabId}`
            : state.activeTerminalId
              ? `terminal-${state.activeTerminalId}`
              : null

          if (currentTabId) {
            const currentIndex = state.tabOrder.indexOf(currentTabId)
            const nextIndex = (currentIndex + 1) % state.tabOrder.length
            const nextTabId = state.tabOrder[nextIndex]

            if (nextTabId.startsWith('editor-')) {
              dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: nextTabId.replace('editor-', '') })
            } else if (nextTabId.startsWith('terminal-')) {
              dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: nextTabId.replace('terminal-', '') })
            }
          }
        }
        break
      }

      case 'prevTab': {
        // Switch to previous tab
        if (state.tabOrder.length > 1) {
          const currentTabId = state.activeEditorTabId
            ? `editor-${state.activeEditorTabId}`
            : state.activeTerminalId
              ? `terminal-${state.activeTerminalId}`
              : null

          if (currentTabId) {
            const currentIndex = state.tabOrder.indexOf(currentTabId)
            const prevIndex = (currentIndex - 1 + state.tabOrder.length) % state.tabOrder.length
            const prevTabId = state.tabOrder[prevIndex]

            if (prevTabId.startsWith('editor-')) {
              dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: prevTabId.replace('editor-', '') })
            } else if (prevTabId.startsWith('terminal-')) {
              dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: prevTabId.replace('terminal-', '') })
            }
          }
        }
        break
      }

      case 'focusTerminal': {
        // Focus on the active terminal
        if (state.activeTerminalId) {
          const terminalElement = document.querySelector(`[data-terminal-id="${state.activeTerminalId}"]`)
          if (terminalElement) {
            (terminalElement as HTMLElement).focus()
          }
        } else if (state.terminals.length > 0) {
          // Switch to first terminal if none active
          dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: state.terminals[0].id })
        }
        break
      }

      case 'focusEditor': {
        // Focus on the active editor
        if (state.activeEditorTabId) {
          const editorElement = document.querySelector('.monaco-editor textarea')
          if (editorElement) {
            (editorElement as HTMLElement).focus()
          }
        } else if (state.editorTabs.length > 0) {
          // Switch to first editor if none active
          dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: state.editorTabs[0].id })
        }
        break
      }
    }
  }, [state, dispatch])

  useKeyboardShortcuts(handleShortcut)

  // This component doesn't render anything
  return null
}
