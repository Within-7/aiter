import React, { useContext, useCallback, useState, useEffect, useRef } from 'react'
import { AppContext } from '../../context/AppContext'
import { VoicePanel } from './VoicePanel'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { defaultVoiceInputSettings, VoiceTranscription, VoiceBackup } from '../../../types/voiceInput'

/**
 * Container component that connects VoicePanel to AppContext and voice input logic
 */
export const VoicePanelContainer: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const [pendingBackups, setPendingBackups] = useState<VoiceBackup[]>([])
  const [retryingBackupId, setRetryingBackupId] = useState<string | null>(null)
  const lastLoadedProjectRef = useRef<string | null>(null)

  // Get voice settings from app settings
  const voiceSettings = state.settings.voiceInput || defaultVoiceInputSettings

  // Get active project path for backup operations
  const getActiveProjectPath = useCallback((): string | null => {
    if (!state.activeProjectId) return null
    const project = state.projects.find(p => p.id === state.activeProjectId)
    return project?.path || null
  }, [state.activeProjectId, state.projects])

  // Load pending backups when panel opens or project changes
  useEffect(() => {
    const loadBackups = async () => {
      const projectPath = getActiveProjectPath()
      if (!projectPath) {
        setPendingBackups([])
        lastLoadedProjectRef.current = null
        return
      }

      // Only reload if project changed
      if (lastLoadedProjectRef.current === projectPath) return
      lastLoadedProjectRef.current = projectPath

      try {
        const result = await window.api.voiceBackup.list(projectPath)
        if (result.success && result.backups) {
          setPendingBackups(result.backups)
        }
      } catch (error) {
        console.error('Failed to load voice backups:', error)
      }
    }

    if (state.showVoicePanel) {
      loadBackups()
    }
  }, [state.showVoicePanel, getActiveProjectPath])

  // Reload backups after successfully adding one
  const reloadBackups = useCallback(async () => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    try {
      const result = await window.api.voiceBackup.list(projectPath)
      if (result.success && result.backups) {
        setPendingBackups(result.backups)
      }
    } catch (error) {
      console.error('Failed to reload voice backups:', error)
    }
  }, [getActiveProjectPath])

  // Track previous error to detect new errors
  const prevErrorRef = useRef<string | null>(null)

  // Determine active target based on current state
  const getActiveTarget = (): 'terminal' | 'editor' | null => {
    // If terminal is active, return terminal
    if (state.activeTerminalId) {
      return 'terminal'
    }
    // If editor is active, return editor
    if (state.activeEditorTabId) {
      return 'editor'
    }
    return null
  }

  // Handle inserting text to terminal
  // Terminal-specific: sanitize text to prevent accidental command execution
  const handleInsertToTerminal = useCallback((text: string) => {
    if (state.activeTerminalId) {
      // Sanitize text for terminal:
      // 1. Replace newlines with spaces (prevent multiple command execution)
      // 2. Replace carriage returns
      // 3. Remove control characters (prevent Ctrl+C, Ctrl+D, etc.)
      // 4. Collapse multiple spaces and trim
      const sanitizedText = text
        .replace(/\r\n/g, ' ')  // Windows-style newlines
        .replace(/\n/g, ' ')    // Unix-style newlines
        .replace(/\r/g, ' ')    // Old Mac-style newlines
        .replace(/\t/g, ' ')    // Tab characters (prevent autocomplete trigger)
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters (except already handled \n\r\t)
        .replace(/\s+/g, ' ')   // Collapse multiple spaces
        .trim()

      window.api.terminal.write(state.activeTerminalId, sanitizedText)
      // Auto-execute if enabled
      if (voiceSettings.autoExecuteInTerminal) {
        window.api.terminal.write(state.activeTerminalId, '\r')
      }
    }
  }, [state.activeTerminalId, voiceSettings.autoExecuteInTerminal])

  // Handle inserting text to editor
  const handleInsertToEditor = useCallback((text: string) => {
    if (state.activeEditorTabId) {
      // Dispatch custom event for Monaco Editor to handle
      window.dispatchEvent(new CustomEvent('voice-input-insert', {
        detail: { text }
      }))
    }
  }, [state.activeEditorTabId])

  // Voice input hook - panel mode doesn't auto-insert
  // Enable Push-to-Talk when panel is open so Option key triggers recording in panel
  const voiceInput = useVoiceInput({
    settings: {
      ...voiceSettings,
      pushToTalk: {
        ...voiceSettings.pushToTalk,
        // Enable Push-to-Talk only when panel is open
        enabled: voiceSettings.pushToTalk.enabled && state.showVoicePanel
      }
    },
    onTextInsert: undefined, // Panel handles insertion manually
    useEditableOverlay: true // Keep editable behavior for interim text tracking
  })

  // Auto-save backup when transcription fails (error occurs)
  // This effect runs when voiceInput.error changes
  useEffect(() => {
    const saveBackupOnError = async () => {
      const projectPath = getActiveProjectPath()
      if (!projectPath) return

      // Only save if:
      // 1. There's a new error (different from previous)
      // 2. There's accumulated audio to save
      const currentError = voiceInput.error
      if (currentError && currentError !== prevErrorRef.current) {
        const duration = voiceInput.getAccumulatedDuration()
        if (duration > 0.5) { // Only save if recording is at least 0.5 seconds
          console.log('[VoicePanelContainer] Error detected, saving backup:', currentError)
          const backupId = await voiceInput.saveBackup(projectPath, currentError)
          if (backupId) {
            console.log('[VoicePanelContainer] Backup saved:', backupId)
            // Reload backups to show the new one
            await reloadBackups()
          }
        }
      }
      prevErrorRef.current = currentError
    }

    saveBackupOnError()
  }, [voiceInput.error, voiceInput, getActiveProjectPath, reloadBackups])

  // Handle closing the panel
  const handleClose = useCallback(() => {
    voiceInput.stopRecording()
    dispatch({ type: 'SET_VOICE_PANEL', payload: false })
  }, [voiceInput, dispatch])

  // Voice transcription handlers (connected to global state)
  const handleAddTranscription = useCallback((transcription: VoiceTranscription) => {
    dispatch({ type: 'ADD_VOICE_TRANSCRIPTION', payload: transcription })
  }, [dispatch])

  const handleUpdateTranscription = useCallback((id: string, text: string) => {
    dispatch({ type: 'UPDATE_VOICE_TRANSCRIPTION', payload: { id, text } })
  }, [dispatch])

  const handleDeleteTranscription = useCallback((id: string) => {
    dispatch({ type: 'DELETE_VOICE_TRANSCRIPTION', payload: id })
  }, [dispatch])

  const handleClearTranscriptions = useCallback(() => {
    dispatch({ type: 'CLEAR_VOICE_TRANSCRIPTIONS' })
  }, [dispatch])

  // Handle retry backup transcription
  const handleRetryBackup = useCallback(async (backupId: string) => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    setRetryingBackupId(backupId)

    try {
      // Update backup status
      await window.api.voiceBackup.update(projectPath, backupId, { status: 'retrying' })
      setPendingBackups(prev => prev.map(b =>
        b.id === backupId ? { ...b, status: 'retrying' as const } : b
      ))

      // Read audio data
      const readResult = await window.api.voiceBackup.read(projectPath, backupId)
      if (!readResult.success || !readResult.audioData) {
        throw new Error(readResult.error || 'Failed to read audio data')
      }

      // Get the backup info
      const backup = pendingBackups.find(b => b.id === backupId)
      if (!backup) {
        throw new Error('Backup not found')
      }

      // Try to transcribe using the ASR service
      // We need to access the ASR service through voiceInput hook's service ref
      const transcribedText = await voiceInput.retryTranscription(readResult.audioData, backup.sampleRate)

      if (transcribedText) {
        // Success! Add transcription and delete backup
        handleAddTranscription({
          id: Date.now().toString(),
          text: transcribedText,
          timestamp: Date.now(),
          source: backup.source,
          projectId: state.activeProjectId || undefined
        })

        await window.api.voiceBackup.delete(projectPath, backupId)
        setPendingBackups(prev => prev.filter(b => b.id !== backupId))
      } else {
        throw new Error('Transcription returned empty result')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Retry transcription failed:', errorMessage)

      // Update backup with error info
      const backup = pendingBackups.find(b => b.id === backupId)
      await window.api.voiceBackup.update(projectPath, backupId, {
        status: 'failed',
        retryCount: (backup?.retryCount || 0) + 1,
        lastError: errorMessage
      })

      setPendingBackups(prev => prev.map(b =>
        b.id === backupId ? {
          ...b,
          status: 'failed' as const,
          retryCount: (b.retryCount || 0) + 1,
          lastError: errorMessage
        } : b
      ))
    } finally {
      setRetryingBackupId(null)
    }
  }, [getActiveProjectPath, pendingBackups, voiceInput, handleAddTranscription, state.activeProjectId])

  // Handle delete backup
  const handleDeleteBackup = useCallback(async (backupId: string) => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    try {
      await window.api.voiceBackup.delete(projectPath, backupId)
      setPendingBackups(prev => prev.filter(b => b.id !== backupId))
    } catch (error) {
      console.error('Failed to delete backup:', error)
    }
  }, [getActiveProjectPath])

  // Don't render if panel is not open or voice is not enabled
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
      onAddTranscription={handleAddTranscription}
      onUpdateTranscription={handleUpdateTranscription}
      onDeleteTranscription={handleDeleteTranscription}
      onClearTranscriptions={handleClearTranscriptions}
      activeProjectId={state.activeProjectId}
      pendingBackups={pendingBackups}
      onRetryBackup={handleRetryBackup}
      onDeleteBackup={handleDeleteBackup}
      retryingBackupId={retryingBackupId}
    />
  )
}

export default VoicePanelContainer
