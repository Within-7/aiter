/**
 * Container component that connects VoicePanel to AppContext and voice input logic
 */

import React, { useContext, useCallback, useState, useEffect, useRef } from 'react'
import { AppContext } from '../../context/AppContext'
import { VoicePanel } from './VoicePanel'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceRecordManagement } from '../../hooks/useVoiceRecordManagement'
import { defaultVoiceInputSettings } from '../../../types/voiceInput'

export const VoicePanelContainer: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const [retryingBackupId, setRetryingBackupId] = useState<string | null>(null)
  const [retryInterimText, setRetryInterimText] = useState<string>('')
  const [pendingOfflineError, setPendingOfflineError] = useState<string | null>(null)
  const prevErrorRef = useRef<string | null>(null)

  // Get voice settings from app settings
  const voiceSettings = state.settings.voiceInput || defaultVoiceInputSettings

  // Get active project path
  const getActiveProjectPath = useCallback((): string | null => {
    if (!state.activeProjectId) return null
    const project = state.projects.find(p => p.id === state.activeProjectId)
    return project?.path || null
  }, [state.activeProjectId, state.projects])

  // Voice record management hook
  const recordMgmt = useVoiceRecordManagement({
    isOpen: state.showVoicePanel,
    getProjectPath: getActiveProjectPath,
    dispatch
  })

  // Determine active target based on current state
  const getActiveTarget = (): 'terminal' | 'editor' | null => {
    if (state.activeTerminalId) return 'terminal'
    if (state.activeEditorTabId) return 'editor'
    return null
  }

  // Handle inserting text to terminal (with sanitization)
  const handleInsertToTerminal = useCallback((text: string) => {
    if (state.activeTerminalId) {
      const sanitizedText = text
        .replace(/\r\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      window.api.terminal.write(state.activeTerminalId, sanitizedText)
      if (voiceSettings.autoExecuteInTerminal) {
        window.api.terminal.write(state.activeTerminalId, '\r')
      }
    }
  }, [state.activeTerminalId, voiceSettings.autoExecuteInTerminal])

  // Handle inserting text to editor
  const handleInsertToEditor = useCallback((text: string) => {
    if (state.activeEditorTabId) {
      window.dispatchEvent(new CustomEvent('voice-input-insert', {
        detail: { text }
      }))
    }
  }, [state.activeEditorTabId])

  // Handle offline backup needed callback
  const handleOfflineBackupNeeded = useCallback((offlineError: string) => {
    console.log('[VoicePanelContainer] Offline backup needed:', offlineError)
    setPendingOfflineError(offlineError)
  }, [])

  // Voice input hook
  const voiceInput = useVoiceInput({
    settings: {
      ...voiceSettings,
      pushToTalk: {
        ...voiceSettings.pushToTalk,
        enabled: voiceSettings.pushToTalk.enabled && state.showVoicePanel
      }
    },
    onTextInsert: undefined,
    useEditableOverlay: true,
    onOfflineBackupNeeded: handleOfflineBackupNeeded,
    projectPath: getActiveProjectPath() || undefined,
    source: 'panel'
  })

  // Save offline backup when pendingOfflineError is set
  useEffect(() => {
    const saveOfflineBackup = async () => {
      if (!pendingOfflineError) return

      const projectPath = getActiveProjectPath()
      if (!projectPath) {
        console.warn('[VoicePanelContainer] No project path for offline backup')
        setPendingOfflineError(null)
        return
      }

      const duration = voiceInput.getAccumulatedDuration()
      if (duration > 0.5) {
        console.log('[VoicePanelContainer] Saving offline backup, duration:', duration.toFixed(1), 's')
        const backupId = await voiceInput.saveBackup(projectPath, pendingOfflineError)
        if (backupId) {
          console.log('[VoicePanelContainer] Offline backup saved:', backupId)
          await recordMgmt.reloadRecords()
        }
      } else {
        console.log('[VoicePanelContainer] Recording too short for backup:', duration.toFixed(1), 's')
      }

      setPendingOfflineError(null)
    }

    saveOfflineBackup()
  }, [pendingOfflineError, getActiveProjectPath, voiceInput, recordMgmt])

  // Auto-save backup when transcription fails
  useEffect(() => {
    const saveBackupOnError = async () => {
      const projectPath = getActiveProjectPath()
      if (!projectPath) return

      const currentError = voiceInput.error
      if (currentError && currentError !== prevErrorRef.current) {
        const duration = voiceInput.getAccumulatedDuration()
        if (duration > 0.5) {
          console.log('[VoicePanelContainer] Error detected, saving backup:', currentError)
          const backupId = await voiceInput.saveBackup(projectPath, currentError)
          if (backupId) {
            console.log('[VoicePanelContainer] Backup saved:', backupId)
            await recordMgmt.reloadRecords()
          }
        }
      }
      prevErrorRef.current = currentError
    }

    saveBackupOnError()
  }, [voiceInput.error, voiceInput, getActiveProjectPath, recordMgmt])

  // Handle closing the panel
  const handleClose = useCallback(() => {
    voiceInput.stopRecording()
    dispatch({ type: 'SET_VOICE_PANEL', payload: false })
  }, [voiceInput, dispatch])

  // Handle retry backup transcription
  const handleRetryBackup = useCallback(async (backupId: string) => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    setRetryingBackupId(backupId)
    setRetryInterimText('')

    try {
      await window.api.voiceRecords.update(projectPath, backupId, { status: 'retrying' })
      recordMgmt.updateBackupStatus(backupId, { status: 'retrying' })

      const readResult = await window.api.voiceBackup.read(projectPath, backupId)
      if (!readResult.success || !readResult.audioData) {
        throw new Error(readResult.error || 'Failed to read audio data')
      }

      const backup = recordMgmt.pendingBackups.find(b => b.id === backupId)
      if (!backup) {
        throw new Error('Backup not found')
      }

      const transcribedText = await voiceInput.retryTranscription(
        readResult.audioData,
        backup.sampleRate,
        (interim) => setRetryInterimText(interim)
      )

      if (transcribedText) {
        await window.api.voiceRecords.update(projectPath, backupId, {
          status: 'transcribed',
          text: transcribedText
        })
        await window.api.voiceBackup.delete(projectPath, backupId)
        await recordMgmt.reloadRecords()
      } else {
        throw new Error('Transcription returned empty result')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Retry transcription failed:', errorMessage)

      const backup = recordMgmt.pendingBackups.find(b => b.id === backupId)
      await window.api.voiceRecords.update(projectPath, backupId, {
        status: 'failed',
        retryCount: (backup?.retryCount || 0) + 1,
        lastError: errorMessage
      })

      recordMgmt.updateBackupStatus(backupId, {
        status: 'failed',
        retryCount: (backup?.retryCount || 0) + 1,
        lastError: errorMessage
      })
    } finally {
      setRetryingBackupId(null)
      setRetryInterimText('')
    }
  }, [getActiveProjectPath, recordMgmt, voiceInput])

  if (!state.showVoicePanel) {
    return null
  }

  return (
    <VoicePanel
      isOpen={state.showVoicePanel}
      isRecording={voiceInput.isRecording}
      state={voiceInput.state}
      interimText={voiceInput.interimText}
      provider={voiceSettings.provider}
      error={voiceInput.error}
      onClose={handleClose}
      onStartRecording={voiceInput.startRecording}
      onStopRecording={voiceInput.stopRecording}
      onInsertToTerminal={handleInsertToTerminal}
      onInsertToEditor={handleInsertToEditor}
      activeTarget={getActiveTarget()}
      transcriptions={state.voiceTranscriptions}
      onAddTranscription={recordMgmt.addTranscription}
      onUpdateTranscription={recordMgmt.updateTranscription}
      onDeleteTranscription={recordMgmt.deleteTranscription}
      activeProjectId={state.activeProjectId}
      pendingBackups={recordMgmt.pendingBackups}
      onRetryBackup={handleRetryBackup}
      onDeleteBackup={recordMgmt.deleteBackup}
      retryingBackupId={retryingBackupId}
      retryInterimText={retryInterimText}
    />
  )
}

export default VoicePanelContainer
