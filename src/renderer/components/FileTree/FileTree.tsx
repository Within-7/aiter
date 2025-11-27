import React, { useState, useEffect } from 'react'
import { FileNode } from '../../../types'
import { FileTreeNode } from './FileTreeNode'
import './FileTree.css'

interface FileTreeProps {
  projectId: string
  projectPath: string
  projectName: string
  onFileClick: (file: FileNode) => void
}

export const FileTree: React.FC<FileTreeProps> = ({
  projectPath,
  onFileClick
}) => {
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDirectory(projectPath)
  }, [projectPath])

  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.api.fs.readDir(path, 1)
      if (result.success && result.nodes) {
        setNodes(result.nodes)
      } else {
        setError(result.error || 'Failed to load directory')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (node: FileNode) => {
    if (node.type !== 'directory') return

    // If already has children loaded, just toggle
    if (node.children && node.children.length > 0) {
      updateNodeExpansion(node.id, !node.isExpanded)
      return
    }

    // Load children if not loaded
    try {
      const result = await window.api.fs.readDir(node.path, 1)
      if (result.success && result.nodes) {
        updateNodeChildren(node.id, result.nodes)
        updateNodeExpansion(node.id, true)
      }
    } catch (err) {
      console.error('Failed to load directory:', err)
    }
  }

  const updateNodeExpansion = (nodeId: string, isExpanded: boolean) => {
    setNodes(prevNodes => updateNodeInTree(prevNodes, nodeId, { isExpanded }))
  }

  const updateNodeChildren = (nodeId: string, children: FileNode[]) => {
    setNodes(prevNodes => updateNodeInTree(prevNodes, nodeId, { children, isExpanded: true }))
  }

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

  if (loading && nodes.length === 0) {
    return (
      <div className="file-tree">
        <div className="file-tree-loading">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="file-tree">
        <div className="file-tree-error">{error}</div>
      </div>
    )
  }

  return (
    <div className="file-tree">
      <div className="file-tree-content">
        {nodes.map(node => (
          <FileTreeNode
            key={node.id}
            node={node}
            level={0}
            onToggle={handleToggle}
            onClick={onFileClick}
          />
        ))}
      </div>
    </div>
  )
}
