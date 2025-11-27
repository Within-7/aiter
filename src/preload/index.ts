import { contextBridge, ipcRenderer } from 'electron'
import { Project, Terminal, AppSettings, FileNode } from '../types'

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
  app: {
    onError(callback: (error: { message: string; stack?: string }) => void): () => void
  }
}

declare global {
  interface Window {
    api: API
  }
}
