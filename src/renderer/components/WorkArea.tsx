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

  // Track edit/preview mode for each editor tab
  const [editorModes, setEditorModes] = useState<Record<string, 'preview' | 'edit'>>({})

  // Track dragging state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const [dragOverEnd, setDragOverEnd] = useState<boolean>(false) // For dropping at the end

  // Detect platform for Windows-specific styling
  const isWindows = navigator.platform.toLowerCase().includes('win')

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
      dispatch({ type: 'REMOVE_EDITOR_TAB', payload: id })
    } else if (tabId.startsWith('terminal-')) {
      const id = tabId.substring('terminal-'.length)
      dispatch({ type: 'REMOVE_TERMINAL', payload: id })
    }
  }, [dispatch])

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
          {/* Drop zone for dropping tabs at the end */}
          <div
            className={`tab-drop-end-zone ${dragOverEnd ? 'drag-over' : ''} ${draggedTabId ? 'visible' : ''}`}
            onDragOver={handleDragOverEnd}
            onDrop={handleDropAtEnd}
            onDragLeave={() => setDragOverEnd(false)}
          />
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
    </div>
  )
}
