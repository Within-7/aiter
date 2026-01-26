import { useState, useCallback, useRef, useEffect } from 'react'
import type { FileNode } from '../../types'

/**
 * Collect all expanded folder paths from a node tree
 */
const collectExpandedPaths = (nodes: FileNode[]): Set<string> => {
  const expanded = new Set<string>()

  const traverse = (nodeList: FileNode[]) => {
    for (const node of nodeList) {
      if (node.type === 'directory' && node.isExpanded) {
        expanded.add(node.path)
        if (node.children) {
          traverse(node.children)
        }
      }
    }
  }

  traverse(nodes)
  return expanded
}

/**
 * Restore expanded state to a new node tree (async load subdirectory contents)
 */
const restoreExpandedState = async (
  newNodes: FileNode[],
  expandedPaths: Set<string>
): Promise<FileNode[]> => {
  const restoreNode = async (node: FileNode): Promise<FileNode> => {
    if (node.type === 'directory' && expandedPaths.has(node.path)) {
      try {
        const result = await window.api.fs.readDir(node.path, 1)
        if (result.success && result.nodes) {
          const restoredChildren = await Promise.all(
            result.nodes.map(child => restoreNode(child))
          )
          return { ...node, isExpanded: true, children: restoredChildren }
        }
      } catch {
        return node
      }
    }
    return node
  }

  return Promise.all(newNodes.map(node => restoreNode(node)))
}

/**
 * Update a node in the tree by ID
 */
const updateNodeInTree = (
  nodes: FileNode[],
  nodeId: string,
  updates: Partial<FileNode>
): FileNode[] => {
  return nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, ...updates }
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeId, updates)
      }
    }
    return node
  })
}

/**
 * Count total nodes in the tree
 */
export const countNodes = (nodes: FileNode[]): number => {
  let count = 0
  const traverse = (nodeList: FileNode[]) => {
    for (const node of nodeList) {
      count++
      if (node.children) {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return count
}

interface UseFileTreeDataOptions {
  projectPath: string
}

interface UseFileTreeDataReturn {
  nodes: FileNode[]
  loading: boolean
  error: string | null
  nodesRef: React.RefObject<FileNode[]>
  loadDirectory: (path: string) => Promise<void>
  handleToggle: (node: FileNode) => Promise<void>
  refreshTree: () => Promise<void>
}

/**
 * Hook for managing file tree data loading and node state.
 *
 * Provides:
 * - File tree nodes state
 * - Directory loading with expanded state preservation
 * - Node toggle (expand/collapse) with lazy loading
 * - Tree refresh functionality
 */
export function useFileTreeData({
  projectPath
}: UseFileTreeDataOptions): UseFileTreeDataReturn {
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nodesRef = useRef<FileNode[]>([])

  // Keep nodesRef in sync with nodes
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      // Collect currently expanded paths
      const expandedPaths = collectExpandedPaths(nodesRef.current)

      const result = await window.api.fs.readDir(path, 1)
      if (result.success && result.nodes) {
        // Restore expanded state if there were expanded folders
        if (expandedPaths.size > 0) {
          const restoredNodes = await restoreExpandedState(result.nodes, expandedPaths)
          setNodes(restoredNodes)
        } else {
          setNodes(result.nodes)
        }
      } else {
        setError(result.error || 'Failed to load directory')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleToggle = useCallback(async (node: FileNode) => {
    if (node.type !== 'directory') return

    // If already has children loaded, just toggle
    if (node.children && node.children.length > 0) {
      setNodes(prevNodes => updateNodeInTree(prevNodes, node.id, { isExpanded: !node.isExpanded }))
      return
    }

    // Load children if not loaded
    try {
      const result = await window.api.fs.readDir(node.path, 1)
      if (result.success && result.nodes) {
        setNodes(prevNodes => updateNodeInTree(prevNodes, node.id, {
          children: result.nodes,
          isExpanded: true
        }))
      }
    } catch (err) {
      console.error('Failed to load directory:', err)
    }
  }, [])

  const refreshTree = useCallback(async () => {
    await loadDirectory(projectPath)
  }, [loadDirectory, projectPath])

  return {
    nodes,
    loading,
    error,
    nodesRef,
    loadDirectory,
    handleToggle,
    refreshTree
  }
}
