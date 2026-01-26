/**
 * PluginManager
 *
 * Central orchestrator for all plugin operations in AiTer.
 * Manages plugin lifecycle: registration, installation, updates, removal.
 * Implements auto-update checking every 6 hours.
 */

import {
  PluginWithInstaller,
  PluginDefinition,
  PartialPluginDefinition,
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
import { loadBuiltinPluginsConfig, BuiltinPluginConfig } from './BuiltinPluginsLoader';

interface CustomPluginEntry {
  packageName: string;
  commandName: string;
  name: string;
  description: string;
  author?: string;
  homepage?: string;
  version?: string;
  tags?: string[];
}

interface PluginStoreSchema {
  plugins: {
    registry: Record<string, PluginRegistryEntry>;
    custom: Record<string, CustomPluginEntry>;
  };
}

export class PluginManager {
  private static instance: PluginManager | null = null;

  private plugins: Map<string, PluginWithInstaller> = new Map();
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

      const nodeEnv = this.nodeManager.getTerminalEnv();
      const npmPath = this.nodeManager.getNpmExecutable();
      console.log('[PluginManager] NodeManager env PATH:', nodeEnv.PATH?.substring(0, 200));
      console.log('[PluginManager] NodeManager npm path:', npmPath);

      // Load built-in plugins from configuration file
      await this.loadBuiltinPluginsFromConfig(nodeEnv, npmPath);

      // Load custom plugins from store
      await this.loadCustomPlugins();

      // Auto-install built-in plugins if not installed
      await this.autoInstallBuiltInPlugins();

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
   * Load built-in plugins from configuration file
   */
  private async loadBuiltinPluginsFromConfig(
    nodeEnv: NodeJS.ProcessEnv,
    npmPath: string
  ): Promise<void> {
    const config = loadBuiltinPluginsConfig();
    console.log(`[PluginManager] Loading ${config.plugins.length} built-in plugins from config...`);

    const { NpmPluginInstaller } = await import('./installers/NpmPluginInstaller');

    for (const pluginConfig of config.plugins) {
      try {
        await this.registerBuiltinPlugin(pluginConfig, nodeEnv, npmPath, NpmPluginInstaller);
      } catch (error) {
        console.error(`[PluginManager] Failed to register built-in plugin ${pluginConfig.id}:`, error);
      }
    }
  }

  /**
   * Register a single built-in plugin from configuration
   */
  private async registerBuiltinPlugin(
    pluginConfig: BuiltinPluginConfig,
    nodeEnv: NodeJS.ProcessEnv,
    npmPath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NpmPluginInstaller: any
  ): Promise<void> {
    console.log(`[PluginManager] Registering built-in plugin: ${pluginConfig.id}`);

    // Create installer based on type
    let installer: PluginInstaller;

    if (pluginConfig.installer.type === 'npm') {
      installer = new NpmPluginInstaller({
        store: this.store,
        packageName: pluginConfig.installer.packageName,
        commandName: pluginConfig.installer.commandName,
        configStoreKey: `plugins.${pluginConfig.id}.configuration`,
        env: nodeEnv,
        npmPath,
      });
    } else {
      throw new Error(`Unknown installer type: ${pluginConfig.installer.type}`);
    }

    // Determine autoInstall value (default: true for built-in plugins)
    const autoInstall = pluginConfig.autoInstall !== false;

    // Register the plugin
    await this.registerPlugin(
      {
        id: pluginConfig.id,
        name: pluginConfig.name,
        description: pluginConfig.description,
        icon: pluginConfig.icon,
        version: '1.0.0',
        author: pluginConfig.author || 'Unknown',
        homepage: pluginConfig.homepage,
        platforms: pluginConfig.platforms,
        tags: pluginConfig.tags,
        isBuiltIn: true,
        autoInstall,
      },
      installer
    );

    console.log(`[PluginManager] Built-in plugin registered: ${pluginConfig.id} (autoInstall: ${autoInstall})`);
  }

  /**
   * Auto-install built-in plugins if they are not installed
   * This runs silently in the background on first launch
   * Only installs plugins with autoInstall: true (default for built-in)
   */
  private async autoInstallBuiltInPlugins(): Promise<void> {
    console.log('[PluginManager] Checking built-in plugins for auto-installation...');

    const builtInPlugins: string[] = [];

    // Find all built-in plugins that are not installed and have autoInstall enabled
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.definition.isBuiltIn && plugin.status === 'not-installed') {
        // Check autoInstall flag (default: true for built-in plugins)
        const shouldAutoInstall = plugin.definition.autoInstall !== false;
        if (shouldAutoInstall) {
          builtInPlugins.push(pluginId);
        } else {
          console.log(`[PluginManager] Skipping auto-install for ${pluginId} (autoInstall: false)`);
        }
      }
    }

    if (builtInPlugins.length === 0) {
      console.log('[PluginManager] All built-in plugins are already installed');
      return;
    }

    console.log(`[PluginManager] Auto-installing ${builtInPlugins.length} built-in plugins:`, builtInPlugins);

    // Install each built-in plugin
    for (const pluginId of builtInPlugins) {
      try {
        console.log(`[PluginManager] Auto-installing built-in plugin: ${pluginId}`);
        const result = await this.installPlugin(pluginId, (progress) => {
          console.log(`[PluginManager] ${pluginId} install progress: ${progress.percentage}% - ${progress.message}`);
        });

        if (result.success) {
          console.log(`[PluginManager] Successfully auto-installed ${pluginId} (v${result.version})`);
        } else {
          console.error(`[PluginManager] Failed to auto-install ${pluginId}: ${result.error}`);
        }
      } catch (error) {
        console.error(`[PluginManager] Error auto-installing ${pluginId}:`, error);
      }
    }

    console.log('[PluginManager] Auto-installation of built-in plugins complete');

    // Notify renderer that plugin status has changed
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('plugins:status-changed');
        console.log('[PluginManager] Sent plugins:status-changed event after auto-install');
      } catch (error) {
        console.warn('[PluginManager] Failed to send status-changed event:', error);
      }
    }
  }

  /**
   * Load custom plugins from persistent storage
   */
  private async loadCustomPlugins(): Promise<void> {
    const customPlugins = this.store.get('plugins.custom', {});
    const customPluginIds = Object.keys(customPlugins);

    if (customPluginIds.length === 0) {
      console.log('[PluginManager] No custom plugins to load');
      return;
    }

    console.log(`[PluginManager] Loading ${customPluginIds.length} custom plugins...`);

    const nodeEnv = this.nodeManager.getTerminalEnv();
    const npmPath = this.nodeManager.getNpmExecutable();
    const { GenericNpmInstaller } = await import('./installers/GenericNpmInstaller');
    const { fetchNpmPackageMetadata, getCommandNameFromMetadata } = await import('./npm-utils');

    for (const pluginId of customPluginIds) {
      const entry = customPlugins[pluginId];

      try {
        // Re-fetch metadata to ensure we have the correct command name from bin field
        let commandName = entry.commandName;
        try {
          const metadata = await fetchNpmPackageMetadata(entry.packageName, nodeEnv, npmPath);
          const actualCommandName = getCommandNameFromMetadata(metadata);

          // If command name has changed, update the stored entry
          if (actualCommandName !== entry.commandName) {
            console.log(`[PluginManager] Updating command name for ${entry.packageName}: ${entry.commandName} → ${actualCommandName}`);
            entry.commandName = actualCommandName;
            commandName = actualCommandName;

            // Save updated entry
            customPlugins[pluginId] = entry;
            this.store.set('plugins.custom', customPlugins);
          }
        } catch (metadataError) {
          console.warn(`[PluginManager] Failed to fetch metadata for ${entry.packageName}, using stored command name:`, metadataError);
        }

        const installer = new GenericNpmInstaller(
          this.store,
          entry.packageName,
          commandName,
          nodeEnv,
          npmPath
        );

        await this.registerPlugin(
          {
            id: pluginId,
            name: entry.name,
            description: entry.description,
            icon: '📦',  // Default icon for custom plugins
            version: entry.version || '1.0.0',
            author: entry.author || 'Unknown',
            homepage: entry.homepage,
            platforms: ['darwin', 'linux', 'win32'],
            tags: entry.tags || ['custom', 'npm'],
            isBuiltIn: false  // Mark as custom plugin
          },
          installer
        );

        console.log(`[PluginManager] Loaded custom plugin: ${pluginId}`);
      } catch (error) {
        console.error(`[PluginManager] Failed to load custom plugin ${pluginId}:`, error);
      }
    }
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
    definition: PartialPluginDefinition,
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

    // Normalize definition to PluginDefinition with defaults
    const normalizedDefinition: PluginDefinition = {
      ...definition,
      version: definition.version || '1.0.0',
      author: definition.author || 'Unknown',
    };

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
    const plugin: PluginWithInstaller = {
      definition: normalizedDefinition,
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
        const rawVersion = await Promise.race([
          installer.getCurrentVersion(),
          new Promise<null>((resolve) => setTimeout(() => {
            console.warn(`[PluginManager] getCurrentVersion() timed out for ${definition.id}`);
            resolve(null);
          }, 3000)) // 3 second timeout
        ]);
        // Trim version to avoid whitespace issues
        const currentVersion = rawVersion?.trim() || null;
        console.log(`[PluginManager] ${definition.id} rawVersion: "${rawVersion}", trimmed: "${currentVersion}"`);
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
        isBuiltIn: plugin.definition.isBuiltIn || false,
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
        isBuiltIn: plugin.definition.isBuiltIn || false,
      });
    }

    return items;
  }

  /**
   * Get a specific plugin by ID
   */
  public getPlugin(pluginId: string): PluginWithInstaller | null {
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
      console.log(`[PluginManager] ${pluginId} isInstalled: ${isInstalled}`);

      if (isInstalled) {
        // Get current version with timeout
        const rawVersion = await Promise.race([
          plugin.installer.getCurrentVersion(),
          new Promise<null>((resolve) => setTimeout(() => {
            console.warn(`[PluginManager] getCurrentVersion() timed out for ${pluginId}`);
            resolve(null);
          }, 5000)) // 5 second timeout
        ]);

        // Trim version to avoid whitespace issues
        const currentVersion = rawVersion?.trim() || null;
        console.log(`[PluginManager] ${pluginId} rawVersion: "${rawVersion}", trimmed: "${currentVersion}"`);

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
   * Add a custom plugin from npm package URL or package name
   *
   * @param urlOrPackageName npm URL (https://www.npmjs.com/package/foo) or package name
   * @returns Result with plugin ID if successful
   */
  public async addCustomPlugin(urlOrPackageName: string): Promise<{
    success: boolean;
    pluginId?: string;
    error?: string;
  }> {
    try {
      const { parseNpmUrl, fetchNpmPackageMetadata, getCommandNameFromMetadata } = await import('./npm-utils');

      // Parse URL to get package name
      const packageName = parseNpmUrl(urlOrPackageName);
      if (!packageName) {
        return { success: false, error: 'Invalid npm package URL or name' };
      }

      console.log(`[PluginManager] Adding custom plugin: ${packageName}`);

      // Check if plugin already exists
      const existingPlugin = Array.from(this.plugins.values()).find(
        p => p.definition.id === packageName
      );
      if (existingPlugin) {
        return { success: false, error: `Plugin ${packageName} already exists` };
      }

      // Fetch package metadata from npm registry
      const nodeEnv = this.nodeManager.getTerminalEnv();
      const npmPath = this.nodeManager.getNpmExecutable();
      const metadata = await fetchNpmPackageMetadata(packageName, nodeEnv, npmPath);

      // Extract actual command name from metadata bin field
      const commandName = getCommandNameFromMetadata(metadata);
      console.log(`[PluginManager] Extracted command name: ${commandName} for package: ${packageName}`);

      // Create plugin entry
      const pluginEntry: CustomPluginEntry = {
        packageName,
        commandName,
        name: metadata.name,
        description: metadata.description,
        author: typeof metadata.author === 'string' ? metadata.author : metadata.author?.name,
        homepage: metadata.homepage,
        version: metadata.version,
        tags: metadata.keywords,
      };

      // Save to store
      const customPlugins = this.store.get('plugins.custom', {});
      customPlugins[packageName] = pluginEntry;
      this.store.set('plugins.custom', customPlugins);

      // Register plugin
      const { GenericNpmInstaller } = await import('./installers/GenericNpmInstaller');
      const installer = new GenericNpmInstaller(
        this.store,
        packageName,
        commandName,
        nodeEnv,
        npmPath
      );

      await this.registerPlugin(
        {
          id: packageName,
          name: metadata.name,
          description: metadata.description,
          icon: '📦',
          version: metadata.version,
          author: typeof metadata.author === 'string' ? metadata.author : metadata.author?.name || 'Unknown',
          homepage: metadata.homepage,
          platforms: ['darwin', 'linux', 'win32'],
          tags: metadata.keywords || ['custom', 'npm']
        },
        installer
      );

      console.log(`[PluginManager] Custom plugin added successfully: ${packageName}`);

      return { success: true, pluginId: packageName };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[PluginManager] Failed to add custom plugin:', error);
      return { success: false, error: message };
    }
  }

  /**
   * Remove a custom plugin
   *
   * @param pluginId Plugin identifier
   * @returns Result indicating success or failure
   */
  public async removeCustomPlugin(pluginId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Check if this is a built-in plugin
      const plugin = this.plugins.get(pluginId);
      if (plugin?.definition.isBuiltIn) {
        return { success: false, error: 'Cannot remove built-in system plugins' };
      }

      // Check if plugin exists in custom plugins
      const customPlugins = this.store.get('plugins.custom', {});
      if (!customPlugins[pluginId]) {
        return { success: false, error: 'Plugin is not a custom plugin' };
      }

      // Remove plugin from memory
      this.plugins.delete(pluginId);

      // Remove from store
      delete customPlugins[pluginId];
      this.store.set('plugins.custom', customPlugins);

      // Remove from registry
      const registry = this.store.get('plugins.registry', {});
      delete registry[pluginId];
      this.store.set('plugins.registry', registry);

      console.log(`[PluginManager] Custom plugin removed: ${pluginId}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[PluginManager] Failed to remove custom plugin:', error);
      return { success: false, error: message };
    }
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

      console.log(`[PluginManager] checkForUpdate ${pluginId}: currentVersion="${currentVersion}" (type: ${typeof currentVersion}), latestVersion="${latestVersion}" (type: ${typeof latestVersion})`);
      console.log(`[PluginManager] checkForUpdate ${pluginId}: versions equal? ${currentVersion === latestVersion}, strict equal? ${currentVersion === latestVersion}`);

      plugin.installedVersion = currentVersion;
      plugin.latestVersion = latestVersion;
      plugin.lastChecked = new Date();

      // Update registry
      this.updateRegistry(pluginId, {
        lastChecked: plugin.lastChecked.toISOString(),
      });

      // Trim versions before comparison to avoid whitespace issues
      const trimmedCurrent = currentVersion?.trim() || null;
      const trimmedLatest = latestVersion?.trim() || null;

      const hasUpdate =
        trimmedCurrent !== null &&
        trimmedLatest !== null &&
        trimmedCurrent !== trimmedLatest;

      console.log(`[PluginManager] checkForUpdate ${pluginId}: trimmedCurrent="${trimmedCurrent}", trimmedLatest="${trimmedLatest}", hasUpdate=${hasUpdate}`);

      if (hasUpdate && plugin.status === 'installed') {
        plugin.status = 'update-available';
      }

      return {
        hasUpdate,
        currentVersion: trimmedCurrent,
        latestVersion: trimmedLatest,
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
