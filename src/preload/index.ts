import { contextBridge, ipcRenderer } from 'electron'
import { Project, Terminal, AppSettings, FileNode, Plugin, PluginInstallProgress, PluginUpdateProgress, GitStatus, GitCommit, FileChange, DetectedShell, VersionManagerInfo, ShellType, Workspace, SessionState } from '../types'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Project APIs
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    add: (path: string, name?: string) =>
      ipcRenderer.invoke('project:add', { path, name }),
    remove: (id: string) => ipcRenderer.invoke('project:remove', { id }),
    reorder: (projectIds: string[]) =>
      ipcRenderer.invoke('projects:reorder', { projectIds }),
    onUpdated: (callback: (projects: Project[]) => void) => {
      const listener = (_: unknown, { projects }: { projects: Project[] }) =>
        callback(projects)
      ipcRenderer.on('projects:updated', listener)
      return () => ipcRenderer.removeListener('projects:updated', listener)
    }
  },

  // Terminal APIs
  terminal: {
    create: (cwd: string, projectId: string, projectName: string, shell?: string, skipStartupCommand?: boolean) =>
      ipcRenderer.invoke('terminal:create', { cwd, projectId, projectName, shell, skipStartupCommand }),
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
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openFiles: () => ipcRenderer.invoke('dialog:openFiles')
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
    fileExists: (path: string) => ipcRenderer.invoke('fs:fileExists', { path }),
    createFile: (path: string, content?: string) =>
      ipcRenderer.invoke('fs:createFile', { path, content }),
    createDirectory: (path: string) =>
      ipcRenderer.invoke('fs:createDirectory', { path }),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs:rename', { oldPath, newPath }),
    delete: (path: string) =>
      ipcRenderer.invoke('fs:delete', { path }),
    copyFiles: (sourcePaths: string[], destDir: string) =>
      ipcRenderer.invoke('fs:copyFiles', { sourcePaths, destDir })
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
    },
    getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads'): Promise<string> =>
      ipcRenderer.invoke('app:getPath', { name })
  },

  // Window APIs
  window: {
    create: () => ipcRenderer.invoke('window:create')
  },

  // Shell APIs
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', { url }),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', { path }),
    // Shell detection APIs
    detectAvailable: (): Promise<{ success: boolean; shells?: DetectedShell[]; error?: string }> =>
      ipcRenderer.invoke('shell:detectAvailable'),
    getConfigFiles: (shellType: ShellType): Promise<{ success: boolean; files?: string[]; error?: string }> =>
      ipcRenderer.invoke('shell:getConfigFiles', { shellType }),
    getDefaultShell: (): Promise<{ success: boolean; defaultShell?: string; error?: string }> =>
      ipcRenderer.invoke('shell:getDefaultShell')
  },

  // Version Manager APIs
  versionManager: {
    detect: (): Promise<{ success: boolean; managers?: VersionManagerInfo[]; error?: string }> =>
      ipcRenderer.invoke('versionManager:detect'),
    getDetected: (): Promise<{ success: boolean; managers?: VersionManagerInfo[]; error?: string }> =>
      ipcRenderer.invoke('versionManager:getDetected')
  },

  // Menu APIs
  menu: {
    onShowAbout: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:show-about', listener)
      return () => ipcRenderer.removeListener('menu:show-about', listener)
    },
    onShowSettings: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:show-settings', listener)
      return () => ipcRenderer.removeListener('menu:show-settings', listener)
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
    checkForUpdate: (pluginId: string) =>
      ipcRenderer.invoke('plugins:checkForUpdate', { pluginId }),
    refreshStatus: () => ipcRenderer.invoke('plugins:refreshStatus'),
    addCustom: (urlOrPackageName: string) =>
      ipcRenderer.invoke('plugins:addCustom', { urlOrPackageName }),
    removeCustom: (pluginId: string) =>
      ipcRenderer.invoke('plugins:removeCustom', { pluginId }),
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
    },
    onStatusChanged: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('plugins:status-changed', listener)
      return () => ipcRenderer.removeListener('plugins:status-changed', listener)
    }
  },

  // Auto-Update APIs
  autoUpdate: {
    check: () => ipcRenderer.invoke('autoUpdate:check'),
    download: () => ipcRenderer.invoke('autoUpdate:download'),
    install: () => ipcRenderer.invoke('autoUpdate:install'),
    getVersion: () => ipcRenderer.invoke('autoUpdate:getVersion'),
    onStatus: (callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
      info?: {
        version?: string;
        releaseDate?: string;
        releaseNotes?: string | null;
      };
      progress?: {
        percent: number;
        bytesPerSecond: number;
        total: number;
        transferred: number;
      };
      error?: string;
    }) => void) => {
      const listener = (_: unknown, data: {
        status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        info?: {
          version?: string;
          releaseDate?: string;
          releaseNotes?: string | null;
        };
        progress?: {
          percent: number;
          bytesPerSecond: number;
          total: number;
          transferred: number;
        };
        error?: string;
      }) => callback(data)
      ipcRenderer.on('autoUpdate:status', listener)
      return () => ipcRenderer.removeListener('autoUpdate:status', listener)
    }
  },

  // Legacy Update APIs (for backward compatibility)
  update: {
    check: () => ipcRenderer.invoke('autoUpdate:check'),
    download: () => ipcRenderer.invoke('autoUpdate:download'),
    onAvailable: (callback: (data: {
      currentVersion: string;
      latestVersion: string;
      changelog: string[];
      releaseDate: string;
    }) => void) => {
      // Map new status events to old format
      const listener = (_: unknown, data: {
        status: string;
        info?: { version?: string; releaseDate?: string; releaseNotes?: string | null };
      }) => {
        if (data.status === 'available' && data.info) {
          callback({
            currentVersion: '',
            latestVersion: data.info.version || '',
            changelog: data.info.releaseNotes ? data.info.releaseNotes.split('\n') : [],
            releaseDate: data.info.releaseDate || ''
          })
        }
      }
      ipcRenderer.on('autoUpdate:status', listener)
      return () => ipcRenderer.removeListener('autoUpdate:status', listener)
    }
  },

  // Node.js management APIs
  nodejs: {
    checkBuiltin: () => ipcRenderer.invoke('nodejs:checkBuiltin'),
    checkSystem: () => ipcRenderer.invoke('nodejs:checkSystem'),
    install: () => ipcRenderer.invoke('nodejs:install'),
    download: (version: string) => ipcRenderer.invoke('nodejs:download', { version }),
    getRecommendedVersion: () => ipcRenderer.invoke('nodejs:getRecommendedVersion'),
    uninstall: () => ipcRenderer.invoke('nodejs:uninstall'),
    // Cache management for MCP compatibility
    cleanNpxCache: () => ipcRenderer.invoke('nodejs:cleanNpxCache'),
    cleanNpmCache: () => ipcRenderer.invoke('nodejs:cleanNpmCache'),
    // Version upgrade management
    checkUpgrade: () => ipcRenderer.invoke('nodejs:checkUpgrade'),
    upgrade: () => ipcRenderer.invoke('nodejs:upgrade'),
    onDownloadProgress: (callback: (progress: {
      percent: number;
      downloaded: number;
      total: number;
      status: 'downloading' | 'extracting' | 'complete' | 'error';
      message?: string;
    }) => void) => {
      const listener = (_: unknown, progress: {
        percent: number;
        downloaded: number;
        total: number;
        status: 'downloading' | 'extracting' | 'complete' | 'error';
        message?: string;
      }) => callback(progress)
      ipcRenderer.on('nodejs:download-progress', listener)
      return () => ipcRenderer.removeListener('nodejs:download-progress', listener)
    }
  },

  // Git management APIs
  git: {
    getStatus: (projectPath: string) =>
      ipcRenderer.invoke('git:getStatus', { projectPath }),
    getRecentCommits: (projectPath: string, count?: number) =>
      ipcRenderer.invoke('git:getRecentCommits', { projectPath, count }),
    initRepo: (projectPath: string) =>
      ipcRenderer.invoke('git:initRepo', { projectPath }),
    getFileChanges: (projectPath: string) =>
      ipcRenderer.invoke('git:getFileChanges', { projectPath }),
    commitAll: (projectPath: string, message: string) =>
      ipcRenderer.invoke('git:commitAll', { projectPath, message }),
    getBranches: (projectPath: string) =>
      ipcRenderer.invoke('git:getBranches', { projectPath }),
    createBranch: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:createBranch', { projectPath, branchName }),
    switchBranch: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:switchBranch', { projectPath, branchName }),
    deleteBranch: (projectPath: string, branchName: string, force?: boolean) =>
      ipcRenderer.invoke('git:deleteBranch', { projectPath, branchName, force }),
    pull: (projectPath: string) =>
      ipcRenderer.invoke('git:pull', { projectPath }),
    push: (projectPath: string) =>
      ipcRenderer.invoke('git:push', { projectPath }),
    fetch: (projectPath: string) =>
      ipcRenderer.invoke('git:fetch', { projectPath }),
    stageFile: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:stageFile', { projectPath, filePath }),
    unstageFile: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:unstageFile', { projectPath, filePath }),
    getFileDiff: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getFileDiff', { projectPath, filePath }),
    getCommitFiles: (projectPath: string, commitHash: string) =>
      ipcRenderer.invoke('git:getCommitFiles', { projectPath, commitHash }),
    getCommitFileDiff: (projectPath: string, commitHash: string, filePath: string) =>
      ipcRenderer.invoke('git:getCommitFileDiff', { projectPath, commitHash, filePath })
  },

  // Workspace APIs
  workspace: {
    getCurrent: () => ipcRenderer.invoke('workspace:getCurrent'),
    list: () => ipcRenderer.invoke('workspace:list'),
    create: (name: string, projectIds?: string[]) =>
      ipcRenderer.invoke('workspace:create', { name, projectIds }),
    update: (id: string, updates: Partial<Workspace>) =>
      ipcRenderer.invoke('workspace:update', { id, updates }),
    delete: (id: string) => ipcRenderer.invoke('workspace:delete', { id }),
    launch: (workspaceId: string) =>
      ipcRenderer.invoke('workspace:launch', { workspaceId }),
    setProjectVisibility: (projectId: string, visible: boolean) =>
      ipcRenderer.invoke('workspace:setProjectVisibility', { projectId, visible }),
    getAllProjects: () => ipcRenderer.invoke('workspace:getAllProjects')
  },

  // File Watcher APIs
  fileWatcher: {
    watch: (projectPath: string) =>
      ipcRenderer.invoke('fileWatcher:watch', { projectPath }),
    unwatch: (projectPath: string) =>
      ipcRenderer.invoke('fileWatcher:unwatch', { projectPath }),
    isWatching: (projectPath: string) =>
      ipcRenderer.invoke('fileWatcher:isWatching', { projectPath }),
    onChanged: (callback: (data: { projectPath: string; changeCount: number }) => void) => {
      const listener = (_: unknown, data: { projectPath: string; changeCount: number }) =>
        callback(data)
      ipcRenderer.on('fileWatcher:changed', listener)
      return () => ipcRenderer.removeListener('fileWatcher:changed', listener)
    }
  },

  // Session APIs
  session: {
    save: (session: SessionState) =>
      ipcRenderer.invoke('session:save', { session }),
    get: () => ipcRenderer.invoke('session:get'),
    clear: () => ipcRenderer.invoke('session:clear')
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
    reorder(projectIds: string[]): Promise<{ success: boolean; projects?: Project[]; error?: string }>
    onUpdated(callback: (projects: Project[]) => void): () => void
  }
  terminal: {
    create(
      cwd: string,
      projectId: string,
      projectName: string,
      shell?: string,
      skipStartupCommand?: boolean
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
    openFiles(): Promise<{
      success: boolean
      data?: { paths: string[] } | null
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
    createFile(
      path: string,
      content?: string
    ): Promise<{ success: boolean; error?: string }>
    createDirectory(
      path: string
    ): Promise<{ success: boolean; error?: string }>
    rename(
      oldPath: string,
      newPath: string
    ): Promise<{ success: boolean; error?: string }>
    delete(
      path: string
    ): Promise<{ success: boolean; error?: string }>
    copyFiles(
      sourcePaths: string[],
      destDir: string
    ): Promise<{ success: boolean; copied?: string[]; errors?: string[]; error?: string }>
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
    getPath(name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads'): Promise<string>
  }
  window: {
    create(): Promise<{ success: boolean; error?: string }>
  }
  shell: {
    openExternal(url: string): Promise<{ success: boolean; error?: string }>
    openPath(path: string): Promise<{ success: boolean; error?: string }>
    detectAvailable(): Promise<{ success: boolean; shells?: DetectedShell[]; error?: string }>
    getConfigFiles(shellType: ShellType): Promise<{ success: boolean; files?: string[]; error?: string }>
    getDefaultShell(): Promise<{ success: boolean; defaultShell?: string; error?: string }>
  }
  versionManager: {
    detect(): Promise<{ success: boolean; managers?: VersionManagerInfo[]; error?: string }>
    getDetected(): Promise<{ success: boolean; managers?: VersionManagerInfo[]; error?: string }>
  }
  menu: {
    onShowAbout(callback: () => void): () => void
    onShowSettings(callback: () => void): () => void
  }
  plugins: {
    list(): Promise<{ success: boolean; plugins?: Plugin[]; error?: string }>
    install(pluginId: string): Promise<{ success: boolean; version?: string; error?: string }>
    update(pluginId: string): Promise<{ success: boolean; version?: string; error?: string }>
    remove(pluginId: string): Promise<{ success: boolean; error?: string }>
    configure(
      pluginId: string,
      config: Record<string, unknown>
    ): Promise<{ success: boolean; error?: string }>
    getInstallCommand(pluginId: string): Promise<{ success: boolean; command?: string; error?: string }>
    getUpdateCommand(pluginId: string): Promise<{ success: boolean; command?: string; error?: string }>
    getCheckUpdateCommand(pluginId: string): Promise<{ success: boolean; command?: string; error?: string }>
    checkForUpdate(pluginId: string): Promise<{ success: boolean; data?: { hasUpdate: boolean; currentVersion: string | null; latestVersion: string | null }; error?: string }>
    refreshStatus(): Promise<{ success: boolean; error?: string }>
    addCustom(urlOrPackageName: string): Promise<{ success: boolean; pluginId?: string; error?: string }>
    removeCustom(pluginId: string): Promise<{ success: boolean; error?: string }>
    onInstallProgress(callback: (progress: PluginInstallProgress) => void): () => void
    onUpdateProgress(callback: (progress: PluginUpdateProgress) => void): () => void
    onAutoUpdateAvailable(callback: (data: { pluginId: string; pluginName: string }) => void): () => void
    onInitialized(callback: () => void): () => void
    onStatusChanged(callback: () => void): () => void
  }
  autoUpdate: {
    check(): Promise<{ success: boolean; error?: string }>
    download(): Promise<{ success: boolean; skipDownload?: boolean; mode?: string; error?: string }>
    install(): Promise<{ success: boolean; mode?: string; command?: string; error?: string }>
    getVersion(): Promise<{ success: boolean; version?: string; error?: string }>
    onStatus(callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
      info?: {
        version?: string;
        releaseDate?: string;
        releaseNotes?: string | null;
      };
      progress?: {
        percent: number;
        bytesPerSecond: number;
        total: number;
        transferred: number;
      };
      error?: string;
    }) => void): () => void
  }
  update: {
    check(): Promise<{ success: boolean; error?: string }>
    download(): Promise<{ success: boolean; error?: string }>
    onAvailable(callback: (data: {
      currentVersion: string;
      latestVersion: string;
      changelog: string[];
      releaseDate: string;
    }) => void): () => void
  }
  nodejs: {
    checkBuiltin(): Promise<{
      success: boolean;
      installed?: boolean;
      info?: {
        version: string;
        nodePath: string;
        npmPath: string;
      } | null;
      error?: string;
    }>
    checkSystem(): Promise<{
      success: boolean;
      systemNode?: {
        installed: boolean;
        version?: string;
        nodePath?: string;
        npmPath?: string;
        npmVersion?: string;
      };
      error?: string;
    }>
    install(): Promise<{ success: boolean; error?: string }>
    download(version: string): Promise<{ success: boolean; error?: string }>
    getRecommendedVersion(): Promise<{ success: boolean; version?: string | null; error?: string }>
    uninstall(): Promise<{ success: boolean; error?: string }>
    // Cache management for MCP compatibility
    cleanNpxCache(): Promise<{ success: boolean; error?: string }>
    cleanNpmCache(): Promise<{ success: boolean; error?: string }>
    // Version upgrade management
    checkUpgrade(): Promise<{
      success: boolean;
      needed?: boolean;
      reason?: string;
      installedVersion?: string | null;
      bundledVersion?: string | null;
      error?: string;
    }>
    upgrade(): Promise<{
      success: boolean;
      upgraded?: boolean;
      oldVersion?: string | null;
      newVersion?: string | null;
      reason?: string;
      error?: string;
    }>
    onDownloadProgress(callback: (progress: {
      percent: number;
      downloaded: number;
      total: number;
      status: 'downloading' | 'extracting' | 'complete' | 'error';
      message?: string;
    }) => void): () => void
  }
  git: {
    getStatus(projectPath: string): Promise<{
      success: boolean;
      status?: GitStatus;
      error?: string;
    }>
    getRecentCommits(projectPath: string, count?: number): Promise<{
      success: boolean;
      commits?: GitCommit[];
      error?: string;
    }>
    initRepo(projectPath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    getFileChanges(projectPath: string): Promise<{
      success: boolean;
      changes?: FileChange[];
      error?: string;
    }>
    commitAll(projectPath: string, message: string): Promise<{
      success: boolean;
      error?: string;
    }>
    getBranches(projectPath: string): Promise<{
      success: boolean;
      branches?: Array<{ name: string; current: boolean }>;
      error?: string;
    }>
    createBranch(projectPath: string, branchName: string): Promise<{
      success: boolean;
      error?: string;
    }>
    switchBranch(projectPath: string, branchName: string): Promise<{
      success: boolean;
      error?: string;
    }>
    deleteBranch(projectPath: string, branchName: string, force?: boolean): Promise<{
      success: boolean;
      error?: string;
    }>
    pull(projectPath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    push(projectPath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    fetch(projectPath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    stageFile(projectPath: string, filePath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    unstageFile(projectPath: string, filePath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    getFileDiff(projectPath: string, filePath: string): Promise<{
      success: boolean;
      diff?: string;
      error?: string;
    }>
    getCommitFiles(projectPath: string, commitHash: string): Promise<{
      success: boolean;
      files?: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }>;
      error?: string;
    }>
    getCommitFileDiff(projectPath: string, commitHash: string, filePath: string): Promise<{
      success: boolean;
      diff?: string;
      error?: string;
    }>
  }
  workspace: {
    getCurrent(): Promise<{
      success: boolean;
      workspace?: Workspace | null;
      error?: string;
    }>
    list(): Promise<{
      success: boolean;
      workspaces?: Workspace[];
      error?: string;
    }>
    create(name: string, projectIds?: string[]): Promise<{
      success: boolean;
      workspace?: Workspace;
      error?: string;
    }>
    update(id: string, updates: Partial<Workspace>): Promise<{
      success: boolean;
      workspace?: Workspace;
      error?: string;
    }>
    delete(id: string): Promise<{
      success: boolean;
      error?: string;
    }>
    launch(workspaceId: string): Promise<{
      success: boolean;
      error?: string;
    }>
    setProjectVisibility(projectId: string, visible: boolean): Promise<{
      success: boolean;
      error?: string;
    }>
    getAllProjects(): Promise<{
      success: boolean;
      projects?: Project[];
      error?: string;
    }>
  }
  fileWatcher: {
    watch(projectPath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    unwatch(projectPath: string): Promise<{
      success: boolean;
      error?: string;
    }>
    isWatching(projectPath: string): Promise<{
      success: boolean;
      watching?: boolean;
      error?: string;
    }>
    onChanged(callback: (data: { projectPath: string; changeCount: number }) => void): () => void
  }
  session: {
    save(session: SessionState): Promise<{
      success: boolean;
      error?: string;
    }>
    get(): Promise<{
      success: boolean;
      session?: SessionState | null;
      error?: string;
    }>
    clear(): Promise<{
      success: boolean;
      error?: string;
    }>
  }
}

declare global {
  interface Window {
    api: API
  }
}
