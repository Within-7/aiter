import React, { useContext, useState, useCallback, useMemo } from 'react'
import { AppContext } from '../context/AppContext'
import { MonacoEditorLazy } from './Editor/MonacoEditorLazy'
import { MarkdownEditor } from './Editor/MarkdownEditor'
import { HTMLPreview } from './Editor/HTMLPreview'
import { DiffViewer } from './Editor/DiffViewer'
import { ImageViewer } from './Editor/ImageViewer'
import { PDFViewer } from './Editor/PDFViewer'
import { OfficeViewer } from './Editor/OfficeViewer'
import { TerminalContainer } from './TerminalContainer'
import { ConfirmDialog } from './FileTree/ConfirmDialog'
import { VoiceInputButton, InlineVoiceBubble } from './VoiceInput'
import { useInlineVoiceInput } from '../hooks/useInlineVoiceInput'
import { defaultVoiceInputSettings, VoiceTranscription, VoiceRecord } from '../../types/voiceInput'
import { getProjectColor } from '../utils/projectColors'
import '../styles/WorkArea.css'

type TabType = 'editor' | 'terminal'

interface Tab {
  id: string
  type: TabType
  title: string
  projectColor?: string
  isPreview?: boolean
}

// Dialog state for terminal close confirmation
interface CloseTerminalDialogState {
  show: boolean
  terminalId: string | null
  terminalName: string
}

// Dialog state for scratchpad close confirmation
interface CloseScratchpadDialogState {
  show: boolean
  tabId: string | null
  tabName: string
}

