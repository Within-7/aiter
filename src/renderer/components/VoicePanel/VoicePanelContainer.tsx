import React, { useContext, useCallback } from 'react'
import { AppContext } from '../../context/AppContext'
import { VoicePanel } from './VoicePanel'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { defaultVoiceInputSettings } from '../../../types/voiceInput'

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
  const handleInsertToTerminal = useCallback((text: string) => {
    if (state.activeTerminalId) {
      window.api.terminal.write(state.activeTerminalId, text)
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
  const voiceInput = useVoiceInput({
    settings: voiceSettings,
    onTextInsert: undefined, // Panel handles insertion manually
    useEditableOverlay: true // Keep editable behavior for interim text tracking
  })

  // Handle closing the panel
  const handleClose = useCallback(() => {
    voiceInput.stopRecording()
    dispatch({ type: 'SET_VOICE_PANEL', payload: false })
  }, [voiceInput, dispatch])

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
    />
  )
}

export default VoicePanelContainer
