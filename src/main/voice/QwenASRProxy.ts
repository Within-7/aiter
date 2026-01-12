import WebSocket from 'ws'
import { BrowserWindow, ipcMain } from 'electron'

interface QwenASRProxyOptions {
  apiKey: string
  region: 'cn' | 'intl'
  language?: string
}

/**
 * Connection states for the Keep-Alive WebSocket model
 */
type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'READY' | 'RECORDING' | 'PROCESSING'

/**
 * QwenASRProxy - WebSocket proxy for Qwen ASR service with connection reuse
 *
 * This proxy runs in the Electron main process to bypass browser WebSocket
 * header limitations. The DashScope API requires Bearer token authentication
 * via HTTP headers, which browsers cannot set for WebSocket connections.
 *
 * Connection Reuse Model:
 * - Maintains a persistent WebSocket connection between recordings
 * - Uses input_audio_buffer.clear before each new recording
 * - Uses input_audio_buffer.commit to signal end of recording
 * - Auto-reconnects at 25 minutes (before 30-minute server limit)
 * - Auto-reconnects on connection errors
 */
export class QwenASRProxy {
  private ws: WebSocket | null = null
  private options: QwenASRProxyOptions | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private mainWindow: BrowserWindow | null = null

  // Session ID to allow renderer to filter events from old sessions
  private sessionId = 0

  // Connection health management
  private connectionStartTime: number = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private readonly MAX_CONNECTION_AGE_MS = 25 * 60 * 1000 // 25 minutes (before 30-min limit)
  private readonly RECONNECT_CHECK_INTERVAL_MS = 60 * 1000 // Check every minute

  // Pending start resolve/reject for connection establishment
  private pendingStartResolve: (() => void) | null = null
  private pendingStartReject: ((error: Error) => void) | null = null

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

