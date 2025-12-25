import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { VscNewFile, VscNewFolder, VscEdit, VscTrash, VscCloudUpload, VscCopy } from 'react-icons/vsc'
import './FileContextMenu.css'

export interface ContextMenuAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  dividerAfter?: boolean
  disabled?: boolean
}

interface FileContextMenuProps {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  actions,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current
      const rect = menu.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10
      }

      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10
      }

      menu.style.left = `${adjustedX}px`
      menu.style.top = `${adjustedY}px`
    }
  }, [x, y])

  return createPortal(
    <div
      ref={menuRef}
      className="file-context-menu"
      style={{ left: x, top: y }}
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          <button
            className={`context-menu-item ${action.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (!action.disabled) {
                action.onClick()
                onClose()
              }
            }}
            disabled={action.disabled}
          >
            <span className="context-menu-icon">{action.icon}</span>
            <span className="context-menu-label">{action.label}</span>
          </button>
          {action.dividerAfter && <div className="context-menu-divider" />}
        </React.Fragment>
      ))}
    </div>,
    document.body
  )
}

// Helper to get context menu actions for a file/folder
export function getFileContextMenuActions(
  isDirectory: boolean,
  isProjectRoot: boolean,
  callbacks: {
    onNewFile: () => void
    onNewFolder: () => void
    onRename: () => void
    onDelete: () => void
    onUploadFiles: () => void
    onCopyPath: () => void
  }
): ContextMenuAction[] {
  const actions: ContextMenuAction[] = []

  if (isDirectory) {
    actions.push({
      id: 'new-file',
      label: 'New File',
      icon: <VscNewFile />,
      onClick: callbacks.onNewFile
    })

    actions.push({
      id: 'new-folder',
      label: 'New Folder',
      icon: <VscNewFolder />,
      onClick: callbacks.onNewFolder
    })

    actions.push({
      id: 'upload-files',
      label: 'Upload Files...',
      icon: <VscCloudUpload />,
      onClick: callbacks.onUploadFiles,
      dividerAfter: true
    })
  }

  actions.push({
    id: 'copy-path',
    label: 'Copy Path',
    icon: <VscCopy />,
    onClick: callbacks.onCopyPath,
    dividerAfter: !isProjectRoot
  })

  if (!isProjectRoot) {
    actions.push({
      id: 'rename',
      label: 'Rename',
      icon: <VscEdit />,
      onClick: callbacks.onRename
    })

    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: <VscTrash />,
      onClick: callbacks.onDelete
    })
  }

  return actions
}
