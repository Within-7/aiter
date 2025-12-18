import { useState, useEffect } from 'react'
import { VscGitCommit, VscRefresh, VscCheck, VscFile, VscDiffAdded, VscDiffModified, VscDiffRemoved, VscCloudUpload, VscCloudDownload, VscSync, VscAdd, VscRemove, VscDiff, VscChevronDown, VscChevronRight } from 'react-icons/vsc'
import { GitCommit, GitStatus } from '../../types'
import '../styles/GitHistoryPanel.css'

interface GitHistoryPanelProps {
  projectId: string
  projectPath: string
  projectName: string
  gitStatus: GitStatus
  onClose: () => void
}

interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'untracked'
}

interface CommitFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

interface Branch {
  name: string
  current: boolean
}

export function GitHistoryPanel({ projectId, projectPath, projectName, gitStatus, onClose }: GitHistoryPanelProps) {
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [fileChanges, setFileChanges] = useState<FileChange[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranchInput, setShowNewBranchInput] = useState(false)
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null)
  const [selectedFileDiff, setSelectedFileDiff] = useState<{ path: string; diff: string } | null>(null)
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set())
  const [commitFiles, setCommitFiles] = useState<Map<string, CommitFile[]>>(new Map())

  const loadGitData = async () => {
    setLoading(true)
    try {
      // Load commits
      const commitsResult = await window.api.git.getRecentCommits(projectPath, 10)
      if (commitsResult.success && commitsResult.commits) {
        setCommits(commitsResult.commits)
      }

      // Load file changes
      const changesResult = await window.api.git.getFileChanges(projectPath)
      if (changesResult.success && changesResult.changes) {
        setFileChanges(changesResult.changes)
      }

      // Load branches
      const branchesResult = await window.api.git.getBranches(projectPath)
      if (branchesResult.success && branchesResult.branches) {
        setBranches(branchesResult.branches)
      }
    } catch (error) {
      console.error('Failed to load git data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGitData()
  }, [projectPath])

  const handleRefresh = () => {
    loadGitData()
  }

  const handleCommitAll = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message')
      return
    }

    setCommitting(true)
    try {
      const result = await window.api.git.commitAll(projectPath, commitMessage)
      if (result.success) {
        setCommitMessage('')
        await loadGitData()
      } else {
        alert(`Commit failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to commit:', error)
      alert('Failed to commit changes')
    } finally {
      setCommitting(false)
    }
  }

  const handleSwitchBranch = async (branchName: string) => {
    setOperationInProgress('switch-branch')
    try {
      const result = await window.api.git.switchBranch(projectPath, branchName)
      if (result.success) {
        await loadGitData()
        setShowBranchDropdown(false)
      } else {
        alert(`Failed to switch branch: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to switch branch:', error)
      alert('Failed to switch branch')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      alert('Please enter a branch name')
      return
    }

    setOperationInProgress('create-branch')
    try {
      const result = await window.api.git.createBranch(projectPath, newBranchName)
      if (result.success) {
        setNewBranchName('')
        setShowNewBranchInput(false)
        await loadGitData()
      } else {
        alert(`Failed to create branch: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to create branch:', error)
      alert('Failed to create branch')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleDeleteBranch = async (branchName: string) => {
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) {
      return
    }

    setOperationInProgress('delete-branch')
    try {
      const result = await window.api.git.deleteBranch(projectPath, branchName)
      if (result.success) {
        await loadGitData()
      } else {
        alert(`Failed to delete branch: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete branch:', error)
      alert('Failed to delete branch')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handlePull = async () => {
    setOperationInProgress('pull')
    try {
      const result = await window.api.git.pull(projectPath)
      if (result.success) {
        await loadGitData()
        alert('Pull completed successfully')
      } else {
        alert(`Pull failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to pull:', error)
      alert('Failed to pull')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handlePush = async () => {
    setOperationInProgress('push')
    try {
      const result = await window.api.git.push(projectPath)
      if (result.success) {
        await loadGitData()
        alert('Push completed successfully')
      } else {
        alert(`Push failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to push:', error)
      alert('Failed to push')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleFetch = async () => {
    setOperationInProgress('fetch')
    try {
      const result = await window.api.git.fetch(projectPath)
      if (result.success) {
        await loadGitData()
        alert('Fetch completed successfully')
      } else {
        alert(`Fetch failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
      alert('Failed to fetch')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleStageFile = async (filePath: string) => {
    setOperationInProgress(`stage-${filePath}`)
    try {
      const result = await window.api.git.stageFile(projectPath, filePath)
      if (result.success) {
        await loadGitData()
      } else {
        alert(`Failed to stage file: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to stage file:', error)
      alert('Failed to stage file')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleUnstageFile = async (filePath: string) => {
    setOperationInProgress(`unstage-${filePath}`)
    try {
      const result = await window.api.git.unstageFile(projectPath, filePath)
      if (result.success) {
        await loadGitData()
      } else {
        alert(`Failed to unstage file: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to unstage file:', error)
      alert('Failed to unstage file')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleViewDiff = async (filePath: string) => {
    setOperationInProgress(`diff-${filePath}`)
    try {
      const result = await window.api.git.getFileDiff(projectPath, filePath)
      if (result.success && result.diff !== undefined) {
        setSelectedFileDiff({ path: filePath, diff: result.diff })
      } else {
        alert(`Failed to get diff: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to get diff:', error)
      alert('Failed to get diff')
    } finally {
      setOperationInProgress(null)
    }
  }

  const handleToggleCommit = async (commitHash: string) => {
    const newExpanded = new Set(expandedCommits)

    if (newExpanded.has(commitHash)) {
      // Collapse
      newExpanded.delete(commitHash)
    } else {
      // Expand and load files if not already loaded
      newExpanded.add(commitHash)

      if (!commitFiles.has(commitHash)) {
        try {
          const result = await window.api.git.getCommitFiles(projectPath, commitHash)
          if (result.success && result.files) {
            setCommitFiles(prev => new Map(prev).set(commitHash, result.files!))
          }
        } catch (error) {
          console.error('Failed to load commit files:', error)
        }
      }
    }

    setExpandedCommits(newExpanded)
  }

  const getCommitFileStatusIcon = (status: CommitFile['status']) => {
    switch (status) {
      case 'added':
        return <VscDiffAdded className="status-icon added" />
      case 'modified':
        return <VscDiffModified className="status-icon modified" />
      case 'deleted':
        return <VscDiffRemoved className="status-icon deleted" />
      case 'renamed':
        return <VscFile className="status-icon renamed" />
      default:
        return <VscFile className="status-icon" />
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
      case 'untracked':
        return <VscDiffAdded className="status-icon added" />
      case 'modified':
        return <VscDiffModified className="status-icon modified" />
      case 'deleted':
        return <VscDiffRemoved className="status-icon deleted" />
      default:
        return <VscFile className="status-icon" />
    }
  }

  const currentBranch = branches.find(b => b.current)

  return (
    <div className="git-history-panel">
      <div className="git-history-header">
        <h3>Git History - {projectName}</h3>
        <div className="git-history-actions">
          <button
            className="btn-icon"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh"
          >
            <VscRefresh className={loading ? 'spinning' : ''} />
          </button>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Branch and Remote Operations Bar */}
      <div className="git-operations-bar">
        {/* Branch Switcher */}
        <div className="branch-selector">
          <button
            className="branch-button"
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            disabled={operationInProgress !== null}
          >
            <span className="branch-name">{currentBranch?.name || 'main'}</span>
            <VscChevronDown />
          </button>
          {showBranchDropdown && (
            <div className="branch-dropdown">
              <div className="branch-dropdown-header">
                <span>Switch Branch</span>
                <button
                  className="btn-text"
                  onClick={() => setShowNewBranchInput(!showNewBranchInput)}
                >
                  + New
                </button>
              </div>
              {showNewBranchInput && (
                <div className="new-branch-input">
                  <input
                    type="text"
                    placeholder="Branch name..."
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateBranch()
                      if (e.key === 'Escape') setShowNewBranchInput(false)
                    }}
                    autoFocus
                  />
                  <button
                    className="btn-create"
                    onClick={handleCreateBranch}
                    disabled={!newBranchName.trim()}
                  >
                    Create
                  </button>
                </div>
              )}
              <div className="branch-list">
                {branches.map((branch) => (
                  <div
                    key={branch.name}
                    className={`branch-item ${branch.current ? 'current' : ''}`}
                  >
                    <button
                      className="branch-name-btn"
                      onClick={() => !branch.current && handleSwitchBranch(branch.name)}
                      disabled={branch.current || operationInProgress !== null}
                    >
                      <span>{branch.name}</span>
                      {branch.current && <VscCheck />}
                    </button>
                    {!branch.current && (
                      <button
                        className="btn-delete-branch"
                        onClick={() => handleDeleteBranch(branch.name)}
                        disabled={operationInProgress !== null}
                        title="Delete branch"
                      >
                        <VscRemove />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Remote Operations */}
        <div className="remote-operations">
          <button
            className="btn-remote"
            onClick={handleFetch}
            disabled={operationInProgress !== null}
            title="Fetch from remote"
          >
            <VscSync />
          </button>
          <button
            className="btn-remote"
            onClick={handlePull}
            disabled={operationInProgress !== null}
            title="Pull from remote"
          >
            <VscCloudDownload />
          </button>
          <button
            className="btn-remote"
            onClick={handlePush}
            disabled={operationInProgress !== null}
            title="Push to remote"
          >
            <VscCloudUpload />
          </button>
        </div>
      </div>

      <div className="git-history-content">
        {/* File Changes Section */}
        {gitStatus.hasChanges && (
          <div className="git-changes-section">
            <h4>Changes ({fileChanges.length})</h4>

            {fileChanges.length > 0 ? (
              <>
                <div className="file-changes-list">
                  {fileChanges.map((change, index) => (
                    <div key={index} className="file-change-item">
                      {getStatusIcon(change.status)}
                      <span className="file-path" title={change.path}>
                        {change.path}
                      </span>
                      <span className={`status-badge ${change.status}`}>
                        {change.status}
                      </span>
                      <div className="file-actions">
                        <button
                          className="btn-file-action"
                          onClick={() => handleViewDiff(change.path)}
                          disabled={operationInProgress !== null}
                          title="View diff"
                        >
                          <VscDiff />
                        </button>
                        {change.status !== 'untracked' && (
                          <button
                            className="btn-file-action"
                            onClick={() => handleStageFile(change.path)}
                            disabled={operationInProgress !== null}
                            title="Stage file"
                          >
                            <VscAdd />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="commit-section">
                  <input
                    type="text"
                    className="commit-input"
                    placeholder="Commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleCommitAll()
                      }
                    }}
                    disabled={committing}
                  />
                  <button
                    className="btn-commit"
                    onClick={handleCommitAll}
                    disabled={committing || !commitMessage.trim()}
                  >
                    <VscCheck />
                    {committing ? 'Committing...' : 'Commit All'}
                  </button>
                </div>
              </>
            ) : (
              <p className="no-changes">No changes detected</p>
            )}
          </div>
        )}

        {/* Commit History Section */}
        <div className="git-commits-section">
          <h4>Recent Commits</h4>

          {loading ? (
            <p className="loading">Loading commits...</p>
          ) : commits.length > 0 ? (
            <div className="commits-list">
              {commits.map((commit) => {
                const isExpanded = expandedCommits.has(commit.hash)
                const files = commitFiles.get(commit.hash) || []

                return (
                  <div key={commit.hash} className={`commit-item ${isExpanded ? 'expanded' : ''}`}>
                    <div
                      className="commit-header"
                      onClick={() => handleToggleCommit(commit.hash)}
                    >
                      <div className="commit-expand-icon">
                        {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
                      </div>
                      <div className="commit-icon">
                        <VscGitCommit />
                      </div>
                      <div className="commit-details">
                        <div className="commit-message">{commit.message}</div>
                        <div className="commit-meta">
                          <span className="commit-author">{commit.author}</span>
                          <span className="commit-separator">•</span>
                          <span className="commit-hash">{commit.shortHash}</span>
                          <span className="commit-separator">•</span>
                          <span className="commit-date">{formatDate(commit.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="commit-files">
                        {files.length > 0 ? (
                          files.map((file, index) => (
                            <div key={index} className="commit-file-item">
                              {getCommitFileStatusIcon(file.status)}
                              <span className="commit-file-path" title={file.path}>
                                {file.path}
                              </span>
                              <span className={`commit-file-status ${file.status}`}>
                                {file.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="loading-files">Loading files...</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="no-commits">No commits yet</p>
          )}
        </div>
      </div>

      {/* Diff Modal */}
      {selectedFileDiff && (
        <div className="diff-modal-overlay" onClick={() => setSelectedFileDiff(null)}>
          <div className="diff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="diff-modal-header">
              <h4>{selectedFileDiff.path}</h4>
              <button
                className="btn-icon"
                onClick={() => setSelectedFileDiff(null)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="diff-modal-content">
              {selectedFileDiff.diff ? (
                <pre className="diff-content">{selectedFileDiff.diff}</pre>
              ) : (
                <p className="no-diff">No changes to display</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
