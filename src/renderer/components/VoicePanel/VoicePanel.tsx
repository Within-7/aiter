import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInputState, VoiceProvider, VoiceTranscription, VoiceBackup } from '../../../types/voiceInput'
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
  // Active project ID for persistence
  activeProjectId: string | null
  // Pending audio backups (failed transcriptions)
  pendingBackups: VoiceBackup[]
  onRetryBackup: (backupId: string) => void
  onDeleteBackup: (backupId: string) => void
  retryingBackupId?: string | null
  /** Real-time interim text during retry transcription */
  retryInterimText?: string
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
  activeProjectId,
  pendingBackups,
  onRetryBackup,
  onDeleteBackup,
  retryingBackupId,
  retryInterimText
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

  // Create a unified timeline of messages and pending backups, sorted by timestamp
  type TimelineItem =
    | { type: 'message'; data: VoiceMessage }
    | { type: 'backup'; data: VoiceBackup }

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...messages.map(m => ({ type: 'message' as const, data: m })),
      ...pendingBackups
        .filter(b => b.status !== 'recording') // Don't show actively recording backups
        .map(b => ({ type: 'backup' as const, data: b }))
    ]
    // Sort by timestamp, oldest first (newest at bottom)
    return items.sort((a, b) => {
      const timestampA = a.type === 'message' ? a.data.timestamp.getTime() : a.data.timestamp
      const timestampB = b.type === 'message' ? b.data.timestamp.getTime() : b.data.timestamp
      return timestampA - timestampB
    })
  }, [messages, pendingBackups])

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
      // Skip offline placeholder text - it's not a real transcription
      const isOfflinePlaceholder = text === '⏺ 离线录音中...'
      if (text !== lastAddedTextRef.current && !isOfflinePlaceholder) {
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

  const handleInsert = useCallback((text: string) => {
    if (activeTarget === 'terminal') {
      onInsertToTerminal(text)
    } else if (activeTarget === 'editor') {
      onInsertToEditor(text)
    }
  }, [activeTarget, onInsertToTerminal, onInsertToEditor])

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

  // Format duration in seconds
  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(1)}s`
  }

  // Format timestamp to time string
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
        {timeline.length === 0 && !isRecording && !interimText ? (
          <div className="voice-panel-empty">
            <p>{t('messages.emptyHint')}</p>
          </div>
        ) : (
          <>
            {/* Timeline: messages and backups sorted by timestamp */}
            {timeline.map(item => item.type === 'backup' ? (
              // Pending backup item
              <div key={`backup-${item.data.id}`} className={`voice-message voice-backup-pending ${item.data.status === 'retrying' || retryingBackupId === item.data.id ? 'voice-backup-retrying' : ''}`}>
                <div className="voice-backup-content">
                  <div className="voice-backup-icon">
                    {item.data.status === 'retrying' || retryingBackupId === item.data.id ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className="spinning">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    )}
                  </div>
                  <div className="voice-backup-info">
                    <div className="voice-backup-title">
                      {item.data.status === 'retrying' || retryingBackupId === item.data.id
                        ? t('backup.retrying', { defaultValue: '重试中...' })
                        : t('backup.pending', { defaultValue: '待转录' })}
                      <span className="voice-backup-duration">({formatDuration(item.data.duration)})</span>
                    </div>
                    {/* Show real-time transcription during retry */}
                    {(item.data.status === 'retrying' || retryingBackupId === item.data.id) && retryInterimText ? (
                      <div className="voice-backup-interim">
                        {retryInterimText}
                      </div>
                    ) : (
                      <>
                        <div className="voice-backup-meta">
                          {t('backup.recordedAt', { defaultValue: '录制于' })} {formatTime(item.data.timestamp)}
                          {item.data.retryCount > 0 && (
                            <span className="voice-backup-retry-count">
                              · {t('backup.retryCount', { count: item.data.retryCount, defaultValue: `已重试 ${item.data.retryCount} 次` })}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="voice-backup-actions">
                  <button
                    onClick={() => onRetryBackup(item.data.id)}
                    disabled={item.data.status === 'retrying' || retryingBackupId === item.data.id}
                    title={t('backup.retry', { defaultValue: '重试' })}
                    className="btn-retry"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteBackup(item.data.id)}
                    disabled={item.data.status === 'retrying' || retryingBackupId === item.data.id}
                    title={t('actions.delete')}
                    className="btn-delete"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              // Transcribed message item
              <div key={item.data.id} className={`voice-message ${item.data.source === 'inline' ? 'voice-message-inline' : ''}`}>
                {editingId === item.data.id ? (
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
                    <div className="voice-message-text">{item.data.text}</div>
                    <div className="voice-message-actions">
                      <button onClick={() => handleInsert(item.data.text)} title={t('actions.insert')} disabled={!activeTarget}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleCopy(item.data.text)} title={t('actions.copy')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleEdit(item.data)} title={t('actions.edit')}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(item.data.id)} title={t('actions.delete')}>
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
        </div>
      </div>
    </div>
  )
}

export default VoicePanel
