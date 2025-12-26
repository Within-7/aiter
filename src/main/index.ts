import { app, BrowserWindow } from 'electron'
import path from 'path'
import { execFileSync } from 'child_process'
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
// Clear Proxy Environment Variables on Startup
// ============================================================================
// Prevent proxy settings from being inherited from the launching terminal
// This avoids issues with HTTP libraries (like axios) that don't handle
// environment-based proxies correctly, causing MCP services to fail
const proxyVarsToClear = [
  'http_proxy', 'https_proxy', 'ftp_proxy', 'all_proxy',
  'HTTP_PROXY', 'HTTPS_PROXY', 'FTP_PROXY', 'ALL_PROXY',
  'no_proxy', 'NO_PROXY'
]
for (const varName of proxyVarsToClear) {
  delete process.env[varName]
}
console.log('[Startup] Cleared proxy environment variables')

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

/**
 * Check if Minto CLI is installed
 */
function isMintoInstalled(): boolean {
  try {
    // Use 'which' on Unix, 'where' on Windows
    const command = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(command, ['minto'], { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    // Command not found
    return false
  }
}

/**
 * Install Minto CLI using npm
 * Returns true if installation was successful
 */
async function installMinto(nodeManagerInstance: NodeManager): Promise<boolean> {
  try {
    console.log('[MintoInstaller] Installing Minto CLI...')

    // Get npm path from NodeManager
    const npmPath = nodeManagerInstance.getNpmExecutable()
    if (!npmPath) {
      console.error('[MintoInstaller] npm not found')
      return false
    }

    // Install minto globally using execFileSync (safer than execSync)
    execFileSync(npmPath, ['install', '-g', '@within-7/minto'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      env: {
        ...process.env,
        ...nodeManagerInstance.getTerminalEnv()
      }
    })

    console.log('[MintoInstaller] Minto CLI installed successfully')
    return true
  } catch (error) {
    console.error('[MintoInstaller] Failed to install Minto CLI:', error)
    return false
  }
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

    // Initialize Node.js manager with automatic version management
    nodeManager = new NodeManager()

    // Check if upgrade is needed (handles both fresh install and version upgrades)
    const upgradeResult = await nodeManager.upgradeIfNeeded()

    if (upgradeResult.upgraded) {
      if (upgradeResult.oldVersion) {
        console.log(`[NodeManager] Upgraded Node.js from ${upgradeResult.oldVersion} to ${upgradeResult.newVersion}`)
        console.log(`[NodeManager] Reason: ${upgradeResult.reason}`)
      } else {
        console.log(`[NodeManager] Installed Node.js ${upgradeResult.newVersion}`)
      }
    } else {
      console.log(`[NodeManager] Node.js ${upgradeResult.oldVersion} is up to date`)
    }

    // Auto-configure shell for seamless Node.js integration
    // This runs on every launch to ensure configuration is present
    const shellConfigured = await nodeManager.configureShell()
    if (shellConfigured) {
      console.log('[NodeManager] Shell configuration verified')
    } else {
      console.warn('[NodeManager] Failed to configure shell automatically')
    }

    // Check and install Minto CLI if needed (first-time setup)
    const settings = storeManager.getSettings()
    if (!settings.mintoInstalled) {
      console.log('[MintoInstaller] Checking Minto CLI installation...')
      if (isMintoInstalled()) {
        console.log('[MintoInstaller] Minto CLI is already installed')
        storeManager.updateSettings({ mintoInstalled: true })
      } else {
        console.log('[MintoInstaller] Minto CLI not found, installing...')
        const mintoSuccess = await installMinto(nodeManager)
        if (mintoSuccess) {
          storeManager.updateSettings({ mintoInstalled: true })
          console.log('[MintoInstaller] Minto CLI setup complete')
        } else {
          console.warn('[MintoInstaller] Minto CLI installation failed, user can install manually')
        }
      }
    } else {
      console.log('[MintoInstaller] Minto CLI installation already verified')
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
app.whenReady()
  .then(initialize)
  .catch(error => {
    console.error('Failed to initialize app:', error)
    app.quit()
  })

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
  console.log('[App] before-quit: Starting cleanup...')

  if (ptyManager) {
    const result = await ptyManager.killAll()
    console.log(`[App] PTY cleanup: ${result.success} success, ${result.failed} failed, timeout: ${result.timeout}`)
  }
  if (serverManager) {
    await serverManager.stopAllServers()
    console.log('[App] File servers stopped')
  }
  if (pluginManager) {
    await pluginManager.cleanup()
    console.log('[App] Plugins cleaned up')
  }

  console.log('[App] Cleanup complete')
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error)
})
