import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { app } from 'electron';
import fs from 'fs-extra';
import { AppSettings } from '../../types';
import { VersionManagerDetector } from '../shell/VersionManagerDetector';

export interface NodeInfo {
  version: string;
  nodePath: string;
  npmPath: string;
}

export interface NodeUpgradeResult {
  upgraded: boolean;
  oldVersion: string | null;
  newVersion: string | null;
  reason: string;
}

/**
 * Minimum required Node.js version for MCP compatibility
 * MCP servers often depend on packages requiring Node.js 20.19.0+
 * We use v22.x LTS as the bundled version for best compatibility
 */
const MINIMUM_NODE_VERSION = '22.0.0';

export class NodeManager {
  private nodejsDir: string;
  private platform: string;
  private arch: string;

  constructor() {
    // Node.js 存储在应用数据目录
    this.nodejsDir = path.join(app.getPath('userData'), 'nodejs');
    this.platform = process.platform; // 'darwin' or 'win32'
    this.arch = process.arch; // 'x64' or 'arm64'
  }

  /**
   * 获取平台标识符 (darwin-x64, darwin-arm64, win32-x64)
   */
  getPlatformId(): string {
    return `${this.platform}-${this.arch}`;
  }

  /**
   * 获取内置 Node.js 的根目录
   */
  getNodeRootPath(): string {
    return path.join(this.nodejsDir, this.getPlatformId());
  }

  /**
   * 获取内置 Node.js 的 bin 路径
   */
  getNodeBinPath(): string {
    const rootPath = this.getNodeRootPath();
    // Windows: node.exe 直接在根目录
    // macOS/Linux: 在 bin/ 子目录
    const binDir = this.platform === 'win32' ? '' : 'bin';
    return path.join(rootPath, binDir);
  }

  /**
   * 获取 node 可执行文件路径
   */
  getNodeExecutable(): string {
    const binPath = this.getNodeBinPath();
    const exeName = this.platform === 'win32' ? 'node.exe' : 'node';
    return path.join(binPath, exeName);
  }

  /**
   * 获取 npm 可执行文件路径
   */
  getNpmExecutable(): string {
    const binPath = this.getNodeBinPath();
    const exeName = this.platform === 'win32' ? 'npm.cmd' : 'npm';
    return path.join(binPath, exeName);
  }

  /**
   * 检查内置 Node.js 是否已安装
   */
  async isInstalled(): Promise<boolean> {
    try {
      const nodePath = this.getNodeExecutable();
      const exists = await fs.pathExists(nodePath);
      if (!exists) return false;

      // 检查是否可执行
      const stats = await fs.stat(nodePath);
      return stats.isFile();
    } catch (error) {
      console.error('[NodeManager] Error checking installation:', error);
      return false;
    }
  }

  /**
   * 获取内置 Node.js 版本信息
   */
  async getNodeInfo(): Promise<NodeInfo | null> {
    try {
      const nodePath = this.getNodeExecutable();
      const npmPath = this.getNpmExecutable();

      if (!(await fs.pathExists(nodePath))) {
        return null;
      }

      // 执行 node --version 获取版本
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      const { stdout } = await execFileAsync(nodePath, ['--version']);
      const version = stdout.trim();

      return {
        version,
        nodePath,
        npmPath,
      };
    } catch (error) {
      console.error('[NodeManager] Error getting node info:', error);
      return null;
    }
  }

  /**
   * Get the bundled Node.js version from resources
   */
  async getBundledNodeVersion(): Promise<string | null> {
    try {
      const resourcesPath = this.getResourcesPath();
      if (!resourcesPath || !(await fs.pathExists(resourcesPath))) {
        return null;
      }

      const nodePath = this.platform === 'win32'
        ? path.join(resourcesPath, 'node.exe')
        : path.join(resourcesPath, 'bin', 'node');

      if (!(await fs.pathExists(nodePath))) {
        return null;
      }

      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      const { stdout } = await execFileAsync(nodePath, ['--version']);
      return stdout.trim();
    } catch (error) {
      console.error('[NodeManager] Error getting bundled node version:', error);
      return null;
    }
  }

