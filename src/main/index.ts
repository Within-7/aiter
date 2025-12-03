import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { setupIPC } from './ipc'
import { setupMenu } from './menu'
import { PTYManager } from './pty'
import { StoreManager } from './store'
import { ProjectServerManager } from './fileServer/ProjectServerManager'
import { PluginManager } from './plugins/PluginManager'
import { initUpdateManager } from './updater'

// Set application name
app.setName('AiTer')

let mainWindow: BrowserWindow | null = null
let ptyManager: PTYManager | null = null
let storeManager: StoreManager | null = null
let serverManager: ProjectServerManager | null = null
let pluginManager: PluginManager | null = null

// Update check URL (可以通过环境变量配置)
const UPDATE_CHECK_URL = process.env.UPDATE_CHECK_URL || 'http://aiter.within-7.com/latest.json'

async function initialize() {
  try {
    // Initialize store
    storeManager = new StoreManager()

    // Initialize PTY manager
    ptyManager = new PTYManager()

    // Initialize file server manager
    serverManager = new ProjectServerManager()

    // Initialize plugin manager
    pluginManager = PluginManager.getInstance()

    // Create main window first (so UI appears quickly)
    mainWindow = createMainWindow()

    // Set main window on plugin manager for event communication
    pluginManager.setMainWindow(mainWindow)

    // Initialize plugins in background (non-blocking for UI)
    pluginManager.initialize().catch((error) => {
      console.error('[PluginManager] Background initialization failed:', error)
    })

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

    // Initialize and start update checker
    const updateManager = initUpdateManager(UPDATE_CHECK_URL)
    updateManager.startAutoCheck(mainWindow)

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
