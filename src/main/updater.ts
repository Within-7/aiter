import { app, shell, BrowserWindow } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string[];
  downloads: {
    mac: {
      arm64: { url: string; size: string; sha256: string };
      x64: { url: string; size: string; sha256: string };
    };
    win: {
      x64: { url: string; size: string; sha256: string };
    };
  };
}

export class UpdateManager {
  private updateCheckUrl: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;
  private updateInfo: UpdateInfo | null = null;

  constructor(updateCheckUrl: string) {
    this.updateCheckUrl = updateCheckUrl;
  }

  /**
   * 启动自动检查更新（每 6 小时检查一次）
   */
  startAutoCheck(window: BrowserWindow) {
    // 立即检查一次
    this.checkForUpdates(window);

    // 设置定时检查（6 小时）
    this.checkInterval = setInterval(() => {
      this.checkForUpdates(window);
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * 停止自动检查
   */
  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 手动检查更新
   */
  async checkForUpdates(window: BrowserWindow): Promise<UpdateInfo | null> {
    try {
      console.log('[UpdateManager] Checking for updates...');

      const updateInfo = await this.fetchUpdateInfo();

      if (!updateInfo) {
        console.log('[UpdateManager] Failed to fetch update info');
        return null;
      }

      this.updateInfo = updateInfo;
      this.lastCheckTime = Date.now();

      const currentVersion = app.getVersion();
      const latestVersion = updateInfo.version;

      console.log(`[UpdateManager] Current version: ${currentVersion}`);
      console.log(`[UpdateManager] Latest version: ${latestVersion}`);

      if (this.isNewerVersion(latestVersion, currentVersion)) {
        console.log('[UpdateManager] New version available!');

        // 通知渲染进程有新版本
        window.webContents.send('update:available', {
          currentVersion,
          latestVersion,
          changelog: updateInfo.changelog,
          releaseDate: updateInfo.releaseDate,
        });

        return updateInfo;
      } else {
        console.log('[UpdateManager] Already up to date');
        return null;
      }
    } catch (error) {
      console.error('[UpdateManager] Check update failed:', error);
      return null;
    }
  }

  /**
   * 获取下载 URL
   */
  getDownloadUrl(): string | null {
    if (!this.updateInfo) {
      return null;
    }

    const platform = process.platform;
    const arch = process.arch;

    try {
      if (platform === 'darwin') {
        if (arch === 'arm64') {
          return this.updateInfo.downloads.mac.arm64.url;
        } else {
          return this.updateInfo.downloads.mac.x64.url;
        }
      } else if (platform === 'win32') {
        return this.updateInfo.downloads.win.x64.url;
      }
    } catch (error) {
      console.error('[UpdateManager] Failed to get download URL:', error);
    }

    return null;
  }

  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<boolean> {
    const downloadUrl = this.getDownloadUrl();

    if (!downloadUrl) {
      console.error('[UpdateManager] No download URL available');
      return false;
    }

    try {
      // 如果是绝对 URL，直接在浏览器中打开
      if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
        await shell.openExternal(downloadUrl);
        return true;
      }

      // 如果是相对 URL，需要拼接完整 URL
      const baseUrl = this.updateCheckUrl.replace('/latest.json', '');
      const fullUrl = `${baseUrl}/${downloadUrl}`;

      await shell.openExternal(fullUrl);
      return true;
    } catch (error) {
      console.error('[UpdateManager] Failed to open download URL:', error);
      return false;
    }
  }

  /**
   * 获取更新信息（从远程服务器）
   */
  private async fetchUpdateInfo(): Promise<UpdateInfo | null> {
    return new Promise((resolve) => {
      const request = https.get(this.updateCheckUrl, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const updateInfo = JSON.parse(data);
            resolve(updateInfo);
          } catch (error) {
            console.error('[UpdateManager] Failed to parse update info:', error);
            resolve(null);
          }
        });
      });

      request.on('error', (error) => {
        console.error('[UpdateManager] Request failed:', error);
        resolve(null);
      });

      request.setTimeout(10000, () => {
        console.error('[UpdateManager] Request timeout');
        request.destroy();
        resolve(null);
      });
    });
  }

  /**
   * 比较版本号（语义化版本）
   */
  private isNewerVersion(latestVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string): number[] => {
      return version
        .replace(/^v/, '')
        .split('.')
        .map((num) => parseInt(num, 10) || 0);
    };

    const latest = parseVersion(latestVersion);
    const current = parseVersion(currentVersion);

    for (let i = 0; i < Math.max(latest.length, current.length); i++) {
      const latestPart = latest[i] || 0;
      const currentPart = current[i] || 0;

      if (latestPart > currentPart) {
        return true;
      } else if (latestPart < currentPart) {
        return false;
      }
    }

    return false;
  }

  /**
   * 获取最后检查时间
   */
  getLastCheckTime(): number {
    return this.lastCheckTime;
  }

  /**
   * 获取当前缓存的更新信息
   */
  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }
}

// 单例
let updateManager: UpdateManager | null = null;

export function initUpdateManager(updateCheckUrl: string): UpdateManager {
  if (!updateManager) {
    updateManager = new UpdateManager(updateCheckUrl);
  }
  return updateManager;
}

export function getUpdateManager(): UpdateManager | null {
  return updateManager;
}
