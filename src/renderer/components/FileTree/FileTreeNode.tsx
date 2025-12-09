import React from 'react'
import { FileNode } from '../../../types'

interface FileTreeNodeProps {
  node: FileNode
  level: number
  onToggle: (node: FileNode) => void
  onClick: (node: FileNode) => void
  activeFilePath?: string
}

const getFileIcon = (node: FileNode): string => {
  if (node.type === 'directory') {
    return node.isExpanded ? '📂' : '📁'
  }

  const fileName = node.name.toLowerCase()
  const ext = fileName.substring(fileName.lastIndexOf('.'))

  const iconMap: Record<string, string> = {
    '.js': '📄',
    '.jsx': '⚛️',
    '.ts': '📘',
    '.tsx': '⚛️',
    '.html': '🌐',
    '.htm': '🌐',
    '.css': '🎨',
    '.scss': '🎨',
    '.sass': '🎨',
    '.less': '🎨',
    '.json': '📋',
    '.md': '📝',
    '.markdown': '📝',
    '.txt': '📄',
    '.xml': '📄',
    '.yaml': '📄',
    '.yml': '📄',
    '.log': '📄',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.gif': '🖼️',
    '.svg': '🖼️',
    '.webp': '🖼️',
    '.pdf': '📕',
    '.zip': '📦',
    '.tar': '📦',
    '.gz': '📦',
  }

  return iconMap[ext] || '📄'
}

const getGitStatusIcon = (status?: FileNode['gitStatus']): string | null => {
  if (!status || status === 'clean') return null

  const statusMap: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    untracked: '?',
  }

  return statusMap[status] || null
}

const getGitStatusClass = (status?: FileNode['gitStatus']): string => {
  if (!status || status === 'clean') return ''
  return `git-status-${status}`
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  level,
  onToggle,
  onClick,
  activeFilePath
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'directory') {
      onToggle(node)
    } else {
      onClick(node)
    }
  }

  const icon = getFileIcon(node)
  const gitStatus = getGitStatusIcon(node.gitStatus)
  const gitStatusClass = getGitStatusClass(node.gitStatus)
  const isActive = node.type === 'file' && activeFilePath === node.path

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${gitStatusClass} ${isActive ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="expand-icon">
            {node.isExpanded ? '▼' : '▶'}
          </span>
        )}
        <span className="file-icon">{icon}</span>
        <span className="file-name">{node.name}</span>
        {gitStatus && <span className="git-status">{gitStatus}</span>}
      </div>

      {node.type === 'directory' && node.isExpanded && node.children && (
        <div className="file-tree-children">
          {node.children.map(child => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onClick={onClick}
              activeFilePath={activeFilePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}
