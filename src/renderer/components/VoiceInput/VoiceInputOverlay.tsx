import React from 'react'
import type { VoiceInputState, VoiceProvider } from '../../../types/voiceInput'
import './VoiceInput.css'

interface VoiceInputOverlayProps {
  isVisible: boolean
  state: VoiceInputState
  interimText: string
  provider: VoiceProvider
  error?: string | null
  onClose: () => void
}

export const VoiceInputOverlay: React.FC<VoiceInputOverlayProps> = ({
  isVisible,
  state,
  interimText,
  provider,
  error,
  onClose
}) => {
  if (!isVisible) {
    return null
  }

  const getProviderLabel = () => {
    switch (provider) {
      case 'qwen-asr':
        return 'Qwen-ASR'
      case 'system':
        return '系统语音'
      default:
        return provider
    }
  }

  const getStatusText = () => {
    switch (state) {
      case 'recording':
        return '正在录音...'
      case 'processing':
        return '正在处理...'
      case 'error':
        return '识别出错'
      default:
        return '准备就绪'
    }
  }

  return (
    <div className="voice-input-overlay">
      <div className="voice-overlay-header">
        <div className="voice-overlay-status">
          {state === 'recording' && <span className="recording-dot" />}
          <span>{getStatusText()}</span>
          <span className="voice-overlay-engine">{getProviderLabel()}</span>
        </div>
        <button
          className="voice-overlay-close"
          onClick={onClose}
          title="关闭"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {state === 'recording' && (
        <div className="voice-waveform">
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
        </div>
      )}

      <div className={`voice-overlay-text ${!interimText && !error ? 'placeholder' : ''}`}>
        {error ? (
          <span style={{ color: '#ef4444' }}>{error}</span>
        ) : interimText ? (
          interimText
        ) : (
          '请开始说话...'
        )}
      </div>

      <div className="voice-overlay-hint">
        {state === 'recording'
          ? '松开 Option/Alt 键结束录音'
          : '按住 Option/Alt 键开始录音'}
      </div>
    </div>
  )
}

export default VoiceInputOverlay
