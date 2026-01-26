/**
 * Plugin System Type Definitions
 *
 * Defines interfaces for the AiTer plugin system, enabling extensibility
 * for AI CLI tools like Minto, Claude Code CLI, Gemini CLI, etc.
 */

/**
 * Plugin installation status
 */
export type PluginStatus =
  | 'not-installed'
  | 'installed'
  | 'update-available'
  | 'installing'
  | 'updating'
  | 'removing'
  | 'error';

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallback {
  (progress: {
    phase: string;
    percentage: number;
    message: string;
  }): void;
}

/**
 * Plugin installer interface
 *
 * Each plugin must implement this interface to provide installation,
 * update, and removal capabilities.
 */
export interface PluginInstaller {
  /**
   * Check if the plugin is currently installed
   */
  checkInstallation(): Promise<boolean>;

  /**
   * Get the currently installed version
   * @returns Version string or null if not installed
   */
  getCurrentVersion(): Promise<string | null>;

  /**
   * Get the latest available version from the source
   * @returns Latest version string or null if unavailable
   */
  getLatestVersion(): Promise<string | null>;

  /**
   * Install the plugin
   * @param progressCallback Optional callback for progress updates
   */
  install(progressCallback?: ProgressCallback): Promise<void>;

  /**
   * Update the plugin to the latest version
   * @param progressCallback Optional callback for progress updates
   */
  update(progressCallback?: ProgressCallback): Promise<void>;

  /**
   * Remove the plugin from the system
   * @param progressCallback Optional callback for progress updates
   */
  remove(progressCallback?: ProgressCallback): Promise<void>;

  /**
   * Configure plugin-specific settings
   * @param config Configuration object (plugin-specific)
   */
  configure(config: Record<string, unknown>): Promise<void>;

  /**
   * Get current configuration
   */
  getConfiguration(): Promise<Record<string, unknown>>;

  /**
   * Validate configuration
   * @param config Configuration to validate
   * @returns true if valid, error message if invalid
   */
  validateConfiguration(config: Record<string, unknown>): Promise<boolean | string>;

  /**
   * Get install command for terminal execution
   * @returns Shell command string to install the plugin
   */
  getInstallCommand?(): Promise<string>;

  /**
   * Get update command for terminal execution
   * @returns Shell command string to update the plugin
   */
  getUpdateCommand?(): Promise<string>;

  /**
   * Get check update command for terminal execution
   * @returns Shell command string to check for updates
   */
  getCheckUpdateCommand?(): Promise<string>;
}

/**
 * Plugin metadata and definition
 */
export interface PluginDefinition {
  /** Unique plugin identifier (e.g., 'minto', 'claude-code') */
  id: string;

  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** Plugin version (AiTer plugin version, not tool version) */
  version: string;

  /** Plugin author */
  author: string;

  /** Homepage URL */
  homepage?: string;

  /** Documentation URL */
  documentation?: string;

  /** GitHub repository URL */
  repository?: string;

  /** Icon path or data URL */
  icon?: string;

  /** Supported platforms */
  platforms: Array<'darwin' | 'win32' | 'linux'>;

  /** Required configuration fields */
  requiredConfig?: Array<{
    key: string;
    label: string;
    type: 'string' | 'password' | 'number' | 'boolean';
    description?: string;
    required: boolean;
    default?: unknown;
  }>;

  /** Plugin tags for categorization */
  tags?: string[];

  /** Minimum AiTer version required */
  minAiTerVersion?: string;

  /** Whether this is a built-in system plugin */
  isBuiltIn?: boolean;

  /** Whether to auto-install this plugin on first launch (default: true for built-in) */
  autoInstall?: boolean;
}

/**
 * Partial plugin definition for registration
 * Used when creating plugin definitions with only required fields
 */
export type PartialPluginDefinition = Omit<PluginDefinition, 'version' | 'author'> & {
  version?: string;
  author?: string;
}

/**
 * Complete plugin with installer and metadata (internal use)
 */
export interface PluginWithInstaller {
  /** Plugin metadata */
  definition: PluginDefinition;

  /** Plugin installer implementation */
  installer: PluginInstaller;

  /** Current status */
  status: PluginStatus;

  /** Currently installed version */
  installedVersion: string | null;

  /** Latest available version */
  latestVersion: string | null;

  /** Last check timestamp */
  lastChecked: Date | null;

  /** Error message if status is 'error' */
  error?: string;

  /** Whether plugin is enabled */
  enabled: boolean;
}

/**
 * Plugin data transfer object for UI display
 */
export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  installed: boolean;
  installedVersion?: string;
  updateAvailable: boolean;
  enabled: boolean;
  config?: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  homepage?: string;
  isBuiltIn?: boolean;
}

/**
 * Plugin registry entry (persisted)
 */
export interface PluginRegistryEntry {
  id: string;
  enabled: boolean;
  installedVersion: string | null;
  lastChecked: string | null;
  configuration?: Record<string, unknown>;
}

/**
 * Plugin installation result
 */
export interface PluginInstallResult {
  success: boolean;
  version?: string;
  error?: string;
}

/**
 * Plugin update check result
 */
export interface PluginUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  error?: string;
}

/**
 * Plugin list item (for UI)
 */
export interface PluginListItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  status: PluginStatus;
  installedVersion: string | null;
  latestVersion: string | null;
  hasUpdate: boolean;
  enabled: boolean;
  platforms: string[];
  tags?: string[];
  isBuiltIn?: boolean;
}

/**
 * Plugin installation progress
 */
export interface PluginInstallProgress {
  pluginId: string;
  status: 'downloading' | 'installing' | 'complete' | 'error';
  phase: string;
  percentage: number;
  message?: string;
}

/**
 * Plugin update progress
 */
export interface PluginUpdateProgress {
  pluginId: string;
  status: 'checking' | 'downloading' | 'installing' | 'complete' | 'error';
  phase: string;
  percentage: number;
  message?: string;
  fromVersion?: string;
  toVersion?: string;
}
