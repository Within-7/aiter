/**
 * 自动更新模块
 * 使用 electron-updater 实现自动检查、下载和安装更新
 */

import { app, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import log from 'electron-log'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, execFileSync } from 'child_process'
import * as https from 'https'

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

// 更新模式
export type UpdateMode = 'electron-updater' | 'install-script'

export class AutoUpdateManager {
  private mainWindow: BrowserWindow | null = null
  private isCheckingForUpdate = false
  private updateDownloaded = false
  private latestReleaseInfo: GitHubRelease | null = null
  private _isAppSigned: boolean | null = null  // 缓存签名检测结果
  private _updateMode: UpdateMode = 'electron-updater'

  constructor() {
    // 配置 autoUpdater
    autoUpdater.autoDownload = false // 手动控制下载
    autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装
    autoUpdater.allowDowngrade = false // 不允许降级

    // 检测应用签名状态并决定更新模式
    if (process.platform === 'darwin') {
      const isSigned = this.isAppSigned()
      log.info(`[AutoUpdater] App signature status: ${isSigned ? 'signed' : 'unsigned'}`)

      if (isSigned) {
        // 已签名：使用 electron-updater 标准流程，支持差量更新
        this._updateMode = 'electron-updater'
        log.info('[AutoUpdater] Using electron-updater with differential updates')
      } else {
        // 未签名：使用 install.sh 脚本更新
        this._updateMode = 'install-script'
        log.info('[AutoUpdater] Using install.sh script for updates (unsigned app)')

        // 禁用 electron-updater 的 macOS 相关功能
        autoUpdater.forceDevUpdateConfig = true
        autoUpdater.disableDifferentialDownload = true
        autoUpdater.disableWebInstaller = true
      }
    } else if (process.platform === 'win32') {
      // Windows：目前使用标准 electron-updater
      this._updateMode = 'electron-updater'
    }

    // 设置事件监听
    this.setupEventListeners()
  }

  /**
   * 检测应用是否已签名（macOS）
   * 使用 codesign 命令验证签名
   */
  isAppSigned(): boolean {
    // 使用缓存结果
    if (this._isAppSigned !== null) {
      return this._isAppSigned
    }

    // 非 macOS 默认认为已签名（使用标准更新）
    if (process.platform !== 'darwin') {
      this._isAppSigned = true
      return true
    }

    // 开发模式下认为未签名
    if (!app.isPackaged) {
      this._isAppSigned = false
      return false
    }

    try {
      // 获取 .app 路径
      const appPath = path.dirname(path.dirname(path.dirname(app.getPath('exe'))))
      log.info('[AutoUpdater] Checking signature for:', appPath)

      // 使用 codesign -v 验证签名
      // 如果应用已正确签名，此命令将成功退出（退出码 0）
      // 如果未签名或签名无效，将抛出错误
      execFileSync('/usr/bin/codesign', ['-v', '--strict', appPath], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      })

      log.info('[AutoUpdater] App is properly signed')
      this._isAppSigned = true
      return true
    } catch (error) {
      // codesign 返回非 0 退出码，说明未签名或签名无效
      log.info('[AutoUpdater] App is not signed or signature is invalid:', (error as Error).message)
      this._isAppSigned = false
      return false
    }
  }

  /**
   * 获取当前更新模式
   */
  getUpdateMode(): UpdateMode {
    return this._updateMode
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
   * - 开发模式：使用 GitHub API 检查
   * - 未签名应用：使用 GitHub API 检查（install-script 模式）
   * - 已签名应用：使用 electron-updater
   */
  async checkForUpdates(): Promise<void> {
    // 开发环境下使用脚本模式检查（通过 GitHub API）
    if (!app.isPackaged) {
      log.info('[AutoUpdater] Development mode: using GitHub API to check updates')
      await this.checkForUpdatesScript()
      return
    }

    // 未签名应用使用脚本模式检查（通过 GitHub API）
    // 避免 electron-updater 在访问 GitHub Release 时的 404 错误
    if (this._updateMode === 'install-script') {
      log.info('[AutoUpdater] Unsigned app: using GitHub API to check updates')
      await this.checkForUpdatesScript()
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
   * 使用脚本模式检查更新（用于未签名的 macOS 应用和开发环境）
   * 通过 GitHub API 获取最新版本信息
   */
  async checkForUpdatesScript(): Promise<void> {
    if (this.isCheckingForUpdate) {
      log.info('[AutoUpdater] Already checking for updates')
      return
    }

    this.isCheckingForUpdate = true

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
   * 使用 install.sh 脚本安装更新（适用于未签名的 macOS 应用）
   * 这是最简单的更新方式：直接运行 install.sh 脚本完成下载和安装
   */
  async installViaInstallScript(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('installViaInstallScript only works on macOS')
    }

    log.info('[AutoUpdater] Starting install.sh based update...')
    this.sendToRenderer({ status: 'installing' })

    const pid = process.pid

    // 创建一个临时脚本，用于：
    // 1. 等待当前应用退出
    // 2. 运行 install.sh
    // 3. 启动新版本
    const tempScriptPath = path.join(app.getPath('temp'), 'aiter-update-wrapper.sh')

    const wrapperScript = `#!/bin/bash
# AiTer Update Wrapper Script
# Waits for app to exit, runs install.sh, then launches new version

LOG_DIR="$HOME/Library/Logs/AiTer"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/update.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "=========================================="
log "AiTer Update Wrapper Started"
log "Waiting for PID: ${pid}"
log "=========================================="

# Wait for the application to exit
MAX_WAIT=60
WAIT_COUNT=0
while kill -0 ${pid} 2>/dev/null; do
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log "Application did not exit within $MAX_WAIT seconds, force killing..."
        kill -9 ${pid} 2>/dev/null || true
        sleep 2
        break
    fi
done

log "Application has exited, running install.sh..."

# Download and run install.sh
curl -fsSL https://raw.githubusercontent.com/Within-7/aiter/main/scripts/install.sh | bash >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log "Install.sh completed successfully"
else
    log "Install.sh failed"
fi

log "Update wrapper finished"

# Clean up this script
rm -f "${tempScriptPath}"
`

    try {
      // 写入临时脚本
      fs.writeFileSync(tempScriptPath, wrapperScript, { mode: 0o755 })
      log.info('[AutoUpdater] Created wrapper script:', tempScriptPath)

      // 启动独立进程运行脚本
      const child = spawn('/bin/bash', [tempScriptPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
      })

      child.unref()
      log.info('[AutoUpdater] Update wrapper launched with PID:', child.pid)

      // 退出应用，让脚本完成更新
      log.info('[AutoUpdater] Quitting app for update...')
      setTimeout(() => {
        app.quit()
      }, 500)
    } catch (error) {
      log.error('[AutoUpdater] Failed to create/run wrapper script:', error)
      throw error
    }
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
