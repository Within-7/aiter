import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FileNode, FileChange } from '../../../types'
import { FileTreeNode } from './FileTreeNode'
import { FileContextMenu, getFileContextMenuActions, ContextMenuAction } from './FileContextMenu'
import { InputDialog } from './InputDialog'
import { ConfirmDialog } from './ConfirmDialog'
import './FileTree.css'

interface FileTreeProps {
  projectId: string
  projectPath: string
  projectName: string
  onFileClick: (file: FileNode) => void
  activeFilePath?: string
}

// Extended status type to include recently committed files
export type ExtendedGitStatus = FileChange['status'] | 'recent-commit'

interface ContextMenuState {
  x: number
  y: number
  node: FileNode | null
  isProjectRoot: boolean
}

interface DialogState {
  type: 'new-file' | 'new-folder' | 'rename' | 'delete' | null
  targetPath: string
  targetName?: string
}

export const FileTree: React.FC<FileTreeProps> = ({
  projectPath,
  onFileClick,
  activeFilePath
}) => {
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gitChanges, setGitChanges] = useState<Map<string, ExtendedGitStatus>>(new Map())
  const gitPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ type: null, targetPath: '' })

  // Load git file changes (uncommitted) and last commit files
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
    } catch (err) {
      // Silently ignore git errors (project might not be a git repo)
    }
  }, [projectPath])

  useEffect(() => {
    loadDirectory(projectPath)
    loadGitChanges()

    // Poll git status every 3 seconds
    gitPollIntervalRef.current = setInterval(loadGitChanges, 3000)

    return () => {
      if (gitPollIntervalRef.current) {
        clearInterval(gitPollIntervalRef.current)
      }
    }
  }, [projectPath, loadGitChanges])

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

  // Context menu handler
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    node: FileNode | null,
    isProjectRoot: boolean = false
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
      isProjectRoot
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // File operations
  const handleCreateFile = useCallback(async (name: string) => {
    const targetDir = dialog.targetPath
    const filePath = `${targetDir}/${name}`

    try {
      const result = await window.api.fs.createFile(filePath)
      if (result.success) {
        // Refresh the directory
        loadDirectory(projectPath)
      } else {
        console.error('Failed to create file:', result.error)
      }
    } catch (err) {
      console.error('Error creating file:', err)
    }

    setDialog({ type: null, targetPath: '' })
  }, [dialog.targetPath, projectPath])

  const handleCreateFolder = useCallback(async (name: string) => {
    const targetDir = dialog.targetPath
    const folderPath = `${targetDir}/${name}`

    try {
      const result = await window.api.fs.createDirectory(folderPath)
      if (result.success) {
        loadDirectory(projectPath)
      } else {
        console.error('Failed to create folder:', result.error)
      }
    } catch (err) {
      console.error('Error creating folder:', err)
    }

    setDialog({ type: null, targetPath: '' })
  }, [dialog.targetPath, projectPath])

  const handleRename = useCallback(async (newName: string) => {
    const oldPath = dialog.targetPath
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = `${parentDir}/${newName}`

    try {
      const result = await window.api.fs.rename(oldPath, newPath)
      if (result.success) {
        loadDirectory(projectPath)
      } else {
        console.error('Failed to rename:', result.error)
      }
    } catch (err) {
      console.error('Error renaming:', err)
    }

    setDialog({ type: null, targetPath: '' })
  }, [dialog.targetPath, projectPath])

  const handleDelete = useCallback(async () => {
    const targetPath = dialog.targetPath

    try {
      const result = await window.api.fs.delete(targetPath)
      if (result.success) {
        loadDirectory(projectPath)
      } else {
        console.error('Failed to delete:', result.error)
      }
    } catch (err) {
      console.error('Error deleting:', err)
    }

    setDialog({ type: null, targetPath: '' })
  }, [dialog.targetPath, projectPath])

  const handleUploadFiles = useCallback(async (targetDir: string) => {
    try {
      const result = await window.api.dialog.openFiles()
      if (result.success && result.data?.paths) {
        const copyResult = await window.api.fs.copyFiles(result.data.paths, targetDir)
        if (copyResult.success) {
          loadDirectory(projectPath)
        } else {
          console.error('Failed to copy files:', copyResult.error)
        }
      }
    } catch (err) {
      console.error('Error uploading files:', err)
    }
  }, [projectPath])

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path)
  }, [])

  // Get context menu actions
  const getContextMenuActionsForNode = useCallback((): ContextMenuAction[] => {
    if (!contextMenu) return []

    const node = contextMenu.node
    const isDirectory = node ? node.type === 'directory' : true
    const isProjectRoot = contextMenu.isProjectRoot
    const targetPath = node?.path || projectPath

    return getFileContextMenuActions(isDirectory, isProjectRoot, {
      onNewFile: () => {
        setDialog({
          type: 'new-file',
          targetPath: isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/'))
        })
      },
      onNewFolder: () => {
        setDialog({
          type: 'new-folder',
          targetPath: isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/'))
        })
      },
      onRename: () => {
        if (node) {
          setDialog({
            type: 'rename',
            targetPath: targetPath,
            targetName: node.name
          })
        }
      },
      onDelete: () => {
        if (node) {
          setDialog({
            type: 'delete',
            targetPath: targetPath,
            targetName: node.name
          })
        }
      },
      onUploadFiles: () => {
        handleUploadFiles(isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/')))
      },
      onCopyPath: () => {
        handleCopyPath(targetPath)
      }
    })
  }, [contextMenu, projectPath, handleUploadFiles, handleCopyPath])

  // Validate file/folder name
  const validateName = useCallback((name: string): string | null => {
    if (name.includes('/') || name.includes('\\')) {
      return 'Name cannot contain / or \\'
    }
    if (name.startsWith('.') && name.length === 1) {
      return 'Invalid name'
    }
    return null
  }, [])

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
    <div
      className="file-tree"
      onContextMenu={(e) => handleContextMenu(e, null, true)}
    >
      <div className="file-tree-content">
        {nodes.map(node => (
          <FileTreeNode
            key={node.id}
            node={node}
            level={0}
            onToggle={handleToggle}
            onClick={onFileClick}
            onContextMenu={handleContextMenu}
            activeFilePath={activeFilePath}
            gitChanges={gitChanges}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActionsForNode()}
          onClose={closeContextMenu}
        />
      )}

      {/* Input Dialogs */}
      {dialog.type === 'new-file' && (
        <InputDialog
          title="New File"
          placeholder="Enter file name"
          confirmLabel="Create"
          onConfirm={handleCreateFile}
          onCancel={() => setDialog({ type: null, targetPath: '' })}
          validator={validateName}
        />
      )}

      {dialog.type === 'new-folder' && (
        <InputDialog
          title="New Folder"
          placeholder="Enter folder name"
          confirmLabel="Create"
          onConfirm={handleCreateFolder}
          onCancel={() => setDialog({ type: null, targetPath: '' })}
          validator={validateName}
        />
      )}

      {dialog.type === 'rename' && (
        <InputDialog
          title="Rename"
          placeholder="Enter new name"
          defaultValue={dialog.targetName}
          confirmLabel="Rename"
          onConfirm={handleRename}
          onCancel={() => setDialog({ type: null, targetPath: '' })}
          validator={validateName}
        />
      )}

      {/* Confirm Dialog */}
      {dialog.type === 'delete' && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${dialog.targetName}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDialog({ type: null, targetPath: '' })}
        />
      )}
    </div>
  )
}
