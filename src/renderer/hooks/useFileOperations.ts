import { useState, useCallback } from 'react'

export interface FileDialogState {
  type: 'new-file' | 'new-folder' | 'rename' | 'delete' | null
  targetPath: string
  targetName?: string
}

interface UseFileOperationsOptions {
  projectPath: string
  onOperationComplete: () => void
}

interface UseFileOperationsReturn {
  dialog: FileDialogState
  setDialog: React.Dispatch<React.SetStateAction<FileDialogState>>
  handleCreateFile: (name: string) => Promise<void>
  handleCreateFolder: (name: string) => Promise<void>
  handleRename: (newName: string) => Promise<void>
  handleDelete: () => Promise<void>
  handleUploadFiles: (targetDir: string) => Promise<void>
  handleCopyPath: (path: string) => void
  validateName: (name: string) => string | null
  closeDialog: () => void
  openNewFileDialog: (targetPath: string) => void
  openNewFolderDialog: (targetPath: string) => void
  openRenameDialog: (targetPath: string, targetName: string) => void
  openDeleteDialog: (targetPath: string, targetName: string) => void
}

/**
 * Hook for managing file operations (create, rename, delete, upload).
 *
 * Provides:
 * - Dialog state management for file operations
 * - File/folder creation
 * - Rename and delete operations
 * - File upload handling
 * - Path copy to clipboard
 * - Name validation
 */
export function useFileOperations({
  projectPath,
  onOperationComplete
}: UseFileOperationsOptions): UseFileOperationsReturn {
  const [dialog, setDialog] = useState<FileDialogState>({ type: null, targetPath: '' })

  const closeDialog = useCallback(() => {
    setDialog({ type: null, targetPath: '' })
  }, [])

  const openNewFileDialog = useCallback((targetPath: string) => {
    setDialog({ type: 'new-file', targetPath })
  }, [])

  const openNewFolderDialog = useCallback((targetPath: string) => {
    setDialog({ type: 'new-folder', targetPath })
  }, [])

  const openRenameDialog = useCallback((targetPath: string, targetName: string) => {
    setDialog({ type: 'rename', targetPath, targetName })
  }, [])

  const openDeleteDialog = useCallback((targetPath: string, targetName: string) => {
    setDialog({ type: 'delete', targetPath, targetName })
  }, [])

  const handleCreateFile = useCallback(async (name: string) => {
    const targetDir = dialog.targetPath
    const filePath = `${targetDir}/${name}`

    try {
      const result = await window.api.fs.createFile(filePath)
      if (result.success) {
        onOperationComplete()
      } else {
        console.error('Failed to create file:', result.error)
      }
    } catch (err) {
      console.error('Error creating file:', err)
    }

    closeDialog()
  }, [dialog.targetPath, onOperationComplete, closeDialog])

  const handleCreateFolder = useCallback(async (name: string) => {
    const targetDir = dialog.targetPath
    const folderPath = `${targetDir}/${name}`

    try {
      const result = await window.api.fs.createDirectory(folderPath)
      if (result.success) {
        onOperationComplete()
      } else {
        console.error('Failed to create folder:', result.error)
      }
    } catch (err) {
      console.error('Error creating folder:', err)
    }

    closeDialog()
  }, [dialog.targetPath, onOperationComplete, closeDialog])

  const handleRename = useCallback(async (newName: string) => {
    const oldPath = dialog.targetPath
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = `${parentDir}/${newName}`

    try {
      const result = await window.api.fs.rename(oldPath, newPath)
      if (result.success) {
        onOperationComplete()
      } else {
        console.error('Failed to rename:', result.error)
      }
    } catch (err) {
      console.error('Error renaming:', err)
    }

    closeDialog()
  }, [dialog.targetPath, onOperationComplete, closeDialog])

  const handleDelete = useCallback(async () => {
    const targetPath = dialog.targetPath

    try {
      const result = await window.api.fs.delete(targetPath)
      if (result.success) {
        onOperationComplete()
      } else {
        console.error('Failed to delete:', result.error)
      }
    } catch (err) {
      console.error('Error deleting:', err)
    }

    closeDialog()
  }, [dialog.targetPath, onOperationComplete, closeDialog])

  const handleUploadFiles = useCallback(async (targetDir: string) => {
    try {
      const result = await window.api.dialog.openFiles()
      if (result.success && result.data?.paths) {
        const copyResult = await window.api.fs.copyFiles(result.data.paths, targetDir)
        if (copyResult.success) {
          onOperationComplete()
        } else {
          console.error('Failed to copy files:', copyResult.error)
        }
      }
    } catch (err) {
      console.error('Error uploading files:', err)
    }
  }, [onOperationComplete])

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path)
  }, [])

  const validateName = useCallback((name: string): string | null => {
    if (name.includes('/') || name.includes('\\')) {
      return 'Name cannot contain / or \\'
    }
    if (name.startsWith('.') && name.length === 1) {
      return 'Invalid name'
    }
    return null
  }, [])

  return {
    dialog,
    setDialog,
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
  }
}
