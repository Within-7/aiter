# AiTer 语音输入功能设计方案

## 概述

为 AiTer 添加现代化的语音输入功能，让用户可以通过语音与 AI CLI 工具和文件编辑器进行交互。

## 设计目标

1. **无缝集成** - 语音输入作为现有输入方式的补充，不改变用户习惯
2. **多场景支持** - 同时支持终端命令输入、代码编辑、文档撰写
3. **实时转录** - 边说边显示，流式识别结果
4. **双引擎支持** - 系统原生（离线）+ Qwen-ASR（云端高精度）
5. **隐私优先** - 默认使用系统原生离线识别

---

## 语音识别引擎

### 引擎对比

| 特性 | 系统原生 | Qwen-ASR |
|------|----------|----------|
| **实时性** | ✅ 流式识别 | ✅ 流式识别 |
| **离线支持** | ✅ 完全离线 | ❌ 需要网络 |
| **中文准确度** | 良好 | 优秀 |
| **技术术语** | 一般 | 优秀 |
| **费用** | 免费 | 有免费额度 |
| **配置难度** | 零配置 | 需要 API Key |
| **隐私** | ✅ 本地处理 | ⚠️ 云端处理 |

### 推荐使用场景

- **系统原生**：日常使用、隐私敏感场景、无网络环境
- **Qwen-ASR**：需要高精度识别、技术术语较多、编程相关输入

---

## 交互设计

### 1. 激活方式

#### 1.1 按住说话 (Push-to-Talk) - 推荐方式

```
默认按键: Option (macOS) / Alt (Windows)
```

**交互流程：**
```
按下 Option ──→ 开始录音 ──→ 说话（实时显示文字）──→ 松开 Option ──→ 插入文本
     │                              │                        │
     └── 显示录音指示器              └── 流式更新识别结果      └── 隐藏指示器
```

**为什么选择 Option/Alt 键？**
- ✅ 单键操作，比组合键更自然
- ✅ 位置适合拇指按压，符合人体工学
- ✅ 在终端和编辑器中很少单独使用
- ✅ 类似对讲机的直觉操作

**防误触机制：**
- 需按住超过 200ms 才开始录音（避免误触）
- 按住时间少于 500ms 且无语音检测时，不触发识别
- 如果焦点在需要 Option 的输入框中，自动禁用

**可选替代键：**
| 按键 | macOS | Windows | 说明 |
|------|-------|---------|------|
| Option/Alt | ⌥ | Alt | 默认推荐 |
| Fn | Fn | Fn | 更不容易误触 |
| 右 Command | ⌘ (右) | 右 Ctrl | 适合右手操作 |
| 自定义 | 用户设置 | 用户设置 | 任意单键或组合键 |

#### 1.2 切换模式（可选）

```
快捷键: Cmd+Shift+V (macOS) / Ctrl+Shift+V (Windows)
```

- 按一次开始录音
- 再按一次结束录音
- 适合长时间语音输入场景

#### 1.3 UI 按钮激活（辅助方式）

