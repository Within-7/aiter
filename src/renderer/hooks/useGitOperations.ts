import { useState, useCallback, useEffect, useRef } from 'react'
import type { GitCommit } from '../../types'

/**
 * File change in working directory
 */
export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'untracked'
}

/**
 * File in a commit
 */
export interface CommitFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

/**
 * Git branch
 */
export interface Branch {
  name: string
  current: boolean
}

/**
 * Result type for Git operations
 */
interface OperationResult {
  success: boolean
  error?: string
}

/**
 * Hook for managing Git operations with unified error handling and loading states.
 *
 * Provides:
 * - Data fetching (commits, changes, branches)
 * - Git operations (commit, push, pull, fetch, branch management)
 * - Loading/operation state tracking
 * - Automatic data refresh after operations
 */
export function useGitOperations(projectPath: string) {
  // Data state
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [fileChanges, setFileChanges] = useState<FileChange[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [commitFiles, setCommitFiles] = useState<Map<string, CommitFile[]>>(new Map())

  // Loading states
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null)

  // Mount ref for cleanup
  const mountedRef = useRef(true)

  // Load all Git data
  const loadGitData = useCallback(async () => {
    if (!projectPath) return

    setLoading(true)
    try {
      // Load commits
      const commitsResult = await window.api.git.getRecentCommits(projectPath, 10)
      if (mountedRef.current && commitsResult.success && commitsResult.commits) {
        setCommits(commitsResult.commits)
      }

      // Load file changes
      const changesResult = await window.api.git.getFileChanges(projectPath)
      if (mountedRef.current && changesResult.success && changesResult.changes) {
        setFileChanges(changesResult.changes)
      }

      // Load branches
      const branchesResult = await window.api.git.getBranches(projectPath)
      if (mountedRef.current && branchesResult.success && branchesResult.branches) {
        setBranches(branchesResult.branches)
      }
    } catch (error) {
      console.error('Failed to load git data:', error)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [projectPath])

  // Load data on mount and path change
  useEffect(() => {
    mountedRef.current = true
    loadGitData()
    return () => {
      mountedRef.current = false
    }
  }, [loadGitData])

  /**
   * Generic operation wrapper with error handling
   */
  const executeOperation = useCallback(async <T>(
    operationId: string,
    operation: () => Promise<{ success: boolean; error?: string } & T>,
    options?: {
      skipRefresh?: boolean
      onSuccess?: (result: T) => void
      successMessage?: string
    }
  ): Promise<OperationResult> => {
    setOperationInProgress(operationId)
    try {
      const result = await operation()
      if (result.success) {
        if (!options?.skipRefresh) {
          await loadGitData()
        }
        if (options?.onSuccess) {
          options.onSuccess(result)
        }
        if (options?.successMessage) {
          alert(options.successMessage)
        }
        return { success: true }
      } else {
        alert(`Operation failed: ${result.error}`)
        return { success: false, error: result.error }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Git operation failed (${operationId}):`, error)
      alert(`Operation failed: ${message}`)
      return { success: false, error: message }
    } finally {
      if (mountedRef.current) {
        setOperationInProgress(null)
      }
    }
  }, [loadGitData])

  // === Git Operations ===

  const commitAll = useCallback(async (message: string): Promise<OperationResult> => {
    if (!message.trim()) {
      alert('Please enter a commit message')
      return { success: false, error: 'Empty commit message' }
    }

    setCommitting(true)
    try {
      return await executeOperation('commit', () =>
        window.api.git.commitAll(projectPath, message)
      )
    } finally {
      if (mountedRef.current) {
        setCommitting(false)
      }
    }
  }, [projectPath, executeOperation])

  const switchBranch = useCallback((branchName: string) => {
    return executeOperation('switch-branch', () =>
      window.api.git.switchBranch(projectPath, branchName)
    )
  }, [projectPath, executeOperation])

  const createBranch = useCallback((branchName: string) => {
    if (!branchName.trim()) {
      alert('Please enter a branch name')
      return Promise.resolve({ success: false, error: 'Empty branch name' })
    }
    return executeOperation('create-branch', () =>
      window.api.git.createBranch(projectPath, branchName)
    )
  }, [projectPath, executeOperation])

  const deleteBranch = useCallback(async (branchName: string): Promise<OperationResult> => {
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) {
      return { success: false, error: 'Cancelled' }
    }
    return executeOperation('delete-branch', () =>
      window.api.git.deleteBranch(projectPath, branchName)
    )
  }, [projectPath, executeOperation])

  const pull = useCallback(() => {
    return executeOperation('pull', () =>
      window.api.git.pull(projectPath),
      { successMessage: 'Pull completed successfully' }
    )
  }, [projectPath, executeOperation])

  const push = useCallback(() => {
    return executeOperation('push', () =>
      window.api.git.push(projectPath),
      { successMessage: 'Push completed successfully' }
    )
  }, [projectPath, executeOperation])

  const fetch = useCallback(() => {
    return executeOperation('fetch', () =>
      window.api.git.fetch(projectPath),
      { successMessage: 'Fetch completed successfully' }
    )
  }, [projectPath, executeOperation])

  const stageFile = useCallback((filePath: string) => {
    return executeOperation(`stage-${filePath}`, () =>
      window.api.git.stageFile(projectPath, filePath)
    )
  }, [projectPath, executeOperation])

  const unstageFile = useCallback((filePath: string) => {
    return executeOperation(`unstage-${filePath}`, () =>
      window.api.git.unstageFile(projectPath, filePath)
    )
  }, [projectPath, executeOperation])

  const loadCommitFiles = useCallback(async (commitHash: string) => {
    if (commitFiles.has(commitHash)) {
      return commitFiles.get(commitHash) || []
    }

    try {
      const result = await window.api.git.getCommitFiles(projectPath, commitHash)
      if (result.success && result.files) {
        setCommitFiles(prev => new Map(prev).set(commitHash, result.files!))
        return result.files
      }
    } catch (error) {
      console.error('Failed to load commit files:', error)
    }
    return []
  }, [projectPath, commitFiles])

  const getCommitFileDiff = useCallback(async (commitHash: string, filePath: string) => {
    try {
      const result = await window.api.git.getCommitFileDiff(projectPath, commitHash, filePath)
      if (result.success) {
        return result.diff
      }
    } catch (error) {
      console.error('Failed to get commit file diff:', error)
    }
    return null
  }, [projectPath])

  const getFileDiff = useCallback(async (filePath: string) => {
    try {
      const result = await window.api.git.getFileDiff(projectPath, filePath)
      if (result.success) {
        return result.diff
      }
    } catch (error) {
      console.error('Failed to get file diff:', error)
    }
    return null
  }, [projectPath])

  return {
    // Data
    commits,
    fileChanges,
    branches,
    commitFiles,

    // States
    loading,
    committing,
    operationInProgress,

    // Operations
    refresh: loadGitData,
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
  }
}
