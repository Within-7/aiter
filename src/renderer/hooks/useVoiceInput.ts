import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceInputManager } from '../services/VoiceInputManager'
import { usePushToTalk } from './usePushToTalk'
import type { VoiceInputSettings, VoiceInputState } from '../../types/voiceInput'

interface UseVoiceInputOptions {
  settings: VoiceInputSettings
  onTextInsert?: (text: string) => void
  /** If true, don't auto-insert on final result - let user confirm in overlay */
  useEditableOverlay?: boolean
}

export function useVoiceInput(options: UseVoiceInputOptions) {
  const { settings, onTextInsert, useEditableOverlay = true } = options

  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)
  // Track if overlay should be visible (for editable mode)
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)

  const managerRef = useRef<VoiceInputManager | null>(null)
  // Use ref to always have the latest onTextInsert callback
  const onTextInsertRef = useRef(onTextInsert)
  onTextInsertRef.current = onTextInsert

  // 初始化管理器
  useEffect(() => {
    if (!settings.enabled) {
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
        console.log('[useVoiceInput] Final result received:', text)
        setIsRecording(false)

        if (useEditableOverlay) {
          // In editable mode, update interimText with final result for overlay to display
          // This ensures the overlay gets the final text even if no interim results were sent
          if (text.trim()) {
            setInterimText(text)
          }
          console.log('[useVoiceInput] Editable mode: keeping overlay open for user confirmation')
          // Keep overlay visible, state becomes idle but overlay stays
          setState('idle')
        } else {
          // Original behavior: auto-insert text
          setInterimText('')
          setState('idle')
          if (text.trim()) {
            console.log('[useVoiceInput] Calling onTextInsert with:', text)
            onTextInsertRef.current?.(text)
          }
        }
      },
      onError: (err) => {
        setError(err)
        setIsRecording(false)
        console.error('[useVoiceInput] Error:', err)
      },
      onStateChange: (newState) => {
        console.log('[useVoiceInput] State change:', newState)
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
    settings.provider,
    settings.qwenApiKey,
    settings.qwenRegion,
    settings.language,
    useEditableOverlay
  ])

  const startRecording = useCallback(async () => {
    if (!managerRef.current) {
      setError('语音识别服务未初始化')
      return
    }

    if (isRecording) {
      return
    }

    setIsRecording(true)
    setIsOverlayVisible(true) // Show overlay when starting
    setInterimText('')
    setError(null)

    await managerRef.current.start()
  }, [isRecording])

  // Force close - reset all state regardless of current status
  const forceClose = useCallback(() => {
    console.log('[useVoiceInput] Force close called')
    managerRef.current?.stop()
    setState('idle')
    setIsRecording(false)
    setInterimText('')
    setError(null)
    setIsOverlayVisible(false) // Hide overlay
  }, [])

  // Confirm text from overlay and insert
  const confirmText = useCallback((text: string) => {
    console.log('[useVoiceInput] Confirm text:', text)
    if (text.trim()) {
      onTextInsertRef.current?.(text)
    }
    forceClose()
  }, [forceClose])

  // Close overlay without inserting (cancel)
  const closeOverlay = useCallback(() => {
    console.log('[useVoiceInput] Close overlay')
    forceClose()
  }, [forceClose])

  const stopRecording = useCallback(() => {
    console.log('[useVoiceInput] stopRecording called, state:', state, 'isRecording:', isRecording)

    // If in error or processing state, force close
    if (state === 'error' || state === 'processing') {
      forceClose()
      return
    }

    if (!isRecording) {
      // If not recording but still visible, force close
      if (state !== 'idle') {
        forceClose()
      }
      return
    }

    managerRef.current?.stop()
  }, [isRecording, state, forceClose])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Push-to-Talk 集成
  usePushToTalk({
    triggerKey: settings.pushToTalk.triggerKey,
    minHoldDuration: settings.pushToTalk.minHoldDuration,
    onStart: startRecording,
    onEnd: stopRecording,
    enabled: settings.enabled && settings.pushToTalk.enabled
  })

  return {
    // 状态
    isRecording,
    interimText,
    state,
    error,
    isOverlayVisible,

    // 方法
    startRecording,
    stopRecording,
    toggleRecording,
    confirmText,
    closeOverlay,

    // 辅助
    isAvailable: managerRef.current?.isAvailable() ?? false,
    provider: settings.provider
  }
}

// 辅助函数：获取当前活动的输入目标
export function getActiveInputTarget(): 'terminal' | 'editor' | 'search' | null {
  const activeElement = document.activeElement

  if (activeElement?.closest('.xterm')) {
    return 'terminal'
  }
  if (activeElement?.closest('.monaco-editor')) {
    return 'editor'
  }
  if (activeElement?.closest('.search-input')) {
    return 'search'
  }

  return null
}