```
┌─────────────────────────────────────────────────────┐
│ [Tab1] [Tab2] [Tab3]              [🎤]  [⚙️]        │
│─────────────────────────────────────────────────────│
│                                                     │
│  Terminal / Editor Content                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- 标签栏右侧添加麦克风按钮
- 点击激活/停止语音输入
- 录音时按钮显示动画效果

### 2. 实时视觉反馈

#### 2.1 录音状态指示器

```
┌─────────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────┐   │
│ │  🔴 正在录音...  ████████░░░░  [停止]         │   │
│ │                                               │   │
│ │  "我想要创建一个新的 React 组件"              │   │
│ │                          ▲                    │   │
│ │                     实时更新                  │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│  $ npm run dev                                      │
│  > vite                                             │
└─────────────────────────────────────────────────────┘
```

**状态指示器特性：**
- 浮动在当前活动区域上方
- 显示录音波形/音量条
- **实时显示识别中的文字（流式更新）**
- 提供手动停止按钮
- 显示当前使用的识别引擎

#### 2.2 状态图标变化

| 状态 | 图标 | 颜色 | 描述 |
|------|------|------|------|
| 待机 | 🎤 | 灰色 | 可以开始录音 |
| 录音中 | 🔴 | 红色+脉动动画 | 正在录音和识别 |
| 处理中 | ⏳ | 黄色 | 正在处理最终结果 |
| 错误 | ⚠️ | 红色 | 识别失败 |

### 3. 文本插入行为

#### 3.1 终端模式

```typescript
// 语音识别完成后
const insertToTerminal = (text: string, options: InsertOptions) => {
  // 不自动执行，只输入文本
  await window.api.terminal.write(activeTerminalId, text)

  // 用户可选：自动添加换行执行
  if (options.autoExecute) {
    await window.api.terminal.write(activeTerminalId, '\n')
  }
}
```

**终端专用指令识别：**
- "执行" / "运行" / "回车" → 发送换行符
- "清空" / "清除" → 发送 Ctrl+C 或清空输入
- "上一条" / "上一个命令" → 发送向上箭头

#### 3.2 编辑器模式

```typescript
// 语音识别完成后
const insertToEditor = (text: string, options: InsertOptions) => {
  // 获取当前光标位置
  const position = editor.getPosition()

  // 插入文本
  editor.executeEdits('voice-input', [{
    range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
    text: text
  }])
}
```

**编辑器专用指令识别：**
- "新行" / "换行" → 插入换行符
- "删除这行" → 删除当前行
- "撤销" → 触发 Ctrl+Z

---

## 技术架构

### 1. 双引擎架构

```
┌─────────────────────────────────────────────────────────────┐
│                    VoiceInputManager                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  统一接口层                          │    │
│  │  start() | stop() | onInterimResult() | onFinal()   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│              ┌────────────┴────────────┐                    │
│              ▼                         ▼                    │
│  ┌─────────────────────┐   ┌─────────────────────┐         │
│  │    系统原生引擎      │   │    Qwen-ASR 引擎    │         │
│  │  (NativeSpeech)     │   │   (QwenASRService)  │         │
│  │                     │   │                     │         │
│  │  macOS: Speech      │   │  WebSocket 实时流   │         │
│  │  Framework          │   │  阿里云 DashScope   │         │
│  │                     │   │                     │         │
│  │  Windows: SAPI /    │   │  支持 VAD 自动断句  │         │
│  │  WinRT Speech       │   │                     │         │
│  └─────────────────────┘   └─────────────────────┘         │
│         │                           │                       │
│         └───────────┬───────────────┘                       │
│                     ▼                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              实时结果回调                            │   │
│  │  onInterimResult(text) → 更新 UI 显示               │   │
│  │  onFinalResult(text) → 插入到终端/编辑器            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2. 数据流

```
用户按住 Option 键
    │
    ▼
┌─────────────┐
│  麦克风采集  │  (navigator.mediaDevices.getUserMedia)
└─────────────┘
    │
    ├─────────────────────────────────────┐
    ▼                                     ▼
┌─────────────┐                  ┌─────────────┐
│  系统原生    │      或         │  Qwen-ASR   │
│  Speech API │                  │  WebSocket  │
└─────────────┘                  └─────────────┘
    │                                     │
    └─────────────┬───────────────────────┘
                  ▼
         ┌─────────────┐
         │  实时结果    │  (onInterimResult)
         │  更新 UI    │
         └─────────────┘
                  │
    用户松开 Option 键
                  │
                  ▼
         ┌─────────────┐
         │  最终结果    │  (onFinalResult)
         └─────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Terminal │ │ Editor  │ │ Search  │
│  Input  │ │  Input  │ │  Input  │
└─────────┘ └─────────┘ └─────────┘
```

---

## 引擎实现

### 1. 系统原生引擎

#### macOS: Speech Framework

```typescript
// src/main/services/NativeSpeechMac.ts
// 通过 Native Module 调用 macOS Speech Framework

import { NativeModules } from 'electron'

export class NativeSpeechMac implements VoiceRecognitionService {
  private recognizer: any  // Native binding

  async start(options: RecognitionOptions): Promise<void> {
    // 调用 Objective-C 绑定
    await NativeModules.SpeechRecognizer.start({
      language: options.language,  // 'zh-CN'
      onDeviceRecognition: true,   // 强制离线识别
      reportPartialResults: true   // 启用实时结果
    })
  }

  stop(): void {
    NativeModules.SpeechRecognizer.stop()
  }

  onInterimResult(callback: (text: string) => void): void {
    NativeModules.SpeechRecognizer.onPartialResult(callback)
  }

  onFinalResult(callback: (text: string) => void): void {
    NativeModules.SpeechRecognizer.onFinalResult(callback)
  }
}
```

