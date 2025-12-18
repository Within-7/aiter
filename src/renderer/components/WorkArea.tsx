import React, { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { MonacoEditor } from './Editor/MonacoEditor'
import { MarkdownEditor } from './Editor/MarkdownEditor'
import { HTMLPreview } from './Editor/HTMLPreview'
import { DiffViewer } from './Editor/DiffViewer'
import { ImageViewer } from './Editor/ImageViewer'
import { PDFViewer } from './Editor/PDFViewer'
import { OfficeViewer } from './Editor/OfficeViewer'
import { TerminalContainer } from './TerminalContainer'
import { getProjectColor } from '../utils/projectColors'
import '../styles/WorkArea.css'

type TabType = 'editor' | 'terminal'

interface Tab {
  id: string
  type: TabType
  title: string
  projectColor?: string
}

export const WorkArea: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)

  // Track edit/preview mode for each editor tab
  const [editorModes, setEditorModes] = useState<Record<string, 'preview' | 'edit'>>({})

  // Track dragging state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)

  // Detect platform for Windows-specific styling
  const isWindows = navigator.platform.toLowerCase().includes('win')

  // Derive active tab ID from global state
  const activeTabId = state.activeEditorTabId
    ? `editor-${state.activeEditorTabId}`
    : state.activeTerminalId
    ? `terminal-${state.activeTerminalId}`
    : null

  // Create a map of all tabs by ID for quick lookup
  const tabsById = new Map<string, Tab>()

  state.editorTabs.forEach(t => {
    const project = state.projects.find(p => t.filePath.startsWith(p.path))
    tabsById.set(`editor-${t.id}`, {
      id: `editor-${t.id}`,
      type: 'editor' as TabType,
      title: t.isDirty ? `● ${t.fileName}` : t.fileName,
      projectColor: project ? getProjectColor(project.id, project.color) : undefined
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
  const allTabs: Tab[] = (state.tabOrder || [])
    .map(id => tabsById.get(id))
    .filter((tab): tab is Tab => tab !== undefined)

  const handleTabClick = (tabId: string) => {
    // Extract type and id correctly (handle IDs that may contain hyphens)
    if (tabId.startsWith('editor-')) {
      const id = tabId.substring('editor-'.length)
      dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: id })
    } else if (tabId.startsWith('terminal-')) {
      const id = tabId.substring('terminal-'.length)
      dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: id })
    }
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()

    // Extract type and id correctly (handle IDs that may contain hyphens)
    if (tabId.startsWith('editor-')) {
      const id = tabId.substring('editor-'.length)
      dispatch({ type: 'REMOVE_EDITOR_TAB', payload: id })
    } else if (tabId.startsWith('terminal-')) {
      const id = tabId.substring('terminal-'.length)
      dispatch({ type: 'REMOVE_TERMINAL', payload: id })
    }
  }

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
    // Set a transparent drag image to avoid default ghost image
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTabId(tabId)
  }

  const handleDragEnd = () => {
    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()

    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null)
      setDragOverTabId(null)
      return
    }

    const draggedIndex = state.tabOrder.findIndex(id => id === draggedTabId)
    const targetIndex = state.tabOrder.findIndex(id => id === targetTabId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTabId(null)
      setDragOverTabId(null)
      return
    }

    // Reorder the tabOrder array
    const newTabOrder = [...state.tabOrder]
    const [removed] = newTabOrder.splice(draggedIndex, 1)
    newTabOrder.splice(targetIndex, 0, removed)

    // Dispatch the reorder action
    dispatch({ type: 'REORDER_TABS', payload: newTabOrder })

    setDraggedTabId(null)
    setDragOverTabId(null)
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

  const handleSave = async () => {
    const activeEditorTab = state.editorTabs.find(t => `editor-${t.id}` === activeTabId)
    if (!activeEditorTab) return

    try {
      const result = await window.api.fs.writeFile(activeEditorTab.filePath, activeEditorTab.content)
      if (result.success) {
        dispatch({
          type: 'MARK_TAB_DIRTY',
          payload: { id: activeEditorTab.id, isDirty: false }
        })
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
            return (
              <div
                key={tab.id}
                className={`work-area-tab ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                onClick={() => handleTabClick(tab.id)}
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
        </div>
        <button
          className={`mode-toggle-button ${!supportsPreview ? 'disabled' : ''} ${isWindows ? 'windows-platform' : ''}`}
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
              <MonacoEditor
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
    </div>
  )
}
