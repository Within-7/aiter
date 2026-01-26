/**
 * General Settings Tab Component
 * Contains language, shell, Node.js, proxy, and platform-specific settings
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { availableLanguages, type LanguageCode } from '../../i18n'
import type { UseSettingsPanelReturn } from '../../hooks/useSettingsPanel'

interface GeneralSettingsTabProps {
  settingsHook: UseSettingsPanelReturn
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({ settingsHook }) => {
  const { t } = useTranslation('settings')

  const {
    settings,
    availableShells,
    detectedVersionManagers,
    currentConfigFiles,
    systemProxyStatus,
    defaultConfigPath,
    isWindows,
    isMac,
    handleSettingChange,
    handleLanguageChange,
    getConfigIsolation,
    handleConfigIsolationToggle,
    handleToolIsolationToggle,
    formatPath
  } = settingsHook

  return (
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

      {/* Configuration Isolation Section (Hybrid Mode) */}
      <section className="settings-section">
        <h3>{t('general.configIsolation.title')}</h3>

        <div className="setting-item setting-item-checkbox">
          <label htmlFor="config-isolation-enabled">{t('general.configIsolation.enable')}</label>
          <input
            id="config-isolation-enabled"
            type="checkbox"
            checked={getConfigIsolation().enabled}
            onChange={(e) => handleConfigIsolationToggle(e.target.checked)}
          />
          <span className="setting-hint">
            {t('general.configIsolation.enableHint')}
          </span>
        </div>

        {getConfigIsolation().enabled && (
          <>
            <div className="setting-info">
              <span className="setting-info-label">{t('general.configIsolation.basePath')}</span>
              <span className="detected-items">{formatPath(getConfigIsolation().basePath || defaultConfigPath)}</span>
            </div>

            <div className="config-isolation-tools">
              <span className="setting-subsection-label">{t('general.configIsolation.toolsTitle')}</span>
              {getConfigIsolation().tools.map(tool => (
                <div key={tool.id} className="config-isolation-tool-item">
                  <div className="tool-header">
                    <input
                      type="checkbox"
                      id={`tool-${tool.id}`}
                      checked={tool.enabled}
                      onChange={(e) => handleToolIsolationToggle(tool.id, e.target.checked)}
                    />
                    <label htmlFor={`tool-${tool.id}`} className="tool-name">{tool.name}</label>
                    <span className="tool-env-var">{tool.envVar}</span>
                  </div>
                  {tool.description && (
                    <span className="tool-description">{tool.description}</span>
                  )}
                  {tool.enabled && (
                    <div className="tool-path">
                      <span className="tool-path-label">{t('general.configIsolation.configPath')}</span>
                      <span className="tool-path-value">
                        {formatPath(tool.customPath || `${getConfigIsolation().basePath || defaultConfigPath}/${tool.id}`)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
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
}
