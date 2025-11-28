import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { setupIPC } from './ipc'
import { setupMenu } from './menu'
import { PTYManager } from './pty'
import { StoreManager } from './store'
import { ProjectServerManager } from './fileServer/ProjectServerManager'
import { PluginManager } from './plugins/PluginManager'

// Set application name
app.setName('AiTer')

let mainWindow: BrowserWindow | null = null
let ptyManager: PTYManager | null = null
let storeManager: StoreManager | null = null
let serverManager: ProjectServerManager | null = null
let pluginManager: PluginManager | null = null

async function initialize() {
  try {
    // Initialize store
    storeManager = new StoreManager()

    // Initialize PTY manager
    ptyManager = new PTYManager()

    // Initialize file server manager
    serverManager = new ProjectServerManager()

    // Initialize plugin manager (non-blocking)
    pluginManager = PluginManager.getInstance()
    // Initialize plugins in background to avoid blocking app startup
    pluginManager.initialize().catch((error) => {
      console.error('[PluginManager] Background initialization failed:', error)
    })

    // Create main window
    mainWindow = createMainWindow()

    // Setup menu
    setupMenu()

    // Setup IPC handlers
    setupIPC(mainWindow, ptyManager, storeManager, serverManager)

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null
    })

    // Start plugin auto-check after window is created
    pluginManager.startAutoCheck()

    console.log('AiTer initialized successfully')
  } catch (error) {
    console.error('Failed to initialize AiTer:', error)
    app.quit()
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(initialize)

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS, re-create a window when dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0) {
    initialize()
  }
})

// Cleanup on quit
app.on('before-quit', async () => {
  if (ptyManager) {
    ptyManager.killAll()
  }
  if (serverManager) {
    await serverManager.stopAllServers()
  }
  if (pluginManager) {
    await pluginManager.cleanup()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error)
})
