import React, { useState, useCallback } from 'react'
import { FileNode } from '../../../types'
import { FileTreeNode } from './FileTreeNode'
import { FileContextMenu, getFileContextMenuActions, ContextMenuAction } from './FileContextMenu'
import { InputDialog } from './InputDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { useFileTreeData } from '../../hooks/useFileTreeData'
import { useGitStatusPolling, ExtendedGitStatus } from '../../hooks/useGitStatusPolling'
import { useFileDragDrop } from '../../hooks/useFileDragDrop'
import { useFileOperations } from '../../hooks/useFileOperations'
import './FileTree.css'

// Re-export for backward compatibility
export type { ExtendedGitStatus }

interface FileTreeProps {
  projectId: string
  projectPath: string
  projectName: string
  onFileClick: (file: FileNode) => void
  onFileDoubleClick?: (file: FileNode) => void
  activeFilePath?: string
}

interface ContextMenuState {
  x: number
  y: number
  node: FileNode | null
  isProjectRoot: boolean
}

export const FileTree: React.FC<FileTreeProps> = ({
  projectPath,
  onFileClick,
  onFileDoubleClick,
  activeFilePath
}) => {
  // File tree data management
  const {
    nodes,
    loading,
    error,
    nodesRef,
    loadDirectory,
    handleToggle,
    refreshTree
  } = useFileTreeData({ projectPath })

  // Git status polling
  const { gitChanges } = useGitStatusPolling({
    projectPath,
    nodesRef,
    onRefresh: () => loadDirectory(projectPath)
  })

  // File drag and drop
  const {
    draggedPath,
    dropTargetPath,
    handleFileDragStart,
    handleFileDragOver,
    handleFileDragLeave,
    handleFileDrop,
    handleFileDragEnd,
    handleRootDragOver,
    handleRootDragLeave,
    handleRootDrop
  } = useFileDragDrop({
    projectPath,
    onMoveComplete: () => loadDirectory(projectPath)
  })

  // File operations (create, rename, delete)
  const {
    dialog,
    handleCreateFile,
    handleCreateFolder,
    handleRename,
    handleDelete,
    handleUploadFiles,
    handleCopyPath,
    validateName,
    closeDialog,
    openNewFileDialog,
    openNewFolderDialog,
    openRenameDialog,
    openDeleteDialog
  } = useFileOperations({
    projectPath,
    onOperationComplete: () => loadDirectory(projectPath)
  })

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Load initial directory
  React.useEffect(() => {
    loadDirectory(projectPath)
  }, [projectPath, loadDirectory])

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

  // Get context menu actions
  const getContextMenuActionsForNode = useCallback((): ContextMenuAction[] => {
    if (!contextMenu) return []

    const node = contextMenu.node
    const isDirectory = node ? node.type === 'directory' : true
    const isProjectRoot = contextMenu.isProjectRoot
    const targetPath = node?.path || projectPath

    return getFileContextMenuActions(isDirectory, isProjectRoot, {
      onNewFile: () => {
        openNewFileDialog(isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/')))
      },
      onNewFolder: () => {
        openNewFolderDialog(isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/')))
      },
      onRename: () => {
        if (node) {
          openRenameDialog(targetPath, node.name)
        }
      },
      onDelete: () => {
        if (node) {
          openDeleteDialog(targetPath, node.name)
        }
      },
      onUploadFiles: () => {
        handleUploadFiles(isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/')))
      },
      onCopyPath: () => {
        handleCopyPath(targetPath)
      }
    })
  }, [contextMenu, projectPath, openNewFileDialog, openNewFolderDialog, openRenameDialog, openDeleteDialog, handleUploadFiles, handleCopyPath])

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

  const isRootDropTarget = dropTargetPath === projectPath

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
            onDoubleClick={onFileDoubleClick}
            onContextMenu={handleContextMenu}
            activeFilePath={activeFilePath}
            gitChanges={gitChanges}
            onDragStart={handleFileDragStart}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
            onDragEnd={handleFileDragEnd}
            draggedPath={draggedPath}
            dropTargetPath={dropTargetPath}
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
          onCancel={closeDialog}
          validator={validateName}
        />
      )}

      {dialog.type === 'new-folder' && (
        <InputDialog
          title="New Folder"
          placeholder="Enter folder name"
          confirmLabel="Create"
          onConfirm={handleCreateFolder}
          onCancel={closeDialog}
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
          onCancel={closeDialog}
          validator={validateName}
        />
      )}

      {/* Confirm Dialog */}
      {dialog.type === 'delete' && (
        <ConfirmDialog
          title="Move to Trash"
          message={`Are you sure you want to move "${dialog.targetName}" to the trash?`}
          confirmLabel="Move to Trash"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}
