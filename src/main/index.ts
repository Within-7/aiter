import { app, BrowserWindow } from 'electron'
import path from 'path'
import { createMainWindow } from './window'
import { setupIPC } from './ipc'
import { setupMenu } from './menu'
import { PTYManager } from './pty'
import { StoreManager } from './store'
import { ProjectServerManager } from './fileServer/ProjectServerManager'
import { PluginManager } from './plugins/PluginManager'
import { initAutoUpdateManager } from './updater'
import { NodeManager } from './nodejs/manager'
import { WorkspaceManager } from './workspace'

// ============================================================================
// Development/Production Environment Isolation
// ============================================================================
// This ensures dev and production versions can run simultaneously without conflicts
const isDev = !app.isPackaged

if (isDev) {
  // Set separate app name for development
  app.setName('AiTer Dev')

  // Use separate user data directory for dev mode
  // This prevents conflicts with production version's data
  const devUserData = path.join(app.getPath('userData'), '..', 'AiTer-Dev')
  app.setPath('userData', devUserData)

  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║              🚀 DEVELOPMENT MODE ENABLED                       ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log(`[Dev Mode] App Name: ${app.getName()}`)
  console.log(`[Dev Mode] User Data: ${app.getPath('userData')}`)
  console.log(`[Dev Mode] Logs: ${app.getPath('logs')}`)
  console.log('─────────────────────────────────────────────────────────────────')
} else {
  // Production mode: use normal app name
  app.setName('AiTer')
  console.log('Production mode - using default configuration')
}

let mainWindow: BrowserWindow | null = null
let ptyManager: PTYManager | null = null
let storeManager: StoreManager | null = null
let serverManager: ProjectServerManager | null = null
let pluginManager: PluginManager | null = null
let nodeManager: NodeManager | null = null
let workspaceManager: WorkspaceManager | null = null

// Parse workspace ID from command line arguments
function getWorkspaceIdFromArgs(): string {
  const workspaceArg = process.argv.find(arg => arg.startsWith('--workspace='))
  if (workspaceArg) {
    return workspaceArg.split('=')[1] || 'default'
  }
  return process.env.AITER_WORKSPACE || 'default'
}

// electron-updater 会自动从 electron-builder.yml 中的 publish 配置获取更新源
// 不再需要手动配置 UPDATE_CHECK_URL

async function initialize() {
  try {
    // Initialize store
    storeManager = new StoreManager()

    // Initialize workspace manager with workspace ID from command line
    const workspaceId = getWorkspaceIdFromArgs()
    workspaceManager = new WorkspaceManager(workspaceId)
    console.log(`[WorkspaceManager] Using workspace: ${workspaceId}`)

    // Initialize Node.js manager and install if needed
    nodeManager = new NodeManager()
    const installed = await nodeManager.isInstalled()
    if (!installed) {
      console.log('[NodeManager] Built-in Node.js not found, installing...')
      const success = await nodeManager.installFromResources()
      if (success) {
        console.log('[NodeManager] Built-in Node.js installed successfully')
      } else {
        console.warn('[NodeManager] Failed to install built-in Node.js, terminals will use system Node.js')
      }
    } else {
      const nodeInfo = await nodeManager.getNodeInfo()
      console.log(`[NodeManager] Built-in Node.js already installed: ${nodeInfo?.version}`)
    }

    // Auto-configure shell for seamless Node.js integration
    // This runs on every launch to ensure configuration is present
    const shellConfigured = await nodeManager.configureShell()
    if (shellConfigured) {
      console.log('[NodeManager] Shell configuration verified')
    } else {
      console.warn('[NodeManager] Failed to configure shell automatically')
    }

    // Initialize PTY manager
    ptyManager = new PTYManager()

    // Initialize file server manager
    serverManager = new ProjectServerManager()

    // Initialize plugin manager
    pluginManager = PluginManager.getInstance()

    // Create main window first (so UI appears quickly)
    mainWindow = createMainWindow(workspaceManager)

    // Set main window on plugin manager for event communication
    pluginManager.setMainWindow(mainWindow)

    // Initialize plugins in background (non-blocking for UI)
    pluginManager.initialize().catch((error) => {
      console.error('[PluginManager] Background initialization failed:', error)
    })

    // Setup menu
    setupMenu()

    // Setup IPC handlers
    setupIPC(mainWindow, ptyManager, storeManager, serverManager, workspaceManager)

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null
    })

    // Start plugin auto-check after window is created
    pluginManager.startAutoCheck()

    // Initialize and start auto-updater
    const autoUpdateManager = initAutoUpdateManager()
    autoUpdateManager.setMainWindow(mainWindow)
    autoUpdateManager.startAutoCheck()

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
