import React from 'react'
import { FileNode } from '../../../types'
import { ExtendedGitStatus } from './FileTree'

interface FileTreeNodeProps {
  node: FileNode
  level: number
  onToggle: (node: FileNode) => void
  onClick: (node: FileNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode, isProjectRoot?: boolean) => void
  activeFilePath?: string
  gitChanges?: Map<string, ExtendedGitStatus>
}

const getFileIcon = (node: FileNode): string => {
  if (node.type === 'directory') {
    return node.isExpanded ? '📂' : '📁'
  }

  const fileName = node.name.toLowerCase()
  const ext = fileName.substring(fileName.lastIndexOf('.'))

  const iconMap: Record<string, string> = {
    // JavaScript/TypeScript
    '.js': '📄',
    '.jsx': '⚛️',
    '.mjs': '📄',
    '.cjs': '📄',
    '.ts': '📘',
    '.tsx': '⚛️',
    '.mts': '📘',
    '.cts': '📘',
    // Web
    '.html': '🌐',
    '.htm': '🌐',
    '.css': '🎨',
    '.scss': '🎨',
    '.sass': '🎨',
    '.less': '🎨',
    // Data formats
    '.json': '📋',
    '.jsonc': '📋',
    '.json5': '📋',
    // Markdown
    '.md': '📝',
    '.markdown': '📝',
    '.mdx': '📝',
    // Python
    '.py': '🐍',
    '.pyw': '🐍',
    '.pyi': '🐍',
    '.pyx': '🐍',
    // Java
    '.java': '☕',
    '.jar': '☕',
    '.class': '☕',
    // C/C++
    '.c': '🔧',
    '.h': '🔧',
    '.cpp': '⚙️',
    '.cxx': '⚙️',
    '.cc': '⚙️',
    '.hpp': '⚙️',
    '.hxx': '⚙️',
    '.hh': '⚙️',
    // Go
    '.go': '🔵',
    // Rust
    '.rs': '🦀',
    // Ruby
    '.rb': '💎',
    '.erb': '💎',
    '.rake': '💎',
    '.gemspec': '💎',
    // PHP
    '.php': '🐘',
    '.phtml': '🐘',
    // Shell
    '.sh': '🖥️',
    '.bash': '🖥️',
    '.zsh': '🖥️',
    '.fish': '🖥️',
    '.ps1': '🖥️',
    '.bat': '🖥️',
    '.cmd': '🖥️',
    // SQL
    '.sql': '🗃️',
    '.mysql': '🗃️',
    '.pgsql': '🗃️',
    // YAML/Config
    '.yaml': '⚙️',
    '.yml': '⚙️',
    '.toml': '⚙️',
    '.ini': '⚙️',
    '.env': '🔐',
    // XML
    '.xml': '📄',
    '.xsd': '📄',
    '.xsl': '📄',
    '.plist': '📄',
    // Docker
    '.dockerfile': '🐳',
    // Text/Log
    '.txt': '📄',
    '.log': '📄',
    '.gitignore': '📄',
    '.gitattributes': '📄',
    '.editorconfig': '📄',
    // Images
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.gif': '🖼️',
    '.svg': '🖼️',
    '.webp': '🖼️',
    '.bmp': '🖼️',
    '.ico': '🖼️',
    '.tiff': '🖼️',
    '.tif': '🖼️',
    // Documents
    '.pdf': '📕',
    '.doc': '📘',
    '.docx': '📘',
    '.xls': '📗',
    '.xlsx': '📗',
    '.ppt': '📙',
    '.pptx': '📙',
    // Archives
    '.zip': '📦',
    '.tar': '📦',
    '.gz': '📦',
    '.rar': '📦',
    '.7z': '📦',
  }

  return iconMap[ext] || '📄'
}

const getGitStatusIcon = (status?: ExtendedGitStatus | FileNode['gitStatus']): string | null => {
  if (!status || status === 'clean') return null

  const statusMap: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    untracked: 'U',
    'recent-commit': 'C',
  }

  return statusMap[status] || null
}

const getGitStatusClass = (status?: ExtendedGitStatus | FileNode['gitStatus']): string => {
  if (!status || status === 'clean') return ''
  return `git-status-${status}`
}

// Get the most important git status for a directory based on its children
const getDirectoryGitStatus = (
  dirPath: string,
  gitChanges?: Map<string, ExtendedGitStatus>
): ExtendedGitStatus | null => {
  if (!gitChanges || gitChanges.size === 0) return null

  // Priority: modified > added > deleted > untracked > recent-commit
  const priorityOrder: ExtendedGitStatus[] = ['modified', 'added', 'deleted', 'untracked', 'recent-commit']
  let highestPriority: ExtendedGitStatus | null = null
  let highestPriorityIndex = Infinity

  for (const [filePath, status] of gitChanges.entries()) {
    // Check if this file is under the directory
    if (filePath.startsWith(dirPath + '/')) {
      const index = priorityOrder.indexOf(status)
      if (index !== -1 && index < highestPriorityIndex) {
        highestPriorityIndex = index
        highestPriority = status
      }
    }
  }

  return highestPriority
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  level,
  onToggle,
  onClick,
  onContextMenu,
  activeFilePath,
  gitChanges
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'directory') {
      onToggle(node)
    } else {
      onClick(node)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    onContextMenu(e, node, false)
  }

  // Get git status: for files from map, for directories check children
  let effectiveGitStatus: ExtendedGitStatus | FileNode['gitStatus'] | undefined
  if (node.type === 'directory') {
    effectiveGitStatus = getDirectoryGitStatus(node.path, gitChanges)
  } else {
    effectiveGitStatus = gitChanges?.get(node.path) || node.gitStatus
  }

  const icon = getFileIcon(node)
  const gitStatus = getGitStatusIcon(effectiveGitStatus)
  const gitStatusClass = getGitStatusClass(effectiveGitStatus)
  const isActive = node.type === 'file' && activeFilePath === node.path
  const isIgnored = node.isGitIgnored

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${gitStatusClass} ${isActive ? 'selected' : ''} ${isIgnored ? 'gitignored' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
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
              onContextMenu={onContextMenu}
              activeFilePath={activeFilePath}
              gitChanges={gitChanges}
            />
          ))}
        </div>
      )}
    </div>
  )
}
