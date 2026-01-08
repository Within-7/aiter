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
    this.setupIPC()
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
    // Start ASR session
    ipcMain.handle('voice:qwen-asr:start', async (_, options: QwenASRProxyOptions) => {
      try {
        await this.start(options)
        return { success: true }
      } catch (error) {
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
    if (this.isRunning) {
      console.warn('[QwenASRProxy] Already running')
      return
    }

    this.options = options
    this.isRunning = true

    const url = `${this.getBaseUrl()}?model=${this.model}`

    console.log('[QwenASRProxy] Connecting to:', url)

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      })

      this.ws.on('open', () => {
        console.log('[QwenASRProxy] WebSocket connected')
        this.sendSessionUpdate(options.language || 'zh')
        this.sendToRenderer('voice:qwen-asr:connected', {})
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(message)
        } catch (e) {
          console.error('[QwenASRProxy] Failed to parse message:', e)
        }
      })

      this.ws.on('error', (err) => {
        console.error('[QwenASRProxy] WebSocket error:', err.message)
        this.sendToRenderer('voice:qwen-asr:error', { error: err.message || 'WebSocket 连接错误' })
        this.cleanup()
        if (!this.isRunning) {
          reject(new Error(err.message || 'WebSocket connection failed'))
        }
      })

      this.ws.on('close', (code, reason) => {
        console.log('[QwenASRProxy] WebSocket closed:', code, reason.toString())
        this.sendToRenderer('voice:qwen-asr:closed', { code, reason: reason.toString() })
        this.cleanup()
      })

      // Timeout for connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'))
          this.cleanup()
        }
      }, 10000)
    })
  }

  private sendSessionUpdate(language: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    const sessionConfig = {
      event_id: 'event_session',
      type: 'session.update',
      session: {
        modalities: ['text'],
        input_audio_format: 'pcm',
        sample_rate: 16000,
        input_audio_transcription: {
          language: language
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 500
        }
      }
    }

    this.ws.send(JSON.stringify(sessionConfig))
  }

  private sendAudio(base64Audio: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    const appendEvent = {
      event_id: `event_audio_${Date.now()}`,
      type: 'input_audio_buffer.append',
      audio: base64Audio
    }
    this.ws.send(JSON.stringify(appendEvent))
  }

  private commit(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    const commitEvent = {
      event_id: `event_commit_${Date.now()}`,
      type: 'input_audio_buffer.commit'
    }
    this.ws.send(JSON.stringify(commitEvent))
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
    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        console.log('[QwenASRProxy] Session ready')
        this.sendToRenderer('voice:qwen-asr:ready', {})
        break

      case 'conversation.item.input_audio_transcription.delta':
        if (data.delta) {
          this.sendToRenderer('voice:qwen-asr:interim', { text: data.delta })
        }
        break

      case 'conversation.item.input_audio_transcription.completed':
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
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
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