  /**
   * Check if the existing connection can be reused
   */
  private canReuseConnection(options: QwenASRProxyOptions): boolean {
    // Must have an existing connection in READY state
    if (!this.ws || this.connectionState !== 'READY') {
      return false
    }

    // Must have same API key and region
    if (!this.options ||
        this.options.apiKey !== options.apiKey ||
        this.options.region !== options.region) {
      return false
    }

    // WebSocket must be in OPEN state
    if (this.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    return true
  }

  /**
   * Start connection health monitoring timer
   */
  private startConnectionHealthMonitor(): void {
    this.stopConnectionHealthMonitor()

    this.reconnectTimer = setInterval(() => {
      if (this.connectionState === 'DISCONNECTED') {
        this.stopConnectionHealthMonitor()
        return
      }

      const connectionAge = Date.now() - this.connectionStartTime
      if (connectionAge >= this.MAX_CONNECTION_AGE_MS) {
        console.log('[QwenASRProxy] Connection approaching 30-min limit, reconnecting...')
        // Only reconnect if we're in READY state (not actively recording)
        if (this.connectionState === 'READY') {
          this.reconnect()
        }
      }
    }, this.RECONNECT_CHECK_INTERVAL_MS)
  }

  /**
   * Stop connection health monitoring timer
   */
  private stopConnectionHealthMonitor(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Reconnect by closing current connection and establishing new one
   */
  private async reconnect(): Promise<void> {
    console.log('[QwenASRProxy] Reconnecting...')
    const savedOptions = this.options

    // Clean up current connection silently
    this.cleanupWithoutNotify()

    // Re-establish connection if we have options
    if (savedOptions) {
      try {
        await this.ensureConnection(savedOptions)
        console.log('[QwenASRProxy] Reconnection successful')
      } catch (error) {
        console.error('[QwenASRProxy] Reconnection failed:', error)
      }
    }
  }

  private setupIPC() {
    console.log('[QwenASRProxy] Setting up IPC handlers...')

    // Start ASR recording session (reuses connection if possible)
    ipcMain.handle('voice:qwen-asr:start', async (_, options: QwenASRProxyOptions) => {
      console.log('[QwenASRProxy] IPC: start called, state:', this.connectionState)
      try {
        // Increment session ID for each new recording session
        this.sessionId++
        const sessionId = this.sessionId
        console.log('[QwenASRProxy] Starting recording session:', sessionId)
        await this.startRecording(options)
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

    // Stop ASR recording (keeps connection alive for reuse)
    ipcMain.handle('voice:qwen-asr:stop', async () => {
      try {
        this.stopRecording()
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Disconnect (closes connection entirely)
    ipcMain.handle('voice:qwen-asr:disconnect', async () => {
      try {
        this.disconnect()
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })
  }

  /**
   * Ensure a WebSocket connection is established and ready.
   * Reuses existing connection if possible.
   */
  private async ensureConnection(options: QwenASRProxyOptions): Promise<void> {
    // Check if we can reuse the existing connection
    if (this.canReuseConnection(options)) {
      console.log('[QwenASRProxy] Reusing existing connection')
      return
    }

    console.log('[QwenASRProxy] Creating new connection, region:', options.region)

    // Clean up any existing connection
    if (this.ws) {
      console.log('[QwenASRProxy] Cleaning up old connection before new one')
      this.cleanupWithoutNotify()
    }

    this.options = options
    this.connectionState = 'CONNECTING'
    this.connectionStartTime = Date.now()

    const url = `${this.getBaseUrl()}?model=${this.model}`
    console.log('[QwenASRProxy] Connecting to:', url)

    return new Promise((resolve, reject) => {
      this.pendingStartResolve = resolve
      this.pendingStartReject = reject

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
        this.connectionState = 'DISCONNECTED'
        this.pendingStartResolve = null
        this.pendingStartReject = null
        reject(wsError)
        return
      }

      const currentSessionId = this.sessionId

      this.ws.on('open', () => {
        console.log('[QwenASRProxy] WebSocket connected')
        this.sendSessionUpdate(options.language || 'zh')
        this.sendToRenderer('voice:qwen-asr:connected', { sessionId: currentSessionId })
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(message, currentSessionId)
        } catch (e) {
          console.error('[QwenASRProxy] Failed to parse message:', e)
        }
      })

      this.ws.on('error', (err) => {
        console.error('[QwenASRProxy] WebSocket error:', err.message)
        const errorSessionId = this.sessionId
        this.sendToRenderer('voice:qwen-asr:error', {
          error: err.message || 'WebSocket 连接错误',
          sessionId: errorSessionId
        })

        // Reject pending start if still waiting
        if (this.pendingStartReject) {
          this.pendingStartReject(new Error(err.message || 'WebSocket connection failed'))
          this.pendingStartResolve = null
          this.pendingStartReject = null
        }

        this.cleanup()
      })

      this.ws.on('close', (code, reason) => {
        console.log('[QwenASRProxy] WebSocket closed:', code, reason.toString())
        const closeSessionId = this.sessionId
        this.sendToRenderer('voice:qwen-asr:closed', {
          code,
          reason: reason.toString(),
          sessionId: closeSessionId
        })

        // Reject pending start if still waiting
        if (this.pendingStartReject) {
          this.pendingStartReject(new Error(`WebSocket closed: ${code} ${reason.toString()}`))
          this.pendingStartResolve = null
          this.pendingStartReject = null
        }

        this.cleanup()
      })

      // Timeout for connection
      setTimeout(() => {
        if (this.connectionState === 'CONNECTING' && this.pendingStartReject) {
          this.pendingStartReject(new Error('Connection timeout'))
          this.pendingStartResolve = null
          this.pendingStartReject = null
          this.cleanup()
        }
      }, 10000)
    })
  }

  /**
   * Start a new recording session.
   * Reuses existing connection if possible, otherwise establishes new one.
   *
   * Note: Qwen-ASR automatically clears the audio buffer after commit,
   * so no explicit clear is needed before new recordings.
   */
  private async startRecording(options: QwenASRProxyOptions): Promise<void> {
    console.log('[QwenASRProxy] startRecording() called, state:', this.connectionState)

    // Ensure connection is established
    await this.ensureConnection(options)

    // Update state to recording
    // Note: Qwen-ASR doesn't have input_audio_buffer.clear event.
    // After commit, the buffer is automatically ready for new audio.
    this.connectionState = 'RECORDING'

    const currentSessionId = this.sessionId
    console.log('[QwenASRProxy] Recording started for session:', currentSessionId)
    this.sendToRenderer('voice:qwen-asr:ready', { sessionId: currentSessionId })
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

  /**
   * Stop recording but keep connection alive for reuse.
   * Sends commit to signal end of speech and transitions to PROCESSING state.
   */
  private stopRecording(): void {
    if (this.connectionState !== 'RECORDING') {
      console.log('[QwenASRProxy] stopRecording called but not recording, state:', this.connectionState)
      return
    }

    console.log('[QwenASRProxy] Stopping recording for session:', this.sessionId)

    // Send commit to signal end of speech
    this.commit()

    // Transition to PROCESSING state (waiting for final result)
    this.connectionState = 'PROCESSING'
    console.log('[QwenASRProxy] State changed to PROCESSING, connection kept alive')
  }

  /**
   * Disconnect and close the WebSocket connection entirely.
   * Call this when the user exits voice input mode or app is closing.
   */
  private disconnect(): void {
    console.log('[QwenASRProxy] Disconnecting...')
    this.stopConnectionHealthMonitor()
    this.cleanup()
  }

  private handleMessage(data: any, sessionId: number): void {
    // Log all message types for debugging
    if (data.type !== 'session.created' && data.type !== 'session.updated') {
      console.log('[QwenASRProxy] Message received for session:', sessionId, data.type, JSON.stringify(data).substring(0, 200))
    }

    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        console.log('[QwenASRProxy] Session ready, state:', this.connectionState)

        // If we're in CONNECTING state, this means connection is ready
        if (this.connectionState === 'CONNECTING') {
          this.connectionState = 'READY'
          console.log('[QwenASRProxy] Connection established, state changed to READY')

          // Start connection health monitoring
          this.startConnectionHealthMonitor()

          // Resolve pending start
          if (this.pendingStartResolve) {
            this.pendingStartResolve()
            this.pendingStartResolve = null
            this.pendingStartReject = null
          }
        }
        // Note: Don't send ready event here for session.updated during connection
        // The ready event is sent in startRecording() after connection is ensured
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

        // After receiving final result, transition back to READY state
        if (this.connectionState === 'PROCESSING') {
          this.connectionState = 'READY'
          console.log('[QwenASRProxy] Final result received, state changed back to READY')
        }
        break

      case 'error': {
        const errorMsg = data.error?.message || '识别错误'
        // Ignore "no audio" errors - this happens when user stops without speaking
        if (errorMsg.includes('no invalid audio') || errorMsg.includes('no audio')) {
          console.log('[QwenASRProxy] No audio data for session:', sessionId, ', ignoring error:', errorMsg)
          // Send empty final result instead of error
          this.sendToRenderer('voice:qwen-asr:final', { text: '', sessionId })

          // Transition back to READY state
          if (this.connectionState === 'PROCESSING') {
            this.connectionState = 'READY'
          }
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
   * Used when reconnecting or switching to new connection.
   */
  private cleanupWithoutNotify(): void {
    console.log('[QwenASRProxy] Cleaning up (silent)...')

    this.stopConnectionHealthMonitor()

    if (this.ws) {
      // Remove all listeners before closing to prevent close event
      this.ws.removeAllListeners()
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Connection replaced')
      }
      this.ws = null
    }

    this.connectionState = 'DISCONNECTED'
    this.pendingStartResolve = null
    this.pendingStartReject = null
    // Note: Don't clear this.options here - needed for reconnection
  }

  private cleanupInternal(): void {
    this.stopConnectionHealthMonitor()

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Normal closure')
      }
      this.ws = null
    }

    this.connectionState = 'DISCONNECTED'
    this.options = null
    this.pendingStartResolve = null
    this.pendingStartReject = null
  }

  destroy(): void {
    this.disconnect()
  }

  /**
   * Get current connection state (for debugging)
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
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
