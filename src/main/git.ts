import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

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

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  timestamp: number
}

export class GitManager {
  /**
   * Check if a directory is a Git repository
   */
  async isGitRepo(projectPath: string): Promise<boolean> {
    try {
      const gitPath = path.join(projectPath, '.git')
      return fs.existsSync(gitPath)
    } catch {
      return false
    }
  }

  /**
   * Initialize a Git repository in the given directory
   */
  async initRepo(projectPath: string): Promise<boolean> {
    try {
      await execAsync('git init', { cwd: projectPath })

      // Create initial .gitignore if it doesn't exist
      const gitignorePath = path.join(projectPath, '.gitignore')
      if (!fs.existsSync(gitignorePath)) {
        const defaultGitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/
*.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`
        fs.writeFileSync(gitignorePath, defaultGitignore, 'utf-8')
      }

      // Create initial commit
      try {
        await execAsync('git add .gitignore', { cwd: projectPath })
        await execAsync('git commit -m "Initial commit"', { cwd: projectPath })
      } catch {
        // If commit fails (no git user configured), that's okay
        // The repo is still initialized
      }

      return true
    } catch (error) {
      console.error('Failed to initialize Git repo:', error)
      return false
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(projectPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: projectPath
      })
      return stdout.trim() || 'main'
    } catch (error) {
      console.error('Failed to get current branch:', error)
      return null
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(projectPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: projectPath
      })
      return stdout.trim().length > 0
    } catch (error) {
      console.error('Failed to check git status:', error)
      return false
    }
  }

  /**
   * Get ahead/behind commit counts relative to remote
   */
  async getAheadBehind(
    projectPath: string
  ): Promise<{ ahead: number; behind: number } | null> {
    try {
      // First, try to get the upstream branch
      const { stdout: upstreamOutput } = await execAsync(
        'git rev-parse --abbrev-ref @{upstream}',
        { cwd: projectPath }
      )

      if (!upstreamOutput.trim()) {
        return null // No upstream configured
      }

      const { stdout } = await execAsync(
        'git rev-list --left-right --count HEAD...@{upstream}',
        { cwd: projectPath }
      )

      const [ahead, behind] = stdout.trim().split('\t').map(Number)
      return { ahead, behind }
    } catch {
      // No upstream or error - return null
      return null
    }
  }

  /**
   * Get the last commit information
   */
  async getLastCommit(projectPath: string): Promise<GitCommit | null> {
    try {
      const { stdout } = await execAsync(
        'git log -1 --pretty=format:"%H|%h|%s|%an|%ai"',
        { cwd: projectPath }
      )

      if (!stdout.trim()) {
        return null
      }

      const [hash, shortHash, message, author, date] = stdout.split('|')

      return {
        hash,
        shortHash,
        message,
        author,
        date,
        timestamp: new Date(date).getTime()
      }
    } catch (error) {
      console.error('Failed to get last commit:', error)
      return null
    }
  }

  /**
   * Get recent commits (limited to count)
   */
  async getRecentCommits(
    projectPath: string,
    count: number = 10
  ): Promise<GitCommit[]> {
    try {
      const { stdout } = await execAsync(
        `git log -${count} --pretty=format:"%H|%h|%s|%an|%ai"`,
        { cwd: projectPath }
      )

      if (!stdout.trim()) {
        return []
      }

      return stdout
        .trim()
        .split('\n')
        .map(line => {
          const [hash, shortHash, message, author, date] = line.split('|')
          return {
            hash,
            shortHash,
            message,
            author,
            date,
            timestamp: new Date(date).getTime()
          }
        })
    } catch (error) {
      console.error('Failed to get recent commits:', error)
      return []
    }
  }

  /**
   * Get comprehensive Git status for a project
   */
  async getStatus(projectPath: string): Promise<GitStatus> {
    const isRepo = await this.isGitRepo(projectPath)

    if (!isRepo) {
      return { isRepo: false }
    }

    try {
      const [currentBranch, hasChanges, aheadBehind, lastCommit] = await Promise.all([
        this.getCurrentBranch(projectPath),
        this.hasUncommittedChanges(projectPath),
        this.getAheadBehind(projectPath),
        this.getLastCommit(projectPath)
      ])

      return {
        isRepo: true,
        currentBranch: currentBranch || undefined,
        hasChanges,
        ahead: aheadBehind?.ahead,
        behind: aheadBehind?.behind,
        lastCommit: lastCommit || undefined
      }
    } catch (error) {
      console.error('Failed to get git status:', error)
      return { isRepo: true }
    }
  }
}

// Singleton instance
export const gitManager = new GitManager()
