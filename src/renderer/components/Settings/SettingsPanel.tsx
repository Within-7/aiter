import React, { useContext, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AppContext } from '../../context/AppContext'
import { getTerminalThemeNames } from '../../themes/terminalThemes'
import { TerminalThemeName, DetectedShell, VersionManagerInfo, ShellType, ShortcutConfig, KeyboardShortcut } from '../../../types'
import { ShortcutInput } from './ShortcutInput'
import { availableLanguages, changeLanguage, type LanguageCode } from '../../i18n'
import './SettingsPanel.css'

// Default shortcuts for reset (labels will be translated via i18n)
const defaultShortcuts: ShortcutConfig[] = [
  { action: 'newTerminal', label: 'New Terminal', shortcut: { key: 't', metaKey: true }, enabled: true },
  { action: 'closeTab', label: 'Close Tab', shortcut: { key: 'w', metaKey: true }, enabled: true },
  { action: 'saveFile', label: 'Save File', shortcut: { key: 's', metaKey: true }, enabled: true },
  { action: 'openSettings', label: 'Open Settings', shortcut: { key: ',', metaKey: true }, enabled: true },
  { action: 'newWindow', label: 'New Window', shortcut: { key: 'n', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'toggleSidebar', label: 'Toggle Sidebar', shortcut: { key: 'b', metaKey: true }, enabled: true },
  { action: 'nextTab', label: 'Next Tab', shortcut: { key: ']', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'prevTab', label: 'Previous Tab', shortcut: { key: '[', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'focusTerminal', label: 'Focus Terminal', shortcut: { key: '`', ctrlKey: true }, enabled: true },
  { action: 'focusEditor', label: 'Focus Editor', shortcut: { key: 'e', metaKey: true, shiftKey: true }, enabled: true }
]

// Tab definitions
type SettingsTab = 'general' | 'appearance' | 'shortcuts'

export const SettingsPanel: React.FC = () => {
  const { t } = useTranslation('settings')
  const { state, dispatch } = useContext(AppContext)
  const isOpen = state.showSettingsPanel
  const { settings } = state

  // Active tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // Shell and version manager detection state
  const [availableShells, setAvailableShells] = useState<DetectedShell[]>([])
  const [detectedVersionManagers, setDetectedVersionManagers] = useState<VersionManagerInfo[]>([])
  const [currentConfigFiles, setCurrentConfigFiles] = useState<string[]>([])
  const [isWindows] = useState(() => navigator.platform.toLowerCase().includes('win'))
  const [isMac] = useState(() => navigator.platform.toLowerCase().includes('mac'))

  // Proxy status state
  const [systemProxyStatus, setSystemProxyStatus] = useState<{ mode: string; url?: string; active: boolean } | null>(null)

  // Fetch available shells, version managers, and proxy status on mount
  useEffect(() => {
    if (isOpen) {
      // Detect available shells
      window.api.shell.detectAvailable()
        .then(result => {
          if (result.success && result.shells) {
            setAvailableShells(result.shells)
          }
        })
        .catch(error => {
          console.error('Failed to detect available shells:', error)
        })

      // Detect version managers
      window.api.versionManager.getDetected()
        .then(result => {
          if (result.success && result.managers) {
            setDetectedVersionManagers(result.managers)
          }
        })
        .catch(error => {
          console.error('Failed to detect version managers:', error)
        })

      // Get proxy status
      window.api.proxy.getStatus()
        .then(result => {
          if (result.success) {
            setSystemProxyStatus({
              mode: result.mode || 'off',
              url: result.url,
              active: result.active || false
            })
          }
        })
        .catch(error => {
          console.error('Failed to get proxy status:', error)
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

      window.api.shell.getConfigFiles(shellType)
        .then(result => {
          if (result.success && result.files) {
            setCurrentConfigFiles(result.files)
          }
        })
        .catch(error => {
          console.error('Failed to get shell config files:', error)
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

  // Handle language change
  const handleLanguageChange = async (newLanguage: LanguageCode) => {
    await changeLanguage(newLanguage)
    handleSettingChange('language', newLanguage)
  }

  const themeOptions = getTerminalThemeNames()

  // Get current shortcuts or use defaults
  const shortcuts = settings.shortcuts || defaultShortcuts

  // Get translated shortcut label
  const getShortcutLabel = (action: string): string => {
    const key = `shortcuts.keys.${action}` as const
    return t(key)
  }

  // Update a specific shortcut
  const handleShortcutChange = useCallback((action: string, newShortcut: KeyboardShortcut) => {
    const updatedShortcuts = shortcuts.map(s =>
      s.action === action ? { ...s, shortcut: newShortcut } : s
    )
    handleSettingChange('shortcuts', updatedShortcuts)
  }, [shortcuts, handleSettingChange])

  // Toggle shortcut enabled state
  const handleShortcutToggle = useCallback((action: string, enabled: boolean) => {
    const updatedShortcuts = shortcuts.map(s =>
      s.action === action ? { ...s, enabled } : s
    )
    handleSettingChange('shortcuts', updatedShortcuts)
  }, [shortcuts, handleSettingChange])

  // Reset all shortcuts to default
  const handleResetShortcuts = useCallback(() => {
    handleSettingChange('shortcuts', defaultShortcuts)
  }, [handleSettingChange])

  // Format path for display (shorten home directory)
  const formatPath = (path: string): string => {
    const homePatterns = isWindows
      ? [/^C:\\Users\\[^\\]+/, /^\/c\/Users\/[^/]+/]
      : [/^\/Users\/[^/]+/, /^\/home\/[^/]+/]

    for (const pattern of homePatterns) {
      const match = path.match(pattern)
      if (match) {
        return '~' + path.slice(match[0].length)
      }
    }
    return path
  }

  if (!isOpen) return null

  // Render General tab content
  const renderGeneralTab = () => (
    <>
      {/* Language Section */}
      <section className="settings-section">
        <h3>{t('general.language.title')}</h3>

        <div className="setting-item">
          <label htmlFor="language-select">{t('general.language.displayLanguage')}</label>
          <select
            id="language-select"
            value={settings.language || 'en'}
            onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
          >
            {availableLanguages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Shell Configuration Section */}
      <section className="settings-section">
        <h3>{t('general.shell.title')}</h3>

        <div className="setting-item">
          <label htmlFor="shell-select">{t('general.shell.defaultShell')}</label>
          <select
            id="shell-select"
            value={settings.shell || 'system-default'}
            onChange={(e) => handleSettingChange('shell',
              e.target.value === 'system-default' ? undefined : e.target.value
            )}
          >
            <option value="system-default">{t('general.shell.systemDefault')}</option>
            {availableShells.map(shell => (
              <option key={shell.path} value={shell.path}>
                {shell.name} {shell.isDefault ? t('general.shell.defaultBadge') : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-item setting-item-checkbox">
          <label htmlFor="login-shell">{t('general.shell.loginShellMode')}</label>
          <input
            id="login-shell"
            type="checkbox"
            checked={settings.shellLoginMode ?? true}
            onChange={(e) => handleSettingChange('shellLoginMode', e.target.checked)}
          />
          <span className="setting-hint">
            {t('general.shell.loginShellHint')}
          </span>
        </div>

        {settings.shellLoginMode && currentConfigFiles.length > 0 && (
          <div className="setting-info">
            <span className="setting-info-label">{t('general.shell.configFilesToLoad')}</span>
            <ul className="config-files-list">
              {currentConfigFiles.map(file => (
                <li key={file}>{formatPath(file)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Terminal Startup Command Section */}
      <section className="settings-section">
        <h3>{t('general.startupCommand.title')}</h3>

        <div className="setting-item setting-item-checkbox">
          <label htmlFor="enable-startup-command">{t('general.startupCommand.enable')}</label>
          <input
            id="enable-startup-command"
            type="checkbox"
            checked={settings.enableStartupCommand ?? true}
            onChange={(e) => handleSettingChange('enableStartupCommand', e.target.checked)}
          />
          <span className="setting-hint">
            {t('general.startupCommand.enableHint')}
          </span>
        </div>

        {settings.enableStartupCommand && (
          <div className="setting-item setting-item-command">
            <label htmlFor="startup-command">{t('general.startupCommand.command')}</label>
            <input
              id="startup-command"
              type="text"
              className="command-input"
              value={settings.startupCommand ?? 'minto'}
              onChange={(e) => handleSettingChange('startupCommand', e.target.value)}
              placeholder="minto"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        )}
      </section>

      {/* Node.js Configuration Section */}
      <section className="settings-section">
        <h3>{t('general.nodejs.title')}</h3>

        <div className="setting-item">
          <label htmlFor="node-source">{t('general.nodejs.source')}</label>
          <select
            id="node-source"
            value={settings.nodeSource ?? 'builtin'}
            onChange={(e) => handleSettingChange('nodeSource', e.target.value as 'builtin' | 'system' | 'auto')}
          >
            <option value="builtin">{t('general.nodejs.builtIn')}</option>
            <option value="system">{t('general.nodejs.system')}</option>
            <option value="auto">{t('general.nodejs.auto')}</option>
          </select>
        </div>

        <div className="setting-item setting-item-checkbox">
          <label htmlFor="preserve-vm">{t('general.nodejs.preserveVersionManagers')}</label>
          <input
            id="preserve-vm"
            type="checkbox"
            checked={settings.preserveVersionManagers ?? false}
            onChange={(e) => handleSettingChange('preserveVersionManagers', e.target.checked)}
          />
          <span className="setting-hint">
            {t('general.nodejs.preserveVersionManagersHint')}
          </span>
        </div>

        {detectedVersionManagers.length > 0 && (
          <div className="setting-info">
            <span className="setting-info-label">{t('general.nodejs.detected')}</span>
            <span className="detected-items">
              {detectedVersionManagers.map(vm => vm.name).join(', ')}
            </span>
          </div>
        )}
      </section>

      {/* Proxy Configuration Section */}
      <section className="settings-section">
        <h3>{t('general.proxy.title')}</h3>

        <div className="setting-item setting-item-with-hint">
          <div className="setting-row">
            <label htmlFor="proxy-mode">{t('general.proxy.mode')}</label>
            <select
              id="proxy-mode"
              value={settings.proxyMode ?? 'off'}
              onChange={(e) => handleSettingChange('proxyMode', e.target.value as 'off' | 'manual' | 'system')}
            >
              <option value="off">{t('general.proxy.modes.off')}</option>
              <option value="manual">{t('general.proxy.modes.manual')}</option>
              <option value="system">{t('general.proxy.modes.system')}</option>
            </select>
          </div>
          <span className="setting-hint">
            {t('general.proxy.modeHint')}
          </span>
        </div>

        {settings.proxyMode === 'manual' && (
          <div className="proxy-config-grid">
            <div className="proxy-config-item">
              <label htmlFor="proxy-protocol">{t('general.proxy.protocol')}</label>
              <select
                id="proxy-protocol"
                value={settings.proxyProtocol ?? 'http'}
                onChange={(e) => handleSettingChange('proxyProtocol', e.target.value as 'http' | 'socks5')}
              >
                <option value="http">HTTP</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>

            <div className="proxy-config-item">
              <label htmlFor="proxy-port">{t('general.proxy.port')}</label>
              <input
                id="proxy-port"
                type="number"
                min="1"
                max="65535"
                value={settings.proxyPort ?? 1087}
                onChange={(e) => handleSettingChange('proxyPort', parseInt(e.target.value, 10))}
                placeholder="1087"
              />
            </div>

            <div className="proxy-config-item full-width">
              <label htmlFor="proxy-host">{t('general.proxy.host')}</label>
              <input
                id="proxy-host"
                type="text"
                value={settings.proxyHost ?? '127.0.0.1'}
                onChange={(e) => handleSettingChange('proxyHost', e.target.value)}
                placeholder="127.0.0.1"
              />
            </div>
          </div>
        )}

        {systemProxyStatus && systemProxyStatus.active && (
          <div className="setting-info setting-info-warning">
            <span className="setting-info-label">{t('general.proxy.systemDetected')}</span>
            <span className="detected-items">{systemProxyStatus.url}</span>
          </div>
        )}

        {settings.proxyMode === 'off' && (
          <div className="setting-info">
            <span className="setting-info-label">{t('general.proxy.mcpNote')}</span>
          </div>
        )}
      </section>

      {/* Terminal Behavior Section */}
      <section className="settings-section">
        <h3>{t('general.terminal.title')}</h3>

        <div className="setting-item setting-item-checkbox">
          <label htmlFor="confirm-terminal-close">{t('general.terminal.confirmClose')}</label>
          <input
            id="confirm-terminal-close"
            type="checkbox"
            checked={settings.confirmTerminalClose ?? true}
            onChange={(e) => handleSettingChange('confirmTerminalClose', e.target.checked)}
          />
          <span className="setting-hint">
            {t('general.terminal.confirmCloseHint')}
          </span>
        </div>
      </section>

      {/* macOS-specific section */}
      {isMac && (
        <section className="settings-section">
          <h3>{t('general.macos.title')}</h3>

          <div className="setting-item setting-item-checkbox">
            <label htmlFor="mac-option-meta">{t('general.macos.optionAsMetaKey')}</label>
            <input
              id="mac-option-meta"
              type="checkbox"
              checked={settings.macOptionIsMeta ?? true}
              onChange={(e) => handleSettingChange('macOptionIsMeta', e.target.checked)}
            />
            <span className="setting-hint">
              {t('general.macos.optionAsMetaKeyHint')}
            </span>
          </div>
        </section>
      )}

      {/* Windows-specific section */}
      {isWindows && (
        <section className="settings-section">
          <h3>{t('general.windows.title')}</h3>

          <div className="setting-item setting-item-checkbox">
            <label htmlFor="windows-utf8">{t('general.windows.utf8Encoding')}</label>
            <input
              id="windows-utf8"
              type="checkbox"
              checked={settings.windowsUseUtf8 ?? true}
              onChange={(e) => handleSettingChange('windowsUseUtf8', e.target.checked)}
            />
            <span className="setting-hint">
              {t('general.windows.utf8EncodingHint')}
            </span>
          </div>
        </section>
      )}
    </>
  )

  // Render Appearance tab content
  const renderAppearanceTab = () => (
    <section className="settings-section">
      <h3>{t('appearance.terminal.title')}</h3>

      <div className="setting-item">
        <label htmlFor="terminal-theme">{t('appearance.terminal.theme')}</label>
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
        <label htmlFor="font-size">{t('appearance.terminal.fontSize')}</label>
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
        <label htmlFor="font-family">{t('appearance.terminal.fontFamily')}</label>
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
        <label htmlFor="cursor-style">{t('appearance.terminal.cursorStyle')}</label>
        <select
          id="cursor-style"
          value={settings.cursorStyle}
          onChange={(e) => handleSettingChange('cursorStyle', e.target.value as 'block' | 'underline' | 'bar')}
        >
          <option value="block">{t('appearance.terminal.cursorStyles.block')}</option>
          <option value="underline">{t('appearance.terminal.cursorStyles.underline')}</option>
          <option value="bar">{t('appearance.terminal.cursorStyles.bar')}</option>
        </select>
      </div>

      <div className="setting-item setting-item-checkbox">
        <label htmlFor="cursor-blink">{t('appearance.terminal.cursorBlink')}</label>
        <input
          id="cursor-blink"
          type="checkbox"
          checked={settings.cursorBlink}
          onChange={(e) => handleSettingChange('cursorBlink', e.target.checked)}
        />
      </div>

      <div className="setting-item">
        <label htmlFor="scrollback-lines">{t('appearance.terminal.scrollback')}</label>
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
  )

  // Render Shortcuts tab content
  const renderShortcutsTab = () => (
    <section className="settings-section">
      <div className="shortcuts-list">
        {shortcuts.map(shortcutConfig => (
          <div key={shortcutConfig.action} className="shortcut-item">
            <div className="shortcut-info">
              <input
                type="checkbox"
                checked={shortcutConfig.enabled}
                onChange={(e) => handleShortcutToggle(shortcutConfig.action, e.target.checked)}
                className="shortcut-toggle"
              />
              <span className={`shortcut-label ${!shortcutConfig.enabled ? 'disabled' : ''}`}>
                {getShortcutLabel(shortcutConfig.action)}
              </span>
            </div>
            <ShortcutInput
              value={shortcutConfig.shortcut}
              onChange={(newShortcut) => handleShortcutChange(shortcutConfig.action, newShortcut)}
              disabled={!shortcutConfig.enabled}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="reset-shortcuts-button"
        onClick={handleResetShortcuts}
      >
        {t('shortcuts.resetDefault')}
      </button>
    </section>
  )

  return (
    <div className="settings-panel-overlay" onClick={handleOverlayClick}>
      <div className="settings-panel">
        <button className="settings-close-button" onClick={handleClose}>x</button>

        <div className="settings-header">
          <h2>{t('title')}</h2>
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              {t('tabs.general')}
            </button>
            <button
              className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              {t('tabs.appearance')}
            </button>
            <button
              className={`settings-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              {t('tabs.shortcuts')}
            </button>
          </div>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'appearance' && renderAppearanceTab()}
          {activeTab === 'shortcuts' && renderShortcutsTab()}
        </div>
      </div>
    </div>
  )
}
