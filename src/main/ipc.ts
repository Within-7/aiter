import { BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { PTYManager } from './pty'
import { StoreManager } from './store'
import { fileSystemManager } from './filesystem'
import { ProjectServerManager } from './fileServer/ProjectServerManager'
import { PluginManager } from './plugins/PluginManager'
import { getUpdateManager } from './updater'

export function setupIPC(
  window: BrowserWindow,
  ptyManager: PTYManager,
  storeManager: StoreManager,
  serverManager: ProjectServerManager
) {
  // Project management
  ipcMain.handle('project:add', async (_, { path, name }) => {
    try {
      const project = storeManager.addProject(path, name)
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

      const terminal = ptyManager.create(
        id,
        cwd,
        projectId,
        projectName,
        shell,
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
      if (success && data === '\r') {
        const terminalName = ptyManager.getTerminalName(id)
        if (terminalName) {
          window.webContents.send('terminal:name-updated', { id, name: terminalName })
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
          const config = plugin
            ? await pluginManager.getPluginConfiguration(item.id).catch(() => ({}))
            : {}

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
            homepage: plugin?.definition.homepage
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
      const success = await pluginManager.installPlugin(pluginId, (progress) => {
        window.webContents.send('plugins:install-progress', progress)
      })
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:update', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const success = await pluginManager.updatePlugin(pluginId, (progress) => {
        window.webContents.send('plugins:update-progress', progress)
      })
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:remove', async (_, { pluginId }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const success = await pluginManager.removePlugin(pluginId)
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('plugins:configure', async (_, { pluginId, config }) => {
    try {
      const pluginManager = PluginManager.getInstance()
      const success = await pluginManager.configurePlugin(pluginId, config)
      return { success }
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

  console.log('IPC handlers registered')
}