**macOS Native Module (Objective-C):**
```objective-c
// native/macos/SpeechRecognizer.mm
#import <Speech/Speech.h>

@implementation SpeechRecognizer

- (void)startWithLanguage:(NSString *)language
           onPartialResult:(void (^)(NSString *))partialCallback
            onFinalResult:(void (^)(NSString *))finalCallback {

    SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc]
        initWithLocale:[NSLocale localeWithLocaleIdentifier:language]];

    // 检查并启用离线识别
    if (recognizer.supportsOnDeviceRecognition) {
        self.request.requiresOnDeviceRecognition = YES;
    }

    self.request.shouldReportPartialResults = YES;  // 实时结果

    [recognizer recognitionTaskWithRequest:self.request
        resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
            if (result) {
                NSString *text = result.bestTranscription.formattedString;
                if (result.isFinal) {
                    finalCallback(text);
                } else {
                    partialCallback(text);  // 实时中间结果
                }
            }
        }];
}

@end
```

#### Windows: WinRT Speech API

```typescript
// src/main/services/NativeSpeechWindows.ts

export class NativeSpeechWindows implements VoiceRecognitionService {
  private recognizer: any  // WinRT binding

  async start(options: RecognitionOptions): Promise<void> {
    // 调用 Windows Runtime Speech API
    await NativeModules.WindowsSpeech.start({
      language: options.language,
      continuousRecognition: true,
      onlineMode: false  // 离线模式
    })
  }

  // ... 类似实现
}
```

### 2. Qwen-ASR 引擎

```typescript
// src/renderer/services/QwenASRService.ts

interface QwenASROptions {
  apiKey: string
  language?: string
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  onError: (error: string) => void
}

export class QwenASRService implements VoiceRecognitionService {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private isRunning = false
  private accumulatedText = ''

  private readonly baseUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'
  private readonly model = 'qwen2-audio-asr-realtime'

  constructor(private options: QwenASROptions) {}

  async start(): Promise<void> {
    this.isRunning = true
    this.accumulatedText = ''

    // 1. 建立 WebSocket 连接
    const url = `${this.baseUrl}?model=${this.model}`
    this.ws = new WebSocket(url)

    // 设置鉴权头（通过 URL 参数或在 open 后发送）
    this.ws.onopen = () => {
      this.sendAuth()
      this.sendSessionUpdate()
      this.startAudioCapture()
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data))
    }

    this.ws.onerror = (err) => {
      this.options.onError(`WebSocket 错误: ${err}`)
    }

    this.ws.onclose = () => {
      this.cleanup()
    }
  }

  stop(): void {
    this.isRunning = false

    // 发送结束信号
    if (this.ws?.readyState === WebSocket.OPEN) {
      const commitEvent = {
        event_id: `event_${Date.now()}`,
        type: 'input_audio_buffer.commit'
      }
      this.ws.send(JSON.stringify(commitEvent))
    }
  }

  private sendAuth(): void {
    // 发送鉴权信息
    const authEvent = {
      event_id: 'event_auth',
      type: 'auth',
      auth: {
        api_key: this.options.apiKey
      }
    }
    this.ws?.send(JSON.stringify(authEvent))
  }

  private sendSessionUpdate(): void {
    const sessionConfig = {
      event_id: 'event_session',
      type: 'session.update',
      session: {
        modalities: ['text'],
        input_audio_format: 'pcm',
        sample_rate: 16000,
        input_audio_transcription: {
          language: this.options.language || 'zh'
        },
        // 使用 VAD 模式自动断句
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 500
        }
      }
    }
    this.ws?.send(JSON.stringify(sessionConfig))
  }

  private async startAudioCapture(): Promise<void> {
    // 获取麦克风
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)

    // 使用 ScriptProcessor 获取 PCM 数据
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processor.onaudioprocess = (event) => {
      if (!this.isRunning || this.ws?.readyState !== WebSocket.OPEN) return

      const inputData = event.inputBuffer.getChannelData(0)
      const pcm16 = this.floatTo16BitPCM(inputData)
      const base64Audio = this.arrayBufferToBase64(pcm16.buffer)

      // 发送音频数据
      const appendEvent = {
        event_id: `event_${Date.now()}`,
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }
      this.ws?.send(JSON.stringify(appendEvent))
    }

    source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      // 实时中间结果（增量）
      case 'conversation.item.input_audio_transcription.delta':
        if (data.delta) {
          this.accumulatedText += data.delta
          this.options.onInterimResult(this.accumulatedText)
        }
        break

      // 最终结果
      case 'conversation.item.input_audio_transcription.completed':
        if (data.transcript) {
          this.options.onFinalResult(data.transcript)
        }
        break

      case 'error':
        this.options.onError(data.error?.message || '识别错误')
        break
    }
  }

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16Array
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private cleanup(): void {
    this.processor?.disconnect()
    this.mediaStream?.getTracks().forEach(track => track.stop())
    this.audioContext?.close()
    this.ws = null
    this.isRunning = false
  }
}
```

