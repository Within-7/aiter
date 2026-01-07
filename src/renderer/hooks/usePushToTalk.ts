import { useEffect, useRef, useCallback } from 'react'

interface PushToTalkOptions {
  triggerKey: string           // 'Alt', 'Meta', 'Control' 等
  minHoldDuration: number      // 最小按住时间（ms），防误触
  onStart: () => void          // 开始录音回调
  onEnd: () => void            // 结束录音回调
  enabled: boolean             // 是否启用
}

export function usePushToTalk(options: PushToTalkOptions) {
  const {
    triggerKey = 'Alt',
    minHoldDuration = 200,
    onStart,
    onEnd,
    enabled = true
  } = options

  const isHolding = useRef(false)
  const holdStartTime = useRef<number | null>(null)
  const isRecording = useRef(false)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // 检查是否是触发键（只响应单独按下的修饰键）
    const isTriggerKey =
      (triggerKey === 'Alt' && event.key === 'Alt') ||
      (triggerKey === 'Meta' && event.key === 'Meta') ||
      (triggerKey === 'Control' && event.key === 'Control')

    if (!isTriggerKey) return

    // 防止重复触发
    if (isHolding.current) return

    // 如果有其他修饰键按下，不触发（避免快捷键冲突）
    const hasOtherModifiers =
      (triggerKey !== 'Alt' && event.altKey) ||
      (triggerKey !== 'Meta' && event.metaKey) ||
      (triggerKey !== 'Control' && event.ctrlKey) ||
      event.shiftKey

    if (hasOtherModifiers) return

    isHolding.current = true
    holdStartTime.current = Date.now()

    // 延迟启动录音（防误触）
    startTimeoutRef.current = setTimeout(() => {
      if (isHolding.current && !isRecording.current) {
        isRecording.current = true
        onStart()
      }
    }, minHoldDuration)

  }, [triggerKey, minHoldDuration, onStart, enabled])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    const isTriggerKey =
      (triggerKey === 'Alt' && event.key === 'Alt') ||
      (triggerKey === 'Meta' && event.key === 'Meta') ||
      (triggerKey === 'Control' && event.key === 'Control')

    if (!isTriggerKey) return

    // 清除延迟启动的定时器
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }

    isHolding.current = false
    holdStartTime.current = null

    // 只有在实际录音状态时才触发结束
    if (isRecording.current) {
      isRecording.current = false
      onEnd()
    }

  }, [triggerKey, onEnd, enabled])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // 处理窗口失焦时的情况（用户按住键切换窗口）
    const handleBlur = () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      if (isRecording.current) {
        isRecording.current = false
        isHolding.current = false
        onEnd()
      }
    }
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
      }
    }
  }, [handleKeyDown, handleKeyUp, onEnd, enabled])

  return {
    isRecording: isRecording.current
  }
}
