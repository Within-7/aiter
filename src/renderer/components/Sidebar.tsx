import { useContext, useState, useEffect, useMemo } from 'react'
import { VscTerminal, VscSourceControl } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { FileTree } from './FileTree/FileTree'
import { GitHistoryPanel } from './GitHistoryPanel'
import { FileNode, EditorTab, GitStatus } from '../../types'
import { getProjectColor } from '../utils/projectColors'
import '../styles/Sidebar.css'

export function Sidebar() {
  const { state, dispatch } = useContext(AppContext)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [gitStatuses, setGitStatuses] = useState<Map<string, GitStatus>>(new Map())
  const [showGitHistory, setShowGitHistory] = useState<string | null>(null) // projectId of open history panel

  // Monitor fullscreen state changes
  useEffect(() => {
    const checkFullscreen = () => {
      // In Electron, we need to check if the window takes up the entire screen
      // by comparing innerHeight to screen.height
      // When not fullscreen on macOS, there's a title bar (~28px) and dock space
      const isFs =
        // Check if document is in fullscreen API
        !!(document.fullscreenElement ||
           (document as any).webkitFullscreenElement ||
           (document as any).mozFullScreenElement) ||
        // Check if window.innerHeight is very close to screen height
        // (within 50px to account for differences in how browsers/Electron report sizes)
        (window.innerHeight >= window.screen.height - 50)

      setIsFullscreen(isFs)
    }

    // Initial check
    checkFullscreen()

    // Listen for multiple fullscreen change events
    window.addEventListener('resize', checkFullscreen)
    document.addEventListener('fullscreenchange', checkFullscreen)
    document.addEventListener('webkitfullscreenchange', checkFullscreen)
    document.addEventListener('mozfullscreenchange', checkFullscreen)

    return () => {
      window.removeEventListener('resize', checkFullscreen)
      document.removeEventListener('fullscreenchange', checkFullscreen)
      document.removeEventListener('webkitfullscreenchange', checkFullscreen)
      document.removeEventListener('mozfullscreenchange', checkFullscreen)
    }
  }, [])

  // Calculate which project the active tab belongs to
  const activeProjectId = useMemo(() => {
    if (state.activeEditorTabId) {
      const activeTab = state.editorTabs.find(t => t.id === state.activeEditorTabId)
      if (activeTab) {
        // Find which project this file belongs to
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

  // Auto-expand project when its tab is selected (single-expand mode)
  // Only runs when activeProjectId actually changes
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjects(prev => {
        // Only update if the state needs to change
        if (prev.size !== 1 || !prev.has(activeProjectId)) {
          return new Set([activeProjectId])
        }
        return prev
      })
    }
  }, [activeProjectId])

  // Load Git status for all projects
  useEffect(() => {
    const loadGitStatuses = async () => {
      const statusMap = new Map<string, GitStatus>()

      for (const project of state.projects) {
        try {
          const result = await window.api.git.getStatus(project.path)
          if (result.success && result.status) {
            statusMap.set(project.id, result.status)
          }
        } catch (error) {
          console.error(`Failed to get git status for ${project.name}:`, error)
        }
      }

      setGitStatuses(statusMap)
    }

    if (state.projects.length > 0) {
      loadGitStatuses()

      // Refresh git statuses every 10 seconds
      const interval = setInterval(loadGitStatuses, 10000)
      return () => clearInterval(interval)
    }
  }, [state.projects])

  const handleAddProject = async () => {
    const result = await window.api.dialog.openFolder()
    if (result.success && result.data) {
      const addResult = await window.api.projects.add(
        result.data.path,
        result.data.name
      )
      if (addResult.success && addResult.project) {
        // Don't dispatch ADD_PROJECT here - the IPC 'projects:updated' event will handle it
        // Auto-expand the newly added project and collapse all others (single-expand mode)
        setExpandedProjects(new Set([addResult.project!.id]))
      }
    }
  }

  const handleRemoveProject = async (id: string) => {
    const result = await window.api.projects.remove(id)
    if (result.success) {
      // Don't dispatch REMOVE_PROJECT here - the IPC 'projects:updated' event will handle it
      // Just clean up local state
      setExpandedProjects(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleToggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      if (prev.has(projectId)) {
        // Clicking on expanded project -> collapse it (allow all projects to be collapsed)
        return new Set()
      } else {
        // Clicking on collapsed project -> expand it and collapse all others (single-expand mode)
        return new Set([projectId])
      }
    })
  }

  const handleFileClick = async (file: FileNode) => {
    if (file.type === 'file') {
      try {
        // Read file content
        const result = await window.api.fs.readFile(file.path)
        if (result.success && result.content !== undefined && result.fileType) {
          // Create editor tab
          const tab: EditorTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filePath: file.path,
            fileName: file.name,
            fileType: result.fileType as EditorTab['fileType'],
            content: result.content,
            isDirty: false
          }

          dispatch({ type: 'ADD_EDITOR_TAB', payload: tab })
        } else {
          console.error('Failed to read file:', result.error)
        }
      } catch (error) {
        console.error('Error opening file:', error)
      }
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className={!isFullscreen ? 'has-traffic-lights' : ''}>AiTer</h2>
        <button
          className="btn-icon btn-add"
          onClick={handleAddProject}
          title="Add Project"
        >
          +
        </button>
      </div>
      <div className="sidebar-content">
        {state.projects.map(project => {
          const projectColor = getProjectColor(project.id, project.color)
          const gitStatus = gitStatuses.get(project.id)

          return (
            <div key={project.id} className="project-section">
              <div
                className="project-header"
                onClick={() => handleToggleProject(project.id)}
              >
                <span className="expand-icon">
                  {expandedProjects.has(project.id) ? '▼' : '▶'}
                </span>
                <span
                  className="project-color-indicator"
                  style={{ backgroundColor: projectColor }}
                  title={`Project color: ${projectColor}`}
                />
                <span className="project-name">{project.name}</span>

                {/* Git Status Display */}
                {gitStatus?.isRepo && (
                  <div
                    className="git-status"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowGitHistory(
                        showGitHistory === project.id ? null : project.id
                      )
                    }}
                    title="Click to view Git history"
                  >
                    <VscSourceControl className="git-icon" />
                    <span className="git-branch">{gitStatus.currentBranch || 'main'}</span>
                    {gitStatus.hasChanges && (
                      <span className="git-changes-indicator" title="Uncommitted changes">
                        •
                      </span>
                    )}
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
                  handleRemoveProject(project.id)
                }}
                title="Remove Project"
              >
                ×
              </button>
            </div>
            {expandedProjects.has(project.id) && (
              <>
                {showGitHistory === project.id && gitStatus?.isRepo && (
                  <GitHistoryPanel
                    projectId={project.id}
                    projectPath={project.path}
                    projectName={project.name}
                    gitStatus={gitStatus}
                    onClose={() => setShowGitHistory(null)}
                  />
                )}
                <FileTree
                  projectId={project.id}
                  projectPath={project.path}
                  projectName={project.name}
                  onFileClick={handleFileClick}
                  activeFilePath={
                    state.activeEditorTabId
                      ? state.editorTabs.find(t => t.id === state.activeEditorTabId)?.filePath
                      : undefined
                  }
                />
              </>
            )}
          </div>
        )})}
        {state.projects.length === 0 && (
          <div className="sidebar-empty">
            <p>No projects added yet</p>
            <p>Click the + button to add a project</p>
          </div>
        )}
      </div>
    </div>
  )
}