### 3. 统一管理器

```typescript
// src/renderer/services/VoiceInputManager.ts

type VoiceProvider = 'system' | 'qwen-asr'

interface VoiceInputManagerOptions {
  provider: VoiceProvider
  language: string
  qwenApiKey?: string
  onInterimResult: (text: string) => void
  onFinalResult: (text: string) => void
  onError: (error: string) => void
  onStateChange: (state: VoiceInputState) => void
}

export class VoiceInputManager {
  private service: VoiceRecognitionService | null = null
  private options: VoiceInputManagerOptions

  constructor(options: VoiceInputManagerOptions) {
    this.options = options
    this.initService()
  }

  private initService(): void {
    const { provider, language, qwenApiKey } = this.options

    if (provider === 'system') {
      // 根据平台选择系统原生引擎
      if (process.platform === 'darwin') {
        this.service = new NativeSpeechMac()
      } else if (process.platform === 'win32') {
        this.service = new NativeSpeechWindows()
      }
    } else if (provider === 'qwen-asr') {
      if (!qwenApiKey) {
        this.options.onError('Qwen-ASR 需要配置 API Key')
        return
      }
      this.service = new QwenASRService({
        apiKey: qwenApiKey,
        language,
        onInterimResult: this.options.onInterimResult,
        onFinalResult: this.options.onFinalResult,
        onError: this.options.onError
      })
    }
  }

  async start(): Promise<void> {
    if (!this.service) {
      this.options.onError('语音识别服务未初始化')
      return
    }

    this.options.onStateChange('recording')
    await this.service.start({
      language: this.options.language
    })
  }

  stop(): void {
    this.options.onStateChange('processing')
    this.service?.stop()
  }

  // 切换引擎
  switchProvider(provider: VoiceProvider): void {
    this.options.provider = provider
    this.initService()
  }
}
```

---

## 文件结构

```
src/
├── main/
│   ├── ipc/
│   │   └── voiceInput.ts              # IPC 处理
│   └── services/
│       ├── NativeSpeechMac.ts         # macOS 原生语音
│       └── NativeSpeechWindows.ts     # Windows 原生语音
│
├── renderer/
│   ├── services/
│   │   ├── VoiceInputManager.ts       # 语音输入统一管理器
│   │   └── QwenASRService.ts          # Qwen-ASR 实现
│   │
│   ├── components/
│   │   ├── VoiceInput/
│   │   │   ├── VoiceInputButton.tsx       # 麦克风按钮
│   │   │   ├── VoiceInputIndicator.tsx    # 录音状态指示器
│   │   │   ├── VoiceInputOverlay.tsx      # 浮动录音面板
│   │   │   └── VoiceWaveform.tsx          # 音量波形显示
│   │   └── Settings/
│   │       └── VoiceInputSettings.tsx     # 语音设置面板
│   │
│   ├── hooks/
│   │   ├── usePushToTalk.ts           # Push-to-Talk Hook
│   │   └── useVoiceInput.ts           # 语音输入 Hook
│   │
│   └── context/
│       └── VoiceInputContext.tsx      # 语音输入状态管理
│
├── native/
│   ├── macos/
│   │   └── SpeechRecognizer.mm        # macOS Native Module
│   └── windows/
│       └── SpeechRecognizer.cpp       # Windows Native Module
│
└── types/
    └── voiceInput.ts                  # TypeScript 类型定义
```

---

## 设置项

### TypeScript 类型定义

