/**
 * NpmPluginInstaller
 *
 * Base class for plugins installed via npm (global installation).
 * Provides standard implementation for installation, updates, and removal.
 *
 * Usage:
 * ```typescript
 * export class MyPluginInstaller extends NpmPluginInstaller {
 *   constructor(store: Store) {
 *     super({
 *       store,
 *       packageName: '@my-org/my-package',
 *       commandName: 'my-command'
 *     })
 *   }
 * }
 * ```
 */

import { PluginInstaller, ProgressCallback } from '../../../types/plugin';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Store from 'electron-store';

const execFileAsync = promisify(execFile);

interface NpmPluginInstallerOptions {
  /** electron-store instance for configuration persistence */
  store: Store;
  /** NPM package name (e.g., '@within-7/minto') */
  packageName: string;
  /** Command name to check installation (e.g., 'minto') */
  commandName: string;
  /** Config store key prefix (default: 'plugins.{commandName}') */
  configStoreKey?: string;
  /** Environment variables for command execution (should include PATH from NodeManager) */
  env?: NodeJS.ProcessEnv;
}

interface NpmPackageInfo {
  version: string;
  [key: string]: unknown;
}

interface NpmListOutput {
  dependencies?: {
    [packageName: string]: NpmPackageInfo;
  };
}

export abstract class NpmPluginInstaller implements PluginInstaller {
  protected store: Store;
  protected packageName: string;
  protected commandName: string;
  protected configStoreKey: string;
  protected env: NodeJS.ProcessEnv;

  constructor(options: NpmPluginInstallerOptions) {
    this.store = options.store;
    this.packageName = options.packageName;
    this.commandName = options.commandName;
    this.configStoreKey = options.configStoreKey || `plugins.${this.commandName}.configuration`;
    // Use provided env or fallback to process.env
    this.env = options.env || process.env;
  }

  /**
   * Check if the plugin is installed globally via npm
   * Uses `which` (Unix) or `where` (Windows) to check if command exists
   */
  async checkInstallation(): Promise<boolean> {
    try {
      const command = process.platform === 'win32' ? 'where' : 'which';
      console.log(`[NpmPluginInstaller] Checking installation for ${this.commandName}`);
      console.log(`[NpmPluginInstaller] Command: ${command} ${this.commandName}`);
      console.log(`[NpmPluginInstaller] PATH: ${this.env.PATH?.substring(0, 200)}...`);

      const { stdout, stderr } = await execFileAsync(command, [this.commandName], { env: this.env });
      console.log(`[NpmPluginInstaller] ${command} ${this.commandName} stdout:`, stdout.trim());
      if (stderr) {
        console.log(`[NpmPluginInstaller] ${command} ${this.commandName} stderr:`, stderr.trim());
      }
      return true;
    } catch (error) {
      console.error(`[NpmPluginInstaller] ${this.commandName} not found:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Get current installed version via `npm list -g <package> --json`
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('npm', [
        'list',
        '-g',
        this.packageName,
        '--json',
        '--depth=0'
      ], { env: this.env });

      const data: NpmListOutput = JSON.parse(stdout);
      const packageInfo = data.dependencies?.[this.packageName];

      return packageInfo?.version || null;
    } catch (error) {
      console.error(`[NpmPluginInstaller] Error getting current version for ${this.packageName}:`, error);
      return null;
    }
  }

  /**
   * Get latest available version via `npm view <package> version`
   */
  async getLatestVersion(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('npm', ['view', this.packageName, 'version'], { env: this.env });
      return stdout.trim() || null;
    } catch (error) {
      console.error(`[NpmPluginInstaller] Error getting latest version for ${this.packageName}:`, error);
      return null;
    }
  }

  /**
   * Install the plugin globally via `npm install -g <package>`
   */
  async install(progressCallback?: ProgressCallback): Promise<void> {
    progressCallback?.({
      phase: 'checking',
      percentage: 0,
      message: 'Checking prerequisites...',
    });

    // Check if already installed
    const isInstalled = await this.checkInstallation();
    if (isInstalled) {
      throw new Error(`${this.commandName} is already installed. Use update instead.`);
    }

    progressCallback?.({
      phase: 'installing',
      percentage: 30,
      message: `Installing ${this.packageName}...`,
    });

    try {
      // Install globally with npm
      await execFileAsync('npm', ['install', '-g', this.packageName], {
        maxBuffer: 10 * 1024 * 1024,
        env: this.env,
      });

      progressCallback?.({
        phase: 'verifying',
        percentage: 80,
        message: 'Verifying installation...',
      });

      // Verify installation
      const isNowInstalled = await this.checkInstallation();
      if (!isNowInstalled) {
        throw new Error(`Installation completed but ${this.commandName} command not found`);
      }

      progressCallback?.({
        phase: 'complete',
        percentage: 100,
        message: 'Installation complete',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to install ${this.packageName}: ${message}`);
    }
  }

