import { BrowserWindow, screen, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { WindowState } from '../types'
import { WorkspaceManager } from './workspace'

function getWindowStateFile(workspaceId: string): string {
  if (workspaceId === 'default') {
    return path.join(app.getPath('userData'), 'window-state.json')
  }
  return path.join(app.getPath('userData'), `window-state-${workspaceId}.json`)
}

function getDefaultWindowState(): WindowState {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  return {
    width: Math.floor(width * 0.8),
    height: Math.floor(height * 0.8),
    isMaximized: false
  }
}

function loadWindowState(workspaceId: string): WindowState {
  const stateFile = getWindowStateFile(workspaceId)
  try {
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, 'utf-8')
      return { ...getDefaultWindowState(), ...JSON.parse(data) }
    }
  } catch (error) {
    console.error('Failed to load window state:', error)
  }
  return getDefaultWindowState()
}

function saveWindowState(window: BrowserWindow, workspaceId: string) {
  const stateFile = getWindowStateFile(workspaceId)
  try {
    const bounds = window.getBounds()
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized()
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
  } catch (error) {
    console.error('Failed to save window state:', error)
  }
}

export function createMainWindow(workspaceManager?: WorkspaceManager): BrowserWindow {
  const workspaceId = workspaceManager?.getCurrentWorkspaceId() || 'default'
  const state = loadWindowState(workspaceId)

  // Set icon path based on environment
  // In development, use path relative to project root
  // In production, use path relative to resources
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(app.getAppPath(), 'assets/logo.png')
    : path.join(process.resourcesPath, 'assets/logo.png')

  // Set window title based on workspace (includes dev mode indicator)
  const windowTitle = workspaceManager?.getWindowTitle() || app.getName()

  const window = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 600,
    title: windowTitle,
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Performance optimizations
      backgroundThrottling: false, // Prevent throttling when window is in background
      enableWebSQL: false, // Disable unused feature
      spellcheck: false // Disable spellcheck for terminal performance
    }
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Open DevTools in development
    window.webContents.openDevTools()
  } else {
    window.loadFile(path.join(__dirname, '../../dist-renderer/index.html'))
  }

  // Disable refresh shortcuts to prevent accidental session loss
  // These shortcuts would cause all terminals and editor tabs to be lost
  // Applied in both dev and production environments
  window.webContents.on('before-input-event', (event, input) => {
    // Block Ctrl+R, Cmd+R (reload)
    if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
      event.preventDefault()
    }
    // Block Ctrl+Shift+R, Cmd+Shift+R (hard reload)
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'r') {
      event.preventDefault()
    }
    // Block F5 (reload)
    if (input.key === 'F5') {
      event.preventDefault()
    }
  })

  // Save window state on resize/move
  let saveStateTimeout: NodeJS.Timeout
  const debouncedSaveState = () => {
    clearTimeout(saveStateTimeout)
    saveStateTimeout = setTimeout(() => saveWindowState(window, workspaceId), 500)
  }

  window.on('resize', debouncedSaveState)
  window.on('move', debouncedSaveState)

  // Save state before close
  window.on('close', () => {
    clearTimeout(saveStateTimeout)
    saveWindowState(window, workspaceId)
  })

  return window
}