```typescript
// src/types/voiceInput.ts

type VoiceProvider = 'system' | 'qwen-asr'

interface VoiceInputSettings {
  // 基础设置
  enabled: boolean                    // 是否启用语音输入
  provider: VoiceProvider             // 识别引擎

  // Push-to-Talk 设置
  pushToTalk: {
    enabled: boolean                  // 启用按住说话
    triggerKey: 'Alt' | 'Meta' | 'Control' | 'Fn' | string
    minHoldDuration: number           // 最小按住时间（ms），默认 200
  }

  // 切换模式设置（备选）
  toggleMode: {
    enabled: boolean                  // 启用切换模式
    shortcut: KeyboardShortcut        // Cmd+Shift+V
  }

  // 识别设置
  language: string                    // 'zh-CN', 'en-US', 'auto'
  interimResults: boolean             // 显示实时结果

  // 行为设置
  autoExecuteInTerminal: boolean      // 终端中自动执行（按回车）
  insertMode: 'cursor' | 'newline'    // 插入位置
  enableVoiceCommands: boolean        // 启用语音指令

  // Qwen-ASR 设置
  qwenApiKey?: string                 // API Key
  qwenRegion?: 'cn' | 'intl'          // 区域（中国/国际）

  // 高级设置
  customVocabulary?: Record<string, string[]>  // 自定义术语
  silenceTimeout: number              // 静音超时（毫秒）
}
```

### 设置 UI 布局

```
┌─────────────────────────────────────────────────────┐
│ 语音输入设置                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 启用语音输入              [开关]                    │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ 识别引擎                                            │
│                                                     │
│ ● 系统原生 (推荐)                                   │
│   └ 完全离线，免费，无需配置                        │
│   └ macOS: Speech Framework                         │
│   └ Windows: Windows Speech Recognition             │
│                                                     │
│ ○ 阿里云 Qwen-ASR                                   │
│   └ 云端识别，高精度，适合技术术语                  │
│   API Key    [________________________] [获取 ↗]    │
│   区域       [中国 (cn)            ▼]               │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ 激活方式                                            │
│                                                     │
│ ☑ 按住说话 (Push-to-Talk)                          │
│   触发键                   [Option/Alt     ▼]       │
│   最小按住时间             [200ms          ▼]       │
│                                                     │
│ □ 切换模式                                          │
│   快捷键                   [Cmd+Shift+V] [修改]     │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ 识别语言                   [中文（简体）    ▼]      │
│                                                     │
│ □ 在终端中自动执行命令                              │
│ ☑ 显示实时识别结果                                  │
│ ☑ 启用语音指令（如"执行"、"换行"）                 │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ 提示：按住 Option 键说话，松开后自动输入文字        │
│       当前引擎：系统原生（离线）                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 实现阶段

### Phase 1: 基础功能（MVP）
- [ ] Push-to-Talk 按键监听
- [ ] 系统原生引擎（macOS）
- [ ] 系统原生引擎（Windows）
- [ ] 基础 UI 指示器
- [ ] 终端文本输入
- [ ] 设置面板

### Phase 2: Qwen-ASR 集成
- [ ] Qwen-ASR WebSocket 客户端
- [ ] API Key 配置和验证
- [ ] 引擎切换功能
- [ ] 实时流式显示

### Phase 3: 增强体验
- [ ] 编辑器集成
- [ ] 语音指令支持
- [ ] 多语言切换
- [ ] 音量波形显示

### Phase 4: 完善优化
- [ ] 自定义术语表
- [ ] 错误处理优化
- [ ] 性能优化
- [ ] 完整测试

---

## 技术细节

### 1. Push-to-Talk 按键监听实现

```typescript
// src/renderer/hooks/usePushToTalk.ts
import { useEffect, useRef, useCallback } from 'react'

interface PushToTalkOptions {
  triggerKey: string           // 'Alt', 'Meta', 'Fn' 等
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
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // 检查是否是触发键
    const isTriggerKey =
      (triggerKey === 'Alt' && event.altKey && event.key === 'Alt') ||
      (triggerKey === 'Meta' && event.metaKey && event.key === 'Meta') ||
      (triggerKey === 'Control' && event.ctrlKey && event.key === 'Control')

    if (!isTriggerKey) return

    // 防止重复触发
    if (isHolding.current) return

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

