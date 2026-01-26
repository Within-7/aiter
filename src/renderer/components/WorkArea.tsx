import React, { useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
import { useTabDragDrop } from '../hooks/useTabDragDrop'
import { defaultVoiceInputSettings, VoiceTranscription, VoiceRecord } from '../../types/voiceInput'
import type { EditorTab } from '../../types'
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

  // Tab drag and drop functionality
  const {
    draggedTabId,
    dragOverTabId,
    dragOverEnd,
    handleDragStart,
    handleDragOver,
    handleDragOverEnd,
    handleDragEnd,
    handleDrop,
    handleDropAtEnd,
    clearDragOverEnd
  } = useTabDragDrop(state, dispatch)

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

  // Memoize project color lookup maps to avoid recalculating on every render
  // This creates stable references that only change when projects actually change
  const projectColorById = useMemo(() => {
    const map = new Map<string, string>()
    state.projects.forEach(p => {
      map.set(p.id, getProjectColor(p.id, p.color))
    })
    return map
  }, [state.projects])

  const projectColorByPath = useMemo(() => {
    const map = new Map<string, string>()
    state.projects.forEach(p => {
      map.set(p.path, getProjectColor(p.id, p.color))
    })
    return map
  }, [state.projects])

  // Memoize tabs creation to prevent unnecessary recalculations
  const allTabs = useMemo(() => {
    const tabsById = new Map<string, Tab>()

    state.editorTabs.forEach(t => {
      // For diff tabs, use projectPath; for regular tabs, match by filePath
      let projectColor: string | undefined
      if (t.projectPath) {
        projectColor = projectColorByPath.get(t.projectPath)
      } else {
        // Find project by file path prefix
        for (const [path, color] of projectColorByPath) {
          if (t.filePath.startsWith(path)) {
            projectColor = color
            break
          }
        }
      }
      tabsById.set(`editor-${t.id}`, {
        id: `editor-${t.id}`,
        type: 'editor' as TabType,
        title: t.isDirty ? `● ${t.fileName}` : t.fileName,
        projectColor,
        isPreview: t.isPreview
      })
    })

    state.terminals.forEach(t => {
      tabsById.set(`terminal-${t.id}`, {
        id: `terminal-${t.id}`,
        type: 'terminal' as TabType,
        title: t.name,
        projectColor: projectColorById.get(t.projectId)
      })
    })

    // Use tabOrder to determine display order, filtering out any removed tabs
    return (state.tabOrder || [])
      .map(id => tabsById.get(id))
      .filter((tab): tab is Tab => tab !== undefined)
  }, [state.editorTabs, state.terminals, state.tabOrder, projectColorById, projectColorByPath])

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
      // Normal click: activate tab (this also updates selection in a single dispatch)
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

  // Use refs to store current state values for event handlers to avoid re-registering listeners
  const stateRef = useRef({ terminals: state.terminals, editorTabs: state.editorTabs, settings: state.settings })
  stateRef.current = { terminals: state.terminals, editorTabs: state.editorTabs, settings: state.settings }

  // Listen for terminal and editor close request events - register once using refs
  useEffect(() => {
    const handleCloseTerminalRequest = (event: CustomEvent<{ terminalId: string }>) => {
      const { terminalId } = event.detail
      if (!terminalId) return

      const { terminals, settings } = stateRef.current
      // Check if confirmation is enabled in settings
      if (settings.confirmTerminalClose ?? true) {
        // Find terminal name for confirmation dialog
        const terminal = terminals.find(t => t.id === terminalId)
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
    }

    const handleCloseEditorRequest = (event: CustomEvent<{ editorTabId: string }>) => {
      const { editorTabId } = event.detail
      if (!editorTabId) return

      const { editorTabs } = stateRef.current
      const editorTab = editorTabs.find(t => t.id === editorTabId)

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
    }

    window.addEventListener('close-terminal-request', handleCloseTerminalRequest as EventListener)
    window.addEventListener('close-editor-request', handleCloseEditorRequest as EventListener)

    return () => {
      window.removeEventListener('close-terminal-request', handleCloseTerminalRequest as EventListener)
      window.removeEventListener('close-editor-request', handleCloseEditorRequest as EventListener)
    }
  }, [dispatch]) // Only dispatch is stable, handlers use refs for current state

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
            onDragLeave={clearDragOverEnd}
            onDoubleClick={() => dispatch({ type: 'ADD_SCRATCHPAD_TAB' })}
          />
        </div>
        <div className={`work-area-tabs-right ${isWindows ? 'windows-platform' : ''}`}>
          {/* File type selector for scratchpad tabs */}
          {activeEditorTab?.isScratchpad && (
            <select
              className="scratchpad-type-selector"
              value={activeEditorTab.fileType}
              onChange={(e) => dispatch({
                type: 'UPDATE_SCRATCHPAD_TYPE',
                payload: { id: activeEditorTab.id, fileType: e.target.value as EditorTab['fileType'] }
              })}
              title="Select content type"
            >
              <option value="text">Plain Text</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="css">CSS</option>
              <option value="python">Python</option>
              <option value="shell">Shell</option>
              <option value="sql">SQL</option>
              <option value="yaml">YAML</option>
              <option value="xml">XML</option>
            </select>
          )}
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
                tabId={activeEditorTab.id}
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
                isActive={!isTerminalActive}
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
