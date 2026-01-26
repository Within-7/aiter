import { useState, useCallback, useRef, Dispatch } from 'react'
import type { Project } from '../../types'
import type { AppAction } from '../context/AppContext'

interface DragState {
  draggedId: string | null
  dropTargetId: string | null
}

interface UseProjectDragDropOptions {
  projects: Project[]
  dispatch: Dispatch<AppAction>
}

interface UseProjectDragDropReturn {
  draggedId: string | null
  dropTargetId: string | null
  dragImageRef: React.RefObject<HTMLDivElement | null>
  handleProjectDragStart: (e: React.DragEvent, projectId: string) => void
  handleProjectDragOver: (e: React.DragEvent, projectId: string) => void
  handleProjectDragLeave: () => void
  handleProjectDrop: (e: React.DragEvent, targetProjectId: string) => Promise<void>
  handleProjectDragEnd: () => void
}

/**
 * Hook for managing project drag and drop reordering.
 *
 * Provides:
 * - Drag state tracking (dragged project, drop target)
 * - Custom drag image handling
 * - Project reorder on drop
 * - Persistence to store via IPC
 */
export function useProjectDragDrop({
  projects,
  dispatch
}: UseProjectDragDropOptions): UseProjectDragDropReturn {
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    dropTargetId: null
  })
  const dragImageRef = useRef<HTMLDivElement | null>(null)

  const handleProjectDragStart = useCallback((e: React.DragEvent, projectId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-project-id', projectId)
    setDragState({ draggedId: projectId, dropTargetId: null })

    // Create custom drag image
    const project = projects.find(p => p.id === projectId)
    if (project && dragImageRef.current) {
      dragImageRef.current.textContent = project.name
      dragImageRef.current.style.display = 'block'
      e.dataTransfer.setDragImage(dragImageRef.current, 0, 0)
      setTimeout(() => {
        if (dragImageRef.current) {
          dragImageRef.current.style.display = 'none'
        }
      }, 0)
    }
  }, [projects])

  const handleProjectDragOver = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragState.draggedId && dragState.draggedId !== projectId) {
      setDragState(prev => ({ ...prev, dropTargetId: projectId }))
    }
  }, [dragState.draggedId])

  const handleProjectDragLeave = useCallback(() => {
    setDragState(prev => ({ ...prev, dropTargetId: null }))
  }, [])

  const handleProjectDrop = useCallback(async (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('application/x-project-id')
    if (!draggedId || draggedId === targetProjectId) {
      setDragState({ draggedId: null, dropTargetId: null })
      return
    }

    // Reorder projects
    const projectsCopy = [...projects]
    const draggedIndex = projectsCopy.findIndex(p => p.id === draggedId)
    const targetIndex = projectsCopy.findIndex(p => p.id === targetProjectId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedProject] = projectsCopy.splice(draggedIndex, 1)
      projectsCopy.splice(targetIndex, 0, draggedProject)

      // Update local state immediately
      dispatch({ type: 'REORDER_PROJECTS', payload: projectsCopy })

      // Persist to store
      const projectIds = projectsCopy.map(p => p.id)
      await window.api.projects.reorder(projectIds)
    }

    setDragState({ draggedId: null, dropTargetId: null })
  }, [projects, dispatch])

  const handleProjectDragEnd = useCallback(() => {
    setDragState({ draggedId: null, dropTargetId: null })
  }, [])

  return {
    draggedId: dragState.draggedId,
    dropTargetId: dragState.dropTargetId,
    dragImageRef,
    handleProjectDragStart,
    handleProjectDragOver,
    handleProjectDragLeave,
    handleProjectDrop,
    handleProjectDragEnd
  }
}