    // 处理窗口失焦时的情况
    const handleBlur = () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
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
}
```

### 2. 语音输入 Hook

```typescript
// src/renderer/hooks/useVoiceInput.ts
import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceInputManager } from '../services/VoiceInputManager'
import { usePushToTalk } from './usePushToTalk'

export function useVoiceInput(settings: VoiceInputSettings) {
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const managerRef = useRef<VoiceInputManager | null>(null)

  // 初始化管理器
  useEffect(() => {
    managerRef.current = new VoiceInputManager({
      provider: settings.provider,
      language: settings.language,
      qwenApiKey: settings.qwenApiKey,
      onInterimResult: (text) => {
        setInterimText(text)
      },
      onFinalResult: (text) => {
        // 插入到当前焦点位置
        insertTextToActiveInput(text)
        setInterimText('')
        setState('idle')
      },
      onError: (error) => {
        console.error('语音识别错误:', error)
        setState('idle')
      },
      onStateChange: setState
    })

    return () => {
      managerRef.current = null
    }
  }, [settings.provider, settings.language, settings.qwenApiKey])

  const startRecording = useCallback(async () => {
    setIsRecording(true)
    setInterimText('')
    await managerRef.current?.start()
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    managerRef.current?.stop()
  }, [])

  // Push-to-Talk 集成
  usePushToTalk({
    triggerKey: settings.pushToTalk.triggerKey,
    minHoldDuration: settings.pushToTalk.minHoldDuration,
    onStart: startRecording,
    onEnd: stopRecording,
    enabled: settings.enabled && settings.pushToTalk.enabled
  })

  return {
    isRecording,
    interimText,
    state,
    startRecording,
    stopRecording
  }
}

// 辅助函数：插入文本到当前焦点
function insertTextToActiveInput(text: string): void {
  const activeElement = document.activeElement

  // 终端
  if (activeElement?.closest('.xterm')) {
    window.api.terminal.write(getActiveTerminalId(), text)
    return
  }

  // 编辑器
  if (activeElement?.closest('.monaco-editor')) {
    // 通过 Monaco Editor API 插入
    const editor = getActiveMonacoEditor()
    if (editor) {
      const position = editor.getPosition()
      editor.executeEdits('voice-input', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        },
        text: text
      }])
    }
    return
  }

  // 其他输入框
  if (activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement) {
    const start = activeElement.selectionStart || 0
    const end = activeElement.selectionEnd || 0
    const value = activeElement.value
    activeElement.value = value.slice(0, start) + text + value.slice(end)
    activeElement.selectionStart = activeElement.selectionEnd = start + text.length
  }
}
```

### 3. 麦克风权限处理

```typescript
// src/renderer/services/VoiceInputManager.ts
async requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      // 用户拒绝了权限
      this.showPermissionDeniedDialog()
    }
    return false
  }
}
```

### 4. 焦点管理

```typescript
// 确定当前活动输入区域
const getActiveInputTarget = (): 'terminal' | 'editor' | 'search' | null => {
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

  // 回退：检查哪个区域可见
  if (state.activeTerminalId) return 'terminal'
  if (state.activeEditorTabId) return 'editor'

  return null
}
```

---

## 安全与隐私

### 数据流向说明

| 引擎 | 数据处理位置 | 说明 |
|------|-------------|------|
| 系统原生 | 本地设备 | 音频完全在本地处理，不上传 |
| Qwen-ASR | 阿里云服务器 | 音频流发送到云端处理 |

### 安全措施

1. **麦克风权限**
   - 首次使用时请求权限
   - 权限被拒绝时提供清晰的说明
   - 在设置中显示权限状态

2. **API Key 安全**
   - Qwen API Key 存储在 electron-store 中
   - 不在日志中输出 API Key
   - 提供 API Key 验证功能

3. **用户知情权**
   - 在设置中明确显示当前引擎的数据流向
   - 切换到云端引擎时提示用户
   - 默认使用本地引擎保护隐私

---

## 参考资源

- [macOS Speech Framework](https://developer.apple.com/documentation/speech)
- [Windows Speech Recognition](https://docs.microsoft.com/en-us/windows/apps/design/input/speech-recognition)
- [阿里云 Qwen-ASR 文档](https://help.aliyun.com/zh/model-studio/qwen-asr-realtime)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
