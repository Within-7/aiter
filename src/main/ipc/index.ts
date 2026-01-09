import { BrowserWindow } from 'electron'
import { PTYManager } from '../pty'
import { StoreManager } from '../store'
import { ProjectServerManager } from '../fileServer/ProjectServerManager'
import { WorkspaceManager } from '../workspace'
import { fileSystemManager } from '../filesystem'
import { fileWatcherManager } from '../fileWatcher'

import { registerProjectHandlers } from './projects'
import { registerTerminalHandlers } from './terminal'
import { registerFilesystemHandlers } from './filesystem'
import { registerFileServerHandlers } from './fileServer'
import { registerSettingsHandlers } from './settings'
import { registerDialogHandlers } from './dialog'
import { registerGitHandlers } from './git'
import { registerPluginHandlers } from './plugins'
import { registerAppHandlers } from './app'
import { registerTemplateHandlers } from './templates'
import { registerVoiceNotesHandlers } from './voiceNotes'

export function setupIPC(
  window: BrowserWindow,
  ptyManager: PTYManager,
  storeManager: StoreManager,
  serverManager: ProjectServerManager,
  workspaceManager: WorkspaceManager
) {
  // Set main window for file watcher manager
  fileWatcherManager.setMainWindow(window)

  // Initialize allowed filesystem roots from existing projects (security)
  const existingProjects = storeManager.getProjects()
  for (const project of existingProjects) {
    fileSystemManager.addAllowedRoot(project.path)
  }
  console.log(`[Security] Initialized ${existingProjects.length} allowed filesystem roots`)

  // Register all IPC handlers by namespace
  registerProjectHandlers(window, storeManager, workspaceManager)
  registerTerminalHandlers(window, ptyManager, storeManager)
  registerFilesystemHandlers()
  registerFileServerHandlers(serverManager)
  registerSettingsHandlers(window, storeManager)
  registerDialogHandlers(window)
  registerGitHandlers()
  registerPluginHandlers(window)
  registerAppHandlers(window, workspaceManager, storeManager)
  registerTemplateHandlers()
  registerVoiceNotesHandlers(window)

  console.log('IPC handlers registered')
}
