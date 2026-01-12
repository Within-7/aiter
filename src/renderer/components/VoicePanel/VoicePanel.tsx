import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInputState, VoiceProvider, VoiceTranscription } from '../../../types/voiceInput'
import './VoicePanel.css'

export interface VoiceMessage {
  id: string
  text: string
  timestamp: Date
  isEditing?: boolean
  source?: 'inline' | 'panel'  // Source indicator
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
  // Global transcription history (shared with inline mode)
  transcriptions: VoiceTranscription[]
  onAddTranscription: (transcription: VoiceTranscription) => void
  onUpdateTranscription: (id: string, text: string) => void
  onDeleteTranscription: (id: string) => void
  onClearTranscriptions: () => void
  // Active project ID for persistence
  activeProjectId: string | null
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
  activeTarget,
  transcriptions,
  onAddTranscription,
  onUpdateTranscription,
  onDeleteTranscription,
  onClearTranscriptions,
  activeProjectId
}) => {
  const { t } = useTranslation('voice')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Convert global transcriptions to local message format for display
  const messages = useMemo<VoiceMessage[]>(() => {
    return transcriptions.map(t => ({
      id: t.id,
      text: t.text,
      timestamp: new Date(t.timestamp),
      source: t.source
    }))
  }, [transcriptions])

  // Track previous recording state to detect when recording stops
  const prevIsRecordingRef = useRef(isRecording)
  const lastAddedTextRef = useRef('')

  // When recording stops, add the transcribed text as a new message (panel mode)
  useEffect(() => {
    const wasRecording = prevIsRecordingRef.current
    prevIsRecordingRef.current = isRecording

    if (wasRecording && !isRecording && interimText.trim()) {
      // Recording just stopped with text - add as new transcription
      const text = interimText.trim()
      if (text !== lastAddedTextRef.current) {
        lastAddedTextRef.current = text
        onAddTranscription({
          id: Date.now().toString(),
          text,
          timestamp: Date.now(),
          source: 'panel',
          projectId: activeProjectId || undefined
        })
      }
    }
  }, [isRecording, interimText, onAddTranscription, activeProjectId])

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
    onDeleteTranscription(id)
  }, [onDeleteTranscription])

  const handleEdit = useCallback((message: VoiceMessage) => {
    setEditingId(message.id)
    setEditText(message.text)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (editingId && editText.trim()) {
      onUpdateTranscription(editingId, editText.trim())
    }
    setEditingId(null)
    setEditText('')
  }, [editingId, editText, onUpdateTranscription])

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
    onClearTranscriptions()
    lastAddedTextRef.current = ''
  }, [onClearTranscriptions])

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
      {/* Header with integrated status */}
      <div className="voice-panel-header">
        <div className="voice-panel-title">
          <span className={`voice-panel-status-dot ${getStatusClass()}`} title={getStatusText()} />
          <span>{t('title')}</span>
          {error && <span className="voice-panel-error" title={error}>!</span>}
        </div>
        <button className="voice-panel-close" onClick={onClose} title={t('actions.cancel')}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Messages list */}
      <div className="voice-panel-messages">
        {messages.length === 0 && !isRecording && !interimText ? (
          <div className="voice-panel-empty">
            <p>{t('messages.emptyHint')}</p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div key={message.id} className={`voice-message ${message.source === 'inline' ? 'voice-message-inline' : ''}`}>
                {editingId === message.id ? (
                  <div className="voice-message-edit">
                    <textarea
                      ref={textareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className="voice-message-edit-actions">
                      <button onClick={handleSaveEdit} className="btn-save">{t('actions.save')}</button>
                      <button onClick={handleCancelEdit} className="btn-cancel">{t('actions.cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="voice-message-text">{message.text}</div>
                    <div className="voice-message-actions">
                      <button onClick={() => handleInsert(message.text)} title={t('actions.insert')} disabled={!activeTarget}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleCopy(message.text)} title={t('actions.copy')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleEdit(message)} title={t('actions.edit')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(message.id)} title={t('actions.delete')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
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
          {/* Primary action: Record/Stop */}
          {isRecording ? (
            <button className="btn-primary btn-stop" onClick={onStopRecording}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              <span>{t('actions.stopRecording')}</span>
            </button>
          ) : (
            <button className="btn-primary btn-record" onClick={onStartRecording}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <circle cx="12" cy="12" r="6"/>
              </svg>
              <span>{t('actions.startRecording')}</span>
            </button>
          )}

          {/* Secondary actions */}
          {messages.length > 0 && (
            <div className="voice-panel-secondary">
              <button className="btn-secondary" onClick={handleInsertAll} disabled={!activeTarget} title={t('actions.insert')}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
              <button className="btn-secondary" onClick={handleCopyAll} title={t('actions.copy')}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
              <button className="btn-secondary" onClick={handleClearAll} title={t('actions.clearAll')}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VoicePanel
