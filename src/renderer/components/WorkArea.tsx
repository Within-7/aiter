/**
 * WorkArea Component
 * Main content area with tabs for editors and terminals
 */

import React, { useContext, useCallback, useMemo } from 'react'
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
import { TabItem } from './WorkArea/TabItem'
import { useInlineVoiceInput } from '../hooks/useInlineVoiceInput'
import { useTabDragDrop } from '../hooks/useTabDragDrop'
import { useTabClose } from '../hooks/useTabClose'
import { useEditorMode } from '../hooks/useEditorMode'
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

export const WorkArea: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)

  // Derive active tab ID from global state
  const activeTabId = state.activeEditorTabId
    ? `editor-${state.activeEditorTabId}`
    : state.activeTerminalId
    ? `terminal-${state.activeTerminalId}`
    : null

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

  // Tab close functionality with confirmation dialogs
  const {
    closeTerminalDialog,
    closeScratchpadDialog,
    handleTabClose,
    handleConfirmCloseTerminal,
    handleCancelCloseTerminal,
    handleConfirmCloseScratchpad,
    handleCancelCloseScratchpad
  } = useTabClose({
    terminals: state.terminals,
    editorTabs: state.editorTabs,
    settings: state.settings,
    dispatch
  })

  // Editor mode management
  const {
    currentMode,
    supportsPreview,
    activeEditorTab,
    toggleMode,
    handleContentChange,
    handleSave
  } = useEditorMode({
    editorTabs: state.editorTabs,
    activeTabId,
    dispatch
  })

  // Detect platform for Windows-specific styling
  const isWindows = navigator.platform.toLowerCase().includes('win')
  const isTerminalActive = activeTabId?.startsWith('terminal-')

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
  const handleInlineVoiceInsert = useCallback((text: string, backupId?: string) => {
    // Sanitize text for terminal
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

    if (state.activeTerminalId) {
      const sanitizedText = sanitizeForTerminal(text)
      window.api.terminal.write(state.activeTerminalId, sanitizedText)
      if (voiceSettings.autoExecuteInTerminal) {
        window.api.terminal.write(state.activeTerminalId, '\r')
      }
      insertedTo = 'terminal'
    } else if (state.activeEditorTabId) {
      window.dispatchEvent(new CustomEvent('voice-input-insert', {
        detail: { text }
      }))
      insertedTo = 'editor'
    } else {
      console.log('[WorkArea] No active target for inline voice input')
    }

    const recordId = backupId || Date.now().toString()
    const timestamp = backupId ? parseInt(backupId, 10) : Date.now()

    const transcription: VoiceTranscription = {
      id: recordId,
      text: text.trim(),
      timestamp,
      source: 'inline',
      projectId: state.activeProjectId,
      insertedTo
    }
    dispatch({ type: 'ADD_VOICE_TRANSCRIPTION', payload: transcription })

    // Persist to disk
    if (activeProjectPath) {
      if (backupId) {
        window.api.voiceRecords.update(activeProjectPath, backupId, {
          status: 'transcribed',
          text: transcription.text,
          insertedTo: transcription.insertedTo
        }).catch(err => console.error('[WorkArea] Failed to update voice record:', err))
      } else {
        const record: VoiceRecord = {
          id: transcription.id,
          timestamp: transcription.timestamp,
          source: transcription.source,
          projectId: transcription.projectId,
          status: 'transcribed',
          text: transcription.text,
          insertedTo: transcription.insertedTo
        }
        window.api.voiceRecords.add(activeProjectPath, record)
          .catch(err => console.error('[WorkArea] Failed to persist voice transcription:', err))
      }
    }
  }, [state.activeTerminalId, state.activeEditorTabId, state.activeProjectId, voiceSettings.autoExecuteInTerminal, dispatch, activeProjectPath])

  // Inline voice input (Push-to-Talk mode)
  const inlineVoice = useInlineVoiceInput({
    settings: {
      ...voiceSettings,
      pushToTalk: {
        ...voiceSettings.pushToTalk,
        enabled: voiceSettings.pushToTalk.enabled && !state.showVoicePanel
      }
    },
    onTextInsert: handleInlineVoiceInsert,
    projectPath: activeProjectPath
  })

  const voiceButtonState = state.showVoicePanel || inlineVoice.isActive ? 'recording' : 'idle'

  // Memoize project color lookup maps
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

  // Memoize tabs creation
  const allTabs = useMemo(() => {
    const tabsById = new Map<string, Tab>()

    state.editorTabs.forEach(t => {
      let projectColor: string | undefined
      if (t.projectPath) {
        projectColor = projectColorByPath.get(t.projectPath)
      } else {
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

    return (state.tabOrder || [])
      .map(id => tabsById.get(id))
      .filter((tab): tab is Tab => tab !== undefined)
  }, [state.editorTabs, state.terminals, state.tabOrder, projectColorById, projectColorByPath])

  // Handle tab click with multi-select support
  const handleTabClick = useCallback((e: React.MouseEvent, tabId: string) => {
    const isMac = navigator.platform.toLowerCase().includes('mac')
    const isMultiSelectKey = isMac ? e.metaKey : e.ctrlKey

    if (e.shiftKey || isMultiSelectKey) {
      dispatch({
        type: 'SELECT_TAB',
        payload: { tabId, shiftKey: e.shiftKey, ctrlKey: isMultiSelectKey }
      })
    } else {
      if (tabId.startsWith('editor-')) {
        const id = tabId.substring('editor-'.length)
        dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: id })
      } else if (tabId.startsWith('terminal-')) {
        const id = tabId.substring('terminal-'.length)
        dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: id })
      }
    }
  }, [dispatch])

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
          {allTabs.map(tab => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              isDragging={draggedTabId === tab.id}
              isDragOver={dragOverTabId === tab.id}
              isSelected={state.selectedTabIds.has(tab.id)}
              isMultiSelected={state.selectedTabIds.has(tab.id) && state.selectedTabIds.size > 1}
              onClick={(e) => handleTabClick(e, tab.id)}
              onDoubleClick={() => {
                if (tab.isPreview && tab.id.startsWith('editor-')) {
                  const id = tab.id.substring('editor-'.length)
                  dispatch({ type: 'PIN_EDITOR_TAB', payload: id })
                }
              }}
              onClose={(e) => handleTabClose(e, tab.id)}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, tab.id)}
            />
          ))}
          <div
            className={`tab-drop-end-zone ${dragOverEnd ? 'drag-over' : ''}`}
            onDragOver={handleDragOverEnd}
            onDrop={handleDropAtEnd}
            onDragLeave={clearDragOverEnd}
            onDoubleClick={() => dispatch({ type: 'ADD_SCRATCHPAD_TAB' })}
          />
        </div>
        <div className={`work-area-tabs-right ${isWindows ? 'windows-platform' : ''}`}>
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
