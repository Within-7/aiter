import { useContext, useState, useEffect, useRef } from 'react'
import { VscSourceControl } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { GitHistoryPanel } from './GitHistoryPanel'
import { GitStatus } from '../../types'
import { getProjectColor } from '../utils/projectColors'
import '../styles/GitView.css'

// Helper to compare git statuses for equality
const isGitStatusEqual = (a: GitStatus | undefined, b: GitStatus | undefined): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.isRepo === b.isRepo &&
    a.currentBranch === b.currentBranch &&
    a.hasChanges === b.hasChanges &&
    a.ahead === b.ahead &&
    a.behind === b.behind
  )
}

export function GitView() {
  const { state } = useContext(AppContext)
  const [gitStatuses, setGitStatuses] = useState<Map<string, GitStatus>>(new Map())
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Refs to prevent concurrent loads and state updates after unmount
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)
  const gitStatusesRef = useRef(gitStatuses)

  // Keep ref in sync with state
  useEffect(() => {
    gitStatusesRef.current = gitStatuses
  }, [gitStatuses])

  // Load Git status for all projects
  useEffect(() => {
    mountedRef.current = true

    // Load function defined inside useEffect to capture current projects
    const loadGitStatuses = async () => {
      // Prevent concurrent loads
      if (loadingRef.current) return
      loadingRef.current = true

      try {
        const statusMap = new Map<string, GitStatus>()
        const currentStatuses = gitStatusesRef.current

        for (const project of state.projects) {
          // Check if still mounted before each async operation
          if (!mountedRef.current) return

          try {
            const result = await window.api.git.getStatus(project.path)
            if (result.success && result.status) {
              statusMap.set(project.id, result.status)
            }
          } catch (error) {
            console.error(`Failed to get git status for ${project.name}:`, error)
            // Keep existing status on error to prevent flicker
            const existingStatus = currentStatuses.get(project.id)
            if (existingStatus) {
              statusMap.set(project.id, existingStatus)
            }
          }
        }

        // Only update state if mounted and if there are actual changes
        if (mountedRef.current) {
          setGitStatuses(prev => {
            // Check if anything actually changed
            let hasChanges = prev.size !== statusMap.size
            if (!hasChanges) {
              for (const [id, newStatus] of statusMap) {
                if (!isGitStatusEqual(prev.get(id), newStatus)) {
                  hasChanges = true
                  break
                }
              }
            }
            // Only return new Map if there are actual changes
            return hasChanges ? statusMap : prev
          })
        }
      } finally {
        loadingRef.current = false
      }
    }

    if (state.projects.length > 0) {
      loadGitStatuses()

      // Refresh git statuses every 10 seconds
      const interval = setInterval(loadGitStatuses, 10000)
      return () => {
        mountedRef.current = false
        clearInterval(interval)
      }
    }

    return () => {
      mountedRef.current = false
    }
  }, [state.projects]) // Depend on projects array

  const gitProjects = state.projects.filter(project => {
    const status = gitStatuses.get(project.id)
    return status?.isRepo
  })

  return (
    <div className="git-view">
      <div className="git-view-header">
        <div className="header-title">
          <VscSourceControl className="header-icon" />
          <h2>Source Control</h2>
        </div>
        <div className="btn-placeholder" />
      </div>

      <div className="git-view-content">
        {gitProjects.length === 0 ? (
          <div className="git-view-empty">
            <VscSourceControl className="empty-icon" />
            <p>No Git repositories found</p>
            <p className="empty-hint">
              Projects with Git will appear here
            </p>
          </div>
        ) : (
          <div className="git-projects-list">
            {gitProjects.map(project => {
              const gitStatus = gitStatuses.get(project.id)
              const isSelected = selectedProjectId === project.id
              const projectColor = getProjectColor(project.id, project.color)

              return (
                <div key={project.id} className="git-project-item">
                  <div
                    className={`git-project-header ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedProjectId(isSelected ? null : project.id)}
                  >
                    <span className="expand-icon">
                      {isSelected ? '▼' : '▶'}
                    </span>
                    <span
                      className="project-color-indicator"
                      style={{ backgroundColor: projectColor }}
                      title={`Project color: ${projectColor}`}
                    />
                    <div className="project-info">
                      <span className="project-name">{project.name}</span>
                      {gitStatus && (
                        <div className="project-git-info">
                          <span className="branch-name">
                            {gitStatus.currentBranch || 'main'}
                          </span>
                          {/* Ahead/behind indicators - show regardless of local changes */}
                          {gitStatus.ahead && gitStatus.ahead > 0 && (
                            <span className="ahead-indicator" title={`${gitStatus.ahead} commits ahead of remote`}>
                              ↑{gitStatus.ahead}
                            </span>
                          )}
                          {gitStatus.behind && gitStatus.behind > 0 && (
                            <span className="behind-indicator" title={`${gitStatus.behind} commits behind remote`}>
                              ↓{gitStatus.behind}
                            </span>
                          )}
                          {/* Uncommitted changes indicator */}
                          {gitStatus.hasChanges && (
                            <span className="modified-indicator" title="Uncommitted changes">
                              •
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && gitStatus && (
                    <GitHistoryPanel
                      projectId={project.id}
                      projectPath={project.path}
                      projectName={project.name}
                      gitStatus={gitStatus}
                      onClose={() => setSelectedProjectId(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
