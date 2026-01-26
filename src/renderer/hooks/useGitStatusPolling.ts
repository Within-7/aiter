import { useState, useCallback, useEffect, useRef } from 'react'
import type { FileChange } from '../../types'
import { countNodes } from './useFileTreeData'
import type { FileNode } from '../../types'

/**
 * Extended status type to include recently committed files
 */
export type ExtendedGitStatus = FileChange['status'] | 'recent-commit'

/**
 * Calculate adaptive git polling interval based on project size
 */
const getGitPollInterval = (nodeCount: number): number => {
  if (nodeCount > 1000) return 10000  // 10s for large projects
  if (nodeCount > 500) return 5000    // 5s for medium projects
  return 3000                          // 3s for small projects
}

interface UseGitStatusPollingOptions {
  projectPath: string
  nodesRef: React.RefObject<FileNode[]>
  onRefresh?: () => void
}

interface UseGitStatusPollingReturn {
  gitChanges: Map<string, ExtendedGitStatus>
  loadGitChanges: () => Promise<void>
}

/**
 * Hook for managing Git status polling with adaptive intervals.
 *
 * Provides:
 * - Git file changes map (path -> status)
 * - Adaptive polling based on project size
 * - File watcher integration
 * - Automatic cleanup on unmount
 */
export function useGitStatusPolling({
  projectPath,
  nodesRef,
  onRefresh
}: UseGitStatusPollingOptions): UseGitStatusPollingReturn {
  const [gitChanges, setGitChanges] = useState<Map<string, ExtendedGitStatus>>(new Map())
  const gitPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentIntervalRef = useRef<number>(3000)

  const loadGitChanges = useCallback(async () => {
    try {
      const changesMap = new Map<string, ExtendedGitStatus>()

      // Get files from last commit first (lower priority)
      const commitsResult = await window.api.git.getRecentCommits(projectPath, 1)
      if (commitsResult.success && commitsResult.commits && commitsResult.commits.length > 0) {
        const lastCommit = commitsResult.commits[0]
        const filesResult = await window.api.git.getCommitFiles(projectPath, lastCommit.hash)
        if (filesResult.success && filesResult.files) {
          filesResult.files.forEach(file => {
            const fullPath = `${projectPath}/${file.path}`
            changesMap.set(fullPath, 'recent-commit')
          })
        }
      }

      // Get uncommitted changes (higher priority - will override recent-commit)
      const result = await window.api.git.getFileChanges(projectPath)
      if (result.success && result.changes) {
        result.changes.forEach(change => {
          const fullPath = `${projectPath}/${change.path}`
          changesMap.set(fullPath, change.status)
        })
      }

      setGitChanges(changesMap)
    } catch {
      // Silently ignore git errors (project might not be a git repo)
    }
  }, [projectPath])

  // Initial setup: load git changes, start polling, set up file watcher
  useEffect(() => {
    loadGitChanges()

    // Calculate adaptive polling interval based on project size
    const nodeCount = countNodes(nodesRef.current || [])
    const pollInterval = getGitPollInterval(nodeCount)
    currentIntervalRef.current = pollInterval
    console.log(`[useGitStatusPolling] Using ${pollInterval}ms git poll interval for ${nodeCount} nodes`)

    // Poll git status with adaptive interval
    gitPollIntervalRef.current = setInterval(loadGitChanges, pollInterval)

    // Start file watcher for this project
    window.api.fileWatcher.watch(projectPath)

    // Listen for file changes
    const unsubscribe = window.api.fileWatcher.onChanged((data) => {
      if (data.projectPath === projectPath) {
        console.log(`[useGitStatusPolling] Detected ${data.changeCount} file changes, refreshing...`)
        onRefresh?.()
        loadGitChanges()
      }
    })

    return () => {
      if (gitPollIntervalRef.current) {
        clearInterval(gitPollIntervalRef.current)
      }
      window.api.fileWatcher.unwatch(projectPath)
      unsubscribe()
    }
  }, [projectPath, loadGitChanges, nodesRef, onRefresh])

  // Update git polling interval when node count changes significantly
  useEffect(() => {
    if (!gitPollIntervalRef.current) return

    const nodeCount = countNodes(nodesRef.current || [])
    const newInterval = getGitPollInterval(nodeCount)

    // Only update if interval threshold actually changed
    if (newInterval !== currentIntervalRef.current) {
      currentIntervalRef.current = newInterval
      clearInterval(gitPollIntervalRef.current)
      gitPollIntervalRef.current = setInterval(loadGitChanges, newInterval)
      console.log(`[useGitStatusPolling] Updated git poll interval to ${newInterval}ms for ${nodeCount} nodes`)
    }
  }, [nodesRef, loadGitChanges])

  return {
    gitChanges,
    loadGitChanges
  }
}
