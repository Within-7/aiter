import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInputSettings as VoiceInputSettingsType } from '../../../types/voiceInput'
import { defaultVoiceInputSettings } from '../../../types/voiceInput'

interface VoiceInputSettingsProps {
  settings: VoiceInputSettingsType
  onSettingsChange: (settings: VoiceInputSettingsType) => void
}

export const VoiceInputSettings: React.FC<VoiceInputSettingsProps> = ({
  settings,
  onSettingsChange
}) => {
  const { t } = useTranslation('settings')
  const [showApiKey, setShowApiKey] = useState(false)

  // Use default settings to fill missing fields
  const currentSettings: VoiceInputSettingsType = {
    ...defaultVoiceInputSettings,
    ...settings
  }

  const handleChange = <K extends keyof VoiceInputSettingsType>(
    key: K,
    value: VoiceInputSettingsType[K]
  ) => {
    onSettingsChange({
      ...currentSettings,
      [key]: value
    })
  }

  const handlePushToTalkChange = <K extends keyof VoiceInputSettingsType['pushToTalk']>(
    key: K,
    value: VoiceInputSettingsType['pushToTalk'][K]
  ) => {
    onSettingsChange({
      ...currentSettings,
      pushToTalk: {
        ...currentSettings.pushToTalk,
        [key]: value
      }
    })
  }

  return (
    <div className="voice-input-settings">
      {/* Enable toggle */}
      <div className="setting-item setting-item-checkbox">
        <label htmlFor="voice-enabled">{t('voice.enable')}</label>
        <input
          id="voice-enabled"
          type="checkbox"
          checked={currentSettings.enabled}
          onChange={(e) => handleChange('enabled', e.target.checked)}
        />
        <span className="setting-hint">
          {t('voice.enableHint')}
        </span>
      </div>

      {currentSettings.enabled && (
        <>
          {/* Recognition Engine Section */}
          <h3>{t('voice.engine.title')}</h3>

          <div className="setting-item">
            <label htmlFor="voice-provider">{t('voice.engine.title')}</label>
            <select
              id="voice-provider"
              value={currentSettings.provider}
              onChange={(e) => handleChange('provider', e.target.value as 'qwen-asr' | 'system')}
            >
              <option value="qwen-asr">{t('voice.engine.qwenAsr')}</option>
              <option value="system">{t('voice.engine.system')}</option>
            </select>
          </div>

          <div className="setting-info">
            <span className="setting-info-label">
              {currentSettings.provider === 'qwen-asr'
                ? t('voice.engine.qwenAsr')
                : t('voice.engine.system')}
            </span>
            <span>
              {currentSettings.provider === 'qwen-asr'
                ? t('voice.engine.qwenAsrHint')
                : t('voice.engine.systemHint')}
            </span>
          </div>

          {/* Qwen-ASR Settings */}
          {currentSettings.provider === 'qwen-asr' && (
            <>
              <h3>{t('voice.qwenSettings.title')}</h3>

              <div className="setting-item">
                <label htmlFor="qwen-api-key">{t('voice.qwenSettings.apiKey')}</label>
                <div className="setting-input-group">
                  <input
                    id="qwen-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={currentSettings.qwenApiKey || ''}
                    onChange={(e) => handleChange('qwenApiKey', e.target.value)}
                    placeholder={t('voice.qwenSettings.apiKeyPlaceholder')}
                    style={{ minWidth: '140px' }}
                  />
                  <button
                    type="button"
                    className="reset-shortcuts-button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{ marginTop: 0, padding: '6px 10px' }}
                  >
                    {showApiKey ? t('voice.hide') : t('voice.show')}
                  </button>
                </div>
              </div>

              <div className="setting-info">
                <a
                  href="https://help.aliyun.com/zh/model-studio/get-api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-color, #007acc)', textDecoration: 'none' }}
                >
                  {t('voice.qwenSettings.getApiKey')}
                </a>
              </div>

              <div className="setting-item">
                <label htmlFor="qwen-region">{t('voice.qwenSettings.region')}</label>
                <select
                  id="qwen-region"
                  value={currentSettings.qwenRegion || 'cn'}
                  onChange={(e) => handleChange('qwenRegion', e.target.value as 'cn' | 'intl')}
                >
                  <option value="cn">{t('voice.qwenSettings.regionCn')}</option>
                  <option value="intl">{t('voice.qwenSettings.regionIntl')}</option>
                </select>
              </div>
            </>
          )}

          {/* Activation Method Section */}
          <h3>{t('voice.activation.title')}</h3>

          <div className="setting-item setting-item-checkbox">
            <label htmlFor="push-to-talk">{t('voice.activation.pushToTalk')}</label>
            <input
              id="push-to-talk"
              type="checkbox"
              checked={currentSettings.pushToTalk.enabled}
              onChange={(e) => handlePushToTalkChange('enabled', e.target.checked)}
            />
          </div>

          {currentSettings.pushToTalk.enabled && (
            <>
              <div className="setting-item">
                <label htmlFor="trigger-key">{t('voice.activation.triggerKey')}</label>
                <select
                  id="trigger-key"
                  value={currentSettings.pushToTalk.triggerKey}
                  onChange={(e) => handlePushToTalkChange('triggerKey', e.target.value)}
                >
                  <option value="Alt">{t('voice.activation.triggerKeyOption')}</option>
                  <option value="Meta">{t('voice.activation.triggerKeyMeta')}</option>
                  <option value="Control">{t('voice.activation.triggerKeyControl')}</option>
                </select>
              </div>

              <div className="setting-item">
                <label htmlFor="min-hold">{t('voice.activation.minHoldDuration')}</label>
                <select
                  id="min-hold"
                  value={currentSettings.pushToTalk.minHoldDuration}
                  onChange={(e) => handlePushToTalkChange('minHoldDuration', Number(e.target.value))}
                >
                  <option value={100}>100ms</option>
                  <option value={200}>200ms {t('voice.recommended')}</option>
                  <option value={300}>300ms</option>
                  <option value={500}>500ms</option>
                </select>
              </div>
            </>
          )}

          {/* Recognition Settings Section */}
          <h3>{t('voice.recognition.title')}</h3>

          <div className="setting-item">
            <label htmlFor="voice-language">{t('voice.recognition.language')}</label>
            <select
              id="voice-language"
              value={currentSettings.language}
              onChange={(e) => handleChange('language', e.target.value)}
            >
              <option value="zh-CN">{t('voice.recognition.langZhCN')}</option>
              <option value="zh-TW">{t('voice.recognition.langZhTW')}</option>
              <option value="en-US">{t('voice.recognition.langEnUS')}</option>
              <option value="en-GB">{t('voice.recognition.langEnGB')}</option>
              <option value="ja-JP">{t('voice.recognition.langJaJP')}</option>
              <option value="ko-KR">{t('voice.recognition.langKoKR')}</option>
            </select>
          </div>

          <div className="setting-item setting-item-checkbox">
            <label htmlFor="interim-results">{t('voice.recognition.interimResults')}</label>
            <input
              id="interim-results"
              type="checkbox"
              checked={currentSettings.interimResults}
              onChange={(e) => handleChange('interimResults', e.target.checked)}
            />
            <span className="setting-hint">
              {t('voice.recognition.interimResultsHint')}
            </span>
          </div>

          {/* Behavior Settings Section */}
          <h3>{t('voice.behavior.title')}</h3>

          <div className="setting-item setting-item-checkbox">
            <label htmlFor="auto-execute">{t('voice.behavior.autoExecute')}</label>
            <input
              id="auto-execute"
              type="checkbox"
              checked={currentSettings.autoExecuteInTerminal}
              onChange={(e) => handleChange('autoExecuteInTerminal', e.target.checked)}
            />
            <span className="setting-hint">
              {t('voice.behavior.autoExecuteHint')}
            </span>
          </div>

          <div className="setting-item setting-item-checkbox">
            <label htmlFor="voice-commands">{t('voice.behavior.voiceCommands')}</label>
            <input
              id="voice-commands"
              type="checkbox"
              checked={currentSettings.enableVoiceCommands}
              onChange={(e) => handleChange('enableVoiceCommands', e.target.checked)}
            />
            <span className="setting-hint">
              {t('voice.behavior.voiceCommandsHint')}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default VoiceInputSettings
