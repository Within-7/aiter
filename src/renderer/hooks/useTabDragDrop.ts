import { useState, useCallback, Dispatch } from 'react'
import type { AppAction, AppState } from '../context/AppContext'

/**
 * Hook for managing tab drag and drop functionality.
 *
 * Provides state and handlers for:
 * - Dragging single or multiple selected tabs
 * - Dropping tabs at specific positions or at the end
 * - Creating custom drag images for multi-tab dragging
 */
export function useTabDragDrop(
  state: AppState,
  dispatch: Dispatch<AppAction>
) {
  // Track dragging state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const [dragOverEnd, setDragOverEnd] = useState<boolean>(false)

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

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
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
  }, [draggedTabId, state.tabOrder, state.selectedTabIds, dispatch])

  const handleDropAtEnd = useCallback((e: React.DragEvent) => {
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
  }, [draggedTabId, state.tabOrder, state.selectedTabIds, dispatch])

  const clearDragOverEnd = useCallback(() => {
    setDragOverEnd(false)
  }, [])

  return {
    // State
    draggedTabId,
    dragOverTabId,
    dragOverEnd,
    // Handlers
    handleDragStart,
    handleDragOver,
    handleDragOverEnd,
    handleDragEnd,
    handleDrop,
    handleDropAtEnd,
    clearDragOverEnd
  }
}