  /**
   * Parse version string to comparable numbers
   * e.g., "v22.21.1" -> [22, 21, 1]
   */
  private parseVersion(versionStr: string): number[] {
    const cleaned = versionStr.replace(/^v/, '');
    return cleaned.split('.').map(n => parseInt(n, 10) || 0);
  }

  /**
   * Compare two version arrays
   * @returns positive if v1 > v2, negative if v1 < v2, 0 if equal
   */
  private compareVersions(v1: number[], v2: number[]): number {
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      if (num1 !== num2) return num1 - num2;
    }
    return 0;
  }

  /**
   * Check if upgrade is needed based on version comparison
   */
  async needsUpgrade(): Promise<{ needed: boolean; reason: string; installedVersion: string | null; bundledVersion: string | null }> {
    const nodeInfo = await this.getNodeInfo();
    const bundledVersion = await this.getBundledNodeVersion();

    if (!nodeInfo) {
      return {
        needed: true,
        reason: 'Node.js not installed',
        installedVersion: null,
        bundledVersion,
      };
    }

    if (!bundledVersion) {
      return {
        needed: false,
        reason: 'Cannot determine bundled version',
        installedVersion: nodeInfo.version,
        bundledVersion: null,
      };
    }

    const installed = this.parseVersion(nodeInfo.version);
    const bundled = this.parseVersion(bundledVersion);
    const minimum = this.parseVersion(MINIMUM_NODE_VERSION);

    // Check if installed version is below minimum required
    if (this.compareVersions(installed, minimum) < 0) {
      return {
        needed: true,
        reason: `Installed version ${nodeInfo.version} is below minimum required ${MINIMUM_NODE_VERSION} for MCP compatibility`,
        installedVersion: nodeInfo.version,
        bundledVersion,
      };
    }

    // Check if bundled version is newer
    if (this.compareVersions(bundled, installed) > 0) {
      return {
        needed: true,
        reason: `Bundled version ${bundledVersion} is newer than installed ${nodeInfo.version}`,
        installedVersion: nodeInfo.version,
        bundledVersion,
      };
    }

    return {
      needed: false,
      reason: 'Node.js is up to date',
      installedVersion: nodeInfo.version,
      bundledVersion,
    };
  }

  /**
   * Upgrade Node.js to the bundled version if needed
   */
  async upgradeIfNeeded(): Promise<NodeUpgradeResult> {
    const checkResult = await this.needsUpgrade();

    if (!checkResult.needed) {
      return {
        upgraded: false,
        oldVersion: checkResult.installedVersion,
        newVersion: checkResult.installedVersion,
        reason: checkResult.reason,
      };
    }

    console.log(`[NodeManager] Upgrading: ${checkResult.reason}`);

    // Clean npx cache before upgrade to avoid stale package issues
    await this.cleanNpxCache();

    // Perform the upgrade
    const success = await this.installFromResources();

    if (success) {
      const newInfo = await this.getNodeInfo();
      return {
        upgraded: true,
        oldVersion: checkResult.installedVersion,
        newVersion: newInfo?.version || null,
        reason: checkResult.reason,
      };
    }

    return {
      upgraded: false,
      oldVersion: checkResult.installedVersion,
      newVersion: null,
      reason: 'Upgrade failed',
    };
  }

  /**
   * Clean npx cache to fix corrupted packages
   * This is especially important after Node.js version upgrades
   */
  async cleanNpxCache(): Promise<boolean> {
    try {
      const npxCachePath = path.join(this.nodejsDir, '.npm-cache', '_npx');

      if (await fs.pathExists(npxCachePath)) {
        console.log(`[NodeManager] Cleaning npx cache at: ${npxCachePath}`);
        await fs.remove(npxCachePath);
        console.log('[NodeManager] npx cache cleaned successfully');
      }

      return true;
    } catch (error) {
      console.error('[NodeManager] Error cleaning npx cache:', error);
      return false;
    }
  }

  /**
   * Clean entire npm cache
   */
  async cleanNpmCache(): Promise<boolean> {
    try {
      const npmCachePath = path.join(this.nodejsDir, '.npm-cache');

      if (await fs.pathExists(npmCachePath)) {
        console.log(`[NodeManager] Cleaning npm cache at: ${npmCachePath}`);
        await fs.remove(npmCachePath);
        await fs.ensureDir(npmCachePath);
        console.log('[NodeManager] npm cache cleaned successfully');
      }

      return true;
    } catch (error) {
      console.error('[NodeManager] Error cleaning npm cache:', error);
      return false;
    }
  }

  /**
   * Get the resources path for bundled Node.js
   */
  private getResourcesPath(): string | null {
    const isDev = !app.isPackaged;

    if (isDev) {
      return path.join(app.getAppPath(), 'resources', 'nodejs', this.getPlatformId());
    }

    const possiblePaths = [
      path.join(process.resourcesPath, 'nodejs', this.getPlatformId()),
      path.join(app.getAppPath(), '..', 'Resources', 'nodejs', this.getPlatformId()),
      path.join(app.getAppPath(), 'resources', 'nodejs', this.getPlatformId()),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return possiblePaths[0];
  }

  /**
   * 获取终端环境变量（根据设置决定 Node.js 来源和版本管理器处理）
   */
  getTerminalEnv(settings?: AppSettings): NodeJS.ProcessEnv {
    const binPath = this.getNodeBinPath();
    const rootPath = this.getNodeRootPath();
    const delimiter = this.platform === 'win32' ? ';' : ':';

    // 创建环境变量副本
    const env = { ...process.env };

    // 使用默认设置如果未提供
    const nodeSource = settings?.nodeSource ?? 'builtin';
    const preserveVersionManagers = settings?.preserveVersionManagers ?? false;

    // 处理版本管理器环境变量
    if (!preserveVersionManagers) {
      // 删除版本管理器相关的环境变量，防止冲突
      const varsToClean = VersionManagerDetector.getEnvVarsToClean();
      for (const varName of varsToClean) {
        delete env[varName];
      }
    }

    // 根据 nodeSource 设置决定 PATH 和 Node.js 相关变量
    let finalPath = env.PATH || '';
    const result: NodeJS.ProcessEnv = { ...env };

    if (nodeSource === 'builtin') {
      // 使用内置 Node.js：将内置 Node.js 路径放在最前面
      finalPath = `${binPath}${delimiter}${finalPath}`;

      // Node.js 全局模块路径
      const nodePath = this.platform === 'win32'
        ? path.join(binPath, 'node_modules')
        : path.join(binPath, '../lib/node_modules');

      result.NODE_PATH = nodePath;
      result.npm_config_cache = path.join(this.nodejsDir, '.npm-cache');
      // CRITICAL: Always set npm prefix to use bundled Node.js directory
      // This prevents npm from using system-wide configuration (e.g., nvm paths)
      // which can cause installation hangs due to permission issues
      result.npm_config_prefix = rootPath;
      result.AITER_NODE_PATH = binPath;
    } else if (nodeSource === 'system') {
      // 使用系统 Node.js：不修改 PATH，删除我们的 npm 配置
      // 保留系统的 NODE_PATH 和 npm 配置
    } else if (nodeSource === 'auto') {
      // 自动检测：检查系统 Node.js 是否存在
      const hasSystemNode = this.checkSystemNode();
      if (!hasSystemNode) {
        // 系统没有 Node.js，使用内置的
        finalPath = `${binPath}${delimiter}${finalPath}`;
        const nodePath = this.platform === 'win32'
          ? path.join(binPath, 'node_modules')
          : path.join(binPath, '../lib/node_modules');

        result.NODE_PATH = nodePath;
        result.npm_config_cache = path.join(this.nodejsDir, '.npm-cache');
        result.npm_config_prefix = rootPath;
        result.AITER_NODE_PATH = binPath;
      }
      // 如果系统有 Node.js，保持原样
    }

    result.PATH = finalPath;
    // 标记这是 AiTer 的终端环境
    result.AITER_TERMINAL = '1';

    return result;
  }

  /**
   * 检查系统是否安装了 Node.js（不使用内置版本）
   */
  private checkSystemNode(): boolean {
    try {
      // execFileSync is imported at top of file
      // 尝试在不包含我们内置 Node.js 的 PATH 中查找 node
      const originalPath = process.env.PATH || '';
      const binPath = this.getNodeBinPath();

      // 从 PATH 中移除我们的内置 Node.js 路径
      const delimiter = this.platform === 'win32' ? ';' : ':';
      const paths = originalPath.split(delimiter).filter((p: string) => !p.includes(binPath));
      const cleanPath = paths.join(delimiter);

      // 使用干净的 PATH 检查 node 是否存在
      const env = { ...process.env, PATH: cleanPath };

      if (this.platform === 'win32') {
        execFileSync('where', ['node'], { env, stdio: 'ignore' });
      } else {
        execFileSync('which', ['node'], { env, stdio: 'ignore' });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安装内置 Node.js（从预打包的资源复制）
   *
   * IMPORTANT: This method now preserves user-installed npm packages during upgrades.
   * Previously, using overwrite: true would delete all installed packages (minto, claude, etc.)
   * Now we backup and restore the node_modules directory to preserve user packages.
   */
  async installFromResources(): Promise<boolean> {
    try {
      // 开发模式：从 resources 目录
      // 生产模式：从 app.asar.unpacked/resources 或 resources 目录
      const isDev = !app.isPackaged;
      let resourcesPath: string;

      if (isDev) {
        // 开发模式：项目根目录的 resources
        resourcesPath = path.join(app.getAppPath(), 'resources', 'nodejs', this.getPlatformId());
      } else {
        // 生产模式：尝试多个可能的位置
        const possiblePaths = [
          // electron-builder extraResources 默认位置
          path.join(process.resourcesPath, 'nodejs', this.getPlatformId()),
          // 备用位置
          path.join(app.getAppPath(), '..', 'Resources', 'nodejs', this.getPlatformId()),
          path.join(app.getAppPath(), 'resources', 'nodejs', this.getPlatformId()),
        ];

        console.log(`[NodeManager] Searching for Node.js binaries in production mode...`);
        console.log(`[NodeManager] process.resourcesPath: ${process.resourcesPath}`);
        console.log(`[NodeManager] app.getAppPath(): ${app.getAppPath()}`);
        console.log(`[NodeManager] Platform ID: ${this.getPlatformId()}`);

        for (const p of possiblePaths) {
          console.log(`[NodeManager] Checking path: ${p}`);
          if (fs.existsSync(p)) {
            console.log(`[NodeManager] ✓ Found at: ${p}`);
            resourcesPath = p;
            break;
          } else {
            console.log(`[NodeManager] ✗ Not found at: ${p}`);
          }
        }

        if (!resourcesPath) {
          resourcesPath = possiblePaths[0];
          console.warn(`[NodeManager] No valid path found, using default: ${resourcesPath}`);
        }
      }

      console.log(`[NodeManager] Installing from resources: ${resourcesPath}`);

      // 检查资源是否存在
      if (!(await fs.pathExists(resourcesPath))) {
        console.error(`[NodeManager] Resources not found at ${resourcesPath}`);
        return false;
      }

      // 确保目标目录存在
      const targetPath = this.getNodeRootPath();
      await fs.ensureDir(targetPath);

      // ============================================================
      // PRESERVE USER-INSTALLED NPM PACKAGES DURING UPGRADE
      // ============================================================
      // The node_modules directory contains user-installed packages like minto, claude, etc.
      // We need to backup and restore them after copying the new Node.js files.

      const nodeModulesPath = path.join(targetPath, 'lib', 'node_modules');
      const backupPath = path.join(this.nodejsDir, '.node_modules_backup');
      let hasUserPackages = false;

      // Check if there are user-installed packages to preserve
      if (await fs.pathExists(nodeModulesPath)) {
        const packages = await fs.readdir(nodeModulesPath);
        // Bundled packages that come with Node.js
        const bundledPackages = ['corepack', 'npm'];
        const userPackages = packages.filter(pkg => !bundledPackages.includes(pkg));

        if (userPackages.length > 0) {
          hasUserPackages = true;
          console.log(`[NodeManager] Backing up ${userPackages.length} user-installed packages: ${userPackages.join(', ')}`);

          // Backup user packages
          await fs.ensureDir(backupPath);
          for (const pkg of userPackages) {
            const srcPath = path.join(nodeModulesPath, pkg);
            const destPath = path.join(backupPath, pkg);
            await fs.copy(srcPath, destPath, { preserveTimestamps: true });
          }
          console.log('[NodeManager] User packages backed up successfully');
        }
      }

      // Also backup bin symlinks for user packages
      const binPath = this.getNodeBinPath();
      const binBackupPath = path.join(this.nodejsDir, '.bin_backup');
      const userBinLinks: string[] = [];

      if (hasUserPackages && await fs.pathExists(binPath)) {
        const binFiles = await fs.readdir(binPath);
        // Bundled binaries
        const bundledBins = ['node', 'npm', 'npx', 'corepack'];

        await fs.ensureDir(binBackupPath);
        for (const file of binFiles) {
          if (!bundledBins.includes(file)) {
            const srcPath = path.join(binPath, file);
            const destPath = path.join(binBackupPath, file);
            try {
              // Read symlink target before copying
              const stats = await fs.lstat(srcPath);
              if (stats.isSymbolicLink()) {
                const linkTarget = await fs.readlink(srcPath);
                await fs.writeFile(destPath + '.link', linkTarget);
                userBinLinks.push(file);
              } else {
                await fs.copy(srcPath, destPath, { preserveTimestamps: true });
                userBinLinks.push(file);
              }
            } catch (err) {
              console.warn(`[NodeManager] Failed to backup bin file ${file}:`, err);
            }
          }
        }
        if (userBinLinks.length > 0) {
          console.log(`[NodeManager] Backed up ${userBinLinks.length} user bin files: ${userBinLinks.join(', ')}`);
        }
      }

      // 复制文件
      console.log(`[NodeManager] Copying to: ${targetPath}`);
      await fs.copy(resourcesPath, targetPath, {
        overwrite: true,
        preserveTimestamps: true,
      });

      // Restore user packages if we backed them up
      if (hasUserPackages && await fs.pathExists(backupPath)) {
        console.log('[NodeManager] Restoring user-installed packages...');
        const backedUpPackages = await fs.readdir(backupPath);

        for (const pkg of backedUpPackages) {
          const srcPath = path.join(backupPath, pkg);
          const destPath = path.join(nodeModulesPath, pkg);
          await fs.copy(srcPath, destPath, { preserveTimestamps: true });
        }

        console.log(`[NodeManager] Restored ${backedUpPackages.length} user packages`);

        // Clean up backup
        await fs.remove(backupPath);
      }

      // Restore user bin files
      if (userBinLinks.length > 0 && await fs.pathExists(binBackupPath)) {
        console.log('[NodeManager] Restoring user bin files...');

        for (const file of userBinLinks) {
          const linkFile = path.join(binBackupPath, file + '.link');
          const destPath = path.join(binPath, file);

          try {
            if (await fs.pathExists(linkFile)) {
              // Restore symlink
              const linkTarget = await fs.readFile(linkFile, 'utf-8');
              await fs.symlink(linkTarget, destPath);
            } else {
              // Restore regular file
              const srcPath = path.join(binBackupPath, file);
              if (await fs.pathExists(srcPath)) {
                await fs.copy(srcPath, destPath, { preserveTimestamps: true });
              }
            }
          } catch (err) {
            console.warn(`[NodeManager] Failed to restore bin file ${file}:`, err);
          }
        }

        console.log(`[NodeManager] Restored ${userBinLinks.length} user bin files`);

        // Clean up backup
        await fs.remove(binBackupPath);
      }

      // Unix 系统：设置可执行权限
      if (this.platform !== 'win32') {
        const nodePath = this.getNodeExecutable();
        const npmPath = this.getNpmExecutable();
        await fs.chmod(nodePath, 0o755);
        await fs.chmod(npmPath, 0o755);

        // Also set permissions for restored user bin files
        if (userBinLinks.length > 0) {
          for (const file of userBinLinks) {
            const filePath = path.join(binPath, file);
            try {
              if (await fs.pathExists(filePath)) {
                await fs.chmod(filePath, 0o755);
              }
            } catch (err) {
              // Ignore permission errors for symlinks
            }
          }
        }
      }

      console.log('[NodeManager] Installation completed successfully');
      return true;
    } catch (error) {
      console.error('[NodeManager] Error installing from resources:', error);
      return false;
    }
  }

  /**
   * 卸载内置 Node.js
   */
  async uninstall(): Promise<boolean> {
    try {
      const rootPath = this.getNodeRootPath();
      if (await fs.pathExists(rootPath)) {
        await fs.remove(rootPath);
        console.log('[NodeManager] Uninstalled successfully');
      }
      return true;
    } catch (error) {
      console.error('[NodeManager] Error uninstalling:', error);
      return false;
    }
  }

  /**
   * 获取 shell 初始化脚本内容
   * 用户可以添加到 ~/.zshrc 或 ~/.bashrc 以确保 AiTer 的 Node.js 优先级最高
   */
  getShellInitScript(): string {
    return `
# AiTer - Built-in Node.js Configuration
# This ensures AiTer's bundled Node.js is used in AiTer terminals
if [ -n "$AITER_TERMINAL" ]; then
  export PATH="$AITER_NODE_PATH:$PATH"
fi
`.trim();
  }

  /**
   * 获取用户的 shell 配置文件路径
   */
  private getShellConfigPath(): string | null {
    const homeDir = os.homedir();
    const shell = process.env.SHELL || '';

    // Windows 不需要配置
    if (this.platform === 'win32') {
      return null;
    }

    // 检测 shell 类型并返回配置文件路径
    if (shell.includes('zsh')) {
      return path.join(homeDir, '.zshrc');
    } else if (shell.includes('bash')) {
      return path.join(homeDir, '.bashrc');
    }

    // 默认尝试 zsh（macOS 默认）
    return path.join(homeDir, '.zshrc');
  }

  /**
   * 检查 shell 配置文件中是否已包含 AiTer 配置
   */
  async isShellConfigured(): Promise<boolean> {
    try {
      const configPath = this.getShellConfigPath();
      if (!configPath) return true; // Windows 不需要配置

      if (!(await fs.pathExists(configPath))) {
        return false;
      }

      const content = await fs.readFile(configPath, 'utf-8');
      return content.includes('# AiTer - Built-in Node.js Configuration');
    } catch (error) {
      console.error('[NodeManager] Error checking shell config:', error);
      return false;
    }
  }

  /**
   * 自动配置 shell（添加 AiTer 配置到 .zshrc/.bashrc）
   */
  async configureShell(): Promise<boolean> {
    try {
      const configPath = this.getShellConfigPath();
      if (!configPath) {
        console.log('[NodeManager] Windows platform, shell config not needed');
        return true;
      }

      // 检查是否已配置
      if (await this.isShellConfigured()) {
        console.log('[NodeManager] Shell already configured');
        return true;
      }

      // 确保配置文件存在
      await fs.ensureFile(configPath);

      // 读取现有内容
      let existingContent = '';
      if (await fs.pathExists(configPath)) {
        existingContent = await fs.readFile(configPath, 'utf-8');
      }

      // 准备要添加的内容
      const scriptToAdd = '\n\n' + this.getShellInitScript() + '\n';

      // 检查文件末尾是否有换行符
      const needsNewline = existingContent.length > 0 && !existingContent.endsWith('\n');
      const contentToAppend = needsNewline ? '\n' + scriptToAdd : scriptToAdd;

      // 追加到文件末尾
      await fs.appendFile(configPath, contentToAppend);

      console.log(`[NodeManager] Shell configured successfully: ${configPath}`);
      return true;
    } catch (error) {
      console.error('[NodeManager] Error configuring shell:', error);
      return false;
    }
  }
}
