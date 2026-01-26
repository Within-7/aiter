import React, { useState, useEffect, useMemo } from 'react'
import { Workspace, Project } from '../../../types'
import '../../styles/WorkspaceManagerDialog.css'

interface WorkspaceManagerDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface ConfirmDialogState {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
}

const WORKSPACE_COLORS = [
  '#e74c3c', // Red
  '#e67e22', // Orange
  '#f1c40f', // Yellow
  '#2ecc71', // Green
  '#1abc9c', // Teal
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e91e63', // Pink
]

export const WorkspaceManagerDialog: React.FC<WorkspaceManagerDialogProps> = ({
  isOpen,
  onClose
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('default')
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceColor, setNewWorkspaceColor] = useState<string | undefined>()
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  // Check if workspace name already exists (excluding current editing workspace)
  const isNameDuplicate = useMemo(() => {
    const nameToCheck = isCreating ? newWorkspaceName.trim() : editingWorkspace?.name.trim()
    if (!nameToCheck) return false

    const existingNames = workspaces
      .filter(w => w.id !== editingWorkspace?.id) // Exclude current editing workspace
      .map(w => w.name.toLowerCase())

    return existingNames.includes(nameToCheck.toLowerCase())
  }, [workspaces, newWorkspaceName, editingWorkspace, isCreating])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    const [currentResult, listResult, projectsResult] = await Promise.all([
      window.api.workspace.getCurrent(),
      window.api.workspace.list(),
      window.api.workspace.getAllProjects()
    ])

    if (currentResult.success && currentResult.workspace) {
      setCurrentWorkspaceId(currentResult.workspace.id)
    }
    if (listResult.success && listResult.workspaces) {
      setWorkspaces(listResult.workspaces)
    }
    if (projectsResult.success && projectsResult.projects) {
      setAllProjects(projectsResult.projects)
    }
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return

    const result = await window.api.workspace.create(
      newWorkspaceName.trim(),
      Array.from(selectedProjects)
    )

    if (result.success && result.workspace) {
      // Update with color if selected
      if (newWorkspaceColor) {
        await window.api.workspace.update(result.workspace.id, { color: newWorkspaceColor })
      }
      await loadData()
      setIsCreating(false)
      setNewWorkspaceName('')
      setNewWorkspaceColor(undefined)
      setSelectedProjects(new Set())
    }
  }

  const handleUpdateWorkspace = async () => {
    if (!editingWorkspace) return

    await window.api.workspace.update(editingWorkspace.id, {
      name: editingWorkspace.name,
      color: editingWorkspace.color,
      visibleProjectIds: Array.from(selectedProjects)
    })

    await loadData()
    setEditingWorkspace(null)
    setSelectedProjects(new Set())
  }

  const handleDeleteWorkspace = (id: string) => {
    if (id === 'default') return

    const workspace = workspaces.find(w => w.id === id)
    if (!workspace) return

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Workspace',
      message: `Are you sure you want to delete "${workspace.name}"? This cannot be undone.`,
      onConfirm: async () => {
        await window.api.workspace.delete(id)
        await loadData()
        setSelectedWorkspace(null)
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleCloseConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  const handleLaunchWorkspace = async (workspaceId: string) => {
    await window.api.workspace.launch(workspaceId)
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setSelectedProjects(new Set(workspace.visibleProjectIds))
  }

  const handleEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace({ ...workspace })
    setSelectedProjects(new Set(workspace.visibleProjectIds))
    setIsCreating(false)
  }

  const handleProjectToggle = (projectId: string) => {
    const newSelected = new Set(selectedProjects)
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId)
    } else {
      newSelected.add(projectId)
    }
    setSelectedProjects(newSelected)
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setEditingWorkspace(null)
    setSelectedWorkspace(null)
    setNewWorkspaceName('')
    setNewWorkspaceColor(undefined)
    setSelectedProjects(new Set())
  }

  const handleCancelEdit = () => {
    setIsCreating(false)
    setEditingWorkspace(null)
    setSelectedProjects(new Set())
  }

  if (!isOpen) return null

  const currentEditWorkspace = editingWorkspace

  return (
    <div className="workspace-manager-overlay" onClick={onClose}>
      <div className="workspace-manager-dialog" onClick={e => e.stopPropagation()}>
        <div className="workspace-manager-header">
          <h2>Manage Workspaces</h2>
          <button className="workspace-manager-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        <div className="workspace-manager-content">
          <div className="workspace-manager-sidebar">
            <div className="workspace-list-header">
              <span>Workspaces</span>
              <button className="workspace-add-button" onClick={handleStartCreate} title="Create workspace">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                </svg>
              </button>
            </div>
            <div className="workspace-list-items">
              {workspaces.map(workspace => (
                <div
                  key={workspace.id}
                  className={`workspace-list-item ${selectedWorkspace?.id === workspace.id ? 'selected' : ''} ${workspace.id === currentWorkspaceId ? 'current' : ''}`}
                  onClick={() => handleSelectWorkspace(workspace)}
                >
                  <span className="workspace-list-item-icon">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill={workspace.color || 'currentColor'}>
                      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                    </svg>
                  </span>
                  <span className="workspace-list-item-name">{workspace.name}</span>
                  {workspace.id === currentWorkspaceId && (
                    <span className="workspace-current-badge">Current</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="workspace-manager-main">
            {isCreating ? (
              <div className="workspace-edit-form">
                <h3>Create New Workspace</h3>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={e => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Color (optional)</label>
                  <div className="color-picker">
                    <button
                      className={`color-option ${!newWorkspaceColor ? 'selected' : ''}`}
                      onClick={() => setNewWorkspaceColor(undefined)}
                      title="No color"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                    {WORKSPACE_COLORS.map(color => (
                      <button
                        key={color}
                        className={`color-option ${newWorkspaceColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewWorkspaceColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Projects to include ({selectedProjects.size} selected)</label>
                  <div className="project-list">
                    {allProjects.map(project => (
                      <label key={project.id} className="project-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedProjects.has(project.id)}
                          onChange={() => handleProjectToggle(project.id)}
                        />
                        <span>{project.name}</span>
                      </label>
                    ))}
                    {allProjects.length === 0 && (
                      <p className="no-projects">No projects available</p>
                    )}
                  </div>
                  <p className="form-hint">Leave empty to show all projects</p>
                </div>
                {isNameDuplicate && (
                  <p className="form-error">A workspace with this name already exists</p>
                )}
                <div className="form-actions">
                  <button className="btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                  <button className="btn-primary" onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim() || isNameDuplicate}>
                    Create Workspace
                  </button>
                </div>
              </div>
            ) : currentEditWorkspace ? (
              <div className="workspace-edit-form">
                <h3>Edit Workspace</h3>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={currentEditWorkspace.name}
                    onChange={e => setEditingWorkspace({ ...currentEditWorkspace, name: e.target.value })}
                    placeholder="Workspace name"
                  />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker">
                    <button
                      className={`color-option ${!currentEditWorkspace.color ? 'selected' : ''}`}
                      onClick={() => setEditingWorkspace({ ...currentEditWorkspace, color: undefined })}
                      title="No color"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                    {WORKSPACE_COLORS.map(color => (
                      <button
                        key={color}
                        className={`color-option ${currentEditWorkspace.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setEditingWorkspace({ ...currentEditWorkspace, color })}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Projects ({selectedProjects.size} selected)</label>
                  <div className="project-list">
                    {allProjects.map(project => (
                      <label key={project.id} className="project-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedProjects.has(project.id)}
                          onChange={() => handleProjectToggle(project.id)}
                        />
                        <span>{project.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="form-hint">Leave empty to show all projects</p>
                </div>
                {isNameDuplicate && (
                  <p className="form-error">A workspace with this name already exists</p>
                )}
                <div className="form-actions">
                  <button className="btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                  <button className="btn-primary" onClick={handleUpdateWorkspace} disabled={!currentEditWorkspace.name.trim() || isNameDuplicate}>
                    Save Changes
                  </button>
                </div>
              </div>
            ) : selectedWorkspace ? (
              <div className="workspace-details">
                <div className="workspace-details-header">
                  <div className="workspace-details-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill={selectedWorkspace.color || 'currentColor'}>
                      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                    </svg>
                    <h3>{selectedWorkspace.name}</h3>
                  </div>
                  {selectedWorkspace.id !== 'default' && (
                    <div className="workspace-details-actions">
                      <button className="btn-icon" onClick={() => handleEditWorkspace(selectedWorkspace)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                      </button>
                      <button className="btn-icon danger" onClick={() => handleDeleteWorkspace(selectedWorkspace.id)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div className="workspace-info">
                  <p className="workspace-info-item">
                    <strong>Projects:</strong> {selectedWorkspace.visibleProjectIds.length === 0 ? 'All projects' : `${selectedWorkspace.visibleProjectIds.length} selected`}
                  </p>
                  {selectedWorkspace.description && (
                    <p className="workspace-info-item">
                      <strong>Description:</strong> {selectedWorkspace.description}
                    </p>
                  )}
                </div>
                {selectedWorkspace.id !== currentWorkspaceId && (
                  <button className="btn-primary launch-button" onClick={() => handleLaunchWorkspace(selectedWorkspace.id)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                      <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                    </svg>
                    Open in New Window
                  </button>
                )}
              </div>
            ) : (
              <div className="workspace-empty-state">
                <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.3">
                  <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                </svg>
                <p>Select a workspace to view details</p>
                <p className="empty-hint">or create a new one to organize your projects</p>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Dialog */}
        {confirmDialog.isOpen && (
          <div className="confirm-dialog-overlay" onClick={handleCloseConfirmDialog}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
              <div className="confirm-dialog-header">
                <h3>{confirmDialog.title}</h3>
              </div>
              <div className="confirm-dialog-body">
                <p>{confirmDialog.message}</p>
              </div>
              <div className="confirm-dialog-actions">
                <button className="btn-secondary" onClick={handleCloseConfirmDialog}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={confirmDialog.onConfirm}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
