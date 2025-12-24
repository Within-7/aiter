import React, { useContext } from 'react'
import { AppContext } from '../../context/AppContext'
import { MonacoEditor } from './MonacoEditor'
import './EditorArea.css'

export const EditorArea: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)

  const activeTab = state.editorTabs.find(t => t.id === state.activeEditorTabId)

  const handleTabClick = (tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_EDITOR_TAB', payload: tabId })
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    dispatch({ type: 'REMOVE_EDITOR_TAB', payload: tabId })
  }

  const handleContentChange = (content: string) => {
    if (activeTab) {
      dispatch({
        type: 'UPDATE_EDITOR_CONTENT',
        payload: { id: activeTab.id, content }
      })
    }
  }

  const handleSave = async (content?: string) => {
    if (!activeTab) return

    // Use provided content (from editor) or fall back to state content
    const contentToSave = content !== undefined ? content : activeTab.content

    try {
      const result = await window.api.fs.writeFile(activeTab.filePath, contentToSave)
      if (result.success) {
        // Update state with the saved content if it was provided
        if (content !== undefined && content !== activeTab.content) {
          dispatch({
            type: 'UPDATE_EDITOR_CONTENT',
            payload: { id: activeTab.id, content }
          })
        }
        dispatch({
          type: 'MARK_TAB_DIRTY',
          payload: { id: activeTab.id, isDirty: false }
        })
        console.log('File saved successfully')
      } else {
        console.error('Failed to save file:', result.error)
      }
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  if (state.editorTabs.length === 0) {
    return (
      <div className="editor-area">
        <div className="editor-empty">
          <p>No files open</p>
          <p>Click a file in the file tree to open it</p>
        </div>
      </div>
    )
  }

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        {state.editorTabs.map(tab => (
          <div
            key={tab.id}
            className={`editor-tab ${tab.id === state.activeEditorTabId ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="tab-name">
              {tab.isDirty && <span className="dirty-indicator">●</span>}
              {tab.fileName}
            </span>
            <button
              className="tab-close"
              onClick={(e) => handleTabClose(e, tab.id)}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="editor-content">
        {activeTab && (
          <MonacoEditor
            value={activeTab.content}
            language={activeTab.fileType}
            onChange={handleContentChange}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  )
}
