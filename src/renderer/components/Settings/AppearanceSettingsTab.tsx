/**
 * Appearance Settings Tab Component
 * Contains terminal and editor appearance settings
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { getTerminalThemeNames } from '../../themes/terminalThemes'
import { TerminalThemeName } from '../../../types'
import type { UseSettingsPanelReturn } from '../../hooks/useSettingsPanel'

interface AppearanceSettingsTabProps {
  settingsHook: UseSettingsPanelReturn
}

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({ settingsHook }) => {
  const { t } = useTranslation('settings')
  const { settings, handleSettingChange } = settingsHook
  const themeOptions = getTerminalThemeNames()

  return (
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

      <h3>{t('appearance.editor.title')}</h3>

      <div className="setting-item setting-item-checkbox">
        <label htmlFor="editor-word-wrap">{t('appearance.editor.wordWrap')}</label>
        <input
          id="editor-word-wrap"
          type="checkbox"
          checked={settings.editorWordWrap ?? true}
          onChange={(e) => handleSettingChange('editorWordWrap', e.target.checked)}
        />
        <span className="setting-hint">
          {t('appearance.editor.wordWrapHint')}
        </span>
      </div>

      <div className="setting-item setting-item-checkbox">
        <label htmlFor="editor-minimap">{t('appearance.editor.minimap')}</label>
        <input
          id="editor-minimap"
          type="checkbox"
          checked={settings.editorMinimap ?? false}
          onChange={(e) => handleSettingChange('editorMinimap', e.target.checked)}
        />
        <span className="setting-hint">
          {t('appearance.editor.minimapHint')}
        </span>
      </div>

      <div className="setting-item setting-item-checkbox">
        <label htmlFor="editor-line-numbers">{t('appearance.editor.lineNumbers')}</label>
        <input
          id="editor-line-numbers"
          type="checkbox"
          checked={settings.editorLineNumbers ?? true}
          onChange={(e) => handleSettingChange('editorLineNumbers', e.target.checked)}
        />
        <span className="setting-hint">
          {t('appearance.editor.lineNumbersHint')}
        </span>
      </div>
    </section>
  )
}
