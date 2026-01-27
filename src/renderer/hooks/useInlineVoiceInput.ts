import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceInputManager } from '../services/VoiceInputManager'
import { usePushToTalk } from './usePushToTalk'
import type { VoiceInputSettings, VoiceInputState } from '../../types/voiceInput'

interface UseInlineVoiceInputOptions {
  settings: VoiceInputSettings
  /** Called when text should be inserted. backupId is the streaming backup ID for record update. */
  onTextInsert: (text: string, backupId?: string) => void
  /** Called when inline mode starts (push-to-talk triggered) */
  onStart?: () => void
  /** Called when inline mode ends */
  onEnd?: () => void
  /** Project path for audio backup */
  projectPath?: string
}

/**
 * Hook for inline voice input (Push-to-Talk mode)
 * - Automatically inserts text when key is released
 * - Shows real-time transcription in a bubble
 * - No confirmation step required
 */
export function useInlineVoiceInput(options: UseInlineVoiceInputOptions) {
  const { settings, onTextInsert, onStart, onEnd, projectPath } = options

  const [isActive, setIsActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<VoiceInputManager | null>(null)
  const finalTextRef = useRef<string>('')
  const interimTextRef = useRef<string>('')  // Ref to track latest interim text
  const isRecordingRef = useRef(false)  // Ref to avoid stale closure issues
  const onTextInsertRef = useRef(onTextInsert)
  onTextInsertRef.current = onTextInsert

  // Initialize voice manager
  useEffect(() => {
    if (!settings.enabled || !settings.pushToTalk.enabled) {
      managerRef.current?.destroy()
      managerRef.current = null
      return
    }

    managerRef.current = new VoiceInputManager({
      settings,
      projectPath,
      source: 'inline',
      onInterimResult: (text) => {
        interimTextRef.current = text  // Update ref for stopRecording to use
        setInterimText(text)
        setError(null)
      },
      onFinalResult: (text) => {
        console.log('[useInlineVoiceInput] Final result:', text)
        // Store final text for insertion when recording ends
        if (text.trim()) {
          finalTextRef.current = text
          interimTextRef.current = text
          setInterimText(text)
        }
      },
      onError: (err) => {
        console.error('[useInlineVoiceInput] Error:', err)
        setError(err)
        isRecordingRef.current = false
        setIsRecording(false)
      },
      onStateChange: (newState) => {
        console.log('[useInlineVoiceInput] State:', newState)
        setState(newState)
        if (newState === 'idle' || newState === 'error') {
          isRecordingRef.current = false
          setIsRecording(false)
        }
      }
    })

    return () => {
      managerRef.current?.destroy()
      managerRef.current = null
    }
  }, [
    settings.enabled,
    settings.pushToTalk.enabled,
    settings.provider,
    settings.qwenApiKey,
    settings.qwenRegion,
    settings.language,
    projectPath
  ])

  // Start recording (called by Push-to-Talk)
  const startRecording = useCallback(async () => {
    // Use ref to check recording state to avoid stale closure
    if (!managerRef.current || isRecordingRef.current) {
      console.log('[useInlineVoiceInput] Start blocked: manager=', !!managerRef.current, 'isRecording=', isRecordingRef.current)
      return
    }

    console.log('[useInlineVoiceInput] Start recording')
    isRecordingRef.current = true
    setIsActive(true)
    setIsRecording(true)
    setInterimText('')
    interimTextRef.current = ''
    setError(null)
    finalTextRef.current = ''

    onStart?.()
    await managerRef.current.start()
  }, [onStart])

  // Stop recording and insert text (called by Push-to-Talk on key release)
  const stopRecording = useCallback(async () => {
    // Use ref to check state to avoid stale closure
    if (!isRecordingRef.current) {
      console.log('[useInlineVoiceInput] Stop blocked: not recording')
      return
    }

    console.log('[useInlineVoiceInput] Stop recording')
    isRecordingRef.current = false  // Mark as stopped immediately

    // Stop recording and wait for final result from the ASR service
    // This now returns a Promise that resolves when the server sends final result
    // (or times out after 800ms)
    const result = await managerRef.current?.stop()

    // For offline recordings, don't insert text - the audio is saved for later retry
    if (result?.needsBackup) {
      console.log('[useInlineVoiceInput] Offline recording - audio saved, no text to insert')
      // Don't insert the "⏺ 离线录音中..." placeholder text
    } else {
      // Use the result from stop() if available, otherwise fall back to refs
      const textToInsert = result?.text || finalTextRef.current || interimTextRef.current

      if (textToInsert.trim()) {
        console.log('[useInlineVoiceInput] Auto-inserting:', textToInsert, 'backupId:', result?.backupId)
        onTextInsertRef.current(textToInsert, result?.backupId)
      }
    }

    // Reset state
    setIsActive(false)
    setIsRecording(false)
    setInterimText('')
    interimTextRef.current = ''
    setState('idle')
    finalTextRef.current = ''
    onEnd?.()
  }, [onEnd])

  // Force close without inserting
  const cancel = useCallback(() => {
    console.log('[useInlineVoiceInput] Cancel')
    isRecordingRef.current = false
    managerRef.current?.stop()
    setIsActive(false)
    setIsRecording(false)
    setInterimText('')
    interimTextRef.current = ''
    setState('idle')
    setError(null)
    finalTextRef.current = ''
    onEnd?.()
  }, [onEnd])

  // Push-to-Talk integration
  usePushToTalk({
    triggerKey: settings.pushToTalk.triggerKey,
    triggerMode: settings.pushToTalk.triggerMode,
    minHoldDuration: settings.pushToTalk.minHoldDuration,
    doubleTapInterval: settings.pushToTalk.doubleTapInterval,
    onStart: startRecording,
    onEnd: stopRecording,
    enabled: settings.enabled && settings.pushToTalk.enabled
  })

  return {
    // State
    isActive,      // Whether inline mode is active (bubble visible)
    isRecording,   // Whether actively recording
    interimText,   // Current transcription text
    state,         // Voice input state
    error,         // Error message if any

    // Methods (for manual control if needed)
    startRecording,
    stopRecording,
    cancel
  }
}
