import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceInputManager } from '../services/VoiceInputManager'
import { usePushToTalk } from './usePushToTalk'
import type { VoiceInputSettings, VoiceInputState } from '../../types/voiceInput'

interface UseInlineVoiceInputOptions {
  settings: VoiceInputSettings
  onTextInsert: (text: string) => void
  /** Called when inline mode starts (push-to-talk triggered) */
  onStart?: () => void
  /** Called when inline mode ends */
  onEnd?: () => void
}

/**
 * Hook for inline voice input (Push-to-Talk mode)
 * - Automatically inserts text when key is released
 * - Shows real-time transcription in a bubble
 * - No confirmation step required
 */
export function useInlineVoiceInput(options: UseInlineVoiceInputOptions) {
  const { settings, onTextInsert, onStart, onEnd } = options

  const [isActive, setIsActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<VoiceInputManager | null>(null)
  const finalTextRef = useRef<string>('')
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
      onInterimResult: (text) => {
        setInterimText(text)
        setError(null)
      },
      onFinalResult: (text) => {
        console.log('[useInlineVoiceInput] Final result:', text)
        // Store final text for insertion when recording ends
        if (text.trim()) {
          finalTextRef.current = text
          setInterimText(text)
        }
      },
      onError: (err) => {
        console.error('[useInlineVoiceInput] Error:', err)
        setError(err)
        setIsRecording(false)
      },
      onStateChange: (newState) => {
        console.log('[useInlineVoiceInput] State:', newState)
        setState(newState)
        if (newState === 'idle' || newState === 'error') {
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
    settings.language
  ])

  // Start recording (called by Push-to-Talk)
  const startRecording = useCallback(async () => {
    if (!managerRef.current || isRecording) return

    console.log('[useInlineVoiceInput] Start recording')
    setIsActive(true)
    setIsRecording(true)
    setInterimText('')
    setError(null)
    finalTextRef.current = ''

    onStart?.()
    await managerRef.current.start()
  }, [isRecording, onStart])

  // Stop recording and insert text (called by Push-to-Talk on key release)
  const stopRecording = useCallback(() => {
    if (!isRecording && !isActive) return

    console.log('[useInlineVoiceInput] Stop recording')
    managerRef.current?.stop()

    // Wait a short moment for any pending final result
    setTimeout(() => {
      const textToInsert = finalTextRef.current || interimText

      if (textToInsert.trim()) {
        console.log('[useInlineVoiceInput] Auto-inserting:', textToInsert)
        onTextInsertRef.current(textToInsert)
      }

      // Reset state
      setIsActive(false)
      setIsRecording(false)
      setInterimText('')
      setState('idle')
      finalTextRef.current = ''
      onEnd?.()
    }, 100) // Small delay to catch final result
  }, [isRecording, isActive, interimText, onEnd])

  // Force close without inserting
  const cancel = useCallback(() => {
    console.log('[useInlineVoiceInput] Cancel')
    managerRef.current?.stop()
    setIsActive(false)
    setIsRecording(false)
    setInterimText('')
    setState('idle')
    setError(null)
    finalTextRef.current = ''
    onEnd?.()
  }, [onEnd])

  // Push-to-Talk integration
  usePushToTalk({
    triggerKey: settings.pushToTalk.triggerKey,
    minHoldDuration: settings.pushToTalk.minHoldDuration,
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
