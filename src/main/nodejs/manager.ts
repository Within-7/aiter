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

    // 创建环境变量副本，移除可能与 nvm/fnm/asdf 冲突的变量
    const env = { ...process.env };

    // 检测用户是否使用版本管理器（nvm/fnm/asdf）
    const hasNvm = !!process.env.NVM_DIR;
    const hasFnm = !!process.env.FNM_DIR;
    const hasAsdf = !!process.env.ASDF_DIR;
    const hasVersionManager = hasNvm || hasFnm || hasAsdf;

    // 删除版本管理器相关的环境变量，防止冲突
    delete env.NVM_DIR;
    delete env.NVM_BIN;
    delete env.NVM_INC;
    delete env.NVM_CD_FLAGS;
    delete env.NVM_RC_VERSION;
    delete env.FNM_DIR;
    delete env.FNM_MULTISHELL_PATH;
    delete env.FNM_VERSION_FILE_STRATEGY;
    delete env.ASDF_DIR;
    delete env.ASDF_DATA_DIR;

    const result: NodeJS.ProcessEnv = {
      ...env,
      PATH: newPath,
      NODE_PATH: nodePath,
      npm_config_cache: path.join(this.nodejsDir, '.npm-cache'),
      // 标记这是 AiTer 的终端环境，用于 shell 初始化脚本检测
      AITER_TERMINAL: '1',
      AITER_NODE_PATH: binPath,
    };

    // 只有在用户没有使用版本管理器时，才设置 npm_config_prefix
    // 这避免了与 nvm 的冲突警告
    if (!hasVersionManager) {
      result.npm_config_prefix = rootPath;
    }

    return result;
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
    const homeDir = require('os').homedir();
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
