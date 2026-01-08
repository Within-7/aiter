import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceInputManager } from '../services/VoiceInputManager'
import { usePushToTalk } from './usePushToTalk'
import type { VoiceInputSettings, VoiceInputState } from '../../types/voiceInput'

interface UseVoiceInputOptions {
  settings: VoiceInputSettings
  onTextInsert?: (text: string) => void
}

export function useVoiceInput(options: UseVoiceInputOptions) {
  const { settings, onTextInsert } = options

  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<VoiceInputManager | null>(null)

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
        setInterimText('')
        setIsRecording(false)
        if (text.trim()) {
          onTextInsert?.(text)
        }
      },
      onError: (err) => {
        setError(err)
        setIsRecording(false)
        console.error('[useVoiceInput] Error:', err)
      },
      onStateChange: (newState) => {
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
    settings.language
  ])

  // 更新 onTextInsert 回调
  useEffect(() => {
    if (managerRef.current) {
      // 回调会在 onFinalResult 中使用最新的 onTextInsert
    }
  }, [onTextInsert])

  const startRecording = useCallback(async () => {
    if (!managerRef.current) {
      setError('语音识别服务未初始化')
      return
    }

    if (isRecording) {
      return
    }

    setIsRecording(true)
    setInterimText('')
    setError(null)

    await managerRef.current.start()
  }, [isRecording])

  const stopRecording = useCallback(() => {
    // Also clear error state when stopping
    if (state === 'error') {
      setState('idle')
      setError(null)
      return
    }

    if (!isRecording) {
      return
    }

    managerRef.current?.stop()
  }, [isRecording, state])

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

    // 方法
    startRecording,
    stopRecording,
    toggleRecording,

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
