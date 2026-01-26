/**
 * Terminal-related type definitions.
 */

export interface Terminal {
  id: string
  projectId: string
  name: string
  cwd: string
  shell: string
  createdAt: number
  pid?: number
}

export type TerminalThemeName = 'homebrew' | 'vscode-dark' | 'dracula' | 'solarized-dark'

/**
 * Shell type identifier
 */
export type ShellType = 'zsh' | 'bash' | 'fish' | 'powershell' | 'pwsh' | 'cmd' | 'gitbash' | 'wsl' | 'other'

/**
 * Detected shell information
 */
export interface DetectedShell {
  name: string           // Display name (e.g., "Zsh", "PowerShell")
  path: string           // Full path to executable
  type: ShellType        // Shell type identifier
  isDefault: boolean     // Is this the system default shell
  configFiles: string[]  // Associated config files (e.g., ~/.zshrc)
}

/**
 * Version manager names
 */
export type VersionManagerName = 'nvm' | 'fnm' | 'asdf' | 'pyenv' | 'rbenv' | 'volta'

/**
 * Version manager detection result
 */
export interface VersionManagerInfo {
  name: VersionManagerName
  detected: boolean
  envVars: Record<string, string>  // Environment variables to preserve
}
