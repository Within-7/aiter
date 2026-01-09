import React, { useContext, useCallback } from 'react'
import { AppContext } from '../../context/AppContext'
import { VoicePanel } from './VoicePanel'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { defaultVoiceInputSettings, VoiceTranscription } from '../../../types/voiceInput'

/**
 * Container component that connects VoicePanel to AppContext and voice input logic
 */
export const VoicePanelContainer: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)

  // Get voice settings from app settings
  const voiceSettings = state.settings.voiceInput || defaultVoiceInputSettings

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
    />
  )
}

export default VoicePanelContainer
