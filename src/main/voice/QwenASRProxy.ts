import WebSocket from 'ws'
import { BrowserWindow, ipcMain } from 'electron'

interface QwenASRProxyOptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
}

interface AudioMessage {
  type: 'audio'
  data: string // base64 encoded PCM audio
}

interface ControlMessage {
  type: 'start' | 'stop' | 'commit'
  options?: QwenASRProxyOptions
}

type ProxyMessage = AudioMessage | ControlMessage

/**
 * QwenASRProxy - WebSocket proxy for Qwen ASR service
 *
 * This proxy runs in the Electron main process to bypass browser WebSocket
 * header limitations. The DashScope API requires Bearer token authentication
 * via HTTP headers, which browsers cannot set for WebSocket connections.
 */
export class QwenASRProxy {
  private ws: WebSocket | null = null
  private options: QwenASRProxyOptions | null = null
  private isRunning = false
  private mainWindow: BrowserWindow | null = null

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

    // Start ASR session
    ipcMain.handle('voice:qwen-asr:start', async (_, options: QwenASRProxyOptions) => {
      console.log('[QwenASRProxy] IPC: start called')
      try {
        await this.start(options)
        return { success: true }
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

    // Stop ASR session
    ipcMain.handle('voice:qwen-asr:stop', async () => {
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

    if (this.isRunning) {
      console.warn('[QwenASRProxy] Already running')
      // If already running, just send ready event again
      this.sendToRenderer('voice:qwen-asr:ready', {})
      return
    }

    this.options = options
    this.isRunning = true

    const url = `${this.getBaseUrl()}?model=${this.model}`

    console.log('[QwenASRProxy] Connecting to:', url)

    return new Promise((resolve, reject) => {
      let sessionReady = false

      console.log('[QwenASRProxy] Creating WebSocket...')
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
        console.log('[QwenASRProxy] WebSocket connected')
        this.sendSessionUpdate(options.language || 'zh')
        this.sendToRenderer('voice:qwen-asr:connected', {})
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())

          // Check for session ready before handling
          if ((message.type === 'session.created' || message.type === 'session.updated') && !sessionReady) {
            sessionReady = true
            console.log('[QwenASRProxy] Session ready, resolving start()')
            this.sendToRenderer('voice:qwen-asr:ready', {})
            resolve()
          }

          this.handleMessage(message)
        } catch (e) {
          console.error('[QwenASRProxy] Failed to parse message:', e)
        }
      })

      this.ws.on('error', (err) => {
        console.error('[QwenASRProxy] WebSocket error:', err.message)
        this.sendToRenderer('voice:qwen-asr:error', { error: err.message || 'WebSocket 连接错误' })
        this.cleanup()
        reject(new Error(err.message || 'WebSocket connection failed'))
      })

      this.ws.on('close', (code, reason) => {
        console.log('[QwenASRProxy] WebSocket closed:', code, reason.toString())
        this.sendToRenderer('voice:qwen-asr:closed', { code, reason: reason.toString() })
        this.cleanup()
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

    console.log('[QwenASRProxy] Stopping...')
    this.isRunning = false

    // Send commit before closing
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.commit()
      // Give server time to process final audio
      setTimeout(() => {
        this.cleanup()
      }, 500)
    } else {
      this.cleanup()
    }
  }

  private handleMessage(data: any): void {
    // Log all message types for debugging
    if (data.type !== 'session.created' && data.type !== 'session.updated') {
      console.log('[QwenASRProxy] Message received:', data.type, JSON.stringify(data).substring(0, 200))
    }

    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        console.log('[QwenASRProxy] Session ready')
        this.sendToRenderer('voice:qwen-asr:ready', {})
        break

      case 'conversation.item.input_audio_transcription.text':
        // Real-time interim results are in the 'stash' field
        if (data.stash) {
          console.log('[QwenASRProxy] Interim result:', data.stash)
          this.sendToRenderer('voice:qwen-asr:interim', { text: data.stash })
        }
        break

      case 'conversation.item.input_audio_transcription.completed':
        console.log('[QwenASRProxy] Final result:', data.transcript)
        if (data.transcript) {
          this.sendToRenderer('voice:qwen-asr:final', { text: data.transcript })
        }
        break

      case 'error':
        const errorMsg = data.error?.message || '识别错误'
        console.error('[QwenASRProxy] Error:', errorMsg)
        this.sendToRenderer('voice:qwen-asr:error', { error: errorMsg })
        break

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
