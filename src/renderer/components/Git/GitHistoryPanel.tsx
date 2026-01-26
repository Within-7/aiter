import { useState, useContext } from 'react'
import { VscGitCommit, VscRefresh, VscCheck, VscFile, VscDiffAdded, VscDiffModified, VscDiffRemoved, VscCloudUpload, VscCloudDownload, VscSync, VscAdd, VscRemove, VscChevronDown, VscChevronRight } from 'react-icons/vsc'
import { GitStatus, EditorTab, GitCommit } from '../../../types'
import { AppContext } from '../../context/AppContext'
import { useGitOperations, type CommitFile, type FileChange } from '../../hooks/useGitOperations'
import { formatRelativeTime } from '../../utils'
import '../../styles/GitHistoryPanel.css'

interface GitHistoryPanelProps {
  projectId: string
  projectPath: string
  projectName: string
  gitStatus: GitStatus
  onClose: () => void
}

export function GitHistoryPanel({ projectId, projectPath, projectName, gitStatus, onClose }: GitHistoryPanelProps) {
  const { dispatch } = useContext(AppContext)

  // Use Git operations hook
  const {
    commits,
    fileChanges,
    branches,
    commitFiles,
    loading,
    committing,
    operationInProgress,
    refresh,
    commitAll,
    switchBranch,
    createBranch,
    deleteBranch,
    pull,
    push,
    fetch,
    stageFile,
    unstageFile,
    loadCommitFiles,
    getCommitFileDiff,
    getFileDiff
  } = useGitOperations(projectPath)

  // Local UI state
  const [commitMessage, setCommitMessage] = useState('')
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranchInput, setShowNewBranchInput] = useState(false)
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set())

  // Handler wrappers that manage local UI state
  const handleCommitAll = async () => {
    const result = await commitAll(commitMessage)
    if (result.success) {
      setCommitMessage('')
    }
  }

  const handleSwitchBranch = async (branchName: string) => {
    const result = await switchBranch(branchName)
    if (result.success) {
      setShowBranchDropdown(false)
    }
  }

  const handleCreateBranch = async () => {
    const result = await createBranch(newBranchName)
    if (result.success) {
      setNewBranchName('')
      setShowNewBranchInput(false)
    }
  }

  const handleToggleCommit = async (commitHash: string) => {
    const newExpanded = new Set(expandedCommits)

    if (newExpanded.has(commitHash)) {
      newExpanded.delete(commitHash)
    } else {
      newExpanded.add(commitHash)
      await loadCommitFiles(commitHash)
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

  // Open diff tab for a file in a commit
  const handleOpenCommitFileDiff = async (commit: GitCommit, file: CommitFile) => {
    const diff = await getCommitFileDiff(commit.hash, file.path)
    if (diff !== null) {
      const fileName = file.path.split('/').pop() || file.path
      const tabId = `diff-${commit.shortHash}-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`

      const diffTab: EditorTab = {
        id: tabId,
        filePath: file.path,
        fileName: `${fileName} (${commit.shortHash})`,
        fileType: 'diff',
        content: '',
        isDirty: false,
        isPreview: true,
        isDiff: true,
        diffContent: diff,
        commitHash: commit.hash,
        commitMessage: commit.message,
        projectPath: projectPath
      }

      dispatch({ type: 'ADD_EDITOR_TAB', payload: diffTab })
    }
  }

  // Open diff tab for an uncommitted file change
  const handleOpenUncommittedFileDiff = async (change: FileChange) => {
    try {
      // Extract file name from path
      const fileName = change.path.split('/').pop() || change.path
      // Create a unique ID for this diff tab
      const tabId = `diff-uncommitted-${change.path.replace(/[^a-zA-Z0-9]/g, '-')}`

      let diffContent = ''

      if (change.status === 'untracked') {
        // For untracked files, read the file content and show all as additions
        const fullPath = `${projectPath}/${change.path}`
        const fileResult = await window.api.fs.readFile(fullPath)
        if (fileResult.success && fileResult.content !== undefined) {
          const lines = fileResult.content.split('\n')
          const totalLines = lines.length
          // Format as a diff with all lines as additions
          diffContent = `diff --git a/${change.path} b/${change.path}
new file mode 100644
--- /dev/null
+++ b/${change.path}
@@ -0,0 +1,${totalLines} @@
${lines.map(line => `+${line}`).join('\n')}`
        } else {
          diffContent = `[NEW FILE] ${change.path}\n\nUnable to read file content.`
        }
      } else {
        // For tracked files, use git diff
        const diff = await getFileDiff(change.path)
        if (diff !== null) {
          diffContent = diff || `[${change.status.toUpperCase()}] ${change.path}\n\nNo changes detected.`
        } else {
          return
        }
      }

      // Create editor tab for diff view (preview mode - replaced on next click)
      const diffTab: EditorTab = {
        id: tabId,
        filePath: change.path,
        fileName: `${fileName} (uncommitted)`,
        fileType: 'diff',
        content: '',
        isDirty: false,
        isPreview: true,
        isDiff: true,
        diffContent: diffContent,
        commitHash: undefined,
        commitMessage: `Uncommitted changes - ${change.status}`,
        projectPath: projectPath
      }

      dispatch({ type: 'ADD_EDITOR_TAB', payload: diffTab })
    } catch (error) {
      console.error('Failed to open uncommitted file diff:', error)
    }
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
            onClick={refresh}
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
                        onClick={() => deleteBranch(branch.name)}
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
            onClick={fetch}
            disabled={operationInProgress !== null}
            title="Fetch from remote"
          >
            <VscSync />
          </button>
          <button
            className="btn-remote"
            onClick={pull}
            disabled={operationInProgress !== null}
            title="Pull from remote"
          >
            <VscCloudDownload />
          </button>
          <button
            className="btn-remote"
            onClick={push}
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
                    <div
                      key={index}
                      className="file-change-item clickable"
                      onClick={() => handleOpenUncommittedFileDiff(change)}
                      title={`Click to view diff: ${change.path}`}
                    >
                      {getStatusIcon(change.status)}
                      <span className="file-path" title={change.path}>
                        {change.path}
                      </span>
                      <span className={`status-badge ${change.status}`}>
                        {change.status}
                      </span>
                      <div className="file-actions">
                        {change.status !== 'untracked' && (
                          <button
                            className="btn-file-action"
                            onClick={(e) => {
                              e.stopPropagation()
                              stageFile(change.path)
                            }}
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
                        <div className="commit-message" title={commit.message}>{commit.message}</div>
                        <div className="commit-meta">
                          <span className="commit-author">{commit.author}</span>
                          <span className="commit-separator">•</span>
                          <span className="commit-hash">{commit.shortHash}</span>
                          <span className="commit-separator">•</span>
                          <span className="commit-date">{formatRelativeTime(commit.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="commit-files">
                        {files.length > 0 ? (
                          files.map((file, index) => (
                            <div
                              key={index}
                              className="commit-file-item clickable"
                              onClick={() => handleOpenCommitFileDiff(commit, file)}
                              title={`Click to view diff: ${file.path}`}
                            >
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
    </div>
  )
}
