import WebSocket from 'ws'
import { BrowserWindow, ipcMain } from 'electron'

interface QwenASRProxyOptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
}

/**
 * QwenASRProxy - WebSocket proxy for Qwen ASR service
 *
 * This proxy runs in the Electron main process to bypass browser WebSocket
 * header limitations. The DashScope API requires Bearer token authentication
 * via HTTP headers, which browsers cannot set for WebSocket connections.
 *
 * NOTE: Qwen-ASR does NOT support input_audio_buffer.clear, so each recording
 * session requires a new WebSocket connection. Connection reuse is not possible.
 */
export class QwenASRProxy {
  private ws: WebSocket | null = null
  private options: QwenASRProxyOptions | null = null
  private isRunning = false
  private mainWindow: BrowserWindow | null = null

  // Session ID to allow renderer to filter events from old sessions
  private sessionId = 0

  private readonly model = 'qwen3-asr-flash-realtime'

  constructor() {
    console.log('[QwenASRProxy] Initializing...')
    try {
      this.setupIPC()
      console.log('[QwenASRProxy] IPC handlers registered')
    } catch (error) {
      console.error('[QwenASRProxy] Failed to initialize:', error)
    }
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  private getBaseUrl(): string {
    if (!this.options) return ''
    return this.options.region === 'intl'
      ? 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime'
      : 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'
  }

  private setupIPC() {
    console.log('[QwenASRProxy] Setting up IPC handlers...')

    // Start ASR session - creates new WebSocket connection each time
    ipcMain.handle('voice:qwen-asr:start', async (_, options: QwenASRProxyOptions) => {
      console.log('[QwenASRProxy] IPC: start called')
      try {
        // Increment session ID for each new session
        this.sessionId++
        const sessionId = this.sessionId
        console.log('[QwenASRProxy] Starting session:', sessionId)
        await this.start(options)
        return { success: true, sessionId }
      } catch (error) {
        console.error('[QwenASRProxy] IPC: start failed:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Send audio data
    ipcMain.handle('voice:qwen-asr:audio', async (_, base64Audio: string) => {
      try {
        this.sendAudio(base64Audio)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Commit (signal end of speech)
    ipcMain.handle('voice:qwen-asr:commit', async () => {
      try {
        this.commit()
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Stop ASR session - closes WebSocket connection
    ipcMain.handle('voice:qwen-asr:stop', async () => {
      try {
        this.stop()
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Disconnect (alias for stop, kept for API compatibility)
    ipcMain.handle('voice:qwen-asr:disconnect', async () => {
      try {
        this.stop()
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })
  }

  private async start(options: QwenASRProxyOptions): Promise<void> {
    console.log('[QwenASRProxy] start() called with region:', options.region)

    // Always cleanup previous connection before starting new one
    // This is critical because Qwen-ASR doesn't support clearing audio buffer
    if (this.isRunning || this.ws) {
      console.log('[QwenASRProxy] Cleaning up previous session before starting new one')
      this.cleanupWithoutNotify()
    }

    this.options = options
    this.isRunning = true

    const url = `${this.getBaseUrl()}?model=${this.model}`
    console.log('[QwenASRProxy] Connecting to:', url)

    return new Promise((resolve, reject) => {
      let sessionReady = false
      const currentSessionId = this.sessionId

      console.log('[QwenASRProxy] Creating WebSocket for session:', currentSessionId)
      try {
        this.ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${options.apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        })
        console.log('[QwenASRProxy] WebSocket object created')
      } catch (wsError) {
        console.error('[QwenASRProxy] WebSocket creation failed:', wsError)
        this.isRunning = false
        reject(wsError)
        return
      }

      this.ws.on('open', () => {
        console.log('[QwenASRProxy] WebSocket connected for session:', currentSessionId)
        this.sendSessionUpdate(options.language || 'zh')
        this.sendToRenderer('voice:qwen-asr:connected', { sessionId: currentSessionId })
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())

          // Check for session ready before handling
          if ((message.type === 'session.created' || message.type === 'session.updated') && !sessionReady) {
            sessionReady = true
            console.log('[QwenASRProxy] Session ready, resolving start() for session:', currentSessionId)
            this.sendToRenderer('voice:qwen-asr:ready', { sessionId: currentSessionId })
            resolve()
          }

          this.handleMessage(message, currentSessionId)
        } catch (e) {
          console.error('[QwenASRProxy] Failed to parse message:', e)
        }
      })

      this.ws.on('error', (err) => {
        console.error('[QwenASRProxy] WebSocket error for session:', currentSessionId, err.message)
        this.sendToRenderer('voice:qwen-asr:error', { error: err.message || 'WebSocket 连接错误', sessionId: currentSessionId })
        this.cleanup()
        if (!sessionReady) {
          reject(new Error(err.message || 'WebSocket connection failed'))
        }
      })

      this.ws.on('close', (code, reason) => {
        console.log('[QwenASRProxy] WebSocket closed for session:', currentSessionId, code, reason.toString())
        // Only send closed event if this is still the current session
        if (currentSessionId === this.sessionId) {
          this.sendToRenderer('voice:qwen-asr:closed', { code, reason: reason.toString(), sessionId: currentSessionId })
          this.cleanup()
        }
        if (!sessionReady) {
          reject(new Error(`WebSocket closed: ${code} ${reason.toString()}`))
        }
      })

      // Timeout for connection
      setTimeout(() => {
        if (!sessionReady) {
          reject(new Error('Connection timeout'))
          this.cleanup()
        }
      }, 10000)
    })
  }

  /**
   * Map browser/UI language codes to Qwen-ASR compatible codes
   * Qwen-ASR uses simple language codes like 'zh', 'en', 'ja', etc.
   */
  private normalizeLanguageCode(language: string): string {
    // Map common locale codes to simple language codes
    const languageMap: Record<string, string> = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'zh-HK': 'zh',
      'en-US': 'en',
      'en-GB': 'en',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'es-ES': 'es',
      'fr-FR': 'fr',
      'de-DE': 'de',
      'pt-BR': 'pt',
      'ru-RU': 'ru',
    }

    // Check if we have a mapping, otherwise extract base language
    if (languageMap[language]) {
      return languageMap[language]
    }

    // If it contains a hyphen, take the first part (e.g., 'zh-CN' -> 'zh')
    if (language.includes('-')) {
      return language.split('-')[0].toLowerCase()
    }

    return language.toLowerCase()
  }

  private sendSessionUpdate(language: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    const normalizedLang = this.normalizeLanguageCode(language)
    console.log('[QwenASRProxy] Setting language:', language, '->', normalizedLang)

    try {
      const sessionConfig = {
        event_id: 'event_session',
        type: 'session.update',
        session: {
          modalities: ['text'],
          input_audio_format: 'pcm',
          sample_rate: 16000,
          input_audio_transcription: {
            language: normalizedLang
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            silence_duration_ms: 500
          }
        }
      }

      this.ws.send(JSON.stringify(sessionConfig))
    } catch (err) {
      console.error('[QwenASRProxy] Failed to send session update:', err)
    }
  }

  private sendAudio(base64Audio: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    try {
      const appendEvent = {
        event_id: `event_audio_${Date.now()}`,
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }
      this.ws.send(JSON.stringify(appendEvent))
    } catch (err) {
      console.error('[QwenASRProxy] Failed to send audio:', err)
    }
  }

  private commit(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    try {
      const commitEvent = {
        event_id: `event_commit_${Date.now()}`,
        type: 'input_audio_buffer.commit'
      }
      this.ws.send(JSON.stringify(commitEvent))
    } catch (err) {
      console.error('[QwenASRProxy] Failed to send commit:', err)
    }
  }

  private stop(): void {
    if (!this.isRunning) return

    console.log('[QwenASRProxy] Stopping session:', this.sessionId)
    const stoppingSessionId = this.sessionId
    const stoppingWs = this.ws  // Capture the current WebSocket reference
    this.isRunning = false

    // Send commit before closing
    if (stoppingWs?.readyState === WebSocket.OPEN) {
      this.commit()
      // Give server time to process final audio
      setTimeout(() => {
        // Only close if this is still the same WebSocket (not replaced by a new session)
        if (this.ws === stoppingWs) {
          console.log('[QwenASRProxy] Delayed cleanup for session:', stoppingSessionId)
          this.cleanup()
        } else {
          // A new session has started, just close the old WebSocket quietly
          console.log('[QwenASRProxy] Skipping cleanup, new session started. Old:', stoppingSessionId, 'Current:', this.sessionId)
          if (stoppingWs.readyState === WebSocket.OPEN || stoppingWs.readyState === WebSocket.CONNECTING) {
            stoppingWs.removeAllListeners()
            stoppingWs.close(1000, 'Session replaced')
          }
        }
      }, 500)
    } else {
      this.cleanup()
    }
  }

  private handleMessage(data: any, sessionId: number): void {
    // Log all message types for debugging
    if (data.type !== 'session.created' && data.type !== 'session.updated') {
      console.log('[QwenASRProxy] Message received for session:', sessionId, data.type, JSON.stringify(data).substring(0, 200))
    }

    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        console.log('[QwenASRProxy] Session ready:', sessionId)
        this.sendToRenderer('voice:qwen-asr:ready', { sessionId })
        break

      case 'conversation.item.input_audio_transcription.text':
        // Real-time interim results are in the 'stash' field
        if (data.stash) {
          console.log('[QwenASRProxy] Interim result for session:', sessionId, data.stash)
          this.sendToRenderer('voice:qwen-asr:interim', { text: data.stash, sessionId })
        }
        break

      case 'conversation.item.input_audio_transcription.completed':
        console.log('[QwenASRProxy] Final result for session:', sessionId, data.transcript)
        if (data.transcript !== undefined) {
          this.sendToRenderer('voice:qwen-asr:final', { text: data.transcript || '', sessionId })
        }
        break

      case 'error': {
        const errorMsg = data.error?.message || '识别错误'
        // Ignore "no audio" errors - this happens when user stops without speaking
        if (errorMsg.includes('no invalid audio') || errorMsg.includes('no audio')) {
          console.log('[QwenASRProxy] No audio data for session:', sessionId, ', ignoring error:', errorMsg)
          // Send empty final result instead of error
          this.sendToRenderer('voice:qwen-asr:final', { text: '', sessionId })
        } else {
          console.error('[QwenASRProxy] Error for session:', sessionId, errorMsg)
          this.sendToRenderer('voice:qwen-asr:error', { error: errorMsg, sessionId })
        }
        break
      }

      default:
        // Ignore other message types
        break
    }
  }

  private sendToRenderer(channel: string, data: any): void {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(channel, data)
      }
    } catch (err) {
      console.error('[QwenASRProxy] Failed to send to renderer:', channel, err)
    }
  }

  private cleanup(): void {
    console.log('[QwenASRProxy] Cleaning up...')
    this.cleanupInternal()
  }

  /**
   * Cleanup without sending closed event to renderer.
   * Used when starting a new session to avoid triggering old session's cleanup handlers.
   */
  private cleanupWithoutNotify(): void {
    console.log('[QwenASRProxy] Cleaning up (silent)...')

    if (this.ws) {
      // Remove all listeners before closing to prevent close event
      this.ws.removeAllListeners()
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'New session started')
      }
      this.ws = null
    }

    this.isRunning = false
    this.options = null
  }

  private cleanupInternal(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Normal closure')
      }
      this.ws = null
    }

    this.isRunning = false
    this.options = null
  }

  destroy(): void {
    this.cleanup()
  }
}

// Singleton instance
let proxyInstance: QwenASRProxy | null = null

export function getQwenASRProxy(): QwenASRProxy {
  if (!proxyInstance) {
    proxyInstance = new QwenASRProxy()
  }
  return proxyInstance
}

export function initQwenASRProxy(window: BrowserWindow): QwenASRProxy {
  const proxy = getQwenASRProxy()
  proxy.setMainWindow(window)
  return proxy
}
