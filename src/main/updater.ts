/**
 * 自动更新模块
 * 使用 electron-updater 实现自动检查、下载和安装更新
 */

import { app, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import log from 'electron-log'
import * as fs from 'fs'
import * as path from 'path'

// 配置日志
autoUpdater.logger = log
log.transports.file.level = 'info'

// 更新状态
export type UpdateStatus =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

// 更新事件数据
export interface UpdateEventData {
  status: UpdateStatus
  info?: {
    version?: string
    releaseDate?: string
    releaseNotes?: string | null
  }
  progress?: {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
  }
  error?: string
}

export class AutoUpdateManager {
  private mainWindow: BrowserWindow | null = null
  private isCheckingForUpdate = false
  private updateDownloaded = false

  constructor() {
    // 配置 autoUpdater
    autoUpdater.autoDownload = false // 手动控制下载
    autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装
    autoUpdater.allowDowngrade = false // 不允许降级

    // macOS: 禁用签名验证（仅用于开发/测试环境）
    // 生产环境应该使用代码签名和公证
    // @ts-ignore - electron-updater 内部属性
    if (process.platform === 'darwin') {
      // 设置为不验证签名
      autoUpdater.forceDevUpdateConfig = true
    }

    // 设置事件监听
    this.setupEventListeners()
  }

  /**
   * 设置主窗口引用（用于发送更新事件）
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 检查更新时
    autoUpdater.on('checking-for-update', () => {
      log.info('[AutoUpdater] Checking for update...')
      this.sendToRenderer({
        status: 'checking'
      })
    })

    // 有可用更新
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('[AutoUpdater] Update available:', info.version)
      this.sendToRenderer({
        status: 'available',
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: typeof info.releaseNotes === 'string'
            ? info.releaseNotes
            : Array.isArray(info.releaseNotes)
              ? info.releaseNotes.map(n => n.note || '').join('\n')
              : null
        }
      })
    })

    // 没有可用更新
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('[AutoUpdater] No update available, current version:', info.version)
      this.sendToRenderer({
        status: 'not-available',
        info: {
          version: info.version
        }
      })
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      log.info(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`)
      this.sendToRenderer({
        status: 'downloading',
        progress: {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          total: progress.total,
          transferred: progress.transferred
        }
      })
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      log.info('[AutoUpdater] Update downloaded:', event.version)
      this.updateDownloaded = true
      this.sendToRenderer({
        status: 'downloaded',
        info: {
          version: event.version,
          releaseDate: event.releaseDate,
          releaseNotes: typeof event.releaseNotes === 'string'
            ? event.releaseNotes
            : Array.isArray(event.releaseNotes)
              ? event.releaseNotes.map(n => n.note || '').join('\n')
              : null
        }
      })
    })

    // 错误
    autoUpdater.on('error', (error: Error) => {
      log.error('[AutoUpdater] Error:', error)
      this.sendToRenderer({
        status: 'error',
        error: error.message
      })
      // 发生错误时清理缓存
      this.clearUpdateCache()
    })
  }

  /**
   * 发送事件到渲染进程
   */
  private sendToRenderer(data: UpdateEventData) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('autoUpdate:status', data)
    }
  }

  /**
   * 检查更新
   */
  async checkForUpdates(): Promise<void> {
    if (this.isCheckingForUpdate) {
      log.info('[AutoUpdater] Already checking for updates')
      return
    }

    this.isCheckingForUpdate = true

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      log.error('[AutoUpdater] Check for updates failed:', error)
    } finally {
      this.isCheckingForUpdate = false
    }
  }

  /**
   * 开始下载更新
   */
  async downloadUpdate(): Promise<void> {
    log.info('[AutoUpdater] Starting download...')
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      log.error('[AutoUpdater] Download failed:', error)
      throw error
    }
  }

  /**
   * 安装更新并重启
   */
  quitAndInstall(): void {
    if (!this.updateDownloaded) {
      log.warn('[AutoUpdater] No update downloaded')
      return
    }

    log.info('[AutoUpdater] Quitting and installing...')

    // 安装前清理旧的更新缓存
    // 注意：安装后的清理会在下次启动时进行，因为应用会立即退出
    this.clearUpdateCache()

    autoUpdater.quitAndInstall(false, true)
  }

  /**
   * 清理更新缓存文件
   */
  private clearUpdateCache(): void {
    try {
      // electron-updater 的缓存目录路径
      // macOS: ~/Library/Caches/<app-name>.ShipIt/
      // Windows: %LOCALAPPDATA%\<app-name>-updater\
      const cacheDir = this.getUpdateCacheDir()

      if (!cacheDir || !fs.existsSync(cacheDir)) {
        log.info('[AutoUpdater] No update cache to clear')
        return
      }

      log.info('[AutoUpdater] Clearing update cache:', cacheDir)

      // 递归删除缓存目录
      this.deleteFolderRecursive(cacheDir)

      log.info('[AutoUpdater] Update cache cleared successfully')
    } catch (error) {
      log.error('[AutoUpdater] Failed to clear update cache:', error)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取更新缓存目录路径
   */
  private getUpdateCacheDir(): string | null {
    const appName = app.getName()

    if (process.platform === 'darwin') {
      // macOS: ~/Library/Caches/com.within7.aiter.ShipIt/
      const homeDir = app.getPath('home')
      return path.join(homeDir, 'Library', 'Caches', `${appName}.ShipIt`)
    } else if (process.platform === 'win32') {
      // Windows: %LOCALAPPDATA%\aiter-updater\
      const localAppData = app.getPath('userData')
      const parentDir = path.dirname(localAppData)
      return path.join(parentDir, `${appName}-updater`)
    }

    return null
  }

  /**
   * 递归删除文件夹
   */
  private deleteFolderRecursive(folderPath: string): void {
    if (!fs.existsSync(folderPath)) {
      return
    }

    const files = fs.readdirSync(folderPath)

    for (const file of files) {
      const curPath = path.join(folderPath, file)

      if (fs.lstatSync(curPath).isDirectory()) {
        // 递归删除子文件夹
        this.deleteFolderRecursive(curPath)
      } else {
        // 删除文件
        fs.unlinkSync(curPath)
      }
    }

    // 删除空文件夹
    fs.rmdirSync(folderPath)
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    return app.getVersion()
  }

  /**
   * 是否有已下载的更新
   */
  hasDownloadedUpdate(): boolean {
    return this.updateDownloaded
  }

  /**
   * 启动自动检查更新（每 6 小时）
   */
  startAutoCheck() {
    // 启动时清理旧的更新缓存（来自上次更新）
    setTimeout(() => {
      this.clearUpdateCache()
    }, 3000)

    // 启动后 10 秒检查一次
    setTimeout(() => {
      this.checkForUpdates()
    }, 10000)

    // 每 6 小时检查一次
    setInterval(() => {
      this.checkForUpdates()
    }, 6 * 60 * 60 * 1000)
  }
}

// 单例
let autoUpdateManager: AutoUpdateManager | null = null

export function initAutoUpdateManager(): AutoUpdateManager {
  if (!autoUpdateManager) {
    autoUpdateManager = new AutoUpdateManager()
  }
  return autoUpdateManager
}

export function getAutoUpdateManager(): AutoUpdateManager | null {
  return autoUpdateManager
}

// ==========================================
// 兼容旧版 UpdateManager（可选，用于回退）
// ==========================================

interface LegacyUpdateInfo {
  version: string
  releaseDate: string
  changelog: string[]
  downloads: {
    mac: {
      arm64: { url: string; size: string; sha256: string }
      x64: { url: string; size: string; sha256: string }
    }
    win: {
      x64: { url: string; size: string; sha256: string }
    }
  }
}

/**
 * @deprecated 使用 AutoUpdateManager 代替
 */
export class UpdateManager {
  private updateCheckUrl: string
  private checkInterval: NodeJS.Timeout | null = null
  private lastCheckTime: number = 0
  private updateInfo: LegacyUpdateInfo | null = null

  constructor(updateCheckUrl: string) {
    this.updateCheckUrl = updateCheckUrl
  }

  startAutoCheck(window: BrowserWindow) {
    this.checkForUpdates(window)
    this.checkInterval = setInterval(() => {
      this.checkForUpdates(window)
    }, 6 * 60 * 60 * 1000)
  }

  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  async checkForUpdates(window: BrowserWindow): Promise<LegacyUpdateInfo | null> {
    // 使用新的 AutoUpdateManager
    const manager = getAutoUpdateManager()
    if (manager) {
      manager.setMainWindow(window)
      await manager.checkForUpdates()
    }
    return null
  }

  getDownloadUrl(): string | null {
    return null
  }

  async downloadUpdate(): Promise<boolean> {
    const manager = getAutoUpdateManager()
    if (manager) {
      try {
        await manager.downloadUpdate()
        return true
      } catch {
        return false
      }
    }
    return false
  }

  getLastCheckTime(): number {
    return this.lastCheckTime
  }

  getUpdateInfo(): LegacyUpdateInfo | null {
    return this.updateInfo
  }
}

let updateManager: UpdateManager | null = null

export function initUpdateManager(updateCheckUrl: string): UpdateManager {
  if (!updateManager) {
    updateManager = new UpdateManager(updateCheckUrl)
  }
  return updateManager
}

export function getUpdateManager(): UpdateManager | null {
  return updateManager
}
