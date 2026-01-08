import React, { useState, useEffect, useRef } from 'react'
import type { VoiceInputState, VoiceProvider } from '../../../types/voiceInput'
import './VoiceInput.css'

interface VoiceInputOverlayProps {
  isVisible: boolean
  state: VoiceInputState
  interimText: string
  provider: VoiceProvider
  error?: string | null
  isRecording: boolean
  onClose: () => void
  onConfirm: (text: string) => void
  onStartRecording: () => void
  onStopRecording: () => void
}

export const VoiceInputOverlay: React.FC<VoiceInputOverlayProps> = ({
  isVisible,
  state,
  interimText,
  provider,
  error,
  isRecording,
  onClose,
  onConfirm,
  onStartRecording,
  onStopRecording
}) => {
  // Local editable text state - accumulates transcriptions
  const [editableText, setEditableText] = useState('')
  // Track the last interim text to detect new transcriptions
  const lastInterimRef = useRef('')
  // Track if we have pending transcription being added
  const [pendingText, setPendingText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When overlay becomes visible, reset state
  useEffect(() => {
    if (isVisible) {
      setEditableText('')
      setPendingText('')
      lastInterimRef.current = ''
    }
  }, [isVisible])

  // Handle interim text updates - show as pending
  useEffect(() => {
    if (interimText && interimText !== lastInterimRef.current) {
      setPendingText(interimText)
      lastInterimRef.current = interimText
    }
  }, [interimText])

  // When recording stops and we have pending text, append it to editable text
  useEffect(() => {
    if (!isRecording && pendingText) {
      setEditableText(prev => {
        const separator = prev ? '\n' : ''
        return prev + separator + pendingText
      })
      setPendingText('')
      lastInterimRef.current = ''
    }
  }, [isRecording, pendingText])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [editableText, pendingText])

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
    if (isRecording) {
      return '正在录音...'
    }
    switch (state) {
      case 'recording':
        return '正在录音...'
      case 'processing':
        return '正在处理...'
      case 'error':
        return '识别出错'
      default:
        return '等待录音'
    }
  }

  const handleConfirm = () => {
    const finalText = editableText.trim()
    if (finalText) {
      onConfirm(finalText)
    }
    onClose()
  }

  const handleCancel = () => {
    if (isRecording) {
      onStopRecording()
    }
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to confirm
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // Combined display text: confirmed text + pending transcription
  const displayText = pendingText
    ? (editableText ? editableText + '\n' + pendingText : pendingText)
    : editableText

  const hasContent = editableText.trim() || pendingText

  return (
    <div className="voice-input-overlay voice-overlay-editable">
      <div className="voice-overlay-header">
        <div className="voice-overlay-status">
          {isRecording && <span className="recording-dot" />}
          <span>{getStatusText()}</span>
          <span className="voice-overlay-engine">{getProviderLabel()}</span>
        </div>
        <button
          className="voice-overlay-close"
          onClick={handleCancel}
          title="关闭 (Esc)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {isRecording && (
        <div className="voice-waveform">
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
          <div className="voice-waveform-bar" />
        </div>
      )}

      {error ? (
        <div className="voice-overlay-text voice-overlay-error">
          <span style={{ color: '#ef4444' }}>{error}</span>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="voice-overlay-textarea"
          value={isRecording ? displayText : editableText}
          onChange={(e) => !isRecording && setEditableText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? '请开始说话...' : '转录文本将显示在这里，可以编辑后确认'}
          readOnly={isRecording}
          rows={3}
        />
      )}

      {/* Pending text indicator during recording */}
      {isRecording && pendingText && (
        <div className="voice-overlay-pending-indicator">
          实时转录中...
        </div>
      )}

      <div className="voice-overlay-actions">
        <div className="voice-overlay-hint">
          {isRecording
            ? '松开 Option/Alt 键或点击停止'
            : hasContent
              ? 'Ctrl+Enter 确认 · Esc 取消'
              : '按住 Option/Alt 开始录音'}
        </div>
        <div className="voice-overlay-buttons">
          {isRecording ? (
            <button
              className="voice-overlay-btn voice-overlay-btn-stop"
              onClick={onStopRecording}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              停止
            </button>
          ) : (
            <button
              className="voice-overlay-btn voice-overlay-btn-record"
              onClick={onStartRecording}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <circle cx="12" cy="12" r="6"/>
              </svg>
              继续录音
            </button>
          )}
          <button
            className="voice-overlay-btn voice-overlay-btn-cancel"
            onClick={handleCancel}
          >
            取消
          </button>
          <button
            className="voice-overlay-btn voice-overlay-btn-confirm"
            onClick={handleConfirm}
            disabled={!hasContent}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

export default VoiceInputOverlay
