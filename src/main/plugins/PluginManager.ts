/**
 * PluginManager
 *
 * Central orchestrator for all plugin operations in AiTer.
 * Manages plugin lifecycle: registration, installation, updates, removal.
 * Implements auto-update checking every 6 hours.
 */

import {
  Plugin,
  PluginDefinition,
  PluginInstaller,
  PluginStatus,
  PluginListItem,
  PluginInstallResult,
  PluginUpdateCheckResult,
  PluginRegistryEntry,
  ProgressCallback,
} from '../../types/plugin';
import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { NodeManager } from '../nodejs/manager';

interface PluginStoreSchema {
  plugins: {
    registry: Record<string, PluginRegistryEntry>;
  };
}

export class PluginManager {
  private static instance: PluginManager | null = null;

  private plugins: Map<string, Plugin> = new Map();
  private store: Store<PluginStoreSchema>;
  private autoCheckInterval: NodeJS.Timeout | null = null;
  private readonly AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  private mainWindow: BrowserWindow | null = null;
  private initializePromise: Promise<void> | null = null;
  private nodeManager: NodeManager;

  private constructor(store: Store<PluginStoreSchema>) {
    this.store = store;
    this.nodeManager = new NodeManager();
    this.initializeRegistry();
  }

  /**
   * Set the main window for sending events to renderer
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Get singleton instance of PluginManager
   */
  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      const store = new Store<PluginStoreSchema>({
        name: 'plugin-registry'
      });
      PluginManager.instance = new PluginManager(store);
    }
    return PluginManager.instance;
  }

  /**
   * Initialize plugin registry from persistent storage
   */
  private initializeRegistry(): void {
    const registry = this.store.get('plugins.registry', {});
    console.log(`[PluginManager] Initialized with ${Object.keys(registry).length} registered plugins`);
  }

  /**
   * Initialize plugin manager and register built-in plugins
   */
  public async initialize(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = (async () => {
      console.log('[PluginManager] Initializing...');

      // Register Minto CLI plugin
      const { MintoInstaller } = await import('./installers/MintoInstaller');
      const nodeEnv = this.nodeManager.getTerminalEnv();
      console.log('[PluginManager] NodeManager env PATH:', nodeEnv.PATH?.substring(0, 200));
      await this.registerPlugin(
        {
          id: 'minto',
          name: 'Minto CLI',
          description: 'AI-powered CLI tool for chat and code generation in terminal',
          icon: '🤖',
          version: '1.0.0',
          author: 'Within-7',
          homepage: 'https://github.com/Within-7/minto',
          platforms: ['darwin', 'linux', 'win32'],
          tags: ['ai', 'cli', 'chat', 'code-generation']
        } as any,
        new MintoInstaller(this.store as any, nodeEnv)
      );

      console.log('[PluginManager] Initialization complete');

      // Notify renderer that plugins are ready
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          this.mainWindow.webContents.send('plugins:initialized');
        } catch (error) {
          console.warn('[PluginManager] Failed to send plugins:initialized event:', error);
        }
      }
    })();

    return this.initializePromise;
  }

  /**
   * Cleanup plugin manager resources
   */
  public async cleanup(): Promise<void> {
    console.log('[PluginManager] Cleaning up...');
    this.destroy();
  }

  /**
   * Register a new plugin
   *
   * @param definition Plugin metadata
   * @param installer Plugin installer implementation
   */
  public async registerPlugin(
    definition: PluginDefinition,
    installer: PluginInstaller
  ): Promise<void> {
    console.log(`[PluginManager] Registering plugin: ${definition.id}`);

    // Check platform compatibility
    const currentPlatform = process.platform as 'darwin' | 'win32' | 'linux';
    if (!definition.platforms.includes(currentPlatform)) {
      console.warn(
        `[PluginManager] Plugin ${definition.id} does not support platform ${currentPlatform}`
      );
      return;
    }

    // Get registry entry or create default
    const registry = this.store.get('plugins.registry', {});
    const registryEntry = registry[definition.id] || {
      id: definition.id,
      enabled: true,
      installedVersion: null,
      lastChecked: null,
      configuration: {},
    };

    // Create plugin object
    const plugin: Plugin = {
      definition,
      installer,
      status: 'not-installed',
      installedVersion: null,
      latestVersion: null,
      lastChecked: null,
      enabled: registryEntry.enabled,
    };

    // Check installation status
    console.log(`[PluginManager] Checking installation status for ${definition.id}...`);
    try {
      const isInstalled = await installer.checkInstallation();
      console.log(`[PluginManager] ${definition.id} installed: ${isInstalled}`);
      if (isInstalled) {
        console.log(`[PluginManager] Getting current version for ${definition.id}...`);
        // Add timeout to prevent hanging on slow commands
        const currentVersion = await Promise.race([
          installer.getCurrentVersion(),
          new Promise<null>((resolve) => setTimeout(() => {
            console.warn(`[PluginManager] getCurrentVersion() timed out for ${definition.id}`);
            resolve(null);
          }, 3000)) // 3 second timeout
        ]);
        console.log(`[PluginManager] ${definition.id} current version: ${currentVersion}`);
        plugin.status = 'installed';
        plugin.installedVersion = currentVersion;
        registryEntry.installedVersion = currentVersion;
      }
    } catch (error) {
      console.error(`[PluginManager] Error checking installation for ${definition.id}:`, error);
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);
    }

    console.log(`[PluginManager] Storing ${definition.id} in memory...`);
    // Store in memory
    this.plugins.set(definition.id, plugin);
    console.log(`[PluginManager] Plugins map size after adding: ${this.plugins.size}`);

    // Persist registry entry
    registry[definition.id] = registryEntry;
    this.store.set('plugins.registry', registry);

    console.log(`[PluginManager] Plugin ${definition.id} registered successfully`);
  }

  /**
   * Get list of all plugins (async to wait for initialization)
   */
  public async listPluginsAsync(): Promise<PluginListItem[]> {
    console.log(`[PluginManager] listPluginsAsync called, waiting for initialization...`);

    // Wait for initialization to complete
    if (this.initializePromise) {
      await this.initializePromise;
    }

    console.log(`[PluginManager] Initialization complete, plugins size: ${this.plugins.size}`);
    console.log(`[PluginManager] Plugins map:`, Array.from(this.plugins.keys()));

    const items: PluginListItem[] = [];

    for (const [id, plugin] of this.plugins) {
      items.push({
        id,
        name: plugin.definition.name,
        description: plugin.definition.description,
        icon: plugin.definition.icon,
        status: plugin.status,
        installedVersion: plugin.installedVersion,
        latestVersion: plugin.latestVersion,
        hasUpdate:
          plugin.status === 'installed' &&
          plugin.latestVersion !== null &&
          plugin.installedVersion !== plugin.latestVersion,
        enabled: plugin.enabled,
        platforms: plugin.definition.platforms,
        tags: plugin.definition.tags,
      });
    }

    return items;
  }

  /**
   * Get list of all plugins (synchronous, for backward compatibility)
   */
  public listPlugins(): PluginListItem[] {
    console.log(`[PluginManager] listPlugins called (sync), plugins size: ${this.plugins.size}`);

    const items: PluginListItem[] = [];

    for (const [id, plugin] of this.plugins) {
      items.push({
        id,
        name: plugin.definition.name,
        description: plugin.definition.description,
        icon: plugin.definition.icon,
        status: plugin.status,
        installedVersion: plugin.installedVersion,
        latestVersion: plugin.latestVersion,
        hasUpdate:
          plugin.status === 'installed' &&
          plugin.latestVersion !== null &&
          plugin.installedVersion !== plugin.latestVersion,
        enabled: plugin.enabled,
        platforms: plugin.definition.platforms,
        tags: plugin.definition.tags,
      });
    }

    return items;
  }

  /**
   * Get a specific plugin by ID
   */
  public getPlugin(pluginId: string): Plugin | null {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * Refresh installation status and version for a specific plugin
   */
  public async refreshPluginStatus(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`[PluginManager] Plugin ${pluginId} not found for refresh`);
      return;
    }

    console.log(`[PluginManager] Refreshing status for ${pluginId}...`);

    try {
      // Check if installed
      const isInstalled = await plugin.installer.checkInstallation();

      if (isInstalled) {
        // Get current version with timeout
        const currentVersion = await Promise.race([
          plugin.installer.getCurrentVersion(),
          new Promise<null>((resolve) => setTimeout(() => {
            console.warn(`[PluginManager] getCurrentVersion() timed out for ${pluginId}`);
            resolve(null);
          }, 5000)) // 5 second timeout
        ]);

        plugin.status = 'installed';
        plugin.installedVersion = currentVersion;

        // Update registry
        this.updateRegistry(pluginId, {
          installedVersion: currentVersion,
        });

        console.log(`[PluginManager] ${pluginId} status: installed (v${currentVersion})`);
      } else {
        plugin.status = 'not-installed';
        plugin.installedVersion = null;

        // Update registry
        this.updateRegistry(pluginId, {
          installedVersion: null,
        });

        console.log(`[PluginManager] ${pluginId} status: not-installed`);
      }
    } catch (error) {
      console.error(`[PluginManager] Error refreshing status for ${pluginId}:`, error);
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Refresh installation status and version for all plugins
   */
  public async refreshAllPluginsStatus(): Promise<void> {
    console.log('[PluginManager] Refreshing status for all plugins...');

    const promises: Promise<void>[] = [];
    for (const [pluginId] of this.plugins) {
      promises.push(this.refreshPluginStatus(pluginId));
    }

    await Promise.allSettled(promises);
    console.log('[PluginManager] All plugins status refreshed');
  }

  /**
   * Install a plugin
   *
   * @param pluginId Plugin identifier
   * @param progressCallback Optional progress callback
   */
  public async installPlugin(
    pluginId: string,
    progressCallback?: ProgressCallback
  ): Promise<PluginInstallResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: `Plugin ${pluginId} not found` };
    }

    console.log(`[PluginManager] Installing plugin: ${pluginId}`);
    plugin.status = 'installing';

    try {
      // Call installer
      await plugin.installer.install(progressCallback);

      // Update status
      const currentVersion = await plugin.installer.getCurrentVersion();
      plugin.status = 'installed';
      plugin.installedVersion = currentVersion;

      // Persist to registry
      this.updateRegistry(pluginId, {
        installedVersion: currentVersion,
      });

      console.log(`[PluginManager] Plugin ${pluginId} installed successfully (v${currentVersion})`);

      return { success: true, version: currentVersion || undefined };
    } catch (error) {
      console.error(`[PluginManager] Error installing plugin ${pluginId}:`, error);
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update a plugin to the latest version
   *
   * @param pluginId Plugin identifier
   * @param progressCallback Optional progress callback
   */
  public async updatePlugin(
    pluginId: string,
    progressCallback?: ProgressCallback
  ): Promise<PluginInstallResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: `Plugin ${pluginId} not found` };
    }

    if (plugin.status !== 'installed' && plugin.status !== 'update-available') {
      return { success: false, error: `Plugin ${pluginId} is not installed` };
    }

    console.log(`[PluginManager] Updating plugin: ${pluginId}`);
    plugin.status = 'updating';

    try {
      // Call installer
      await plugin.installer.update(progressCallback);

      // Update status
      const currentVersion = await plugin.installer.getCurrentVersion();
      plugin.status = 'installed';
      plugin.installedVersion = currentVersion;
      plugin.latestVersion = currentVersion; // After update, versions should match

      // Persist to registry
      this.updateRegistry(pluginId, {
        installedVersion: currentVersion,
      });

      console.log(`[PluginManager] Plugin ${pluginId} updated successfully (v${currentVersion})`);

      return { success: true, version: currentVersion || undefined };
    } catch (error) {
      console.error(`[PluginManager] Error updating plugin ${pluginId}:`, error);
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove a plugin
   *
   * @param pluginId Plugin identifier
   * @param progressCallback Optional progress callback
   */
  public async removePlugin(
    pluginId: string,
    progressCallback?: ProgressCallback
  ): Promise<PluginInstallResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: `Plugin ${pluginId} not found` };
    }

    console.log(`[PluginManager] Removing plugin: ${pluginId}`);
    plugin.status = 'removing';

    try {
      // Call installer
      await plugin.installer.remove(progressCallback);

      // Update status
      plugin.status = 'not-installed';
      plugin.installedVersion = null;

      // Persist to registry
      this.updateRegistry(pluginId, {
        installedVersion: null,
      });

      console.log(`[PluginManager] Plugin ${pluginId} removed successfully`);

      return { success: true };
    } catch (error) {
      console.error(`[PluginManager] Error removing plugin ${pluginId}:`, error);
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check for updates for a specific plugin
   */
  public async checkForUpdate(pluginId: string): Promise<PluginUpdateCheckResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return {
        hasUpdate: false,
        currentVersion: null,
        latestVersion: null,
        error: `Plugin ${pluginId} not found`,
      };
    }

    try {
      const [currentVersion, latestVersion] = await Promise.all([
        plugin.installer.getCurrentVersion(),
        plugin.installer.getLatestVersion(),
      ]);

      plugin.installedVersion = currentVersion;
      plugin.latestVersion = latestVersion;
      plugin.lastChecked = new Date();

      // Update registry
      this.updateRegistry(pluginId, {
        lastChecked: plugin.lastChecked.toISOString(),
      });

      const hasUpdate =
        currentVersion !== null &&
        latestVersion !== null &&
        currentVersion !== latestVersion;

      if (hasUpdate && plugin.status === 'installed') {
        plugin.status = 'update-available';
      }

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
      };
    } catch (error) {
      console.error(`[PluginManager] Error checking update for ${pluginId}:`, error);
      return {
        hasUpdate: false,
        currentVersion: plugin.installedVersion,
        latestVersion: plugin.latestVersion,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check for updates for all installed plugins
   */
  public async checkAllForUpdates(): Promise<void> {
    console.log('[PluginManager] Checking all plugins for updates...');

    const promises: Promise<PluginUpdateCheckResult>[] = [];
    const pluginIds: string[] = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.status === 'installed' || plugin.status === 'update-available') {
        promises.push(this.checkForUpdate(pluginId));
        pluginIds.push(pluginId);
      }
    }

    const results = await Promise.allSettled(promises);
    const pluginsWithUpdates: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.hasUpdate) {
        pluginsWithUpdates.push(pluginIds[index]);
      }
    });

    console.log(`[PluginManager] Update check complete. ${pluginsWithUpdates.length} updates available.`);

    // Check for auto-update configuration and trigger updates
    for (const pluginId of pluginsWithUpdates) {
      const config = await this.getPluginConfiguration(pluginId);
      if (config.autoUpdate === true) {
        console.log(`[PluginManager] Auto-update enabled for ${pluginId}, notifying renderer...`);

        // Send event to renderer to trigger auto-update in terminal
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugins:auto-update-available', {
            pluginId,
            pluginName: this.plugins.get(pluginId)?.definition.name || pluginId
          });
        }
      }
    }
  }

  /**
   * Start automatic update checking (every 6 hours)
   */
  public startAutoCheck(): void {
    if (this.autoCheckInterval) {
      console.log('[PluginManager] Auto-check already running');
      return;
    }

    console.log('[PluginManager] Starting auto-check (every 6 hours)');

    // Check immediately on start
    this.checkAllForUpdates().catch((error) => {
      console.error('[PluginManager] Error during initial auto-check:', error);
    });

    // Then check every 6 hours
    this.autoCheckInterval = setInterval(() => {
      this.checkAllForUpdates().catch((error) => {
        console.error('[PluginManager] Error during auto-check:', error);
      });
    }, this.AUTO_CHECK_INTERVAL_MS);
  }

  /**
   * Stop automatic update checking
   */
  public stopAutoCheck(): void {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = null;
      console.log('[PluginManager] Auto-check stopped');
    }
  }

  /**
   * Enable or disable a plugin
   */
  public setPluginEnabled(pluginId: string, enabled: boolean): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.enabled = enabled;
    this.updateRegistry(pluginId, { enabled });
    console.log(`[PluginManager] Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Configure a plugin
   */
  public async configurePlugin(
    pluginId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Validate configuration
    const validation = await plugin.installer.validateConfiguration(config);
    if (validation !== true) {
      throw new Error(`Invalid configuration: ${validation}`);
    }

    // Apply configuration
    await plugin.installer.configure(config);

    // Persist to registry
    this.updateRegistry(pluginId, { configuration: config });

    console.log(`[PluginManager] Plugin ${pluginId} configured`);
  }

  /**
   * Get plugin configuration
   */
  public async getPluginConfiguration(pluginId: string): Promise<Record<string, unknown>> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    return plugin.installer.getConfiguration();
  }

  /**
   * Update registry entry in persistent storage
   */
  private updateRegistry(pluginId: string, updates: Partial<PluginRegistryEntry>): void {
    const registry = this.store.get('plugins.registry', {});
    registry[pluginId] = {
      ...registry[pluginId],
      ...updates,
      id: pluginId, // Ensure ID is always set
    };
    this.store.set('plugins.registry', registry);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopAutoCheck();
    this.plugins.clear();
    console.log('[PluginManager] Destroyed');
  }
}
