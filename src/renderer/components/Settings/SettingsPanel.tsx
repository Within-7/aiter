import React, { useContext, useState, useEffect } from 'react'
import { AppContext } from '../../context/AppContext'
import { getTerminalThemeNames } from '../../themes/terminalThemes'
import { TerminalThemeName, DetectedShell, VersionManagerInfo, ShellType } from '../../../types'
import './SettingsPanel.css'

export const SettingsPanel: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const isOpen = state.showSettingsPanel
  const { settings } = state

  // Shell and version manager detection state
  const [availableShells, setAvailableShells] = useState<DetectedShell[]>([])
  const [detectedVersionManagers, setDetectedVersionManagers] = useState<VersionManagerInfo[]>([])
  const [currentConfigFiles, setCurrentConfigFiles] = useState<string[]>([])
  const [isWindows] = useState(() => navigator.platform.toLowerCase().includes('win'))

  // Fetch available shells and version managers on mount
  useEffect(() => {
    if (isOpen) {
      // Detect available shells
      window.api.shell.detectAvailable().then(result => {
        if (result.success && result.shells) {
          setAvailableShells(result.shells)
        }
      })

      // Detect version managers
      window.api.versionManager.getDetected().then(result => {
        if (result.success && result.managers) {
          setDetectedVersionManagers(result.managers)
        }
      })
    }
  }, [isOpen])

  // Update config files when shell changes
  useEffect(() => {
    if (isOpen && settings.shell) {
      // Determine shell type from path
      const shellName = settings.shell.split('/').pop()?.split('\\').pop()?.toLowerCase() || ''
      let shellType: ShellType = 'other'
      if (shellName.includes('zsh')) shellType = 'zsh'
      else if (shellName.includes('bash')) shellType = 'bash'
      else if (shellName.includes('fish')) shellType = 'fish'
      else if (shellName.includes('powershell')) shellType = 'powershell'
      else if (shellName.includes('pwsh')) shellType = 'pwsh'
      else if (shellName.includes('cmd')) shellType = 'cmd'

      window.api.shell.getConfigFiles(shellType).then(result => {
        if (result.success && result.files) {
          setCurrentConfigFiles(result.files)
        }
      })
    } else if (isOpen && availableShells.length > 0) {
      // Use default shell's config files
      const defaultShell = availableShells.find(s => s.isDefault) || availableShells[0]
      if (defaultShell) {
        setCurrentConfigFiles(defaultShell.configFiles)
      }
    }
  }, [isOpen, settings.shell, availableShells])

  const handleClose = () => {
    dispatch({ type: 'SET_SETTINGS_PANEL', payload: false })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handleSettingChange = async <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } })
    await window.api.settings.update({ [key]: value })
  }

  const themeOptions = getTerminalThemeNames()

  // Format path for display (shorten home directory)
  const formatPath = (path: string): string => {
    const home = isWindows ? process.env.USERPROFILE : process.env.HOME
    if (home && path.startsWith(home)) {
      return '~' + path.slice(home.length)
    }
    return path
  }

  if (!isOpen) return null

  return (
    <div className="settings-panel-overlay" onClick={handleOverlayClick}>
      <div className="settings-panel">
        <button className="settings-close-button" onClick={handleClose}>x</button>

        <div className="settings-header">
          <h2>Settings</h2>
        </div>

        <div className="settings-content">
          {/* Shell Configuration Section */}
          <section className="settings-section">
            <h3>Shell</h3>

            <div className="setting-item">
              <label htmlFor="shell-select">Default Shell</label>
              <select
                id="shell-select"
                value={settings.shell || 'system-default'}
                onChange={(e) => handleSettingChange('shell',
                  e.target.value === 'system-default' ? undefined : e.target.value
                )}
              >
                <option value="system-default">System Default</option>
                {availableShells.map(shell => (
                  <option key={shell.path} value={shell.path}>
                    {shell.name} {shell.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-item setting-item-checkbox">
              <label htmlFor="login-shell">Login Shell Mode</label>
              <input
                id="login-shell"
                type="checkbox"
                checked={settings.shellLoginMode ?? true}
                onChange={(e) => handleSettingChange('shellLoginMode', e.target.checked)}
              />
              <span className="setting-hint">
                Load shell configuration files
              </span>
            </div>

            {settings.shellLoginMode && currentConfigFiles.length > 0 && (
              <div className="setting-info">
                <span className="setting-info-label">Config files to load:</span>
                <ul className="config-files-list">
                  {currentConfigFiles.map(file => (
                    <li key={file}>{formatPath(file)}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Node.js Configuration Section */}
          <section className="settings-section">
            <h3>Node.js</h3>

            <div className="setting-item">
              <label htmlFor="node-source">Node.js Source</label>
              <select
                id="node-source"
                value={settings.nodeSource ?? 'builtin'}
                onChange={(e) => handleSettingChange('nodeSource', e.target.value as 'builtin' | 'system' | 'auto')}
              >
                <option value="builtin">Built-in Node.js</option>
                <option value="system">System Node.js</option>
                <option value="auto">Auto (System if available)</option>
              </select>
            </div>

            <div className="setting-item setting-item-checkbox">
              <label htmlFor="preserve-vm">Preserve Version Managers</label>
              <input
                id="preserve-vm"
                type="checkbox"
                checked={settings.preserveVersionManagers ?? false}
                onChange={(e) => handleSettingChange('preserveVersionManagers', e.target.checked)}
              />
              <span className="setting-hint">
                Keep nvm, fnm, asdf environment variables
              </span>
            </div>

            {detectedVersionManagers.length > 0 && (
              <div className="setting-info">
                <span className="setting-info-label">Detected:</span>
                <span className="detected-items">
                  {detectedVersionManagers.map(vm => vm.name).join(', ')}
                </span>
              </div>
            )}
          </section>

          {/* macOS-specific section */}
          {!isWindows && (
            <section className="settings-section">
              <h3>macOS</h3>

              <div className="setting-item setting-item-checkbox">
                <label htmlFor="mac-option-meta">Option as Meta Key</label>
                <input
                  id="mac-option-meta"
                  type="checkbox"
                  checked={settings.macOptionIsMeta ?? true}
                  onChange={(e) => handleSettingChange('macOptionIsMeta', e.target.checked)}
                />
                <span className="setting-hint">
                  Use Option key for Alt+key shortcuts (e.g., Alt+t)
                </span>
              </div>
            </section>
          )}

          {/* Windows-specific section */}
          {isWindows && (
            <section className="settings-section">
              <h3>Windows</h3>

              <div className="setting-item setting-item-checkbox">
                <label htmlFor="windows-utf8">UTF-8 Encoding</label>
                <input
                  id="windows-utf8"
                  type="checkbox"
                  checked={settings.windowsUseUtf8 ?? true}
                  onChange={(e) => handleSettingChange('windowsUseUtf8', e.target.checked)}
                />
                <span className="setting-hint">
                  Enable UTF-8 encoding for terminal
                </span>
              </div>
            </section>
          )}

          {/* Terminal Appearance Section */}
          <section className="settings-section">
            <h3>Terminal Appearance</h3>

            <div className="setting-item">
              <label htmlFor="terminal-theme">Theme</label>
              <select
                id="terminal-theme"
                value={settings.terminalTheme}
                onChange={(e) => handleSettingChange('terminalTheme', e.target.value as TerminalThemeName)}
              >
                {themeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-item">
              <label htmlFor="font-size">Font Size</label>
              <div className="setting-input-group">
                <input
                  id="font-size"
                  type="number"
                  min="8"
                  max="32"
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value, 10))}
                />
                <span className="setting-unit">px</span>
              </div>
            </div>

            <div className="setting-item">
              <label htmlFor="font-family">Font Family</label>
              <select
                id="font-family"
                value={settings.fontFamily}
                onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
              >
                <option value="Menlo, Monaco, 'Courier New', monospace">Menlo</option>
                <option value="Monaco, Menlo, 'Courier New', monospace">Monaco</option>
                <option value="'SF Mono', Menlo, Monaco, monospace">SF Mono</option>
                <option value="'Fira Code', Menlo, Monaco, monospace">Fira Code</option>
                <option value="'JetBrains Mono', Menlo, Monaco, monospace">JetBrains Mono</option>
                <option value="Consolas, 'Courier New', monospace">Consolas</option>
              </select>
            </div>

            <div className="setting-item">
              <label htmlFor="cursor-style">Cursor Style</label>
              <select
                id="cursor-style"
                value={settings.cursorStyle}
                onChange={(e) => handleSettingChange('cursorStyle', e.target.value as 'block' | 'underline' | 'bar')}
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <div className="setting-item setting-item-checkbox">
              <label htmlFor="cursor-blink">Cursor Blink</label>
              <input
                id="cursor-blink"
                type="checkbox"
                checked={settings.cursorBlink}
                onChange={(e) => handleSettingChange('cursorBlink', e.target.checked)}
              />
            </div>

            <div className="setting-item">
              <label htmlFor="scrollback-lines">Scrollback Lines</label>
              <input
                id="scrollback-lines"
                type="number"
                min="100"
                max="10000"
                step="100"
                value={settings.scrollbackLines}
                onChange={(e) => handleSettingChange('scrollbackLines', parseInt(e.target.value, 10))}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