  /**
   * Update the plugin to latest version via `npm update -g <package>`
   */
  async update(progressCallback?: ProgressCallback): Promise<void> {
    progressCallback?.({
      phase: 'checking',
      percentage: 0,
      message: 'Checking current installation...',
    });

    // Check if installed
    const isInstalled = await this.checkInstallation();
    if (!isInstalled) {
      throw new Error(`${this.commandName} is not installed. Use install instead.`);
    }

    const currentVersion = await this.getCurrentVersion();

    progressCallback?.({
      phase: 'fetching',
      percentage: 20,
      message: 'Checking for updates...',
    });

    // Get latest version
    const latestVersion = await this.getLatestVersion();
    if (!latestVersion) {
      throw new Error('Could not determine latest version');
    }

    if (currentVersion === latestVersion) {
      progressCallback?.({
        phase: 'complete',
        percentage: 100,
        message: 'Already up to date',
      });
      return;
    }

    progressCallback?.({
      phase: 'updating',
      percentage: 40,
      message: `Updating to version ${latestVersion}...`,
    });

    try {
      // Update globally with npm
      await execFileAsync('npm', ['update', '-g', this.packageName], {
        maxBuffer: 10 * 1024 * 1024,
        env: this.env,
      });

      progressCallback?.({
        phase: 'verifying',
        percentage: 80,
        message: 'Verifying update...',
      });

      // Verify new version
      const newVersion = await this.getCurrentVersion();
      if (newVersion !== latestVersion) {
        console.warn(
          `[NpmPluginInstaller] Version mismatch after update: expected ${latestVersion}, got ${newVersion}`
        );
      }

      progressCallback?.({
        phase: 'complete',
        percentage: 100,
        message: 'Update complete',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update ${this.packageName}: ${message}`);
    }
  }

  /**
   * Remove the plugin via `npm uninstall -g <package>`
   */
  async remove(progressCallback?: ProgressCallback): Promise<void> {
    progressCallback?.({
      phase: 'checking',
      percentage: 0,
      message: 'Checking installation...',
    });

    const isInstalled = await this.checkInstallation();
    if (!isInstalled) {
      throw new Error(`${this.commandName} is not installed`);
    }

    progressCallback?.({
      phase: 'removing',
      percentage: 40,
      message: `Removing ${this.packageName}...`,
    });

    try {
      // Uninstall globally with npm
      await execFileAsync('npm', ['uninstall', '-g', this.packageName], {
        maxBuffer: 10 * 1024 * 1024,
        env: this.env,
      });

      progressCallback?.({
        phase: 'verifying',
        percentage: 80,
        message: 'Verifying removal...',
      });

      // Verify removal
      const isStillInstalled = await this.checkInstallation();
      if (isStillInstalled) {
        throw new Error(`Removal completed but ${this.commandName} command still found`);
      }

      progressCallback?.({
        phase: 'complete',
        percentage: 100,
        message: 'Removal complete',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to remove ${this.packageName}: ${message}`);
    }
  }

  /**
   * Configure plugin settings
   * Base implementation saves to electron-store
   */
  async configure(config: Record<string, unknown>): Promise<void> {
    this.store.set(this.configStoreKey, config);
  }

  /**
   * Get current configuration
   */
  async getConfiguration(): Promise<Record<string, unknown>> {
    return this.store.get(this.configStoreKey, {}) as Record<string, unknown>;
  }

  /**
   * Validate configuration
   * Base implementation always returns true
   * Override in subclass for custom validation
   */
  async validateConfiguration(_config: Record<string, unknown>): Promise<boolean | string> {
    return true;
  }

  /**
   * Get install command for terminal execution
   */
  async getInstallCommand(): Promise<string> {
    return `npm install -g ${this.packageName}`;
  }

  /**
   * Get update command for terminal execution
   */
  async getUpdateCommand(): Promise<string> {
    return `npm update -g ${this.packageName}`;
  }

  /**
   * Get check update command for terminal execution
   */
  async getCheckUpdateCommand(): Promise<string> {
    return `npm outdated -g ${this.packageName}`;
  }
}
