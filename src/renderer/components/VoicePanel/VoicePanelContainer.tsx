import React, { useContext, useCallback, useState, useEffect, useRef } from 'react'
import { AppContext } from '../../context/AppContext'
import { VoicePanel } from './VoicePanel'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { defaultVoiceInputSettings, VoiceTranscription, VoiceBackup, VoiceRecord } from '../../../types/voiceInput'

/**
 * Container component that connects VoicePanel to AppContext and voice input logic
 */
export const VoicePanelContainer: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const [pendingBackups, setPendingBackups] = useState<VoiceBackup[]>([])
  const [retryingBackupId, setRetryingBackupId] = useState<string | null>(null)
  const [retryInterimText, setRetryInterimText] = useState<string>('')
  const lastLoadedProjectRef = useRef<string | null>(null)

  // Get voice settings from app settings
  const voiceSettings = state.settings.voiceInput || defaultVoiceInputSettings

  // Get active project path for backup operations
  const getActiveProjectPath = useCallback((): string | null => {
    if (!state.activeProjectId) return null
    const project = state.projects.find(p => p.id === state.activeProjectId)
    return project?.path || null
  }, [state.activeProjectId, state.projects])

  // Load voice records when panel opens or project changes
  // Records include both transcriptions and pending backups
  useEffect(() => {
    const loadRecords = async () => {
      const projectPath = getActiveProjectPath()
      if (!projectPath) {
        setPendingBackups([])
        lastLoadedProjectRef.current = null
        return
      }

      // Always reload when panel opens (to catch inline recordings made while panel was closed)
      lastLoadedProjectRef.current = projectPath

      try {
        // Load unified records
        const result = await window.api.voiceRecords.list(projectPath)
        if (result.success && result.records) {
          // Separate transcribed records from pending backups
          const transcriptions: VoiceTranscription[] = []
          const backups: VoiceBackup[] = []

          for (const record of result.records) {
            if (record.status === 'transcribed' && record.text) {
              transcriptions.push({
                id: record.id,
                text: record.text,
                timestamp: record.timestamp,
                source: record.source,
                projectId: record.projectId,
                insertedTo: record.insertedTo
              })
            } else if (record.status !== 'transcribed') {
              backups.push({
                id: record.id,
                timestamp: record.timestamp,
                source: record.source,
                projectId: record.projectId,
                duration: record.duration || 0,
                sampleRate: record.sampleRate || 16000,
                status: record.status as 'pending' | 'retrying' | 'failed' | 'recording' | 'completed',
                retryCount: record.retryCount || 0,
                lastError: record.lastError
              })
            }
          }

          // Update global transcriptions state
          dispatch({ type: 'SET_VOICE_TRANSCRIPTIONS', payload: transcriptions })
          setPendingBackups(backups)
        }
      } catch (error) {
        console.error('Failed to load voice records:', error)
      }
    }

    if (state.showVoicePanel) {
      loadRecords()
    }
  }, [state.showVoicePanel, getActiveProjectPath, dispatch])

  // Reload records after changes
  const reloadRecords = useCallback(async () => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    try {
      const result = await window.api.voiceRecords.list(projectPath)
      if (result.success && result.records) {
        // Separate transcribed records from pending backups
        const transcriptions: VoiceTranscription[] = []
        const backups: VoiceBackup[] = []

        for (const record of result.records) {
          if (record.status === 'transcribed' && record.text) {
            transcriptions.push({
              id: record.id,
              text: record.text,
              timestamp: record.timestamp,
              source: record.source,
              projectId: record.projectId,
              insertedTo: record.insertedTo
            })
          } else if (record.status !== 'transcribed') {
            backups.push({
              id: record.id,
              timestamp: record.timestamp,
              source: record.source,
              projectId: record.projectId,
              duration: record.duration || 0,
              sampleRate: record.sampleRate || 16000,
              status: record.status as 'pending' | 'retrying' | 'failed' | 'recording' | 'completed',
              retryCount: record.retryCount || 0,
              lastError: record.lastError
            })
          }
        }

        dispatch({ type: 'SET_VOICE_TRANSCRIPTIONS', payload: transcriptions })
        setPendingBackups(backups)
      }
    } catch (error) {
      console.error('Failed to reload voice records:', error)
    }
  }, [getActiveProjectPath, dispatch])

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

  // Track pending offline backup error (set when offline recording stops)
  const [pendingOfflineError, setPendingOfflineError] = useState<string | null>(null)

  // Handle offline backup needed callback
  const handleOfflineBackupNeeded = useCallback((offlineError: string) => {
    console.log('[VoicePanelContainer] Offline backup needed:', offlineError)
    // Set the pending error - the effect below will handle the actual saving
    setPendingOfflineError(offlineError)
  }, [])

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
    useEditableOverlay: true, // Keep editable behavior for interim text tracking
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
          await reloadRecords()
        }
      } else {
        console.log('[VoicePanelContainer] Recording too short for backup:', duration.toFixed(1), 's')
      }

      // Clear the pending error
      setPendingOfflineError(null)
    }

    saveOfflineBackup()
  }, [pendingOfflineError, getActiveProjectPath, voiceInput, reloadRecords])

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
            await reloadRecords()
          }
        }
      }
      prevErrorRef.current = currentError
    }

    saveBackupOnError()
  }, [voiceInput.error, voiceInput, getActiveProjectPath, reloadRecords])

  // Handle closing the panel
  const handleClose = useCallback(() => {
    voiceInput.stopRecording()
    dispatch({ type: 'SET_VOICE_PANEL', payload: false })
  }, [voiceInput, dispatch])

  // Voice transcription handlers - now using unified voiceRecords API
  const handleAddTranscription = useCallback(async (transcription: VoiceTranscription) => {
    // Update local state first for responsiveness
    dispatch({ type: 'ADD_VOICE_TRANSCRIPTION', payload: transcription })

    // Persist to disk using unified records API
    const projectPath = getActiveProjectPath()
    if (projectPath) {
      const record: VoiceRecord = {
        id: transcription.id,
        timestamp: transcription.timestamp,
        source: transcription.source,
        projectId: transcription.projectId,
        status: 'transcribed',
        text: transcription.text,
        insertedTo: transcription.insertedTo
      }
      await window.api.voiceRecords.add(projectPath, record)
    }
  }, [dispatch, getActiveProjectPath])

  const handleUpdateTranscription = useCallback(async (id: string, text: string) => {
    dispatch({ type: 'UPDATE_VOICE_TRANSCRIPTION', payload: { id, text } })

    // Persist to disk
    const projectPath = getActiveProjectPath()
    if (projectPath) {
      await window.api.voiceRecords.update(projectPath, id, { text })
    }
  }, [dispatch, getActiveProjectPath])

  const handleDeleteTranscription = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_VOICE_TRANSCRIPTION', payload: id })

    // Persist to disk
    const projectPath = getActiveProjectPath()
    if (projectPath) {
      await window.api.voiceRecords.delete(projectPath, id)
    }
  }, [dispatch, getActiveProjectPath])

  // Handle retry backup transcription
  const handleRetryBackup = useCallback(async (backupId: string) => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    setRetryingBackupId(backupId)
    setRetryInterimText('') // Clear previous interim text

    try {
      // Update record status to retrying
      await window.api.voiceRecords.update(projectPath, backupId, { status: 'retrying' })
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
      // Pass interim callback for real-time display
      const transcribedText = await voiceInput.retryTranscription(
        readResult.audioData,
        backup.sampleRate,
        (interim) => setRetryInterimText(interim) // Real-time interim text update
      )

      if (transcribedText) {
        // Success! Update the record to transcribed status
        await window.api.voiceRecords.update(projectPath, backupId, {
          status: 'transcribed',
          text: transcribedText
        })

        // Delete the audio file (no longer needed)
        await window.api.voiceBackup.delete(projectPath, backupId)

        // Reload to get updated records
        await reloadRecords()
      } else {
        throw new Error('Transcription returned empty result')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Retry transcription failed:', errorMessage)

      // Update record with error info
      const backup = pendingBackups.find(b => b.id === backupId)
      await window.api.voiceRecords.update(projectPath, backupId, {
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
      setRetryInterimText('') // Clear interim text when done
    }
  }, [getActiveProjectPath, pendingBackups, voiceInput, reloadRecords])

  // Handle delete backup
  const handleDeleteBackup = useCallback(async (backupId: string) => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return

    try {
      // Delete from unified records (also deletes audio file)
      await window.api.voiceRecords.delete(projectPath, backupId)
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
      activeProjectId={state.activeProjectId}
      pendingBackups={pendingBackups}
      onRetryBackup={handleRetryBackup}
      onDeleteBackup={handleDeleteBackup}
      retryingBackupId={retryingBackupId}
      retryInterimText={retryInterimText}
    />
  )
}

export default VoicePanelContainer
