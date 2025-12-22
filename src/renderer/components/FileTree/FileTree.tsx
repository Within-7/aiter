import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FileNode, FileChange } from '../../../types'
import { FileTreeNode } from './FileTreeNode'
import { FileContextMenu, getFileContextMenuActions, ContextMenuAction } from './FileContextMenu'
import { InputDialog } from './InputDialog'
import { ConfirmDialog } from './ConfirmDialog'
import './FileTree.css'

// 收集所有展开的文件夹路径
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

// 恢复展开状态到新节点树（异步加载子目录内容）
const restoreExpandedState = async (
  newNodes: FileNode[],
  expandedPaths: Set<string>
): Promise<FileNode[]> => {
  const restoreNode = async (node: FileNode): Promise<FileNode> => {
    if (node.type === 'directory' && expandedPaths.has(node.path)) {
      try {
        // 重新加载子目录内容
        const result = await window.api.fs.readDir(node.path, 1)
        if (result.success && result.nodes) {
          // 递归恢复子节点的展开状态
          const restoredChildren = await Promise.all(
            result.nodes.map(child => restoreNode(child))
          )
          return { ...node, isExpanded: true, children: restoredChildren }
        }
      } catch {
        // 如果加载失败，保持节点但不展开
        return node
      }
    }
    return node
  }

  return Promise.all(newNodes.map(node => restoreNode(node)))
}

interface FileTreeProps {
  projectId: string
  projectPath: string
  projectName: string
  onFileClick: (file: FileNode) => void
  activeFilePath?: string
}

interface FileDragState {
  draggedPath: string | null
  dropTargetPath: string | null
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
  const nodesRef = useRef<FileNode[]>([]) // 用于在刷新时访问当前节点状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ type: null, targetPath: '' })
  const [fileDragState, setFileDragState] = useState<FileDragState>({ draggedPath: null, dropTargetPath: null })

  // 保持 nodesRef 与 nodes 同步
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

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

    // Start file watcher for this project
    window.api.fileWatcher.watch(projectPath)

    // Listen for file changes
    const unsubscribe = window.api.fileWatcher.onChanged((data) => {
      if (data.projectPath === projectPath) {
        console.log(`[FileTree] Detected ${data.changeCount} file changes, refreshing...`)
        loadDirectory(projectPath)
        loadGitChanges()
      }
    })

    return () => {
      if (gitPollIntervalRef.current) {
        clearInterval(gitPollIntervalRef.current)
      }
      // Stop file watcher and remove listener
      window.api.fileWatcher.unwatch(projectPath)
      unsubscribe()
    }
  }, [projectPath, loadGitChanges])

  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      // 先收集当前展开的路径
      const expandedPaths = collectExpandedPaths(nodesRef.current)

      const result = await window.api.fs.readDir(path, 1)
      if (result.success && result.nodes) {
        // 如果有展开的文件夹，恢复展开状态
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

  // File drag and drop handlers
  const handleFileDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-file-path', path)
    setFileDragState({ draggedPath: path, dropTargetPath: null })
  }, [])

  const handleFileDragOver = useCallback((e: React.DragEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()

    // Only allow drop on directories
    if (node.type !== 'directory') return

    const draggedPath = fileDragState.draggedPath
    if (!draggedPath) return

    // Don't allow dropping on self or parent
    if (draggedPath === node.path || node.path.startsWith(draggedPath + '/')) return

    e.dataTransfer.dropEffect = 'move'
    setFileDragState(prev => ({ ...prev, dropTargetPath: node.path }))
  }, [fileDragState.draggedPath])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    setFileDragState(prev => ({ ...prev, dropTargetPath: null }))
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault()
    e.stopPropagation()

    const draggedPath = e.dataTransfer.getData('application/x-file-path')
    if (!draggedPath || targetNode.type !== 'directory') {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Don't drop on self or into own subdirectory
    if (draggedPath === targetNode.path || targetNode.path.startsWith(draggedPath + '/')) {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Get the file/folder name
    const name = draggedPath.substring(draggedPath.lastIndexOf('/') + 1)
    const newPath = `${targetNode.path}/${name}`

    try {
      const result = await window.api.fs.rename(draggedPath, newPath)
      if (result.success) {
        loadDirectory(projectPath)
      } else {
        console.error('Failed to move file:', result.error)
      }
    } catch (err) {
      console.error('Error moving file:', err)
    }

    setFileDragState({ draggedPath: null, dropTargetPath: null })
  }, [projectPath])

  const handleFileDragEnd = useCallback(() => {
    setFileDragState({ draggedPath: null, dropTargetPath: null })
  }, [])

  // Handle drop on project root (file-tree-content area)
  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (fileDragState.draggedPath) {
      e.dataTransfer.dropEffect = 'move'
      setFileDragState(prev => ({ ...prev, dropTargetPath: projectPath }))
    }
  }, [fileDragState.draggedPath, projectPath])

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the root area, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setFileDragState(prev => ({ ...prev, dropTargetPath: null }))
    }
  }, [])

  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()

    const draggedPath = e.dataTransfer.getData('application/x-file-path')
    if (!draggedPath) {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Check if already in root directory
    const parentDir = draggedPath.substring(0, draggedPath.lastIndexOf('/'))
    if (parentDir === projectPath) {
      setFileDragState({ draggedPath: null, dropTargetPath: null })
      return
    }

    // Get the file/folder name
    const name = draggedPath.substring(draggedPath.lastIndexOf('/') + 1)
    const newPath = `${projectPath}/${name}`

    try {
      const result = await window.api.fs.rename(draggedPath, newPath)
      if (result.success) {
        loadDirectory(projectPath)
      } else {
        console.error('Failed to move file:', result.error)
      }
    } catch (err) {
      console.error('Error moving file:', err)
    }

    setFileDragState({ draggedPath: null, dropTargetPath: null })
  }, [projectPath])

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

  const isRootDropTarget = fileDragState.dropTargetPath === projectPath

  return (
    <div
      className="file-tree"
      onContextMenu={(e) => handleContextMenu(e, null, true)}
    >
      <div
        className={`file-tree-content ${isRootDropTarget ? 'root-drop-target' : ''}`}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
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
            onDragStart={handleFileDragStart}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
            onDragEnd={handleFileDragEnd}
            draggedPath={fileDragState.draggedPath}
            dropTargetPath={fileDragState.dropTargetPath}
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
