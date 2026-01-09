import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInputState, VoiceProvider } from '../../../types/voiceInput'
import './VoicePanel.css'

export interface VoiceMessage {
  id: string
  text: string
  timestamp: Date
  isEditing?: boolean
}

interface VoicePanelProps {
  isOpen: boolean
  isRecording: boolean
  state: VoiceInputState
  interimText: string
  provider: VoiceProvider
  error?: string | null
  onClose: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onInsertToTerminal: (text: string) => void
  onInsertToEditor: (text: string) => void
  activeTarget: 'terminal' | 'editor' | null
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  isOpen,
  isRecording,
  state,
  interimText,
  provider,
  error,
  onClose,
  onStartRecording,
  onStopRecording,
  onInsertToTerminal,
  onInsertToEditor,
  activeTarget
}) => {
  const { t } = useTranslation('voice')
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track previous recording state to detect when recording stops
  const prevIsRecordingRef = useRef(isRecording)
  const lastAddedTextRef = useRef('')

  // When recording stops, add the transcribed text as a new message
  useEffect(() => {
    const wasRecording = prevIsRecordingRef.current
    prevIsRecordingRef.current = isRecording

    if (wasRecording && !isRecording && interimText.trim()) {
      // Recording just stopped with text - add as new message
      const text = interimText.trim()
      if (text !== lastAddedTextRef.current) {
        lastAddedTextRef.current = text
        const newMessage: VoiceMessage = {
          id: Date.now().toString(),
          text,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, newMessage])
      }
    }
  }, [isRecording, interimText])

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset lastAddedText when panel opens
  useEffect(() => {
    if (isOpen) {
      lastAddedTextRef.current = ''
    }
  }, [isOpen])

  const handleDelete = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  const handleEdit = useCallback((message: VoiceMessage) => {
    setEditingId(message.id)
    setEditText(message.text)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (editingId && editText.trim()) {
      setMessages(prev => prev.map(m =>
        m.id === editingId ? { ...m, text: editText.trim() } : m
      ))
    }
    setEditingId(null)
    setEditText('')
  }, [editingId, editText])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText('')
  }, [])

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleCopyAll = useCallback(() => {
    const allText = messages.map(m => m.text).join('\n\n')
    navigator.clipboard.writeText(allText)
  }, [messages])

  const handleClearAll = useCallback(() => {
    setMessages([])
    lastAddedTextRef.current = ''
  }, [])

  const handleInsert = useCallback((text: string) => {
    if (activeTarget === 'terminal') {
      onInsertToTerminal(text)
    } else if (activeTarget === 'editor') {
      onInsertToEditor(text)
    }
  }, [activeTarget, onInsertToTerminal, onInsertToEditor])

  const handleInsertAll = useCallback(() => {
    // Use appropriate separator based on target
    // Terminal: space (newlines would execute as separate commands)
    // Editor: newline (preserve paragraph structure)
    const separator = activeTarget === 'terminal' ? ' ' : '\n\n'
    const allText = messages.map(m => m.text).join(separator)
    handleInsert(allText)
  }, [messages, handleInsert, activeTarget])

  const getProviderLabel = () => {
    switch (provider) {
      case 'qwen-asr':
        return 'Qwen-ASR'
      case 'system':
        return 'System'
      default:
        return provider
    }
  }

  const getStatusText = () => {
    if (isRecording) return t('status.recording')
    if (state === 'processing') return t('status.processing')
    if (state === 'error') return t('status.error')
    return t('status.idle')
  }

  const getStatusClass = () => {
    if (isRecording) return 'recording'
    if (state === 'processing') return 'processing'
    if (state === 'error') return 'error'
    return 'idle'
  }

  if (!isOpen) return null

  return (
    <div className="voice-panel">
      {/* Header */}
      <div className="voice-panel-header">
        <div className="voice-panel-title">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <span>{t('title')}</span>
          <span className="voice-panel-provider">{getProviderLabel()}</span>
        </div>
        <button className="voice-panel-close" onClick={onClose} title={t('actions.cancel')}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Status bar */}
      <div className={`voice-panel-status ${getStatusClass()}`}>
        {isRecording && <span className="recording-indicator" />}
        <span className="status-text">{getStatusText()}</span>
        {error && <span className="error-text">{error}</span>}
      </div>

      {/* Messages list */}
      <div className="voice-panel-messages">
        {messages.length === 0 && !isRecording && !interimText ? (
          <div className="voice-panel-empty">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            <p>{t('messages.empty')}</p>
            <p className="hint">{t('messages.emptyHint')}</p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div key={message.id} className="voice-message">
                {editingId === message.id ? (
                  <div className="voice-message-edit">
                    <textarea
                      ref={textareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className="voice-message-edit-actions">
                      <button onClick={handleSaveEdit} className="btn-save">
                        {t('actions.save')}
                      </button>
                      <button onClick={handleCancelEdit} className="btn-cancel">
                        {t('actions.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="voice-message-text">{message.text}</div>
                    <div className="voice-message-actions">
                      <button
                        onClick={() => handleInsert(message.text)}
                        title={activeTarget === 'terminal' ? t('actions.insertToTerminal') : t('actions.insertToEditor')}
                        disabled={!activeTarget}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleCopy(message.text)} title={t('actions.copy')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleEdit(message)} title={t('actions.edit')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(message.id)} title={t('actions.delete')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Current recording display */}
            {(isRecording || interimText) && (
              <div className="voice-message voice-message-current">
                <div className="voice-message-text">
                  {interimText || t('messages.emptyHint')}
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
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Actions bar */}
      <div className="voice-panel-actions">
        <div className="voice-panel-hint">
          {isRecording ? t('actions.releaseToStop') : t('actions.holdToSpeak')}
        </div>
        <div className="voice-panel-buttons">
          {isRecording ? (
            <button className="btn-stop" onClick={onStopRecording}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              {t('actions.stopRecording')}
            </button>
          ) : (
            <button className="btn-record" onClick={onStartRecording}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <circle cx="12" cy="12" r="6"/>
              </svg>
              {t('actions.startRecording')}
            </button>
          )}

          {messages.length > 0 && (
            <>
              <button
                className="btn-insert"
                onClick={handleInsertAll}
                disabled={!activeTarget}
                title={!activeTarget ? t('messages.noTarget') : undefined}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                {activeTarget === 'terminal' ? t('actions.insertToTerminal') : t('actions.insertToEditor')}
              </button>
              <button className="btn-copy" onClick={handleCopyAll} title={t('actions.copy')}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
              <button className="btn-clear" onClick={handleClearAll} title={t('actions.clearAll')}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default VoicePanel
