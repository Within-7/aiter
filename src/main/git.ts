import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsyncRaw = promisify(exec)

/**
 * Execute git command with proper UTF-8/encoding support
 * Sets core.quotepath=false to display non-ASCII characters correctly
 * Also sets proper encoding environment variables
 */
async function execAsync(command: string, options: { cwd: string }) {
  // Add git config to disable quotepath for non-ASCII filenames
  const gitCommand = command.startsWith('git ')
    ? `git -c core.quotepath=false ${command.slice(4)}`
    : command

  return execAsyncRaw(gitCommand, {
    ...options,
    env: {
      ...process.env,
      // Ensure UTF-8 encoding for git output
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      GIT_TERMINAL_PROMPT: '0'
    }
  })
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
   * Get files changed in a specific commit
   */
  async getCommitFiles(
    projectPath: string,
    commitHash: string
  ): Promise<Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }>> {
    try {
      const { stdout } = await execAsync(
        `git diff-tree --no-commit-id --name-status -r ${commitHash}`,
        { cwd: projectPath }
      )

      if (!stdout.trim()) {
        return []
      }

      return stdout
        .trim()
        .split('\n')
        .map(line => {
          const [statusCode, ...pathParts] = line.split('\t')
          const filePath = pathParts.join('\t') // Handle paths with tabs (rare but possible)

          let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
          switch (statusCode.charAt(0)) {
            case 'A':
              status = 'added'
              break
            case 'D':
              status = 'deleted'
              break
            case 'M':
              status = 'modified'
              break
            case 'R':
              status = 'renamed'
              break
          }

          return { path: filePath, status }
        })
        .filter(item => item.path) // Filter out empty entries
    } catch (error) {
      console.error('Failed to get commit files:', error)
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

  /**
   * Get file changes (modified, added, deleted, untracked)
   */
  async getFileChanges(projectPath: string): Promise<FileChange[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: projectPath
      })

      if (!stdout.trim()) {
        return []
      }

      const changes: FileChange[] = []
      const lines = stdout.trim().split('\n')

      for (const line of lines) {
        if (!line) continue

        const statusCode = line.substring(0, 2)
        const filePath = line.substring(3).trim()

        let status: FileChange['status'] = 'modified'

        // Parse git status codes
        if (statusCode.includes('??')) {
          status = 'untracked'
        } else if (statusCode.includes('A')) {
          status = 'added'
        } else if (statusCode.includes('D')) {
          status = 'deleted'
        } else if (statusCode.includes('M')) {
          status = 'modified'
        }

        changes.push({ path: filePath, status })
      }

      return changes
    } catch (error) {
      console.error('Failed to get file changes:', error)
      return []
    }
  }

  /**
   * Stage all changes and commit
   */
  async commitAll(projectPath: string, message: string): Promise<boolean> {
    try {
      // Stage all changes
      await execAsync('git add -A', { cwd: projectPath })

      // Commit with message
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: projectPath
      })

      return true
    } catch (error) {
      console.error('Failed to commit:', error)
      return false
    }
  }

  /**
   * Get all branches
   */
  async getBranches(projectPath: string): Promise<{ name: string; current: boolean }[]> {
    try {
      const { stdout } = await execAsync('git branch', { cwd: projectPath })

      return stdout
        .trim()
        .split('\n')
        .map(line => {
          const current = line.startsWith('*')
          const name = line.replace('*', '').trim()
          return { name, current }
        })
        .filter(b => b.name)
    } catch (error) {
      console.error('Failed to get branches:', error)
      return []
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(projectPath: string, branchName: string): Promise<boolean> {
    try {
      await execAsync(`git branch "${branchName}"`, { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to create branch:', error)
      return false
    }
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(projectPath: string, branchName: string): Promise<boolean> {
    try {
      await execAsync(`git checkout "${branchName}"`, { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to switch branch:', error)
      return false
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(projectPath: string, branchName: string, force: boolean = false): Promise<boolean> {
    try {
      const flag = force ? '-D' : '-d'
      await execAsync(`git branch ${flag} "${branchName}"`, { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to delete branch:', error)
      return false
    }
  }

  /**
   * Pull from remote
   */
  async pull(projectPath: string): Promise<boolean> {
    try {
      await execAsync('git pull', { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to pull:', error)
      return false
    }
  }

  /**
   * Push to remote
   */
  async push(projectPath: string): Promise<boolean> {
    try {
      await execAsync('git push', { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to push:', error)
      return false
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(projectPath: string): Promise<boolean> {
    try {
      await execAsync('git fetch', { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to fetch:', error)
      return false
    }
  }

  /**
   * Stage a specific file
   */
  async stageFile(projectPath: string, filePath: string): Promise<boolean> {
    try {
      await execAsync(`git add "${filePath}"`, { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to stage file:', error)
      return false
    }
  }

  /**
   * Unstage a specific file
   */
  async unstageFile(projectPath: string, filePath: string): Promise<boolean> {
    try {
      await execAsync(`git reset HEAD "${filePath}"`, { cwd: projectPath })
      return true
    } catch (error) {
      console.error('Failed to unstage file:', error)
      return false
    }
  }

  /**
   * Get diff for a file (uncommitted changes)
   * Uses git diff HEAD to show both staged and unstaged changes
   */
  async getFileDiff(projectPath: string, filePath: string): Promise<string> {
    try {
      // Use HEAD to show all uncommitted changes (both staged and unstaged)
      const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, { cwd: projectPath })
      return stdout
    } catch (error) {
      console.error('Failed to get file diff:', error)
      return ''
    }
  }

  /**
   * Get diff for a specific file in a specific commit
   */
  async getCommitFileDiff(projectPath: string, commitHash: string, filePath: string): Promise<string> {
    try {
      // Show diff of this commit compared to its parent
      const { stdout } = await execAsync(
        `git show ${commitHash} -- "${filePath}"`,
        { cwd: projectPath }
      )
      return stdout
    } catch (error) {
      console.error('Failed to get commit file diff:', error)
      return ''
    }
  }
}

// Singleton instance
export const gitManager = new GitManager()
