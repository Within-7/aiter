import { contextBridge, ipcRenderer } from 'electron'
import { Project, Terminal, AppSettings, FileNode, Plugin, PluginInstallProgress, PluginUpdateProgress } from '../types'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Project APIs
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    add: (path: string, name?: string) =>
      ipcRenderer.invoke('project:add', { path, name }),
    remove: (id: string) => ipcRenderer.invoke('project:remove', { id }),
    onUpdated: (callback: (projects: Project[]) => void) => {
      const listener = (_: unknown, { projects }: { projects: Project[] }) =>
        callback(projects)
      ipcRenderer.on('projects:updated', listener)
      return () => ipcRenderer.removeListener('projects:updated', listener)
    }
  },

  // Terminal APIs
  terminal: {
    create: (cwd: string, projectId: string, projectName: string, shell?: string) =>
      ipcRenderer.invoke('terminal:create', { cwd, projectId, projectName, shell }),
    write: (id: string, data: string) =>
      ipcRenderer.invoke('terminal:write', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', { id }),
    onData: (callback: (id: string, data: string) => void) => {
      const listener = (_: unknown, { id, data }: { id: string; data: string }) =>
        callback(id, data)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (callback: (id: string, exitCode: number) => void) => {
      const listener = (
        _: unknown,
        { id, exitCode }: { id: string; exitCode: number }
      ) => callback(id, exitCode)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },
    onNameUpdated: (callback: (id: string, name: string) => void) => {
      const listener = (_: unknown, { id, name }: { id: string; name: string }) =>
        callback(id, name)
      ipcRenderer.on('terminal:name-updated', listener)
      return () => ipcRenderer.removeListener('terminal:name-updated', listener)
    }
  },

  // Dialog APIs
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder')
  },

  // Settings APIs
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke('settings:update', settings),
    onUpdated: (callback: (settings: AppSettings) => void) => {
      const listener = (_: unknown, { settings }: { settings: AppSettings }) =>
        callback(settings)
      ipcRenderer.on('settings:updated', listener)
      return () => ipcRenderer.removeListener('settings:updated', listener)
    }
  },

  // File System APIs
  fs: {
    readDir: (path: string, depth?: number) =>
      ipcRenderer.invoke('fs:readDir', { path, depth }),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', { path }),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', { path, content }),
    fileExists: (path: string) => ipcRenderer.invoke('fs:fileExists', { path })
  },

  // File Server APIs
  fileServer: {
    getUrl: (projectId: string, projectPath: string, filePath: string) =>
      ipcRenderer.invoke('fileServer:getUrl', { projectId, projectPath, filePath }),
    stop: (projectId: string) =>
      ipcRenderer.invoke('fileServer:stop', { projectId }),
    getStats: () =>
      ipcRenderer.invoke('fileServer:getStats')
  },

  // App APIs
  app: {
    onError: (callback: (error: { message: string; stack?: string }) => void) => {
      const listener = (
        _: unknown,
        error: { message: string; stack?: string }
      ) => callback(error)
      ipcRenderer.on('app:error', listener)
      return () => ipcRenderer.removeListener('app:error', listener)
    }
  },

  // Plugin APIs
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    install: (pluginId: string) => ipcRenderer.invoke('plugins:install', { pluginId }),
    update: (pluginId: string) => ipcRenderer.invoke('plugins:update', { pluginId }),
    remove: (pluginId: string) => ipcRenderer.invoke('plugins:remove', { pluginId }),
    configure: (pluginId: string, config: Record<string, unknown>) =>
      ipcRenderer.invoke('plugins:configure', { pluginId, config }),
    getInstallCommand: (pluginId: string) =>
      ipcRenderer.invoke('plugins:getInstallCommand', { pluginId }),
    getUpdateCommand: (pluginId: string) =>
      ipcRenderer.invoke('plugins:getUpdateCommand', { pluginId }),
    getCheckUpdateCommand: (pluginId: string) =>
      ipcRenderer.invoke('plugins:getCheckUpdateCommand', { pluginId }),
    onInstallProgress: (callback: (progress: PluginInstallProgress) => void) => {
      const listener = (_: unknown, progress: PluginInstallProgress) => callback(progress)
      ipcRenderer.on('plugins:install-progress', listener)
      return () => ipcRenderer.removeListener('plugins:install-progress', listener)
    },
    onUpdateProgress: (callback: (progress: PluginUpdateProgress) => void) => {
      const listener = (_: unknown, progress: PluginUpdateProgress) => callback(progress)
      ipcRenderer.on('plugins:update-progress', listener)
      return () => ipcRenderer.removeListener('plugins:update-progress', listener)
    },
    onAutoUpdateAvailable: (callback: (data: { pluginId: string; pluginName: string }) => void) => {
      const listener = (_: unknown, data: { pluginId: string; pluginName: string }) => callback(data)
      ipcRenderer.on('plugins:auto-update-available', listener)
      return () => ipcRenderer.removeListener('plugins:auto-update-available', listener)
    },
    onInitialized: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('plugins:initialized', listener)
      return () => ipcRenderer.removeListener('plugins:initialized', listener)
    }
  },

  // Update APIs
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    onAvailable: (callback: (data: {
      currentVersion: string;
      latestVersion: string;
      changelog: string[];
      releaseDate: string;
    }) => void) => {
      const listener = (_: unknown, data: {
        currentVersion: string;
        latestVersion: string;
        changelog: string[];
        releaseDate: string;
      }) => callback(data)
      ipcRenderer.on('update:available', listener)
      return () => ipcRenderer.removeListener('update:available', listener)
    }
  }
})

