import { useEffect, useRef, useCallback } from 'react'

// 触发模式
export type TriggerMode = 'hold' | 'double-tap'

interface PushToTalkOptions {
  triggerKey: string           // 'Alt', 'Meta', 'Control' 等
  triggerMode?: TriggerMode    // 'hold' = 长按触发, 'double-tap' = 双击+按住触发
  minHoldDuration: number      // 最小按住时间（ms），防误触
  doubleTapInterval?: number   // 双击间隔时间（ms），默认 300ms
  onStart: () => void          // 开始录音回调
  onEnd: () => void            // 结束录音回调
  enabled: boolean             // 是否启用
}

export function usePushToTalk(options: PushToTalkOptions) {
  const {
    triggerKey = 'Alt',
    triggerMode = 'double-tap',  // 默认改为双击模式
    minHoldDuration = 200,
    doubleTapInterval = 300,
    onStart,
    onEnd,
    enabled = true
  } = options

  const isHolding = useRef(false)
  const holdStartTime = useRef<number | null>(null)
  const isRecording = useRef(false)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 双击检测相关
  const lastTapTime = useRef<number>(0)
  const isDoubleTapDetected = useRef(false)
  const tapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // 检查是否是触发键（只响应单独按下的修饰键）
    const isTriggerKey =
      (triggerKey === 'Alt' && event.key === 'Alt') ||
      (triggerKey === 'Meta' && event.key === 'Meta') ||
      (triggerKey === 'Control' && event.key === 'Control')

    if (!isTriggerKey) return

    // 防止重复触发（按住时的重复 keydown 事件）
    if (isHolding.current) return

    // 如果有其他修饰键按下，不触发（避免快捷键冲突）
    const hasOtherModifiers =
      (triggerKey !== 'Alt' && event.altKey) ||
      (triggerKey !== 'Meta' && event.metaKey) ||
      (triggerKey !== 'Control' && event.ctrlKey) ||
      event.shiftKey

    if (hasOtherModifiers) return

    const now = Date.now()
    isHolding.current = true
    holdStartTime.current = now

    // ===== 双击模式逻辑 =====
    if (triggerMode === 'double-tap') {
      const timeSinceLastTap = now - lastTapTime.current

      // 检测是否为双击（第二次按下在间隔时间内）
      if (timeSinceLastTap <= doubleTapInterval && timeSinceLastTap > 50) {
        // 双击检测成功
        isDoubleTapDetected.current = true

        // 清除重置定时器
        if (tapResetTimeoutRef.current) {
          clearTimeout(tapResetTimeoutRef.current)
          tapResetTimeoutRef.current = null
        }

        // 延迟启动录音（防误触）
        startTimeoutRef.current = setTimeout(() => {
          if (isHolding.current && !isRecording.current && isDoubleTapDetected.current) {
            isRecording.current = true
            onStart()
          }
        }, minHoldDuration)
      }
      // 不是双击，只记录时间，等待可能的第二次按下
      // lastTapTime 会在 keyup 时更新

      return
    }

    // ===== 长按模式逻辑（原有逻辑）=====
    // 延迟启动录音（防误触）
    startTimeoutRef.current = setTimeout(() => {
      if (isHolding.current && !isRecording.current) {
        isRecording.current = true
        onStart()
      }
    }, minHoldDuration)

  }, [triggerKey, triggerMode, minHoldDuration, doubleTapInterval, onStart, enabled])

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

    const now = Date.now()

    // ===== 双击模式逻辑 =====
    if (triggerMode === 'double-tap') {
      // 只有在实际录音状态时才触发结束
      if (isRecording.current) {
        isRecording.current = false
        isDoubleTapDetected.current = false
        onEnd()
      } else if (!isDoubleTapDetected.current) {
        // 未检测到双击，这是单击松开，记录时间用于下一次双击检测
        lastTapTime.current = now

        // 设置重置定时器：如果超过间隔时间没有第二次按下，重置状态
        if (tapResetTimeoutRef.current) {
          clearTimeout(tapResetTimeoutRef.current)
        }
        tapResetTimeoutRef.current = setTimeout(() => {
          lastTapTime.current = 0
          tapResetTimeoutRef.current = null
        }, doubleTapInterval + 50)  // 多加 50ms 容差
      }

      isHolding.current = false
      holdStartTime.current = null
      isDoubleTapDetected.current = false
      return
    }

    // ===== 长按模式逻辑（原有逻辑）=====
    isHolding.current = false
    holdStartTime.current = null

    // 只有在实际录音状态时才触发结束
    if (isRecording.current) {
      isRecording.current = false
      onEnd()
    }

  }, [triggerKey, triggerMode, doubleTapInterval, onEnd, enabled])

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
      if (tapResetTimeoutRef.current) {
        clearTimeout(tapResetTimeoutRef.current)
        tapResetTimeoutRef.current = null
      }
      if (isRecording.current) {
        isRecording.current = false
        isHolding.current = false
        isDoubleTapDetected.current = false
        onEnd()
      }
      // 重置双击状态
      lastTapTime.current = 0
      isDoubleTapDetected.current = false
    }
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
      }
      if (tapResetTimeoutRef.current) {
        clearTimeout(tapResetTimeoutRef.current)
      }
    }
  }, [handleKeyDown, handleKeyUp, onEnd, enabled])

  return {
    isRecording: isRecording.current
  }
}
