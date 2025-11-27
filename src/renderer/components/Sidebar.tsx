import { useContext, useState, useEffect } from 'react'
import { VscTerminal } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { FileTree } from './FileTree/FileTree'
import { FileNode, EditorTab } from '../../types'
import { getProjectColor } from '../utils/projectColors'
import '../styles/Sidebar.css'

export function Sidebar() {
  const { state, dispatch } = useContext(AppContext)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Monitor fullscreen state changes
  useEffect(() => {
    const checkFullscreen = () => {
      // Check multiple conditions for fullscreen
      const isFs =
        // Check if document is in fullscreen
        !!(document.fullscreenElement ||
           (document as any).webkitFullscreenElement ||
           (document as any).mozFullScreenElement) ||
        // Check if window dimensions match screen (macOS fullscreen)
        (window.outerHeight >= window.screen.height * 0.95 &&
         window.outerWidth >= window.screen.width * 0.95)

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

  // Auto-expand project when its tab is selected
  useEffect(() => {
    // Find the project of the active tab
    let activeProjectId: string | undefined

    if (state.activeEditorTabId) {
      const activeTab = state.editorTabs.find(t => t.id === state.activeEditorTabId)
      if (activeTab) {
        // Find which project this file belongs to
        activeProjectId = state.projects.find(p =>
          activeTab.filePath.startsWith(p.path)
        )?.id
      }
    } else if (state.activeTerminalId) {
      const activeTerminal = state.terminals.find(t => t.id === state.activeTerminalId)
      if (activeTerminal) {
        activeProjectId = activeTerminal.projectId
      }
    }

    // Expand only the active project, collapse others
    if (activeProjectId) {
      setExpandedProjects(new Set([activeProjectId]))
    }
  }, [state.activeEditorTabId, state.activeTerminalId, state.editorTabs, state.terminals, state.projects])

  const handleAddProject = async () => {
    const result = await window.api.dialog.openFolder()
    if (result.success && result.data) {
      const addResult = await window.api.projects.add(
        result.data.path,
        result.data.name
      )
      if (addResult.success && addResult.project) {
        // Don't dispatch ADD_PROJECT here - the IPC 'projects:updated' event will handle it
        // Just auto-expand the newly added project
        setExpandedProjects(prev => new Set(prev).add(addResult.project!.id))
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
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
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
        <h2 className={!isFullscreen ? 'has-traffic-lights' : ''}>Files</h2>
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
              <button
                className="btn-icon btn-terminal"
                onClick={async (e) => {
                  e.stopPropagation()
                  const result = await window.api.terminal.create(project.path, project.id, project.name)
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
              <FileTree
                projectId={project.id}
                projectPath={project.path}
                projectName={project.name}
                onFileClick={handleFileClick}
              />
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
