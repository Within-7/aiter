import path from 'path';
import { app } from 'electron';
import fs from 'fs-extra';

export interface NodeInfo {
  version: string;
  nodePath: string;
  npmPath: string;
}

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
   * 获取终端环境变量（包含内置 Node.js 路径）
   */
  getTerminalEnv(): NodeJS.ProcessEnv {
    const binPath = this.getNodeBinPath();
    const rootPath = this.getNodeRootPath();
    const delimiter = this.platform === 'win32' ? ';' : ':';

    // 构建新的 PATH，将内置 Node.js 路径放在最前面
    const newPath = `${binPath}${delimiter}${process.env.PATH || ''}`;

    // Node.js 全局模块路径
    const nodePath = this.platform === 'win32'
      ? path.join(binPath, 'node_modules')
      : path.join(binPath, '../lib/node_modules');

    // npm 全局安装路径配置
    // 这确保 npm install -g 会安装到 AiTer 的 Node.js 目录
    const npmPrefix = rootPath;
    const npmConfig = path.join(rootPath, '.npmrc');

    return {
      ...process.env,
      PATH: newPath,
      NODE_PATH: nodePath,
      // 设置 npm 全局安装前缀，使 npm install -g 安装到 AiTer 的 Node.js
      npm_config_prefix: npmPrefix,
      // 可选：设置 npm 缓存目录到 AiTer 数据目录
      npm_config_cache: path.join(this.nodejsDir, '.npm-cache'),
      // 禁用 nvm，防止它覆盖我们的 Node.js 配置
      NVM_DIR: undefined,
      // 告诉 shell 不要初始化版本管理器
      SKIP_NVM_INIT: '1',
    };
  }

  /**
   * 安装内置 Node.js（从预打包的资源复制）
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
          path.join(process.resourcesPath, 'nodejs', this.getPlatformId()),
          path.join(app.getAppPath(), 'resources', 'nodejs', this.getPlatformId()),
        ];

        resourcesPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
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

      // 复制文件
      console.log(`[NodeManager] Copying to: ${targetPath}`);
      await fs.copy(resourcesPath, targetPath, {
        overwrite: true,
        preserveTimestamps: true,
      });

      // Unix 系统：设置可执行权限
      if (this.platform !== 'win32') {
        const nodePath = this.getNodeExecutable();
        const npmPath = this.getNpmExecutable();
        await fs.chmod(nodePath, 0o755);
        await fs.chmod(npmPath, 0o755);
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
}
