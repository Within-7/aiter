import React, { useState } from 'react'
import type { VoiceInputSettings as VoiceInputSettingsType, VoiceProvider } from '../../../types/voiceInput'
import { defaultVoiceInputSettings } from '../../../types/voiceInput'

interface VoiceInputSettingsProps {
  settings: VoiceInputSettingsType
  onSettingsChange: (settings: VoiceInputSettingsType) => void
}

export const VoiceInputSettings: React.FC<VoiceInputSettingsProps> = ({
  settings,
  onSettingsChange
}) => {
  const [showApiKey, setShowApiKey] = useState(false)

  // 使用默认设置填充缺失字段
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
      {/* 启用开关 */}
      <div className="setting-item">
        <div className="setting-label">
          <span>启用语音输入</span>
          <span className="setting-hint">按住 Option/Alt 键说话</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={currentSettings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {currentSettings.enabled && (
        <>
          {/* 识别引擎 */}
          <div className="setting-section">
            <div className="setting-section-title">识别引擎</div>

            <div className="setting-item radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="voiceProvider"
                  value="qwen-asr"
                  checked={currentSettings.provider === 'qwen-asr'}
                  onChange={() => handleChange('provider', 'qwen-asr')}
                />
                <div className="radio-content">
                  <span className="radio-label">阿里云 Qwen-ASR</span>
                  <span className="radio-hint">云端识别，高精度，适合技术术语</span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="voiceProvider"
                  value="system"
                  checked={currentSettings.provider === 'system'}
                  onChange={() => handleChange('provider', 'system')}
                />
                <div className="radio-content">
                  <span className="radio-label">系统原生</span>
                  <span className="radio-hint">离线识别，免费，隐私优先</span>
                </div>
              </label>
            </div>
          </div>

          {/* Qwen-ASR 设置 */}
          {currentSettings.provider === 'qwen-asr' && (
            <div className="setting-section">
              <div className="setting-section-title">Qwen-ASR 设置</div>

              <div className="setting-item">
                <label className="setting-label">API Key</label>
                <div className="input-with-button">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="setting-input"
                    value={currentSettings.qwenApiKey || ''}
                    onChange={(e) => handleChange('qwenApiKey', e.target.value)}
                    placeholder="输入阿里云 DashScope API Key"
                  />
                  <button
                    type="button"
                    className="input-addon-btn"
                    onClick={() => setShowApiKey(!showApiKey)}
                    title={showApiKey ? '隐藏' : '显示'}
                  >
                    {showApiKey ? '隐藏' : '显示'}
                  </button>
                </div>
                <a
                  href="https://help.aliyun.com/zh/model-studio/get-api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="setting-link"
                >
                  获取 API Key →
                </a>
              </div>

              <div className="setting-item">
                <label className="setting-label">服务区域</label>
                <select
                  className="setting-select"
                  value={currentSettings.qwenRegion || 'cn'}
                  onChange={(e) => handleChange('qwenRegion', e.target.value as 'cn' | 'intl')}
                >
                  <option value="cn">中国 (cn)</option>
                  <option value="intl">国际 (intl)</option>
                </select>
              </div>
            </div>
          )}

          {/* 激活方式 */}
          <div className="setting-section">
            <div className="setting-section-title">激活方式</div>

            <div className="setting-item">
              <div className="setting-label">
                <span>按住说话 (Push-to-Talk)</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={currentSettings.pushToTalk.enabled}
                  onChange={(e) => handlePushToTalkChange('enabled', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {currentSettings.pushToTalk.enabled && (
              <>
                <div className="setting-item">
                  <label className="setting-label">触发键</label>
                  <select
                    className="setting-select"
                    value={currentSettings.pushToTalk.triggerKey}
                    onChange={(e) => handlePushToTalkChange('triggerKey', e.target.value)}
                  >
                    <option value="Alt">Option / Alt</option>
                    <option value="Meta">Command / Win</option>
                    <option value="Control">Control</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">最小按住时间</label>
                  <select
                    className="setting-select"
                    value={currentSettings.pushToTalk.minHoldDuration}
                    onChange={(e) => handlePushToTalkChange('minHoldDuration', Number(e.target.value))}
                  >
                    <option value={100}>100ms</option>
                    <option value={200}>200ms (推荐)</option>
                    <option value={300}>300ms</option>
                    <option value={500}>500ms</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* 识别设置 */}
          <div className="setting-section">
            <div className="setting-section-title">识别设置</div>

            <div className="setting-item">
              <label className="setting-label">识别语言</label>
              <select
                className="setting-select"
                value={currentSettings.language}
                onChange={(e) => handleChange('language', e.target.value)}
              >
                <option value="zh-CN">中文（简体）</option>
                <option value="zh-TW">中文（繁体）</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="ja-JP">日本語</option>
                <option value="ko-KR">한국어</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span>显示实时识别结果</span>
                <span className="setting-hint">边说边显示识别文字</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={currentSettings.interimResults}
                  onChange={(e) => handleChange('interimResults', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* 行为设置 */}
          <div className="setting-section">
            <div className="setting-section-title">行为设置</div>

            <div className="setting-item">
              <div className="setting-label">
                <span>在终端中自动执行</span>
                <span className="setting-hint">识别完成后自动按回车</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={currentSettings.autoExecuteInTerminal}
                  onChange={(e) => handleChange('autoExecuteInTerminal', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span>启用语音指令</span>
                <span className="setting-hint">识别"执行"、"换行"等指令</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={currentSettings.enableVoiceCommands}
                  onChange={(e) => handleChange('enableVoiceCommands', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default VoiceInputSettings
