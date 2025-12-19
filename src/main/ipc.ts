import { BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { PTYManager } from './pty'
import { StoreManager } from './store'
import { fileSystemManager } from './filesystem'
import { ProjectServerManager } from './fileServer/ProjectServerManager'
import { PluginManager } from './plugins/PluginManager'
import { getUpdateManager } from './updater'
import { NodeManager } from './nodejs/manager'
import { NodeDetector } from './nodejs/detector'
import { NodeDownloader } from './nodejs/downloader'
import { gitManager } from './git'
import { ShellDetector } from './shell/ShellDetector'
import { VersionManagerDetector } from './shell/VersionManagerDetector'

export function setupIPC(
  window: BrowserWindow,
  ptyManager: PTYManager,
  storeManager: StoreManager,
  serverManager: ProjectServerManager
) {
  // Throttle terminal name updates to reduce UI flickering
  // For REPL apps like Claude Code CLI that send frequent commands
  const terminalNameThrottle = new Map<string, { lastSent: number; pendingName: string | null; timeout: NodeJS.Timeout | null }>()
  const NAME_UPDATE_THROTTLE_MS = 500 // Only update name every 500ms max

  const sendThrottledNameUpdate = (id: string, name: string) => {
    const now = Date.now()
    let state = terminalNameThrottle.get(id)

    if (!state) {
      state = { lastSent: 0, pendingName: null, timeout: null }
      terminalNameThrottle.set(id, state)
    }

    const timeSinceLastSent = now - state.lastSent

    if (timeSinceLastSent >= NAME_UPDATE_THROTTLE_MS) {
      // Enough time has passed, send immediately
      window.webContents.send('terminal:name-updated', { id, name })
      state.lastSent = now
      state.pendingName = null
      if (state.timeout) {
        clearTimeout(state.timeout)
        state.timeout = null
      }
    } else {
      // Too soon, schedule for later
      state.pendingName = name
      if (!state.timeout) {
        const delay = NAME_UPDATE_THROTTLE_MS - timeSinceLastSent
        state.timeout = setTimeout(() => {
          const currentState = terminalNameThrottle.get(id)
          if (currentState && currentState.pendingName) {
            window.webContents.send('terminal:name-updated', { id, name: currentState.pendingName })
            currentState.lastSent = Date.now()
            currentState.pendingName = null
            currentState.timeout = null
          }
        }, delay)
      }
    }
  }

  // Project management
  ipcMain.handle('project:add', async (_, { path, name }) => {
    try {
      // Check if directory is a Git repository
      let isGitRepo = await gitManager.isGitRepo(path)

      // If not a Git repo, initialize one
      if (!isGitRepo) {
        console.log(`Project ${name} is not a Git repository, initializing...`)
        const initSuccess = await gitManager.initRepo(path)
        if (initSuccess) {
          isGitRepo = true
          console.log(`Git repository initialized for ${name}`)
        } else {
          console.warn(`Failed to initialize Git repository for ${name}`)
        }
      }

      const project = storeManager.addProject(path, name)

      // Update project with Git status
      project.isGitRepo = isGitRepo

      window.webContents.send('projects:updated', {
        projects: storeManager.getProjects()
      })
      return { success: true, project }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('project:remove', async (_, { id }) => {
    try {
      const success = storeManager.removeProject(id)
      if (success) {
        window.webContents.send('projects:updated', {
          projects: storeManager.getProjects()
        })
      }
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('projects:reorder', async (_, { projectIds }) => {
    try {
      const projects = storeManager.reorderProjects(projectIds)
      window.webContents.send('projects:updated', { projects })
      return { success: true, projects }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('projects:list', async () => {
    try {
      const projects = storeManager.getProjects()
      return { success: true, projects }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Terminal management
  ipcMain.handle('terminal:create', async (_, { cwd, shell, projectId, projectName }) => {
    try {
      const id = uuidv4()

      // Get current settings to pass to PTY
      const settings = storeManager.getSettings()

      const terminal = ptyManager.create(
        id,
        cwd,
        projectId,
        projectName,
        shell,
        settings,  // Pass settings for login shell mode, etc.
        // onData callback
        (data) => {
          window.webContents.send('terminal:data', { id, data })
        },
        // onExit callback
        (exitCode) => {
          window.webContents.send('terminal:exit', { id, exitCode })
        }
      )

      return { success: true, terminal }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('terminal:write', async (_, { id, data }) => {
    try {
      const success = ptyManager.write(id, data)
      // Check if terminal name changed (after command execution)
      // Use throttled update to reduce UI flickering for REPL apps
      if (success && data === '\r') {
        const terminalName = ptyManager.getTerminalName(id)
        if (terminalName) {
          sendThrottledNameUpdate(id, terminalName)
        }
      }
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('terminal:resize', async (_, { id, cols, rows }) => {
    try {
      const success = ptyManager.resize(id, cols, rows)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('terminal:kill', async (_, { id }) => {
    try {
      const success = ptyManager.kill(id)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // File system dialogs
  ipcMain.handle('dialog:openFolder', async () => {
    try {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'createDirectory']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      const path = result.filePaths[0]
      const name = path.split('/').pop() || path.split('\\').pop() || 'Unnamed'

      return { success: true, data: { path, name } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('dialog:openFiles', async () => {
    try {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'multiSelections']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      return { success: true, data: { paths: result.filePaths } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Settings management
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = storeManager.getSettings()
      return { success: true, settings }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('settings:update', async (_, settings) => {
    try {
      const updated = storeManager.updateSettings(settings)
      window.webContents.send('settings:updated', { settings: updated })
      return { success: true, settings: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // File system operations
  ipcMain.handle('fs:readDir', async (_, { path, depth }) => {
    try {
      const nodes = await fileSystemManager.readDirectory(path, depth || 1)
      return { success: true, nodes }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:readFile', async (_, { path }) => {
    try {
      const result = await fileSystemManager.readFile(path)
      return { success: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:writeFile', async (_, { path, content }) => {
    try {
      const success = await fileSystemManager.writeFile(path, content)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:fileExists', async (_, { path }) => {
    try {
      const exists = await fileSystemManager.fileExists(path)
      return { success: true, exists }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:createFile', async (_, { path, content }) => {
    try {
      const success = await fileSystemManager.createFile(path, content || '')
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:createDirectory', async (_, { path }) => {
    try {
      const success = await fileSystemManager.createDirectory(path)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:rename', async (_, { oldPath, newPath }) => {
    try {
      const success = await fileSystemManager.rename(oldPath, newPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:delete', async (_, { path }) => {
    try {
      const success = await fileSystemManager.delete(path)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fs:copyFiles', async (_, { sourcePaths, destDir }) => {
    try {
      const result = await fileSystemManager.copyFiles(sourcePaths, destDir)
      return { success: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // File server operations
  ipcMain.handle('fileServer:getUrl', async (_, { projectId, projectPath, filePath }) => {
    try {
      const url = await serverManager.getFileUrl(projectId, projectPath, filePath)
      return { success: true, url }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fileServer:stop', async (_, { projectId }) => {
    try {
      await serverManager.stopServer(projectId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fileServer:getStats', async () => {
    try {
      const stats = serverManager.getStats()
      return { success: true, stats }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Plugin management
  ipcMain.handle('plugins:list', async () => {
    try {
      console.log('[IPC] plugins:list called')
      const pluginManager = PluginManager.getInstance()
      const pluginListItems = await pluginManager.listPluginsAsync()
      console.log('[IPC] Got plugin list items:', pluginListItems)

      // Convert PluginListItem to Plugin format expected by renderer
      const plugins = await Promise.all(
        pluginListItems.map(async item => {
          const plugin = pluginManager.getPlugin(item.id)
          const fullConfig: Record<string, unknown> = plugin
            ? await pluginManager.getPluginConfiguration(item.id).catch(() => ({}))
            : {}

          // Filter config to only include valid fields based on plugin
          // For Minto, only include autoUpdate (remove deprecated githubToken, hasToken)
          const config: Record<string, unknown> = {}
          if (item.id === 'minto') {
            if (fullConfig.autoUpdate !== undefined) {
              config.autoUpdate = fullConfig.autoUpdate
            }
          } else {
            // For other plugins, include all config
            Object.assign(config, fullConfig)
          }

          const result = {
            id: item.id,
            name: item.name,
            description: item.description,
            version: item.latestVersion || item.installedVersion || '0.0.0',
            author: plugin?.definition.author || 'Unknown',
            installed: item.status === 'installed' || item.status === 'update-available',
            installedVersion: item.installedVersion || undefined,
            updateAvailable: item.hasUpdate,
            enabled: item.enabled,
            config,
            tags: item.tags,
            icon: item.icon,
            homepage: plugin?.definition.homepage,
            isBuiltIn: plugin?.definition.isBuiltIn || false
          }
          console.log('[IPC] Converted plugin:', result)
          return result
        })
      )

      console.log('[IPC] Returning plugins:', plugins)
      return { success: true, plugins }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[IPC] Error in plugins:list:', error)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:install', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const result = await pluginManager.installPlugin(pluginId, (progress) => {
        window.webContents.send('plugins:install-progress', progress)
      })

      // After successful installation, send event to refresh status bar
      if (result.success) {
        window.webContents.send('plugins:status-changed')
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:update', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const result = await pluginManager.updatePlugin(pluginId, (progress) => {
        window.webContents.send('plugins:update-progress', progress)
      })

      // After successful update, send event to refresh status bar
      if (result.success) {
        window.webContents.send('plugins:status-changed')
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:remove', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const success = await pluginManager.removePlugin(pluginId)

      // After successful removal, send event to refresh status bar
      if (success) {
        window.webContents.send('plugins:status-changed')
      }

      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:configure', async (_, { pluginId, config }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      await pluginManager.configurePlugin(pluginId, config)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:getInstallCommand', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const plugin = pluginManager.getPlugin(pluginId)
      if (!plugin) {
        return { success: false, error: `Plugin ${pluginId} not found` }
      }

      if (!plugin.installer.getInstallCommand) {
        return { success: false, error: 'Plugin does not support terminal installation' }
      }

      const command = await plugin.installer.getInstallCommand()
      return { success: true, command }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:getUpdateCommand', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const plugin = pluginManager.getPlugin(pluginId)
      if (!plugin) {
        return { success: false, error: `Plugin ${pluginId} not found` }
      }

      if (!plugin.installer.getUpdateCommand) {
        return { success: false, error: 'Plugin does not support terminal update' }
      }

      const command = await plugin.installer.getUpdateCommand()
      return { success: true, command }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:getCheckUpdateCommand', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const plugin = pluginManager.getPlugin(pluginId)
      if (!plugin) {
        return { success: false, error: `Plugin ${pluginId} not found` }
      }

      if (!plugin.installer.getCheckUpdateCommand) {
        return { success: false, error: 'Plugin does not support terminal check' }
      }

      const command = await plugin.installer.getCheckUpdateCommand()
      return { success: true, command }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:checkForUpdate', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const result = await pluginManager.checkForUpdate(pluginId)

      // Notify renderer that plugin status may have changed (e.g., update available)
      if (window && !window.isDestroyed()) {
        window.webContents.send('plugins:status-changed')
      }

      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:refreshStatus', async () => {
    try {
      const pluginManager = PluginManager.getInstance()
      await pluginManager.refreshAllPluginsStatus()

      // Notify renderer that plugin status may have changed
      if (window && !window.isDestroyed()) {
        window.webContents.send('plugins:status-changed')
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:addCustom', async (_, { urlOrPackageName }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const result = await pluginManager.addCustomPlugin(urlOrPackageName)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:removeCustom', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const result = await pluginManager.removeCustomPlugin(pluginId)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Update management
  ipcMain.handle('update:check', async () => {
    try {
      const updateManager = getUpdateManager()
      if (!updateManager) {
        return { success: false, error: 'Update manager not initialized' }
      }

      const updateInfo = await updateManager.checkForUpdates(window)
      return {
        success: true,
        hasUpdate: updateInfo !== null,
        updateInfo: updateInfo || undefined
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      const updateManager = getUpdateManager()
      if (!updateManager) {
        return { success: false, error: 'Update manager not initialized' }
      }

      const success = await updateManager.downloadUpdate()
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Shell operations
  ipcMain.handle('shell:openExternal', async (_, { url }) => {
    try {
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

  // Git management
  ipcMain.handle('git:getStatus', async (_, { projectPath }) => {
    try {
      const status = await gitManager.getStatus(projectPath)
      return { success: true, status }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:getRecentCommits', async (_, { projectPath, count }) => {
    try {
      const commits = await gitManager.getRecentCommits(projectPath, count || 10)
      return { success: true, commits }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:initRepo', async (_, { projectPath }) => {
    try {
      const success = await gitManager.initRepo(projectPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:getFileChanges', async (_, { projectPath }) => {
    try {
      const changes = await gitManager.getFileChanges(projectPath)
      return { success: true, changes }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:commitAll', async (_, { projectPath, message }) => {
    try {
      const success = await gitManager.commitAll(projectPath, message)
      return { success }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.handle('git:getBranches', async (_, { projectPath }) => {
    try {
      const branches = await gitManager.getBranches(projectPath)
      return { success: true, branches }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:createBranch', async (_, { projectPath, branchName }) => {
    try {
      const success = await gitManager.createBranch(projectPath, branchName)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:switchBranch', async (_, { projectPath, branchName }) => {
    try {
      const success = await gitManager.switchBranch(projectPath, branchName)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:deleteBranch', async (_, { projectPath, branchName, force }) => {
    try {
      const success = await gitManager.deleteBranch(projectPath, branchName, force)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:pull', async (_, { projectPath }) => {
    try {
      const success = await gitManager.pull(projectPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:push', async (_, { projectPath }) => {
    try {
      const success = await gitManager.push(projectPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:fetch', async (_, { projectPath }) => {
    try {
      const success = await gitManager.fetch(projectPath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:stageFile', async (_, { projectPath, filePath }) => {
    try {
      const success = await gitManager.stageFile(projectPath, filePath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:unstageFile', async (_, { projectPath, filePath }) => {
    try {
      const success = await gitManager.unstageFile(projectPath, filePath)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:getFileDiff', async (_, { projectPath, filePath }) => {
    try {
      const diff = await gitManager.getFileDiff(projectPath, filePath)
      return { success: true, diff }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:getCommitFiles', async (_, { projectPath, commitHash }) => {
    try {
      const files = await gitManager.getCommitFiles(projectPath, commitHash)
      return { success: true, files }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('git:getCommitFileDiff', async (_, { projectPath, commitHash, filePath }) => {
    try {
      const diff = await gitManager.getCommitFileDiff(projectPath, commitHash, filePath)
      return { success: true, diff }
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

  console.log('IPC handlers registered')
}
