/**
 * Project and file system type definitions.
 */

/**
 * Project representing a workspace folder
 */
export interface Project {
  id: string
  name: string
  path: string
  addedAt: number
  lastAccessed?: number
  isExpanded?: boolean
  isGitRepo?: boolean
  color?: string
}

/**
 * File tree node representing a file or directory
 */
export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'clean'
  isGitIgnored?: boolean  // Whether the file/directory is in .gitignore
  size?: number
  modifiedTime?: number
}
