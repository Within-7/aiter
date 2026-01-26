import { useState, useCallback } from 'react'
import type { FileNode } from '../../types'
import { getParentDir, getFileName, joinPath, isChildPath } from '../utils'

interface FileDragState {
  draggedPath: string | null
  dropTargetPath: string | null
}

interface UseFileDragDropOptions {
  projectPath: string
  onMoveComplete: () => void
}

interface UseFileDragDropReturn {
  draggedPath: string | null
  dropTargetPath: string | null
  handleFileDragStart: (e: React.DragEvent, path: string) => void
  handleFileDragOver: (e: React.DragEvent, node: FileNode) => void
  handleFileDragLeave: (e: React.DragEvent) => void
  handleFileDrop: (e: React.DragEvent, targetNode: FileNode) => Promise<void>
  handleFileDragEnd: () => void
  handleRootDragOver: (e: React.DragEvent) => void
  handleRootDragLeave: (e: React.DragEvent) => void
  handleRootDrop: (e: React.DragEvent) => Promise<void>
}

/**
 * Hook for managing file drag and drop operations within a file tree.
 *
 * Provides:
 * - Drag state tracking (dragged path, drop target)
 * - Drag event handlers for files and directories
 * - Root-level drop zone handling
 * - File move operations via IPC
 */
export function useFileDragDrop({
  projectPath,
  onMoveComplete
}: UseFileDragDropOptions): UseFileDragDropReturn {
  const [fileDragState, setFileDragState] = useState<FileDragState>({
    draggedPath: null,
    dropTargetPath: null
  })

  const handleFileDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-file-path', path)
    setFileDragState({ draggedPath: path, dropTargetPath: null })
  }, [])

  const handleFileDragOver = useCallback((e: React.DragEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()

    // Only allow drop on directories
    if (node.type !== 'directory') return

    const draggedPath = fileDragState.draggedPath
    if (!draggedPath) return

    // Don't allow dropping on self or parent
    if (draggedPath === node.path || isChildPath(node.path, draggedPath)) return

    e.dataTransfer.dropEffect = 'move'
    setFileDragState(prev => ({ ...prev, dropTargetPath: node.path }))
  }, [fileDragState.draggedPath])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    setFileDragState(prev => ({ ...prev, dropTargetPath: null }))
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault()
    e.stopPropagation()

    const draggedPath = e.dataTransfer.getData('application/x-file-path')
    if (!draggedPath || targetNode.type !== 'directory') {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Don't drop on self or into own subdirectory
    if (draggedPath === targetNode.path || isChildPath(targetNode.path, draggedPath)) {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Get the file/folder name and build new path
    const name = getFileName(draggedPath)
    const newPath = joinPath(targetNode.path, name)

    try {
      const result = await window.api.fs.rename(draggedPath, newPath)
      if (result.success) {
        onMoveComplete()
      } else {
        console.error('Failed to move file:', result.error)
      }
    } catch (err) {
      console.error('Error moving file:', err)
    }

    setFileDragState({ draggedPath: null, dropTargetPath: null })
  }, [onMoveComplete])

  const handleFileDragEnd = useCallback(() => {
    setFileDragState({ draggedPath: null, dropTargetPath: null })
  }, [])

  // Handle drop on project root (file-tree-content area)
  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (fileDragState.draggedPath) {
      e.dataTransfer.dropEffect = 'move'
      setFileDragState(prev => ({ ...prev, dropTargetPath: projectPath }))
    }
  }, [fileDragState.draggedPath, projectPath])

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the root area, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setFileDragState(prev => ({ ...prev, dropTargetPath: null }))
    }
  }, [])

  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()

    const draggedPath = e.dataTransfer.getData('application/x-file-path')
    if (!draggedPath) {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Check if already in root directory
    const parentDir = getParentDir(draggedPath)
    if (parentDir === projectPath) {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Get the file/folder name and build new path
    const name = getFileName(draggedPath)
    const newPath = joinPath(projectPath, name)

    try {
      const result = await window.api.fs.rename(draggedPath, newPath)
      if (result.success) {
        onMoveComplete()
      } else {
        console.error('Failed to move file:', result.error)
      }
    } catch (err) {
      console.error('Error moving file:', err)
    }

    setFileDragState({ draggedPath: null, dropTargetPath: null })
  }, [projectPath, onMoveComplete])

  return {
    draggedPath: fileDragState.draggedPath,
    dropTargetPath: fileDragState.dropTargetPath,
    handleFileDragStart,
    handleFileDragOver,
    handleFileDragLeave,
    handleFileDrop,
    handleFileDragEnd,
    handleRootDragOver,
    handleRootDragLeave,
    handleRootDrop
  }
}
