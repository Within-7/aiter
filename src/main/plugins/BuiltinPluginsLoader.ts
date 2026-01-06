/**
 * BuiltinPluginsLoader
 *
 * Loads built-in plugin configurations from JSON file.
 * Supports different configurations for internal/public builds.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Built-in plugin installer configuration
 */
export interface BuiltinPluginInstallerConfig {
  type: 'npm';
  packageName: string;
  commandName: string;
}

/**
 * Built-in plugin configuration from JSON
 */
export interface BuiltinPluginConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  homepage?: string;
  platforms: Array<'darwin' | 'linux' | 'win32'>;
  tags?: string[];
  installer: BuiltinPluginInstallerConfig;
  /** Whether to auto-install this plugin on first launch (default: true) */
  autoInstall?: boolean;
}

/**
 * Built-in plugins configuration file structure
 */
export interface BuiltinPluginsConfig {
  version: string;
  description?: string;
  plugins: BuiltinPluginConfig[];
}

/**
 * Load built-in plugins configuration from JSON file
 *
 * The loader looks for config/builtin-plugins.json in the following locations:
 * 1. Production: app.getAppPath()/config/builtin-plugins.json (inside asar)
 * 2. Development: project root/config/builtin-plugins.json
 *
 * @returns Built-in plugins configuration
 */
export function loadBuiltinPluginsConfig(): BuiltinPluginsConfig {
  const configFileName = 'builtin-plugins.json';

  // Possible config paths
  const possiblePaths = [
    // Production: inside app.asar or unpacked
    path.join(app.getAppPath(), 'config', configFileName),
    // Development: project root
    path.join(process.cwd(), 'config', configFileName),
    // Alternative: relative to __dirname (main process)
    path.join(__dirname, '..', '..', '..', 'config', configFileName),
  ];

  let configPath: string | null = null;
  let configContent: string | null = null;

  // Try each path until we find a valid config
  for (const tryPath of possiblePaths) {
    try {
      if (fs.existsSync(tryPath)) {
        configContent = fs.readFileSync(tryPath, 'utf-8');
        configPath = tryPath;
        console.log(`[BuiltinPluginsLoader] Found config at: ${tryPath}`);
        break;
      }
    } catch (error) {
      // Continue to next path
      console.log(`[BuiltinPluginsLoader] Config not found at: ${tryPath}`);
    }
  }

  if (!configPath || !configContent) {
    console.warn('[BuiltinPluginsLoader] No config file found, using empty config');
    return {
      version: '1.0.0',
      description: 'Empty configuration (no config file found)',
      plugins: [],
    };
  }

  try {
    const config = JSON.parse(configContent) as BuiltinPluginsConfig;

    // Validate required fields
    if (!config.version || !Array.isArray(config.plugins)) {
      throw new Error('Invalid config format: missing version or plugins array');
    }

    console.log(
      `[BuiltinPluginsLoader] Loaded ${config.plugins.length} built-in plugins from: ${configPath}`
    );
    console.log(`[BuiltinPluginsLoader] Config description: ${config.description || 'N/A'}`);

    return config;
  } catch (error) {
    console.error('[BuiltinPluginsLoader] Failed to parse config:', error);
    return {
      version: '1.0.0',
      description: 'Empty configuration (parse error)',
      plugins: [],
    };
  }
}

/**
 * Get the path where the active config file should be located
 */
export function getConfigPath(): string {
  const isDev = !app.isPackaged;

  if (isDev) {
    return path.join(process.cwd(), 'config', 'builtin-plugins.json');
  } else {
    return path.join(app.getAppPath(), 'config', 'builtin-plugins.json');
  }
}
