/**
 * Application settings type definitions.
 */

import type { VoiceInputSettings } from './voiceInput'
import type { TerminalThemeName } from './terminal'

/**
 * Keyboard shortcut action types
 */
export type ShortcutAction =
  | 'newTerminal'      // New terminal
  | 'newScratchpad'    // New scratchpad
  | 'closeTab'         // Close current tab
  | 'saveFile'         // Save file
  | 'openSettings'     // Open settings
  | 'newWindow'        // New window
  | 'toggleSidebar'    // Toggle sidebar
  | 'nextTab'          // Next tab
  | 'prevTab'          // Previous tab
  | 'focusTerminal'    // Focus terminal
  | 'focusEditor'      // Focus editor

export interface KeyboardShortcut {
  key: string              // Main key (e.g.: 't', 's', 'n')
  ctrlKey?: boolean        // Ctrl key
  metaKey?: boolean        // Cmd/Meta key
  altKey?: boolean         // Alt/Option key
  shiftKey?: boolean       // Shift key
}

export interface ShortcutConfig {
  action: ShortcutAction
  label: string            // Display name
  shortcut: KeyboardShortcut
  enabled: boolean         // Whether enabled
}

/**
 * Configuration for opening files with external applications
 */
export interface ExternalOpenConfig {
  fileType: string              // File type (e.g., 'pdf', 'word', 'image')
  enabled: boolean              // Whether to open externally
  application?: string          // Optional: specific application path
}

/**
 * Per-tool configuration isolation
 */
export interface ConfigIsolationToolSettings {
  id: string                              // Tool identifier (e.g., 'minto', 'claude', 'gemini')
  name: string                            // Display name
  envVar: string                          // Environment variable to set (e.g., 'MINTO_CONFIG_DIR')
  enabled: boolean                        // Whether this tool's config is isolated
  customPath?: string                     // Custom path override (optional)
  description?: string                    // Description of what this isolates
}

/**
 * Configuration directory isolation settings (Hybrid Mode)
 * Allows CLI tools to use AiTer-specific config directories instead of system ~/.xxx
 */
export interface ConfigIsolationSettings {
  enabled: boolean                        // Master switch: enable AiTer config isolation
  basePath?: string                       // Custom base path (default: ~/.aiter/config)
  tools: ConfigIsolationToolSettings[]    // Per-tool isolation settings
}

/**
 * Predefined tool configurations
 */
export const DEFAULT_CONFIG_ISOLATION_TOOLS: ConfigIsolationToolSettings[] = [
  {
    id: 'minto',
    name: 'Minto CLI',
    envVar: 'MINTO_CONFIG_DIR',
    enabled: false,
    description: 'Minto CLI configuration (~/.minto.json)'
  },
  {
    id: 'claude',
    name: 'Claude Code CLI',
    envVar: 'CLAUDE_CONFIG_DIR',
    enabled: false,
    description: 'Claude Code CLI configuration (~/.claude/)'
  },
  {
    id: 'xdg-config',
    name: 'XDG Config (General)',
    envVar: 'XDG_CONFIG_HOME',
    enabled: false,
    description: 'XDG config directory for tools supporting XDG spec'
  },
  {
    id: 'xdg-data',
    name: 'XDG Data (General)',
    envVar: 'XDG_DATA_HOME',
    enabled: false,
    description: 'XDG data directory for tools supporting XDG spec'
  }
]

/**
 * Main application settings interface
 */
export interface AppSettings {
  theme: 'dark' | 'light'
  fontSize: number
  fontFamily: string
  shell?: string
  scrollbackLines: number
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
  terminalTheme: TerminalThemeName

  // Internationalization
  language: 'en' | 'zh-CN'          // Display language

  // Shell configuration
  shellLoginMode: boolean           // Whether to use login shell (-l/--login)

  // macOS-specific
  macOptionIsMeta: boolean          // Use Option key as Meta key (for Alt+key shortcuts)

  // Node.js configuration
  nodeSource: 'builtin' | 'system' | 'auto'  // Which Node.js to use
  preserveVersionManagers: boolean  // Keep nvm/fnm/asdf environment variables

  // Windows-specific
  windowsUseUtf8: boolean           // Enable UTF-8 encoding for Windows terminals

  // Keyboard shortcuts
  shortcuts?: ShortcutConfig[]      // Custom keyboard shortcuts

  // Terminal startup command
  enableStartupCommand: boolean     // Enable running a command when opening a new terminal
  startupCommand: string            // The command to run on terminal startup (e.g., 'minto', 'claude')
  mintoInstalled?: boolean          // Track if Minto CLI has been installed (legacy)

  // File handling preferences
  openExternally?: ExternalOpenConfig[]  // File types to open with external apps

  // Proxy configuration
  proxyMode: 'off' | 'manual' | 'system'  // Proxy mode: off=no proxy, manual=use custom proxy, system=inherit system proxy
  proxyHost?: string                      // Proxy host (e.g., 127.0.0.1)
  proxyPort?: number                      // Proxy port (e.g., 1087)
  proxyProtocol?: 'http' | 'socks5'       // Proxy protocol

  // Terminal behavior
  confirmTerminalClose: boolean           // Show confirmation dialog when closing terminal tabs

  // Voice input settings
  voiceInput?: VoiceInputSettings         // Voice input configuration

  // Editor settings
  editorWordWrap: boolean                 // Enable word wrap in code editor
  editorMinimap: boolean                  // Show minimap in code editor
  editorLineNumbers: boolean              // Show line numbers in code editor

  // Configuration directory isolation (Hybrid Mode)
  configIsolation: ConfigIsolationSettings  // Configuration isolation settings for CLI tools
}
