import React from 'react'
import type { VoiceInputState } from '../../../types/voiceInput'
import './VoiceInput.css'

interface VoiceInputButtonProps {
  state: VoiceInputState
  isEnabled: boolean
  onClick: () => void
  className?: string
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  state,
  isEnabled,
  onClick,
  className = ''
}) => {
  if (!isEnabled) {
    return null
  }

  const getStateClass = () => {
    switch (state) {
      case 'recording':
        return 'voice-btn-recording'
      case 'processing':
        return 'voice-btn-processing'
      case 'error':
        return 'voice-btn-error'
      default:
        return 'voice-btn-idle'
    }
  }

  const getTitle = () => {
    switch (state) {
      case 'recording':
        return '正在录音... 点击停止'
      case 'processing':
        return '正在处理...'
      case 'error':
        return '发生错误，点击重试'
      default:
        return '点击或按住 Option/Alt 键开始语音输入'
    }
  }

  const getIcon = () => {
    switch (state) {
      case 'recording':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="voice-icon">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        )
      case 'processing':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="voice-icon spinning">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
            <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.42 3.58-8 8-8z"/>
          </svg>
        )
      default:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="voice-icon">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        )
    }
  }

  return (
    <button
      type="button"
      className={`voice-input-btn ${getStateClass()} ${className}`}
      onClick={onClick}
      title={getTitle()}
      disabled={state === 'processing'}
    >
      {getIcon()}
      {state === 'recording' && <span className="recording-pulse" />}
    </button>
  )
}

export default VoiceInputButton
