/**
 * Custom hook for editor preview/edit mode management
 * Handles mode toggling and content save operations
 */

import { useState, useCallback } from 'react'
import type { EditorTab } from '../../types'

interface UseEditorModeOptions {
  editorTabs: EditorTab[]
  activeTabId: string | null
  dispatch: React.Dispatch<{ type: string; payload?: unknown }>
}

export interface UseEditorModeReturn {
  // State
  editorModes: Record<string, 'preview' | 'edit'>
  currentMode: 'preview' | 'edit'
  supportsPreview: boolean
  activeEditorTab: EditorTab | undefined

  // Handlers
  toggleMode: () => void
  handleContentChange: (content: string) => void
  handleSave: (content?: string) => Promise<void>
}

export function useEditorMode({
  editorTabs,
  activeTabId,
  dispatch
}: UseEditorModeOptions): UseEditorModeReturn {
  // Track edit/preview mode for each editor tab
  const [editorModes, setEditorModes] = useState<Record<string, 'preview' | 'edit'>>({})

  // Find active editor tab
  const activeEditorTab = editorTabs.find(t => `editor-${t.id}` === activeTabId)

  // Get current mode for active editor tab
  const currentMode = activeEditorTab ? (editorModes[activeEditorTab.id] || 'preview') : 'preview'

  // Check if active tab supports preview mode (diff tabs don't support preview toggle)
  const supportsPreview = !!(activeEditorTab && !activeEditorTab.isDiff &&
    (activeEditorTab.fileType === 'markdown' || activeEditorTab.fileType === 'html'))

  // Toggle between preview and edit modes
  const toggleMode = useCallback(() => {
    if (activeEditorTab && supportsPreview) {
      setEditorModes(prev => ({
        ...prev,
        [activeEditorTab.id]: prev[activeEditorTab.id] === 'edit' ? 'preview' : 'edit'
      }))
    }
  }, [activeEditorTab, supportsPreview])

  // Handle content changes
  const handleContentChange = useCallback((content: string) => {
    if (activeEditorTab) {
      dispatch({
        type: 'UPDATE_EDITOR_CONTENT',
        payload: { id: activeEditorTab.id, content }
      })
    }
  }, [activeEditorTab, dispatch])

  // Handle file save
  const handleSave = useCallback(async (content?: string) => {
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
  }, [activeEditorTab, dispatch])

  return {
    editorModes,
    currentMode,
    supportsPreview,
    activeEditorTab,
    toggleMode,
    handleContentChange,
    handleSave
  }
}
