import { useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { VscTerminal, VscFiles, VscNewFile, VscNewFolder, VscCloudUpload, VscGripper, VscRefresh } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { FileTree } from './FileTree/FileTree'
import { InputDialog } from './FileTree/InputDialog'
import { ConfirmDialog } from './FileTree/ConfirmDialog'
import { TemplateSelector } from './TemplateSelector'
import { useProjectDragDrop } from '../hooks/useProjectDragDrop'
import { FileNode, EditorTab } from '../../types'
import { getProjectColor } from '../utils/projectColors'
import { getFileType, isExternalOpenCandidate, FileType } from '../../shared/fileTypeConfig'
import '../styles/ExplorerView.css'

interface DialogState {
  type: 'new-file' | 'new-folder' | 'remove-project' | 'template-selector' | null
  targetPath?: string
  projectId?: string
  projectName?: string
}

export function ExplorerView() {
  const { state, dispatch } = useContext(AppContext)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState>({ type: null })
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0)

  // Project drag and drop
  const {
    draggedId,
    dropTargetId,
    dragImageRef,
    handleProjectDragStart,
    handleProjectDragOver,
    handleProjectDragLeave,
    handleProjectDrop,
    handleProjectDragEnd
  } = useProjectDragDrop({
    projects: state.projects,
    dispatch
  })

  // Calculate which project the active tab belongs to
  const activeProjectId = useMemo(() => {
    if (state.activeEditorTabId) {
      const activeTab = state.editorTabs.find(t => t.id === state.activeEditorTabId)
      if (activeTab) {
        return state.projects.find(p =>
          activeTab.filePath.startsWith(p.path)
        )?.id
      }
    } else if (state.activeTerminalId) {
      const activeTerminal = state.terminals.find(t => t.id === state.activeTerminalId)
      if (activeTerminal) {
        return activeTerminal.projectId
      }
    }
    return undefined
  }, [state.activeEditorTabId, state.activeTerminalId, state.editorTabs, state.terminals, state.projects])

  // Auto-expand project when its tab is selected
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjects(prev => {
        if (prev.size !== 1 || !prev.has(activeProjectId)) {
          return new Set([activeProjectId])
        }
        return prev
      })
    }
  }, [activeProjectId])

  // Sync activeProjectId to global state for persistence hooks
  useEffect(() => {
    if (activeProjectId && activeProjectId !== state.activeProjectId) {
      dispatch({ type: 'SET_ACTIVE_PROJECT', payload: activeProjectId })
    }
  }, [activeProjectId, state.activeProjectId, dispatch])

  const handleAddProject = () => {
    setDialog({ type: 'template-selector' })
  }

  const handleTemplateSelect = async (
    templateId: string | null,
    projectPath: string,
    projectName: string
  ) => {
    // First add the project
    const addResult = await window.api.projects.add(projectPath, projectName)
    if (addResult.success && addResult.project) {
      // If a template was selected, apply it
      if (templateId) {
        try {
          const applyResult = await window.api.templates.apply(
            templateId,
            projectPath,
            projectName
          )
          if (applyResult.success) {
            console.log(`[TemplateSelector] Applied template '${templateId}', created ${applyResult.filesCreated?.length || 0} files`)
          } else {
            console.error('[TemplateSelector] Failed to apply template:', applyResult.error)
          }
        } catch (err) {
          console.error('[TemplateSelector] Error applying template:', err)
        }
      }

      // Expand the new project
      setExpandedProjects(new Set([addResult.project!.id]))
      // Refresh file tree
      setFileTreeRefreshKey(k => k + 1)
    }
    setDialog({ type: null })
  }

  const handleRemoveProject = async (id: string) => {
    const result = await window.api.projects.remove(id)
    if (result.success) {
      setExpandedProjects(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const confirmRemoveProject = (projectId: string, projectName: string) => {
    setDialog({
      type: 'remove-project',
      projectId,
      projectName
    })
  }

  const handleConfirmRemoveProject = async () => {
    if (dialog.projectId) {
      await handleRemoveProject(dialog.projectId)
    }
    setDialog({ type: null })
  }

  // File operations for root directory
  const handleCreateFile = useCallback(async (name: string) => {
    if (!dialog.targetPath) return
    const filePath = `${dialog.targetPath}/${name}`
    try {
      const result = await window.api.fs.createFile(filePath)
      if (result.success) {
        setFileTreeRefreshKey(k => k + 1)
      }
    } catch (err) {
      console.error('Error creating file:', err)
    }
    setDialog({ type: null })
  }, [dialog.targetPath])

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!dialog.targetPath) return
    const folderPath = `${dialog.targetPath}/${name}`
    try {
      const result = await window.api.fs.createDirectory(folderPath)
      if (result.success) {
        setFileTreeRefreshKey(k => k + 1)
      }
    } catch (err) {
      console.error('Error creating folder:', err)
    }
    setDialog({ type: null })
  }, [dialog.targetPath])

  const handleUploadFiles = useCallback(async (projectPath: string) => {
    try {
      const result = await window.api.dialog.openFiles()
      if (result.success && result.data?.paths) {
        const copyResult = await window.api.fs.copyFiles(result.data.paths, projectPath)
        if (copyResult.success) {
          setFileTreeRefreshKey(k => k + 1)
        }
      }
    } catch (err) {
      console.error('Error uploading files:', err)
    }
  }, [])

  // Refresh file tree for a specific project
  const handleRefreshFileTree = useCallback((projectId: string) => {
    console.log(`[ExplorerView] Manually refreshing file tree for project ${projectId}`)
    setFileTreeRefreshKey(k => k + 1)
  }, [])

  const validateName = useCallback((name: string): string | null => {
    if (name.includes('/') || name.includes('\\')) {
      return 'Name cannot contain / or \\'
    }
    if (name.startsWith('.') && name.length === 1) {
      return 'Invalid name'
    }
    return null
  }, [])

  const handleToggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      if (prev.has(projectId)) {
        return new Set()
      } else {
        return new Set([projectId])
      }
    })
  }

  // Open file as preview (single-click) or permanent (double-click)
  const openFile = async (file: FileNode, isPreview: boolean) => {
    if (file.type === 'file') {
      try {
        // Check if this file type should be opened externally
        const fileType = getFileType(file.path) as FileType
        const openExternallyConfig = state.settings.openExternally?.find(
          config => config.fileType === fileType && config.enabled
        )

        if (openExternallyConfig || (isExternalOpenCandidate(fileType) && state.settings.openExternally === undefined)) {
          // For binary files that are external candidates with no explicit config,
          // check if user prefers external opening (default behavior for Office files)
          const shouldOpenExternally = openExternallyConfig?.enabled ||
            (fileType === 'word' || fileType === 'excel' || fileType === 'powerpoint')

          if (shouldOpenExternally) {
            await window.api.shell.openPath(file.path)
            return
          }
        }

        const result = await window.api.fs.readFile(file.path)
        if (result.success && result.content !== undefined && result.fileType) {
          const tab: EditorTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filePath: file.path,
            fileName: file.name,
            fileType: result.fileType as EditorTab['fileType'],
            content: result.content,
            isDirty: false,
            isPreview  // Preview tab (single-click) or permanent tab (double-click)
          }
          dispatch({ type: 'ADD_EDITOR_TAB', payload: tab })
        }
      } catch (error) {
        console.error('Error opening file:', error)
      }
    }
  }

  // Single-click: open as preview tab
  const handleFileClick = async (file: FileNode) => {
    await openFile(file, true)
  }

  // Double-click: open as permanent tab (or pin existing preview)
  const handleFileDoubleClick = async (file: FileNode) => {
    // Check if the file is already open as a preview tab
    const existingTab = state.editorTabs.find(t => t.filePath === file.path)
    if (existingTab?.isPreview) {
      // Pin the existing preview tab
      dispatch({ type: 'PIN_EDITOR_TAB', payload: existingTab.id })
    } else {
      // Open as permanent tab
      await openFile(file, false)
    }
  }

  return (
    <div className="explorer-view">
      <div className="explorer-view-header">
        <div className="header-title">
          <VscFiles className="header-icon" />
          <h2>Explorer</h2>
        </div>
        <button
          className="btn-icon btn-add"
          onClick={handleAddProject}
          title="Add Project"
        >
          +
        </button>
      </div>

      {/* Drag image element (hidden) */}
      <div
        ref={dragImageRef}
        className="project-drag-image"
        style={{
          position: 'absolute',
          top: '-1000px',
          left: '-1000px',
          padding: '4px 8px',
          background: '#007acc',
          color: '#fff',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          display: 'none'
        }}
      />

      <div className="explorer-view-content">
        {state.projects.map(project => {
          const projectColor = getProjectColor(project.id, project.color)
          const isDragging = draggedId === project.id
          const isDropTarget = dropTargetId === project.id

          return (
            <div
              key={project.id}
              className={`project-section ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`}
              draggable
              onDragStart={(e) => handleProjectDragStart(e, project.id)}
              onDragOver={(e) => handleProjectDragOver(e, project.id)}
              onDragLeave={handleProjectDragLeave}
              onDrop={(e) => handleProjectDrop(e, project.id)}
              onDragEnd={handleProjectDragEnd}
            >
              <div
                className="project-header"
                onClick={() => handleToggleProject(project.id)}
              >
                <span className="drag-handle">
                  <VscGripper />
                </span>
                <span className="expand-icon">
                  {expandedProjects.has(project.id) ? '▼' : '▶'}
                </span>
                <span
                  className="project-color-indicator"
                  style={{ backgroundColor: projectColor }}
                  title={`Project color: ${projectColor}`}
                />
                <span className="project-name">{project.name}</span>

                {/* File operation buttons - only show when expanded */}
                {expandedProjects.has(project.id) && (
                  <div className="file-op-buttons">
                    <button
                      className="btn-icon btn-file-op"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDialog({ type: 'new-file', targetPath: project.path })
                      }}
                      title="New File"
                    >
                      <VscNewFile />
                    </button>
                    <button
                      className="btn-icon btn-file-op"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDialog({ type: 'new-folder', targetPath: project.path })
                      }}
                      title="New Folder"
                    >
                      <VscNewFolder />
                    </button>
                    <button
                      className="btn-icon btn-file-op"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUploadFiles(project.path)
                      }}
                      title="Upload Files"
                    >
                      <VscCloudUpload />
                    </button>
                    <button
                      className="btn-icon btn-file-op"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRefreshFileTree(project.id)
                      }}
                      title="Refresh"
                    >
                      <VscRefresh />
                    </button>
                  </div>
                )}

                <button
                  className="btn-icon btn-terminal"
                  onClick={async (e) => {
                    e.stopPropagation()
                    const result = await window.api.terminal.create(
                      project.path,
                      project.id,
                      project.name
                    )
                    if (result.success && result.terminal) {
                      dispatch({ type: 'ADD_TERMINAL', payload: result.terminal })
                    }
                  }}
                  title="Open Terminal"
                >
                  <VscTerminal />
                </button>
                <button
                  className="btn-icon btn-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmRemoveProject(project.id, project.name)
                  }}
                  title="Remove Project"
                >
                  ×
                </button>
              </div>
              {expandedProjects.has(project.id) && (
                <FileTree
                  key={`${project.id}-${fileTreeRefreshKey}`}
                  projectId={project.id}
                  projectPath={project.path}
                  projectName={project.name}
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  activeFilePath={
                    state.activeEditorTabId
                      ? state.editorTabs.find(t => t.id === state.activeEditorTabId)?.filePath
                      : undefined
                  }
                />
              )}
            </div>
          )
        })}
        {state.projects.length === 0 && (
          <div className="explorer-view-empty">
            <p>No projects added yet</p>
            <p>Click the + button to add a project</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {dialog.type === 'new-file' && (
        <InputDialog
          title="New File"
          placeholder="Enter file name"
          confirmLabel="Create"
          onConfirm={handleCreateFile}
          onCancel={() => setDialog({ type: null })}
          validator={validateName}
        />
      )}

      {dialog.type === 'new-folder' && (
        <InputDialog
          title="New Folder"
          placeholder="Enter folder name"
          confirmLabel="Create"
          onConfirm={handleCreateFolder}
          onCancel={() => setDialog({ type: null })}
          validator={validateName}
        />
      )}

      {dialog.type === 'remove-project' && (
        <ConfirmDialog
          title="Remove Project"
          message={`Are you sure you want to remove "${dialog.projectName}" from the workspace? The files will not be deleted.`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={handleConfirmRemoveProject}
          onCancel={() => setDialog({ type: null })}
        />
      )}

      {dialog.type === 'template-selector' && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          onCancel={() => setDialog({ type: null })}
        />
      )}
    </div>
  )
}
