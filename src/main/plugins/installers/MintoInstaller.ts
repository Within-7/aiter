/**
 * MintoInstaller
 *
 * Plugin installer for Minto CLI - AI-powered code generation tool.
 * Handles installation, updates, and removal via npm.
 *
 * Installation: npm install -g @within-7/minto
 * Update: npm update -g @within-7/minto
 * Removal: npm uninstall -g @within-7/minto
 */

import { NpmPluginInstaller } from './NpmPluginInstaller';
import Store from 'electron-store';

export class MintoInstaller extends NpmPluginInstaller {
  constructor(store: Store, env?: NodeJS.ProcessEnv) {
    super({
      store,
      packageName: '@within-7/minto',
      commandName: 'minto',
      configStoreKey: 'plugins.minto.configuration',
      env,
    });
  }

  /**
   * Validate Minto-specific configuration
   */
  async validateConfiguration(config: Record<string, unknown>): Promise<boolean | string> {
    if (config.autoUpdate !== undefined) {
      if (typeof config.autoUpdate !== 'boolean') {
        return 'autoUpdate must be a boolean';
      }
    }

    return true;
  }
}
