import * as chokidar from 'chokidar'
import * as path from 'path'
import { BrowserWindow } from 'electron'

export interface FileChangeEvent {
  type: 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change'
  path: string
  projectPath: string
}

/**
 * FileWatcher Manager
 * Manages file system watchers for project directories
 * Notifies renderer when files are added, removed, or changed
 */
export class FileWatcherManager {
  private watchers: Map<string, chokidar.FSWatcher> = new Map()
  private mainWindow: BrowserWindow | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private pendingChanges: Map<string, Set<string>> = new Map()

  // Debounce delay in milliseconds - reduced for faster response
  private readonly DEBOUNCE_DELAY = 150

  // Directories to ignore
  private readonly IGNORED_PATTERNS = [
    /(^|[/\\])\../, // Hidden files/directories (except we'll add exceptions)
    /node_modules/,
    /\.git/,
    /\.DS_Store/,
    /dist/,
    /build/,
    /coverage/,
    /__pycache__/,
    /\.pyc$/,
    /\.pyo$/,
  ]

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * Start watching a project directory
   */
  watch(projectPath: string): boolean {
    // Already watching this project
    if (this.watchers.has(projectPath)) {
      console.log(`[FileWatcher] Already watching: ${projectPath}`)
      return true
    }

    try {
      const watcher = chokidar.watch(projectPath, {
        ignored: this.IGNORED_PATTERNS,
        persistent: true,
        ignoreInitial: true,
        depth: 10, // Limit depth to prevent performance issues
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      })

      // Handle file/directory events
      watcher
        .on('add', (filePath) => this.handleChange('add', filePath, projectPath))
        .on('addDir', (filePath) => this.handleChange('addDir', filePath, projectPath))
        .on('unlink', (filePath) => this.handleChange('unlink', filePath, projectPath))
        .on('unlinkDir', (filePath) => this.handleChange('unlinkDir', filePath, projectPath))
        .on('change', (filePath) => this.handleChange('change', filePath, projectPath))
        .on('error', (error) => {
          console.error(`[FileWatcher] Error watching ${projectPath}:`, error)
        })

      this.watchers.set(projectPath, watcher)
      console.log(`[FileWatcher] Started watching: ${projectPath}`)
      return true
    } catch (error) {
      console.error(`[FileWatcher] Failed to start watching ${projectPath}:`, error)
      return false
    }
  }

  /**
   * Stop watching a project directory
   */
  async unwatch(projectPath: string): Promise<boolean> {
    const watcher = this.watchers.get(projectPath)
    if (!watcher) {
      return true
    }

    try {
      await watcher.close()
      this.watchers.delete(projectPath)

      // Clear any pending debounce timers
      const timer = this.debounceTimers.get(projectPath)
      if (timer) {
        clearTimeout(timer)
        this.debounceTimers.delete(projectPath)
      }
      this.pendingChanges.delete(projectPath)

      console.log(`[FileWatcher] Stopped watching: ${projectPath}`)
      return true
    } catch (error) {
      console.error(`[FileWatcher] Failed to stop watching ${projectPath}:`, error)
      return false
    }
  }

  /**
   * Stop all watchers
   */
  async unwatchAll(): Promise<void> {
    const closePromises = Array.from(this.watchers.keys()).map(projectPath =>
      this.unwatch(projectPath)
    )
    await Promise.all(closePromises)
  }

  /**
   * Check if a project is being watched
   */
  isWatching(projectPath: string): boolean {
    return this.watchers.has(projectPath)
  }

  /**
   * Handle file change events with debouncing
   * Multiple rapid changes are batched together
   */
  private handleChange(type: FileChangeEvent['type'], filePath: string, projectPath: string) {
    // Skip certain file types
    const basename = path.basename(filePath)
    if (basename.endsWith('.swp') || basename.endsWith('.tmp') || basename.startsWith('~')) {
      return
    }

    // Get or create pending changes set for this project
    let changes = this.pendingChanges.get(projectPath)
    if (!changes) {
      changes = new Set()
      this.pendingChanges.set(projectPath, changes)
    }

    // Add this change (we use a simplified key that just tracks that something changed)
    changes.add(`${type}:${filePath}`)

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(projectPath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.flushChanges(projectPath)
    }, this.DEBOUNCE_DELAY)

    this.debounceTimers.set(projectPath, timer)
  }

  /**
   * Flush pending changes and notify renderer
   */
  private flushChanges(projectPath: string) {
    const changes = this.pendingChanges.get(projectPath)
    if (!changes || changes.size === 0) {
      return
    }

    // Clear pending changes
    this.pendingChanges.delete(projectPath)
    this.debounceTimers.delete(projectPath)

    // Notify renderer to refresh
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      console.log(`[FileWatcher] Sending refresh for ${projectPath}, ${changes.size} changes`)
      this.mainWindow.webContents.send('fileWatcher:changed', {
        projectPath,
        changeCount: changes.size
      })
    }
  }

  /**
   * Get list of watched projects
   */
  getWatchedProjects(): string[] {
    return Array.from(this.watchers.keys())
  }
}

// Singleton instance
export const fileWatcherManager = new FileWatcherManager()