export const WorkArea: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)

  // Track edit/preview mode for each editor tab
  const [editorModes, setEditorModes] = useState<Record<string, 'preview' | 'edit'>>({})

  // Track dragging state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const [dragOverEnd, setDragOverEnd] = useState<boolean>(false) // For dropping at the end

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

  // Detect platform for Windows-specific styling
  const isWindows = navigator.platform.toLowerCase().includes('win')

  // Get voice input settings
  const voiceSettings = state.settings.voiceInput || defaultVoiceInputSettings

  // Get active project path for voice backup
  const activeProjectPath = useMemo(() => {
    if (!state.activeProjectId) return undefined
    const project = state.projects.find(p => p.id === state.activeProjectId)
    return project?.path
  }, [state.activeProjectId, state.projects])

  // Toggle voice panel
  const handleVoicePanelToggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_VOICE_PANEL' })
  }, [dispatch])

  // Handle inline voice text insertion (for Push-to-Talk)
  // backupId is the streaming backup ID - if provided, update existing record instead of creating new one
  const handleInlineVoiceInsert = useCallback((text: string, backupId?: string) => {
    // Sanitize text for terminal: replace newlines with spaces
    const sanitizeForTerminal = (t: string) => t
      .replace(/\r\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    let insertedTo: 'terminal' | 'editor' | undefined

    // Check if terminal is active
    if (state.activeTerminalId) {
      const sanitizedText = sanitizeForTerminal(text)
      window.api.terminal.write(state.activeTerminalId, sanitizedText)
      // Auto-execute if enabled
      if (voiceSettings.autoExecuteInTerminal) {
        window.api.terminal.write(state.activeTerminalId, '\r')
      }
      insertedTo = 'terminal'
    } else if (state.activeEditorTabId) {
      // Check if editor is active
      window.dispatchEvent(new CustomEvent('voice-input-insert', {
        detail: { text }
      }))
      insertedTo = 'editor'
    } else {
      console.log('[WorkArea] No active target for inline voice input')
    }

    // Use backupId if available (streaming backup created record), otherwise generate new ID
    const recordId = backupId || Date.now().toString()
    const timestamp = backupId ? parseInt(backupId, 10) : Date.now()

    // Add to voice transcription history (shared with voice panel)
    const transcription: VoiceTranscription = {
      id: recordId,
      text: text.trim(),
      timestamp,
      source: 'inline',
      projectId: state.activeProjectId,
      insertedTo
    }
    dispatch({ type: 'ADD_VOICE_TRANSCRIPTION', payload: transcription })

    // Persist to disk using unified records API
    if (activeProjectPath) {
      if (backupId) {
        // Update existing record created by streaming backup
        window.api.voiceRecords.update(activeProjectPath, backupId, {
          status: 'transcribed',
          text: transcription.text,
          insertedTo: transcription.insertedTo
        }).catch(err => {
          console.error('[WorkArea] Failed to update voice record:', err)
        })
      } else {
        // Create new record (fallback if no streaming backup)
        const record: VoiceRecord = {
          id: transcription.id,
          timestamp: transcription.timestamp,
          source: transcription.source,
          projectId: transcription.projectId,
          status: 'transcribed',
          text: transcription.text,
          insertedTo: transcription.insertedTo
        }
        window.api.voiceRecords.add(activeProjectPath, record).catch(err => {
          console.error('[WorkArea] Failed to persist voice transcription:', err)
        })
      }
    }
  }, [state.activeTerminalId, state.activeEditorTabId, state.activeProjectId, voiceSettings.autoExecuteInTerminal, dispatch, activeProjectPath])

  // Inline voice input (Push-to-Talk mode)
  // Only enable if voice panel is not open (avoid conflict)
  const inlineVoice = useInlineVoiceInput({
    settings: {
      ...voiceSettings,
      pushToTalk: {
        ...voiceSettings.pushToTalk,
        // Disable Push-to-Talk if voice panel is open
        enabled: voiceSettings.pushToTalk.enabled && !state.showVoicePanel
      }
    },
    onTextInsert: handleInlineVoiceInsert,
    projectPath: activeProjectPath
  })

  // Voice button shows active state when panel is open or inline recording
  const voiceButtonState = state.showVoicePanel || inlineVoice.isActive ? 'recording' : 'idle'

  // Derive active tab ID from global state
  const activeTabId = state.activeEditorTabId
    ? `editor-${state.activeEditorTabId}`
    : state.activeTerminalId
    ? `terminal-${state.activeTerminalId}`
    : null

  // Memoize tabs creation to prevent unnecessary recalculations
  const allTabs = useMemo(() => {
    const tabsById = new Map<string, Tab>()

    state.editorTabs.forEach(t => {
      // For diff tabs, use projectPath; for regular tabs, match by filePath
      const project = t.projectPath
        ? state.projects.find(p => p.path === t.projectPath)
        : state.projects.find(p => t.filePath.startsWith(p.path))
      tabsById.set(`editor-${t.id}`, {
        id: `editor-${t.id}`,
        type: 'editor' as TabType,
        title: t.isDirty ? `● ${t.fileName}` : t.fileName,
        projectColor: project ? getProjectColor(project.id, project.color) : undefined,
        isPreview: t.isPreview
      })
    })

    state.terminals.forEach(t => {
      const project = state.projects.find(p => p.id === t.projectId)
      tabsById.set(`terminal-${t.id}`, {
        id: `terminal-${t.id}`,
        type: 'terminal' as TabType,
        title: t.name,
        projectColor: project ? getProjectColor(project.id, project.color) : undefined
      })
    })

    // Use tabOrder to determine display order, filtering out any removed tabs
    return (state.tabOrder || [])
      .map(id => tabsById.get(id))
      .filter((tab): tab is Tab => tab !== undefined)
  }, [state.editorTabs, state.terminals, state.projects, state.tabOrder])

  // Handle tab click with multi-select support
  const handleTabClick = useCallback((e: React.MouseEvent, tabId: string) => {
    const isMac = navigator.platform.toLowerCase().includes('mac')
    const isMultiSelectKey = isMac ? e.metaKey : e.ctrlKey

    if (e.shiftKey || isMultiSelectKey) {
      // Multi-select mode: update selection without switching active tab
      dispatch({
        type: 'SELECT_TAB',
        payload: {
          tabId,
          shiftKey: e.shiftKey,
          ctrlKey: isMultiSelectKey
        }
      })
    } else {
      // Normal click: switch to tab and update selection
      dispatch({
        type: 'SELECT_TAB',
        payload: { tabId, shiftKey: false, ctrlKey: false }
      })

      // Also activate the tab
      if (tabId.startsWith('editor-')) {
        const id = tabId.substring('editor-'.length)
        dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: id })
      } else if (tabId.startsWith('terminal-')) {
        const id = tabId.substring('terminal-'.length)
        dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: id })
      }
    }
  }, [dispatch])

  const handleTabClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    if (tabId.startsWith('editor-')) {
      const id = tabId.substring('editor-'.length)
      const editorTab = state.editorTabs.find(t => t.id === id)

      // Check if it's a scratchpad tab with content
      if (editorTab?.isScratchpad && editorTab.content.trim().length > 0) {
        // Show confirmation dialog for scratchpad with content
        setCloseScratchpadDialog({
          show: true,
          tabId: id,
          tabName: editorTab.fileName
        })
      } else {
        // Close directly for non-scratchpad or empty scratchpad
        dispatch({ type: 'REMOVE_EDITOR_TAB', payload: id })
      }
    } else if (tabId.startsWith('terminal-')) {
      const id = tabId.substring('terminal-'.length)
      // Check if confirmation is enabled in settings
      if (state.settings.confirmTerminalClose ?? true) {
        // Find terminal name for confirmation dialog
        const terminal = state.terminals.find(t => t.id === id)
        const terminalName = terminal?.name || 'Terminal'
        // Show confirmation dialog for terminal close
        setCloseTerminalDialog({
          show: true,
          terminalId: id,
          terminalName
        })
      } else {
        // Close immediately without confirmation
        dispatch({ type: 'REMOVE_TERMINAL', payload: id })
      }
    }
  }, [dispatch, state.terminals, state.editorTabs, state.settings.confirmTerminalClose])

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

  // Handle scratchpad close confirmation (discard content)
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

  // Handle terminal close request from keyboard shortcut (Ctrl/Cmd+W)
  const handleCloseTerminalRequest = useCallback((event: CustomEvent<{ terminalId: string }>) => {
    const { terminalId } = event.detail
    if (!terminalId) return

    // Check if confirmation is enabled in settings
    if (state.settings.confirmTerminalClose ?? true) {
      // Find terminal name for confirmation dialog
      const terminal = state.terminals.find(t => t.id === terminalId)
      const terminalName = terminal?.name || 'Terminal'
      // Show confirmation dialog for terminal close
      setCloseTerminalDialog({
        show: true,
        terminalId,
        terminalName
      })
    } else {
      // Close immediately without confirmation
      dispatch({ type: 'REMOVE_TERMINAL', payload: terminalId })
    }
  }, [dispatch, state.terminals, state.settings.confirmTerminalClose])

  // Handle editor close request from keyboard shortcut (Ctrl/Cmd+W)
  const handleCloseEditorRequest = useCallback((event: CustomEvent<{ editorTabId: string }>) => {
    const { editorTabId } = event.detail
    if (!editorTabId) return

    const editorTab = state.editorTabs.find(t => t.id === editorTabId)

    // Check if it's a scratchpad tab with content
    if (editorTab?.isScratchpad && editorTab.content.trim().length > 0) {
      // Show confirmation dialog for scratchpad with content
      setCloseScratchpadDialog({
        show: true,
        tabId: editorTabId,
        tabName: editorTab.fileName
      })
    } else {
      // Close directly for non-scratchpad or empty scratchpad
      dispatch({ type: 'REMOVE_EDITOR_TAB', payload: editorTabId })
    }
  }, [dispatch, state.editorTabs])

  // Listen for terminal close request events
  React.useEffect(() => {
    window.addEventListener('close-terminal-request', handleCloseTerminalRequest as EventListener)
    return () => {
      window.removeEventListener('close-terminal-request', handleCloseTerminalRequest as EventListener)
    }
  }, [handleCloseTerminalRequest])

  // Listen for editor close request events
  React.useEffect(() => {
    window.addEventListener('close-editor-request', handleCloseEditorRequest as EventListener)
    return () => {
      window.removeEventListener('close-editor-request', handleCloseEditorRequest as EventListener)
    }
  }, [handleCloseEditorRequest])

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    // If the dragged tab is not in selection, make it the only selected tab
    if (!state.selectedTabIds.has(tabId)) {
      dispatch({
        type: 'SELECT_TAB',
        payload: { tabId, shiftKey: false, ctrlKey: false }
      })
    }

    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'

    // Create custom drag image showing selection count
    const selectedCount = state.selectedTabIds.has(tabId)
      ? state.selectedTabIds.size
      : 1

    if (selectedCount > 1) {
      // First, group scattered selected tabs together at the first selected tab's position
      const selectedTabIds = Array.from(state.selectedTabIds)
      // Find the first selected tab in the current tab order
      const firstSelectedIndex = state.tabOrder.findIndex(id => selectedTabIds.includes(id))

      if (firstSelectedIndex !== -1) {
        // Group all selected tabs at the first selected tab's position
        dispatch({
          type: 'REORDER_TABS_BATCH',
          payload: { tabIds: selectedTabIds, targetIndex: firstSelectedIndex }
        })
      }

      // Create a custom drag image for multiple tabs
      const dragEl = document.createElement('div')
      dragEl.className = 'multi-tab-drag-image'
      dragEl.textContent = `${selectedCount} tabs`
      dragEl.style.cssText = `
        position: fixed;
        left: -1000px;
        padding: 8px 16px;
        background: #007acc;
        color: white;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `
      document.body.appendChild(dragEl)
      e.dataTransfer.setDragImage(dragEl, 40, 15)
      // Clean up after a short delay
      setTimeout(() => document.body.removeChild(dragEl), 0)
    } else {
      const img = new Image()
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
      e.dataTransfer.setDragImage(img, 0, 0)
    }
  }, [state.selectedTabIds, state.tabOrder, dispatch])

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTabId(tabId)
    setDragOverEnd(false)
  }, [])

  const handleDragOverEnd = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTabId(null)
    setDragOverEnd(true)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null)
    setDragOverTabId(null)
    setDragOverEnd(false)
  }, [])

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()

    if (!draggedTabId) {
      setDraggedTabId(null)
      setDragOverTabId(null)
      return
    }

    const targetIndex = state.tabOrder.findIndex(id => id === targetTabId)

    if (targetIndex === -1) {
      setDraggedTabId(null)
      setDragOverTabId(null)
      return
    }

    // Get all selected tabs to move (or just the dragged one if not in selection)
    const tabsToMove = state.selectedTabIds.has(draggedTabId)
      ? Array.from(state.selectedTabIds)
      : [draggedTabId]

    // Don't do anything if dropping on one of the selected tabs
    if (tabsToMove.includes(targetTabId)) {
      setDraggedTabId(null)
      setDragOverTabId(null)
      return
    }

    // Use batch reorder for multi-select, or simple reorder for single tab
    if (tabsToMove.length > 1) {
      dispatch({
        type: 'REORDER_TABS_BATCH',
        payload: { tabIds: tabsToMove, targetIndex }
      })
    } else {
      // Single tab reorder (original behavior)
      const draggedIndex = state.tabOrder.findIndex(id => id === draggedTabId)
      if (draggedIndex !== -1) {
        const newTabOrder = [...state.tabOrder]
        const [removed] = newTabOrder.splice(draggedIndex, 1)
        newTabOrder.splice(targetIndex, 0, removed)
        dispatch({ type: 'REORDER_TABS', payload: newTabOrder })
      }
    }

    setDraggedTabId(null)
    setDragOverTabId(null)
    setDragOverEnd(false)
  }

  const handleDropAtEnd = (e: React.DragEvent) => {
    e.preventDefault()

    if (!draggedTabId) {
      setDraggedTabId(null)
      setDragOverEnd(false)
      return
    }

    // Get all selected tabs to move (or just the dragged one if not in selection)
    const tabsToMove = state.selectedTabIds.has(draggedTabId)
      ? Array.from(state.selectedTabIds)
      : [draggedTabId]

    // Insert at the end of tabOrder
    const targetIndex = state.tabOrder.length

    if (tabsToMove.length > 1) {
      dispatch({
        type: 'REORDER_TABS_BATCH',
        payload: { tabIds: tabsToMove, targetIndex }
      })
    } else {
      // Single tab reorder to the end
      const draggedIndex = state.tabOrder.findIndex(id => id === draggedTabId)
      if (draggedIndex !== -1 && draggedIndex < state.tabOrder.length - 1) {
        const newTabOrder = [...state.tabOrder]
        const [removed] = newTabOrder.splice(draggedIndex, 1)
        newTabOrder.push(removed)
        dispatch({ type: 'REORDER_TABS', payload: newTabOrder })
      }
    }

    setDraggedTabId(null)
    setDragOverTabId(null)
    setDragOverEnd(false)
  }

  const handleContentChange = (content: string) => {
    const activeEditorTab = state.editorTabs.find(t => `editor-${t.id}` === activeTabId)
    if (activeEditorTab) {
      dispatch({
        type: 'UPDATE_EDITOR_CONTENT',
        payload: { id: activeEditorTab.id, content }
      })
    }
  }

  const handleSave = async (content?: string) => {
    const activeEditorTab = state.editorTabs.find(t => `editor-${t.id}` === activeTabId)
    if (!activeEditorTab) return

    // Use provided content (from editor) or fall back to state content
    const contentToSave = content !== undefined ? content : activeEditorTab.content

    try {
      const result = await window.api.fs.writeFile(activeEditorTab.filePath, contentToSave)
      if (result.success) {
        // Update state with the saved content if it was provided
        if (content !== undefined && content !== activeEditorTab.content) {
          dispatch({
            type: 'UPDATE_EDITOR_CONTENT',
            payload: { id: activeEditorTab.id, content }
          })
        }
        dispatch({
          type: 'MARK_TAB_DIRTY',
          payload: { id: activeEditorTab.id, isDirty: false }
        })
      } else {
        console.error('Failed to save file:', result.error)
      }
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const activeEditorTab = state.editorTabs.find(t => `editor-${t.id}` === activeTabId)
  const isTerminalActive = activeTabId?.startsWith('terminal-')

  // Get current mode for active editor tab
  const currentMode = activeEditorTab ? (editorModes[activeEditorTab.id] || 'preview') : 'preview'

  // Check if active tab supports preview mode (diff tabs don't support preview toggle)
  const supportsPreview = activeEditorTab && !activeEditorTab.isDiff && (activeEditorTab.fileType === 'markdown' || activeEditorTab.fileType === 'html')

  // Toggle between preview and edit modes
  const toggleMode = () => {
    if (activeEditorTab && supportsPreview) {
      setEditorModes(prev => ({
        ...prev,
        [activeEditorTab.id]: prev[activeEditorTab.id] === 'edit' ? 'preview' : 'edit'
      }))
    }
  }

  if (allTabs.length === 0) {
    return (
      <div className="work-area">
        <div className="work-area-empty">
          <p>No files or terminals open</p>
          <p>Click a file to edit or create a terminal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="work-area">
      <div className="work-area-tabs">
        <div className="work-area-tabs-left">
          {allTabs.map(tab => {
            const isActive = tab.id === activeTabId
            const isDragging = draggedTabId === tab.id
            const isDragOver = dragOverTabId === tab.id
            const isSelected = state.selectedTabIds.has(tab.id)
            const isMultiSelected = isSelected && state.selectedTabIds.size > 1

            return (
              <div
                key={tab.id}
                className={`work-area-tab ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${tab.isPreview ? 'preview' : ''}`}
                onClick={(e) => handleTabClick(e, tab.id)}
                onDoubleClick={() => {
                  // Double-click on tab pins it (converts preview to permanent)
                  if (tab.isPreview && tab.id.startsWith('editor-')) {
                    const id = tab.id.substring('editor-'.length)
                    dispatch({ type: 'PIN_EDITOR_TAB', payload: id })
                  }
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, tab.id)}
                style={{
                  borderTopColor: tab.projectColor || 'transparent',
                  background: isActive && tab.projectColor
                    ? `linear-gradient(to bottom, ${tab.projectColor}40, #1e1e1e)`
                    : undefined
                }}
              >
                <span className="tab-icon">
                  {tab.type === 'editor' ? '📄' : '⌨️'}
                </span>
                <span className="tab-title">{tab.title}</span>
                <button
                  className="tab-close"
                  onClick={(e) => handleTabClose(e, tab.id)}
                  title="Close"
                >
                  ×
                </button>
              </div>
            )
          })}
          {/* Drop zone for dropping tabs at the end / double-click to create scratchpad */}
          <div
            className={`tab-drop-end-zone ${dragOverEnd ? 'drag-over' : ''}`}
            onDragOver={handleDragOverEnd}
            onDrop={handleDropAtEnd}
            onDragLeave={() => setDragOverEnd(false)}
            onDoubleClick={() => dispatch({ type: 'ADD_SCRATCHPAD_TAB' })}
          />
        </div>
        <div className={`work-area-tabs-right ${isWindows ? 'windows-platform' : ''}`}>
          {/* Voice Input Button - toggles voice panel */}
          <VoiceInputButton
            isEnabled={voiceSettings.enabled}
            state={voiceButtonState as 'idle' | 'recording' | 'processing' | 'error'}
            onClick={handleVoicePanelToggle}
          />
          <button
            className={`mode-toggle-button ${!supportsPreview ? 'disabled' : ''}`}
            onClick={toggleMode}
            disabled={!supportsPreview}
            title={
              !supportsPreview
                ? 'Preview not available'
                : currentMode === 'preview'
                ? 'Switch to Edit Mode'
                : 'Switch to Preview Mode'
            }
          >
            {currentMode === 'preview' ? '📝' : '📖'}
          </button>
        </div>
      </div>

      <div className="work-area-content">
        {activeEditorTab && (
          <div className={`editor-container ${isTerminalActive ? 'hidden' : ''}`}>
            {activeEditorTab.isDiff ? (
              <DiffViewer
                diffContent={activeEditorTab.diffContent || ''}
                fileName={activeEditorTab.fileName}
                commitHash={activeEditorTab.commitHash}
                commitMessage={activeEditorTab.commitMessage}
              />
            ) : activeEditorTab.fileType === 'markdown' ? (
              <MarkdownEditor
                value={activeEditorTab.content}
                onChange={handleContentChange}
                onSave={handleSave}
                mode={currentMode}
                currentFilePath={activeEditorTab.filePath}
              />
            ) : activeEditorTab.fileType === 'html' ? (
              <HTMLPreview
                value={activeEditorTab.content}
                onChange={handleContentChange}
                onSave={handleSave}
                mode={currentMode}
                currentFilePath={activeEditorTab.filePath}
              />
            ) : activeEditorTab.fileType === 'image' ? (
              <ImageViewer
                src={activeEditorTab.content}
                fileName={activeEditorTab.fileName}
              />
            ) : activeEditorTab.fileType === 'pdf' ? (
              <PDFViewer
                filePath={activeEditorTab.filePath}
                fileName={activeEditorTab.fileName}
              />
            ) : activeEditorTab.fileType === 'word' || activeEditorTab.fileType === 'excel' || activeEditorTab.fileType === 'powerpoint' ? (
              <OfficeViewer
                filePath={activeEditorTab.filePath}
                fileName={activeEditorTab.fileName}
                fileType={activeEditorTab.fileType}
              />
            ) : (
              <MonacoEditorLazy
                value={activeEditorTab.content}
                language={activeEditorTab.fileType}
                onChange={handleContentChange}
                onSave={handleSave}
              />
            )}
          </div>
        )}

        <div className={`terminal-area ${!isTerminalActive ? 'hidden' : ''}`}>
          {state.terminals.length > 0 && (
            <TerminalContainer
              terminals={state.terminals}
              activeTerminalId={state.activeTerminalId}
              settings={state.settings}
            />
          )}
        </div>
      </div>

      {/* Terminal close confirmation dialog */}
      {closeTerminalDialog.show && (
        <ConfirmDialog
          title="Close Terminal"
          message={`Are you sure you want to close "${closeTerminalDialog.terminalName}"? Any running processes will be terminated.`}
          confirmLabel="Close"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmCloseTerminal}
          onCancel={handleCancelCloseTerminal}
        />
      )}

      {/* Scratchpad close confirmation dialog */}
      {closeScratchpadDialog.show && (
        <ConfirmDialog
          title="Discard Changes?"
          message={`"${closeScratchpadDialog.tabName}" has unsaved content. Do you want to discard it?`}
          confirmLabel="Discard"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmCloseScratchpad}
          onCancel={handleCancelCloseScratchpad}
        />
      )}

      {/* Inline Voice Bubble (Push-to-Talk mode) */}
      <InlineVoiceBubble
        isVisible={inlineVoice.isActive && voiceSettings.enabled}
        state={inlineVoice.state}
        interimText={inlineVoice.interimText}
        error={inlineVoice.error}
      />
    </div>
  )
}
