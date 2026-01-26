/**
 * Git-related type definitions.
 */

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  timestamp: number
}

export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'untracked'
}

export interface GitStatus {
  isRepo: boolean
  currentBranch?: string
  hasChanges?: boolean
  ahead?: number
  behind?: number
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: string
  }
}

export interface GitRepository {
  projectId: string
  path: string
  currentBranch: string
  isRepo: boolean
  hasChanges: boolean
}
