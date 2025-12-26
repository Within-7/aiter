/**
 * JetrInstaller
 *
 * Plugin installer for Jetr CLI - AI-powered development tool.
 * Handles installation, updates, and removal via npm.
 *
 * Installation: npm install -g @within-7/jetr
 * Update: npm update -g @within-7/jetr
 * Removal: npm uninstall -g @within-7/jetr
 */

import { NpmPluginInstaller } from './NpmPluginInstaller';
import Store from 'electron-store';

export class JetrInstaller extends NpmPluginInstaller {
  constructor(store: Store, env?: NodeJS.ProcessEnv, npmPath?: string) {
    super({
      store,
      packageName: '@within-7/jetr',
      commandName: 'jetr',
      configStoreKey: 'plugins.jetr.configuration',
      env,
      npmPath,
    });
  }

  /**
   * Validate Jetr-specific configuration
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
