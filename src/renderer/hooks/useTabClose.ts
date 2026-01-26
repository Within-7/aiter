/**
 * Custom hook for tab close functionality with confirmation dialogs
 * Handles both terminal and scratchpad close confirmations
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Terminal, EditorTab, AppSettings } from '../../types'

// Dialog state for terminal close confirmation
export interface CloseTerminalDialogState {
  show: boolean
  terminalId: string | null
  terminalName: string
}

// Dialog state for scratchpad close confirmation
export interface CloseScratchpadDialogState {
  show: boolean
  tabId: string | null
  tabName: string
}

interface UseTabCloseOptions {
  terminals: Terminal[]
  editorTabs: EditorTab[]
  settings: AppSettings
  dispatch: React.Dispatch<{ type: string; payload?: unknown }>
}

export interface UseTabCloseReturn {
  // Dialog states
  closeTerminalDialog: CloseTerminalDialogState
  closeScratchpadDialog: CloseScratchpadDialogState

  // Handlers
  handleTabClose: (e: React.MouseEvent, tabId: string) => void
  handleConfirmCloseTerminal: () => void
  handleCancelCloseTerminal: () => void
  handleConfirmCloseScratchpad: () => void
  handleCancelCloseScratchpad: () => void
}

export function useTabClose({
  terminals,
  editorTabs,
  settings,
  dispatch
}: UseTabCloseOptions): UseTabCloseReturn {
  // Track terminal close confirmation dialog
  const [closeTerminalDialog, setCloseTerminalDialog] = useState<CloseTerminalDialogState>({
    show: false,
    terminalId: null,
    terminalName: ''
  })

  // Track scratchpad close confirmation dialog
  const [closeScratchpadDialog, setCloseScratchpadDialog] = useState<CloseScratchpadDialogState>({
    show: false,
    tabId: null,
    tabName: ''
  })

  // Use refs to store current state values for event handlers
  const stateRef = useRef({ terminals, editorTabs, settings })
  stateRef.current = { terminals, editorTabs, settings }

  // Handle tab close with confirmation logic
  const handleTabClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()

    if (tabId.startsWith('editor-')) {
      const id = tabId.substring('editor-'.length)
      const editorTab = editorTabs.find(t => t.id === id)

      // Check if it's a scratchpad tab with content
      if (editorTab?.isScratchpad && editorTab.content.trim().length > 0) {
        setCloseScratchpadDialog({
          show: true,
          tabId: id,
          tabName: editorTab.fileName
        })
      } else {
        dispatch({ type: 'REMOVE_EDITOR_TAB', payload: id })
      }
    } else if (tabId.startsWith('terminal-')) {
      const id = tabId.substring('terminal-'.length)

      if (settings.confirmTerminalClose ?? true) {
        const terminal = terminals.find(t => t.id === id)
        const terminalName = terminal?.name || 'Terminal'
        setCloseTerminalDialog({
          show: true,
          terminalId: id,
          terminalName
        })
      } else {
        dispatch({ type: 'REMOVE_TERMINAL', payload: id })
      }
    }
  }, [terminals, editorTabs, settings.confirmTerminalClose, dispatch])

  // Handle terminal close confirmation
  const handleConfirmCloseTerminal = useCallback(() => {
    if (closeTerminalDialog.terminalId) {
      dispatch({ type: 'REMOVE_TERMINAL', payload: closeTerminalDialog.terminalId })
    }
    setCloseTerminalDialog({ show: false, terminalId: null, terminalName: '' })
  }, [closeTerminalDialog.terminalId, dispatch])

  // Handle terminal close cancellation
  const handleCancelCloseTerminal = useCallback(() => {
    setCloseTerminalDialog({ show: false, terminalId: null, terminalName: '' })
  }, [])

  // Handle scratchpad close confirmation
  const handleConfirmCloseScratchpad = useCallback(() => {
    if (closeScratchpadDialog.tabId) {
      dispatch({ type: 'REMOVE_EDITOR_TAB', payload: closeScratchpadDialog.tabId })
    }
    setCloseScratchpadDialog({ show: false, tabId: null, tabName: '' })
  }, [closeScratchpadDialog.tabId, dispatch])

  // Handle scratchpad close cancellation
  const handleCancelCloseScratchpad = useCallback(() => {
    setCloseScratchpadDialog({ show: false, tabId: null, tabName: '' })
  }, [])

  // Listen for terminal and editor close request events
  useEffect(() => {
    const handleCloseTerminalRequest = (event: CustomEvent<{ terminalId: string }>) => {
      const { terminalId } = event.detail
      if (!terminalId) return

      const { terminals: currentTerminals, settings: currentSettings } = stateRef.current
      if (currentSettings.confirmTerminalClose ?? true) {
        const terminal = currentTerminals.find(t => t.id === terminalId)
        const terminalName = terminal?.name || 'Terminal'
        setCloseTerminalDialog({
          show: true,
          terminalId,
          terminalName
        })
      } else {
        dispatch({ type: 'REMOVE_TERMINAL', payload: terminalId })
      }
    }

    const handleCloseEditorRequest = (event: CustomEvent<{ editorTabId: string }>) => {
      const { editorTabId } = event.detail
      if (!editorTabId) return

      const { editorTabs: currentEditorTabs } = stateRef.current
      const editorTab = currentEditorTabs.find(t => t.id === editorTabId)

      if (editorTab?.isScratchpad && editorTab.content.trim().length > 0) {
        setCloseScratchpadDialog({
          show: true,
          tabId: editorTabId,
          tabName: editorTab.fileName
        })
      } else {
        dispatch({ type: 'REMOVE_EDITOR_TAB', payload: editorTabId })
      }
    }

    window.addEventListener('close-terminal-request', handleCloseTerminalRequest as EventListener)
    window.addEventListener('close-editor-request', handleCloseEditorRequest as EventListener)

    return () => {
      window.removeEventListener('close-terminal-request', handleCloseTerminalRequest as EventListener)
      window.removeEventListener('close-editor-request', handleCloseEditorRequest as EventListener)
    }
  }, [dispatch])

  return {
    closeTerminalDialog,
    closeScratchpadDialog,
    handleTabClose,
    handleConfirmCloseTerminal,
    handleCancelCloseTerminal,
    handleConfirmCloseScratchpad,
    handleCancelCloseScratchpad
  }
}
