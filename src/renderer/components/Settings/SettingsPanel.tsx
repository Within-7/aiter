/**
 * Settings Panel Component
 * Main container for all settings with tabbed navigation
 */

import React, { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppContext } from '../../context/AppContext'
import { useSettingsPanel } from '../../hooks/useSettingsPanel'
import { GeneralSettingsTab } from './GeneralSettingsTab'
import { AppearanceSettingsTab } from './AppearanceSettingsTab'
import { ShortcutsSettingsTab } from './ShortcutsSettingsTab'
import { VoiceInputSettings } from '../VoiceInput/VoiceInputSettings'
import { defaultVoiceInputSettings } from '../../../types/voiceInput'
import './SettingsPanel.css'

// Tab definitions
type SettingsTab = 'general' | 'appearance' | 'shortcuts' | 'voice'

export const SettingsPanel: React.FC = () => {
  const { t } = useTranslation('settings')
  const { state, dispatch } = useContext(AppContext)
  const isOpen = state.showSettingsPanel

  // Active tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // Use the settings panel hook
  const settingsHook = useSettingsPanel(isOpen)

  const handleClose = () => {
    dispatch({ type: 'SET_SETTINGS_PANEL', payload: false })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

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
            <button
              className={`settings-tab ${activeTab === 'voice' ? 'active' : ''}`}
              onClick={() => setActiveTab('voice')}
            >
              {t('tabs.voice')}
            </button>
          </div>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <GeneralSettingsTab settingsHook={settingsHook} />
          )}
          {activeTab === 'appearance' && (
            <AppearanceSettingsTab settingsHook={settingsHook} />
          )}
          {activeTab === 'shortcuts' && (
            <ShortcutsSettingsTab settingsHook={settingsHook} />
          )}
          {activeTab === 'voice' && (
            <section className="settings-section">
              <VoiceInputSettings
                settings={settingsHook.settings.voiceInput || defaultVoiceInputSettings}
                onSettingsChange={settingsHook.handleVoiceSettingsChange}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
