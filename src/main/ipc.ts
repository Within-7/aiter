import { BrowserWindow, ipcMain, dialog } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { PTYManager } from './pty'
import { StoreManager } from './store'
import { fileSystemManager } from './filesystem'

export function setupIPC(
  window: BrowserWindow,
  ptyManager: PTYManager,
  storeManager: StoreManager
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

  console.log('IPC handlers registered')
}
