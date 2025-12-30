import { BrowserWindow, ipcMain, app, shell } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import { getAutoUpdateManager } from '../updater'
import { NodeManager } from '../nodejs/manager'
import { NodeDetector } from '../nodejs/detector'
import { NodeDownloader } from '../nodejs/downloader'
import { ShellDetector } from '../shell/ShellDetector'
import { VersionManagerDetector } from '../shell/VersionManagerDetector'
import { WorkspaceManager } from '../workspace'
import { StoreManager } from '../store'
import { fileWatcherManager } from '../fileWatcher'

export function registerAppHandlers(
  window: BrowserWindow,
  workspaceManager: WorkspaceManager,
  storeManager: StoreManager
) {
  // App operations
  ipcMain.handle('app:getPath', async (_, { name }: { name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads' }) => {
    try {
      return app.getPath(name)
    } catch (error) {
      console.error('[IPC] app:getPath error:', error)
      return ''
    }
  })

  // Shell operations
  ipcMain.handle('shell:openExternal', async (_, { url }) => {
    try {
      // SECURITY: Validate URL scheme to prevent malicious protocols
      const parsedUrl = new URL(url)
      const allowedSchemes = ['http:', 'https:', 'mailto:']

      if (!allowedSchemes.includes(parsedUrl.protocol)) {
        return {
          success: false,
          error: `URL scheme '${parsedUrl.protocol}' is not allowed. Allowed: ${allowedSchemes.join(', ')}`
        }
      }

      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('shell:openPath', async (_, { path }) => {
    try {
      const result = await shell.openPath(path)
      // openPath returns empty string on success, or error message on failure
      if (result === '') {
        return { success: true }
      } else {
        return { success: false, error: result }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Auto-update management
  // 更新策略：
  // - macOS 已签名应用：使用 electron-updater（支持差量更新）
  // - macOS 未签名应用：使用 install.sh 脚本更新
  // - Windows：使用 electron-updater

  ipcMain.handle('autoUpdate:check', async () => {
    try {
      const autoUpdateManager = getAutoUpdateManager()
      if (!autoUpdateManager) {
        return { success: false, error: 'Auto-update manager not initialized' }
      }

      const updateMode = autoUpdateManager.getUpdateMode()

      if (updateMode === 'install-script') {
        // 使用脚本模式检查更新（获取 GitHub release 信息）
        await autoUpdateManager.checkForUpdatesScript()
      } else {
        // 使用 electron-updater 检查更新（支持差量更新）
        await autoUpdateManager.checkForUpdates()
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('autoUpdate:download', async () => {
    try {
      const autoUpdateManager = getAutoUpdateManager()
      if (!autoUpdateManager) {
        return { success: false, error: 'Auto-update manager not initialized' }
      }

      const updateMode = autoUpdateManager.getUpdateMode()

      if (updateMode === 'install-script') {
        // 使用 install.sh 模式时，不需要预下载
        // 直接返回 skipDownload 标志，让前端知道可以直接安装
        return { success: true, skipDownload: true, mode: 'install-script' }
      } else {
        // 使用 electron-updater 下载更新
        await autoUpdateManager.downloadUpdate()
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('autoUpdate:install', async () => {
    try {
      const autoUpdateManager = getAutoUpdateManager()
      if (!autoUpdateManager) {
        return { success: false, error: 'Auto-update manager not initialized' }
      }

      const updateMode = autoUpdateManager.getUpdateMode()

      if (updateMode === 'install-script') {
        // macOS 未签名应用或开发模式：返回安装命令，让前端在终端中执行
        // 因为 install.sh 需要 sudo 权限，用户需要输入密码
        const installCommand = 'curl -fsSL https://raw.githubusercontent.com/Within-7/aiter/main/scripts/install.sh | bash'
        return { success: true, mode: 'install-script', command: installCommand }
      } else {
        // 已签名应用：使用 electron-updater 安装
        autoUpdateManager.quitAndInstall()
        return { success: true, mode: 'electron-updater' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('autoUpdate:getVersion', async () => {
    try {
      const autoUpdateManager = getAutoUpdateManager()
      if (!autoUpdateManager) {
        return { success: false, error: 'Auto-update manager not initialized' }
      }

      return {
        success: true,
        version: autoUpdateManager.getCurrentVersion()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Node.js management
  const nodeManager = new NodeManager()
  const nodeDetector = new NodeDetector()
  const nodeDownloader = new NodeDownloader()

  ipcMain.handle('nodejs:checkBuiltin', async () => {
    try {
      const installed = await nodeManager.isInstalled()
      const info = installed ? await nodeManager.getNodeInfo() : null
      return { success: true, installed, info }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('nodejs:checkSystem', async () => {
    try {
      const systemNode = await nodeDetector.detectSystemNode()
      return { success: true, systemNode }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('nodejs:install', async () => {
    try {
      const success = await nodeManager.installFromResources()
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('nodejs:download', async (_, { version }) => {
    try {
      const success = await nodeDownloader.download(version, (progress) => {
        window.webContents.send('nodejs:download-progress', progress)
      })
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('nodejs:getRecommendedVersion', async () => {
    try {
      const version = await nodeDetector.getRecommendedVersion()
      return { success: true, version }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('nodejs:uninstall', async () => {
    try {
      const success = await nodeManager.uninstall()
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Clean npx cache (fixes MCP and other npx-based tool issues)
  ipcMain.handle('nodejs:cleanNpxCache', async () => {
    try {
      const success = await nodeManager.cleanNpxCache()
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Clean entire npm cache
  ipcMain.handle('nodejs:cleanNpmCache', async () => {
    try {
      const success = await nodeManager.cleanNpmCache()
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Check if Node.js upgrade is available
  ipcMain.handle('nodejs:checkUpgrade', async () => {
    try {
      const result = await nodeManager.needsUpgrade()
      return { success: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Upgrade Node.js if needed
  ipcMain.handle('nodejs:upgrade', async () => {
    try {
      const result = await nodeManager.upgradeIfNeeded()
      return { success: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Proxy management
  ipcMain.handle('proxy:getStatus', async () => {
    try {
      const status = nodeManager.getProxyStatus()
      return { success: true, ...status }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Shell detection
  const shellDetector = new ShellDetector()
  const versionManagerDetector = new VersionManagerDetector()

  ipcMain.handle('shell:detectAvailable', async () => {
    try {
      const shells = await shellDetector.detectAvailableShells()
      return { success: true, shells }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('shell:getConfigFiles', async (_, { shellType }) => {
    try {
      const files = shellDetector.getConfigFiles(shellType)
      return { success: true, files }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('shell:getDefaultShell', async () => {
    try {
      const defaultShell = shellDetector.getDefaultShell()
      return { success: true, defaultShell }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Version manager detection
  ipcMain.handle('versionManager:detect', async () => {
    try {
      const managers = await versionManagerDetector.detectAll()
      return { success: true, managers }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('versionManager:getDetected', async () => {
    try {
      const managers = await versionManagerDetector.getDetected()
      return { success: true, managers }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Workspace management
  ipcMain.handle('workspace:getCurrent', async () => {
    try {
      const workspace = workspaceManager.getCurrentWorkspace()
      return { success: true, workspace }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('workspace:list', async () => {
    try {
      const workspaces = workspaceManager.getWorkspaces()
      return { success: true, workspaces }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('workspace:create', async (_, { name, projectIds }) => {
    try {
      const workspace = workspaceManager.createWorkspace(name, projectIds)
      return { success: true, workspace }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('workspace:update', async (_, { id, updates }) => {
    try {
      const workspace = workspaceManager.updateWorkspace(id, updates)
      if (!workspace) {
        return { success: false, error: 'Workspace not found or cannot be updated' }
      }
      return { success: true, workspace }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('workspace:delete', async (_, { id }) => {
    try {
      const success = workspaceManager.deleteWorkspace(id)
      if (!success) {
        return { success: false, error: 'Workspace not found or cannot be deleted' }
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('workspace:launch', async (_, { workspaceId }) => {
    try {
      // SECURITY: Validate workspaceId to prevent command injection
      // Only allow alphanumeric characters, hyphens, and underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
        return {
          success: false,
          error: 'Invalid workspace ID format. Only alphanumeric characters, hyphens, and underscores are allowed.'
        }
      }

      // Launch new instance with specified workspace
      if (app.isPackaged) {
        // Production mode: use the app executable
        const appPath = app.getPath('exe')
        spawn(appPath, [`--workspace=${workspaceId}`], {
          detached: true,
          stdio: 'ignore'
        }).unref()
      } else {
        // Development mode: use electron with the app path
        const isWindows = process.platform === 'win32'
        const electronBin = isWindows ? 'electron.cmd' : 'electron'
        const electronPath = path.join(app.getAppPath(), 'node_modules', '.bin', electronBin)
        const appRoot = app.getAppPath()

        // Set environment variable for workspace (command line args may be filtered by electron)
        const env = { ...process.env, AITER_WORKSPACE: workspaceId }

        spawn(electronPath, [appRoot, `--workspace=${workspaceId}`], {
          detached: true,
          stdio: 'ignore',
          env,
          shell: isWindows // Use shell on Windows to properly execute .cmd files
        }).unref()
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('workspace:setProjectVisibility', async (_, { projectId, visible }) => {
    try {
      const workspaceId = workspaceManager.getCurrentWorkspaceId()
      if (workspaceId === 'default') {
        return { success: false, error: 'Cannot modify visibility in default workspace' }
      }

      if (visible) {
        workspaceManager.addProjectToWorkspace(workspaceId, projectId)
      } else {
        workspaceManager.removeProjectFromWorkspace(workspaceId, projectId)
      }

      // Refresh projects list
      const visibleIds = workspaceManager.getVisibleProjectIds()
      const projects = visibleIds
        ? storeManager.getProjects().filter(p => visibleIds.includes(p.id))
        : storeManager.getProjects()

      window.webContents.send('projects:updated', { projects })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Get all projects (unfiltered) for workspace management UI
  ipcMain.handle('workspace:getAllProjects', async () => {
    try {
      const projects = storeManager.getProjects()
      return { success: true, projects }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Window management - create a new window
  ipcMain.handle('window:create', async () => {
    try {
      // Launch new instance without a specific workspace (default workspace)
      if (app.isPackaged) {
        // Production mode: use the app executable
        const appPath = app.getPath('exe')
        spawn(appPath, [], {
          detached: true,
          stdio: 'ignore'
        }).unref()
      } else {
        // Development mode: use electron with the app path
        const isWindows = process.platform === 'win32'
        const electronBin = isWindows ? 'electron.cmd' : 'electron'
        const electronPath = path.join(app.getAppPath(), 'node_modules', '.bin', electronBin)
        const appRoot = app.getAppPath()

        spawn(electronPath, [appRoot], {
          detached: true,
          stdio: 'ignore',
          shell: isWindows // Use shell on Windows to properly execute .cmd files
        }).unref()
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Window state management
  ipcMain.handle('window:isFullScreen', async () => {
    try {
      return { success: true, isFullScreen: window.isFullScreen() }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Listen for fullscreen state changes and notify renderer
  window.on('enter-full-screen', () => {
    window.webContents.send('window:fullscreen-changed', true)
  })

  window.on('leave-full-screen', () => {
    window.webContents.send('window:fullscreen-changed', false)
  })

  // File watcher management
  ipcMain.handle('fileWatcher:watch', async (_, { projectPath }) => {
    try {
      const success = fileWatcherManager.watch(projectPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fileWatcher:unwatch', async (_, { projectPath }) => {
    try {
      const success = await fileWatcherManager.unwatch(projectPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fileWatcher:isWatching', async (_, { projectPath }) => {
    try {
      const watching = fileWatcherManager.isWatching(projectPath)
      return { success: true, watching }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })
}