// Type definitions for TypeScript
export interface API {
  projects: {
    list(): Promise<{ success: boolean; projects?: Project[]; error?: string }>
    add(
      path: string,
      name?: string
    ): Promise<{ success: boolean; project?: Project; error?: string }>
    remove(id: string): Promise<{ success: boolean; error?: string }>
    onUpdated(callback: (projects: Project[]) => void): () => void
  }
  terminal: {
    create(
      cwd: string,
      projectId: string,
      projectName: string,
      shell?: string
    ): Promise<{ success: boolean; terminal?: Terminal; error?: string }>
    write(id: string, data: string): Promise<{ success: boolean; error?: string }>
    resize(
      id: string,
      cols: number,
      rows: number
    ): Promise<{ success: boolean; error?: string }>
    kill(id: string): Promise<{ success: boolean; error?: string }>
    onData(callback: (id: string, data: string) => void): () => void
    onExit(callback: (id: string, exitCode: number) => void): () => void
    onNameUpdated(callback: (id: string, name: string) => void): () => void
  }
  dialog: {
    openFolder(): Promise<{
      success: boolean
      data?: { path: string; name: string } | null
      error?: string
    }>
  }
  settings: {
    get(): Promise<{ success: boolean; settings?: AppSettings; error?: string }>
    update(
      settings: Partial<AppSettings>
    ): Promise<{ success: boolean; settings?: AppSettings; error?: string }>
    onUpdated(callback: (settings: AppSettings) => void): () => void
  }
  fs: {
    readDir(
      path: string,
      depth?: number
    ): Promise<{ success: boolean; nodes?: FileNode[]; error?: string }>
    readFile(
      path: string
    ): Promise<{
      success: boolean
      content?: string
      fileType?: string
      error?: string
    }>
    writeFile(
      path: string,
      content: string
    ): Promise<{ success: boolean; error?: string }>
    fileExists(
      path: string
    ): Promise<{ success: boolean; exists?: boolean; error?: string }>
  }
  fileServer: {
    getUrl(
      projectId: string,
      projectPath: string,
      filePath: string
    ): Promise<{ success: boolean; url?: string; error?: string }>
    stop(projectId: string): Promise<{ success: boolean; error?: string }>
    getStats(): Promise<{
      success: boolean
      stats?: {
        activeServers: number
        maxServers: number
        projects: Array<{ projectId: string; port: number; lastAccessed: Date }>
      }
      error?: string
    }>
  }
  app: {
    onError(callback: (error: { message: string; stack?: string }) => void): () => void
  }
  plugins: {
    list(): Promise<{ success: boolean; plugins?: Plugin[]; error?: string }>
    install(pluginId: string): Promise<{ success: boolean; error?: string }>
    update(pluginId: string): Promise<{ success: boolean; error?: string }>
    remove(pluginId: string): Promise<{ success: boolean; error?: string }>
    configure(
      pluginId: string,
      config: Record<string, unknown>
    ): Promise<{ success: boolean; error?: string }>
    getInstallCommand(pluginId: string): Promise<{ success: boolean; command?: string; error?: string }>
    getUpdateCommand(pluginId: string): Promise<{ success: boolean; command?: string; error?: string }>
    getCheckUpdateCommand(pluginId: string): Promise<{ success: boolean; command?: string; error?: string }>
    onInstallProgress(callback: (progress: PluginInstallProgress) => void): () => void
    onUpdateProgress(callback: (progress: PluginUpdateProgress) => void): () => void
    onAutoUpdateAvailable(callback: (data: { pluginId: string; pluginName: string }) => void): () => void
    onInitialized(callback: () => void): () => void
  }
  update: {
    check(): Promise<{
      success: boolean;
      hasUpdate?: boolean;
      updateInfo?: {
        version: string;
        releaseDate: string;
        changelog: string[];
      };
      error?: string;
    }>
    download(): Promise<{ success: boolean; error?: string }>
    onAvailable(callback: (data: {
      currentVersion: string;
      latestVersion: string;
      changelog: string[];
      releaseDate: string;
    }) => void): () => void
  }
}

declare global {
  interface Window {
    api: API
  }
}
