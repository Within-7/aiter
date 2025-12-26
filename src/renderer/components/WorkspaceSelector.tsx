import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Workspace } from '../../types'
import '../styles/WorkspaceSelector.css'

interface WorkspaceSelectorProps {
  onManageWorkspaces: () => void
}

interface ConfirmState {
  isOpen: boolean
  workspaceId: string
  workspaceName: string
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ onManageWorkspaces }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    workspaceId: '',
    workspaceName: ''
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load current workspace and all workspaces
    const loadWorkspaces = async () => {
      const [currentResult, listResult] = await Promise.all([
        window.api.workspace.getCurrent(),
        window.api.workspace.list()
      ])

      if (currentResult.success && currentResult.workspace) {
        setCurrentWorkspace(currentResult.workspace)
      }
      if (listResult.success && listResult.workspaces) {
        setWorkspaces(listResult.workspaces)
      }
    }

    loadWorkspaces()
  }, [])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Launch workspace in new window (with optional confirmation for same workspace)
  const launchWorkspace = useCallback(async (workspaceId: string) => {
    const result = await window.api.workspace.launch(workspaceId)
    if (!result.success) {
      console.error('Failed to launch workspace:', result.error)
    }
  }, [])

  const handleLaunchWorkspace = (workspaceId: string) => {
    setIsOpen(false)
    launchWorkspace(workspaceId)
  }

  // Handle clicking on workspace item (navigate or show new window option)
  const handleWorkspaceClick = (workspace: Workspace) => {
    if (workspace.id === currentWorkspace?.id) {
      // Just close dropdown for current workspace - user can click the new window icon
      setIsOpen(false)
      return
    }
    handleLaunchWorkspace(workspace.id)
  }

  // Handle opening same workspace in new window with confirmation
  const handleOpenSameWorkspace = (e: React.MouseEvent, workspace: Workspace) => {
    e.stopPropagation()
    setIsOpen(false)
    setConfirmState({
      isOpen: true,
      workspaceId: workspace.id,
      workspaceName: workspace.name
    })
  }

  const handleConfirmOpen = () => {
    launchWorkspace(confirmState.workspaceId)
    setConfirmState(prev => ({ ...prev, isOpen: false }))
  }

  const handleCancelConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }))
  }

  // Keyboard shortcut: Cmd/Ctrl+Shift+N to open current workspace in new window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault()
        if (currentWorkspace) {
          setConfirmState({
            isOpen: true,
            workspaceId: currentWorkspace.id,
            workspaceName: currentWorkspace.name
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentWorkspace])

  const handleManageClick = () => {
    setIsOpen(false)
    onManageWorkspaces()
  }

  return (
    <div className="workspace-selector" ref={dropdownRef}>
      <button
        className="workspace-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        title={currentWorkspace?.name || 'Workspace'}
      >
        <span className="workspace-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill={currentWorkspace?.color || 'currentColor'}>
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
          </svg>
        </span>
        <span className="workspace-name">
          {currentWorkspace?.name || 'Loading...'}
        </span>
        <span className="workspace-chevron">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="workspace-dropdown">
          <div className="workspace-dropdown-header">Workspaces</div>
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                className={`workspace-item ${workspace.id === currentWorkspace?.id ? 'active' : ''}`}
                onClick={() => handleWorkspaceClick(workspace)}
              >
                <span className="workspace-item-icon">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill={workspace.color || 'currentColor'}>
                    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                  </svg>
                </span>
                <span className="workspace-item-name">{workspace.name}</span>
                {workspace.id === currentWorkspace?.id && (
                  <span className="workspace-item-check">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                  </span>
                )}
                <span
                  className="workspace-item-launch"
                  title={workspace.id === currentWorkspace?.id ? "Open in new window (⇧⌘N)" : "Open in new window"}
                  onClick={(e) => workspace.id === currentWorkspace?.id
                    ? handleOpenSameWorkspace(e, workspace)
                    : (e.stopPropagation(), handleLaunchWorkspace(workspace.id))
                  }
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                    <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                  </svg>
                </span>
              </button>
            ))}
          </div>
          <div className="workspace-dropdown-footer">
            <button className="workspace-manage-button" onClick={handleManageClick}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
              </svg>
              Manage Workspaces...
            </button>
          </div>
        </div>
      )}

      {/* Confirmation dialog for opening same workspace - rendered via portal to avoid drag region issues */}
      {confirmState.isOpen && createPortal(
        <div className="workspace-confirm-overlay" onClick={handleCancelConfirm}>
          <div className="workspace-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="workspace-confirm-header">
              <h3>Open New Window</h3>
            </div>
            <div className="workspace-confirm-body">
              <p>
                Open another window for <strong>&quot;{confirmState.workspaceName}&quot;</strong>?
              </p>
              <p className="workspace-confirm-hint">
                Multiple windows of the same workspace may have conflicting window positions when closed.
              </p>
            </div>
            <div className="workspace-confirm-actions">
              <button className="btn-secondary" onClick={handleCancelConfirm}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirmOpen}>
                Open New Window
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
