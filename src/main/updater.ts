/**
 * 自动更新模块
 * 使用 electron-updater 实现自动检查、下载和安装更新
 */

import { app, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import log from 'electron-log'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import * as https from 'https'
import * as http from 'http'

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
  | 'installing'
  | 'error'

// GitHub Release 信息
interface GitHubRelease {
  tag_name: string
  published_at: string
  body: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

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
  private downloadedFilePath: string | null = null
  private latestReleaseInfo: GitHubRelease | null = null
  private isScriptUpdateMode = false  // macOS 使用脚本更新模式

  constructor() {
    // 配置 autoUpdater
    autoUpdater.autoDownload = false // 手动控制下载
    autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装
    autoUpdater.allowDowngrade = false // 不允许降级

    // macOS: 完全禁用签名验证（临时方案）
    // 生产环境应该使用代码签名和公证，但目前暂时禁用签名验证以支持未签名应用的更新
    if (process.platform === 'darwin') {
      // 强制跳过签名验证（开发和生产环境都生效）
      autoUpdater.forceDevUpdateConfig = true

      // 额外配置：禁用差量更新（差量更新需要签名）
      autoUpdater.disableDifferentialDownload = true

      // 禁用 Web installer（需要签名）
      autoUpdater.disableWebInstaller = true
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

      // 判断是否是网络错误（静默处理）
      const isNetworkError = this.isNetworkError(error)

      if (isNetworkError) {
        // 网络错误：仅记录日志，不通知用户
        log.warn('[AutoUpdater] Network error detected, will retry later:', error.message)
        // 不清理缓存，以便下次重试时可能继续下载
      } else {
        // 非网络错误：通知用户
        this.sendToRenderer({
          status: 'error',
          error: error.message
        })
        // 发生严重错误时清理缓存
        this.clearUpdateCache()
      }
    })
  }

  /**
   * 判断是否是网络错误
   * 网络错误应该静默处理，不打扰用户
   */
  private isNetworkError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase()

    // 常见的网络错误关键词
    const networkErrorKeywords = [
      'network',
      'enotfound',
      'econnrefused',
      'econnreset',
      'etimedout',
      'timeout',
      'fetch failed',
      'failed to fetch',
      'dns',
      'connection',
      'socket',
      'connect timeout',
      'read timeout',
      'request timeout',
      'net::err',
      'offline'
    ]

    // 检查错误消息是否包含网络错误关键词
    return networkErrorKeywords.some(keyword => errorMessage.includes(keyword))
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
    // 开发环境下跳过更新检查
    if (!app.isPackaged) {
      log.info('[AutoUpdater] Skipping update check in development mode')
      return
    }

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
    // 开发环境下不启动自动更新
    if (!app.isPackaged) {
      log.info('[AutoUpdater] Auto-update disabled in development mode')
      return
    }

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

  // ==========================================
  // 脚本更新模式（用于 macOS 未签名应用）
  // ==========================================

  /**
   * 从 GitHub API 获取最新 Release 信息
   */
  async fetchLatestRelease(): Promise<GitHubRelease | null> {
    const apiUrl = 'https://api.github.com/repos/Within-7/aiter/releases/latest'

    return new Promise((resolve) => {
      const request = https.get(apiUrl, {
        headers: {
          'User-Agent': 'AiTer-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            https.get(redirectUrl, {
              headers: {
                'User-Agent': 'AiTer-Updater',
                'Accept': 'application/vnd.github.v3+json'
              }
            }, (redirectResponse) => {
              let data = ''
              redirectResponse.on('data', chunk => data += chunk)
              redirectResponse.on('end', () => {
                try {
                  resolve(JSON.parse(data))
                } catch {
                  resolve(null)
                }
              })
            }).on('error', () => resolve(null))
            return
          }
        }

        let data = ''
        response.on('data', chunk => data += chunk)
        response.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(null)
          }
        })
      })

      request.on('error', (error) => {
        log.error('[AutoUpdater] Failed to fetch release info:', error)
        resolve(null)
      })

      request.end()
    })
  }

  /**
   * 获取当前平台的下载 URL
   */
  getDownloadUrlForPlatform(release: GitHubRelease): string | null {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'

    let pattern: string
    if (process.platform === 'darwin') {
      // macOS 使用 zip 格式（而不是 dmg，因为 zip 更容易解压）
      pattern = `mac-${arch}.zip`
    } else if (process.platform === 'win32') {
      pattern = `win-${arch}.exe`
    } else {
      return null
    }

    const asset = release.assets.find(a => a.name.includes(pattern))
    return asset ? asset.browser_download_url : null
  }

  /**
   * 使用脚本模式检查更新
   */
  async checkForUpdatesScript(): Promise<void> {
    if (!app.isPackaged) {
      log.info('[AutoUpdater] Skipping script update check in development mode')
      return
    }

    if (this.isCheckingForUpdate) {
      log.info('[AutoUpdater] Already checking for updates')
      return
    }

    this.isCheckingForUpdate = true
    this.isScriptUpdateMode = true

    try {
      this.sendToRenderer({ status: 'checking' })

      const release = await this.fetchLatestRelease()
      if (!release) {
        log.error('[AutoUpdater] Failed to fetch release info')
        this.sendToRenderer({ status: 'error', error: 'Failed to fetch release info' })
        return
      }

      this.latestReleaseInfo = release

      const latestVersion = release.tag_name.replace(/^v/, '')
      const currentVersion = app.getVersion()

      log.info(`[AutoUpdater] Current: ${currentVersion}, Latest: ${latestVersion}`)

      if (this.isNewerVersion(latestVersion, currentVersion)) {
        log.info('[AutoUpdater] Update available:', latestVersion)
        this.sendToRenderer({
          status: 'available',
          info: {
            version: latestVersion,
            releaseDate: release.published_at,
            releaseNotes: release.body
          }
        })
      } else {
        log.info('[AutoUpdater] No update available')
        this.sendToRenderer({
          status: 'not-available',
          info: { version: currentVersion }
        })
      }
    } catch (error) {
      log.error('[AutoUpdater] Check for updates failed:', error)
      if (!this.isNetworkError(error as Error)) {
        this.sendToRenderer({ status: 'error', error: (error as Error).message })
      }
    } finally {
      this.isCheckingForUpdate = false
    }
  }

  /**
   * 比较版本号
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(n => parseInt(n, 10))
    const currentParts = current.split('.').map(n => parseInt(n, 10))

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0
      const c = currentParts[i] || 0
      if (l > c) return true
      if (l < c) return false
    }
    return false
  }

  /**
   * 使用脚本模式下载更新
   */
  async downloadUpdateScript(): Promise<void> {
    if (!this.latestReleaseInfo) {
      throw new Error('No release info available')
    }

    const downloadUrl = this.getDownloadUrlForPlatform(this.latestReleaseInfo)
    if (!downloadUrl) {
      throw new Error('No download URL for current platform')
    }

    log.info('[AutoUpdater] Starting script download:', downloadUrl)

    // 创建下载目录
    const downloadDir = path.join(app.getPath('temp'), 'aiter-update')
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
    }

    const fileName = path.basename(downloadUrl)
    const filePath = path.join(downloadDir, fileName)

    this.sendToRenderer({ status: 'downloading', progress: { percent: 0, bytesPerSecond: 0, total: 0, transferred: 0 } })

    try {
      await this.downloadFile(downloadUrl, filePath, (progress) => {
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

      this.downloadedFilePath = filePath
      this.updateDownloaded = true

      log.info('[AutoUpdater] Download completed:', filePath)
      this.sendToRenderer({
        status: 'downloaded',
        info: {
          version: this.latestReleaseInfo.tag_name.replace(/^v/, ''),
          releaseDate: this.latestReleaseInfo.published_at,
          releaseNotes: this.latestReleaseInfo.body
        }
      })
    } catch (error) {
      log.error('[AutoUpdater] Download failed:', error)
      throw error
    }
  }

  /**
   * 下载文件（支持重定向和进度回调）
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress: (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http
      const file = fs.createWriteStream(destPath)

      let totalSize = 0
      let downloadedSize = 0
      const startTime = Date.now()

      const request = protocol.get(url, {
        headers: { 'User-Agent': 'AiTer-Updater' }
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            fs.unlinkSync(destPath)
            this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          file.close()
          fs.unlinkSync(destPath)
          reject(new Error(`Download failed with status: ${response.statusCode}`))
          return
        }

        totalSize = parseInt(response.headers['content-length'] || '0', 10)

        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          const elapsed = (Date.now() - startTime) / 1000
          const bytesPerSecond = elapsed > 0 ? downloadedSize / elapsed : 0

          onProgress({
            percent: totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0,
            bytesPerSecond,
            total: totalSize,
            transferred: downloadedSize
          })
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve()
        })
      })

      request.on('error', (error) => {
        file.close()
        fs.unlink(destPath, () => {})
        reject(error)
      })

      file.on('error', (error) => {
        file.close()
        fs.unlink(destPath, () => {})
        reject(error)
      })
    })
  }

  /**
   * 使用脚本安装更新并重启
   */
  async installUpdateScript(): Promise<void> {
    if (!this.downloadedFilePath || !fs.existsSync(this.downloadedFilePath)) {
      throw new Error('No downloaded update file')
    }

    log.info('[AutoUpdater] Starting script installation...')
    this.sendToRenderer({ status: 'installing' })

    const appPath = process.platform === 'darwin'
      ? path.dirname(path.dirname(path.dirname(app.getPath('exe'))))  // Get .app path
      : path.dirname(app.getPath('exe'))

    const pid = process.pid

    if (process.platform === 'darwin') {
      await this.runMacOSUpdateScript(pid, this.downloadedFilePath, appPath)
    } else if (process.platform === 'win32') {
      await this.runWindowsUpdateScript(pid, this.downloadedFilePath, appPath)
    }

    // 退出应用，让脚本完成更新
    log.info('[AutoUpdater] Quitting app for update...')
    setTimeout(() => {
      app.quit()
    }, 500)
  }

  /**
   * 运行 macOS 更新脚本
   */
  private async runMacOSUpdateScript(pid: number, downloadPath: string, appPath: string): Promise<void> {
    // 获取更新脚本路径
    let scriptPath: string

    if (app.isPackaged) {
      // 生产环境：脚本在 resources 目录
      scriptPath = path.join(process.resourcesPath, 'scripts', 'update.sh')
    } else {
      // 开发环境：脚本在项目目录
      scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update.sh')
    }

    log.info('[AutoUpdater] Running macOS update script:', scriptPath)
    log.info('[AutoUpdater] Args:', { pid, downloadPath, appPath })

    // 确保脚本可执行
    try {
      fs.chmodSync(scriptPath, '755')
    } catch (error) {
      log.warn('[AutoUpdater] Could not chmod script:', error)
    }

    // 启动独立进程运行脚本
    const child = spawn('/bin/bash', [
      scriptPath,
      pid.toString(),
      downloadPath,
      appPath,
      'true'  // restart
    ], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env }
    })

    child.unref()
    log.info('[AutoUpdater] Update script launched with PID:', child.pid)
  }

  /**
   * 运行 Windows 更新脚本
   */
  private async runWindowsUpdateScript(pid: number, installerPath: string, appPath: string): Promise<void> {
    // 获取更新脚本路径
    let scriptPath: string

    if (app.isPackaged) {
      // 生产环境：脚本在 resources 目录
      scriptPath = path.join(process.resourcesPath, 'scripts', 'update.ps1')
    } else {
      // 开发环境：脚本在项目目录
      scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update.ps1')
    }

    log.info('[AutoUpdater] Running Windows update script:', scriptPath)
    log.info('[AutoUpdater] Args:', { pid, installerPath, appPath })

    // 启动 PowerShell 运行脚本
    const child = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-AppPID', pid.toString(),
      '-InstallerPath', installerPath,
      '-AppPath', appPath,
      '-Restart', '$true',
      '-Silent', '$true'
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })

    child.unref()
    log.info('[AutoUpdater] Update script launched with PID:', child.pid)
  }

  /**
   * 获取下载文件路径
   */
  getDownloadedFilePath(): string | null {
    return this.downloadedFilePath
  }

  /**
   * 是否使用脚本更新模式
   */
  isUsingScriptMode(): boolean {
    return this.isScriptUpdateMode
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
