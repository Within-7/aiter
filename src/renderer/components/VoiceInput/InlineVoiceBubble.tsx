import React from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInputState } from '../../../types/voiceInput'
import './VoiceInput.css'

interface InlineVoiceBubbleProps {
  isVisible: boolean
  state: VoiceInputState
  interimText: string
  error?: string | null
}

/**
 * Inline voice bubble that appears near cursor during Push-to-Talk recording
 * Shows real-time transcription and recording status
 */
export const InlineVoiceBubble: React.FC<InlineVoiceBubbleProps> = ({
  isVisible,
  state,
  interimText,
  error
}) => {
  const { t } = useTranslation('voice')

  if (!isVisible) return null

  const getStatusIcon = () => {
    switch (state) {
      case 'recording':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className="bubble-icon recording">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        )
      case 'processing':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className="bubble-icon spinning">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
            <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.42 3.58-8 8-8z"/>
          </svg>
        )
      case 'error':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className="bubble-icon error">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        )
      default:
        return null
    }
  }

  const getDisplayText = () => {
    if (error) return error
    if (interimText) return interimText
    if (state === 'recording') return t('status.recording')
    if (state === 'processing') return t('status.processing')
    return t('messages.emptyHint')
  }

  return (
    <div className={`inline-voice-bubble ${state}`}>
      <div className="bubble-content">
        {getStatusIcon()}
        <span className="bubble-text">{getDisplayText()}</span>
        {state === 'recording' && <span className="recording-pulse-small" />}
      </div>
      <div className="bubble-hint">
        {state === 'recording' ? t('actions.releaseToStop') : ''}
      </div>
    </div>
  )
}

export default InlineVoiceBubble
