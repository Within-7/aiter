/**
 * Shortcuts Settings Tab Component
 * Contains keyboard shortcuts configuration
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ShortcutInput } from './ShortcutInput'
import type { UseSettingsPanelReturn } from '../../hooks/useSettingsPanel'

interface ShortcutsSettingsTabProps {
  settingsHook: UseSettingsPanelReturn
}

export const ShortcutsSettingsTab: React.FC<ShortcutsSettingsTabProps> = ({ settingsHook }) => {
  const { t } = useTranslation('settings')

  const {
    shortcuts,
    handleShortcutChange,
    handleShortcutToggle,
    handleResetShortcuts
  } = settingsHook

  // Get translated shortcut label
  const getShortcutLabel = (action: string): string => {
    const key = `shortcuts.keys.${action}` as const
    return t(key)
  }

  return (
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
}
