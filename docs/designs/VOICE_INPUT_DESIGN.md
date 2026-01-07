# AiTer 语音输入功能设计方案

## 概述

为 AiTer 添加现代化的语音输入功能，让用户可以通过语音与 AI CLI 工具和文件编辑器进行交互。

## 设计目标

1. **无缝集成** - 语音输入作为现有输入方式的补充，不改变用户习惯
2. **多场景支持** - 同时支持终端命令输入、代码编辑、文档撰写
3. **智能适配** - 根据上下文智能调整语音识别行为
4. **低延迟** - 实时反馈，流式显示识别结果
5. **隐私优先** - 支持本地识别，用户可控数据流向

---

## 交互设计

### 1. 激活方式

#### 1.1 按住说话 (Push-to-Talk) - 推荐方式

```
默认按键: Option (macOS) / Alt (Windows)
```

**交互流程：**
```
按下 Option ──→ 开始录音 ──→ 说话 ──→ 松开 Option ──→ 结束录音 ──→ 识别并输入
     │                                      │
     └── 显示录音指示器                      └── 隐藏指示器，插入文本
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

#### 1.3 语音唤醒（可选高级功能）

```
唤醒词: "Hey AiTer" 或自定义
```

- 需要后台监听，功耗较高
- 作为可选的高级功能
- 默认关闭

### 2. 视觉反馈

#### 2.1 录音状态指示器

```
┌─────────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────┐   │
│ │  🔴 正在录音...  ████████░░░░  [停止]         │   │
│ │  "我想要创建一个新的 React 组件..."           │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│  $ npm run dev                                      │
│  > vite                                             │
└─────────────────────────────────────────────────────┘
```

**状态指示器特性：**
- 浮动在当前活动区域上方
- 显示录音波形/音量条
- 实时显示识别中的文字（流式）
- 提供手动停止按钮

#### 2.2 状态图标变化

| 状态 | 图标 | 颜色 | 描述 |
|------|------|------|------|
| 待机 | 🎤 | 灰色 | 可以开始录音 |
| 录音中 | 🔴 | 红色+脉动动画 | 正在录音 |
| 处理中 | ⏳ | 黄色 | 正在识别 |
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

### 4. 智能上下文适配

#### 4.1 语言检测
```typescript
interface VoiceContext {
  activeArea: 'terminal' | 'editor' | 'search'
  fileType?: string      // 'typescript', 'python', 'markdown'
  projectType?: string   // 从 package.json 或其他配置推断
  recentCommands?: string[] // 最近使用的命令
}
```

#### 4.2 术语表支持
```typescript
// 用户可自定义术语表
const customVocabulary = {
  // 常见编程术语
  "function": ["函数", "方法"],
  "const": ["常量", "康斯特"],
  "npm": ["恩皮恩", "NPM"],

  // 项目特定术语
  "AiTer": ["爱特", "艾特"],
  "xterm": ["艾克斯特姆", "X term"]
}
```

---

## 技术架构

### 1. 语音识别后端选择

#### 方案 A: Web Speech API（推荐默认方案）

**优点：**
- 浏览器原生支持，无需额外依赖
- Electron 基于 Chromium，完全支持
- 免费使用，无 API 费用
- 延迟低（流式识别）

**缺点：**
- 需要网络连接（Chrome 使用 Google 服务器）
- 识别准确度依赖 Google
- 中文支持良好但技术术语可能不准

**实现：**
```typescript
// src/renderer/services/WebSpeechRecognition.ts
export class WebSpeechRecognition implements VoiceRecognitionService {
  private recognition: SpeechRecognition

  constructor(options: RecognitionOptions) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = options.continuous
    this.recognition.interimResults = true
    this.recognition.lang = options.language // 'zh-CN', 'en-US'
  }

  start(): void {
    this.recognition.start()
  }

  stop(): void {
    this.recognition.stop()
  }

  onResult(callback: (result: RecognitionResult) => void): void {
    this.recognition.onresult = (event) => {
      const result = event.results[event.resultIndex]
      callback({
        text: result[0].transcript,
        isFinal: result.isFinal,
        confidence: result[0].confidence
      })
    }
  }
}
```

#### 方案 B: OpenAI Whisper API（高级方案）

**优点：**
- 极高的识别准确度
- 优秀的多语言支持
- 擅长技术术语

**缺点：**
- 需要付费 API
- 需要录制完整音频后上传（非流式）
- 有一定延迟

**实现：**
```typescript
// src/main/services/WhisperService.ts
export class WhisperService {
  private apiKey: string

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer]), 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'zh')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData
    })

    const data = await response.json()
    return data.text
  }
}
```

#### 方案 C: 本地 Whisper（隐私优先方案）

**优点：**
- 完全离线，保护隐私
- 无 API 费用

**缺点：**
- 需要下载模型文件（~1GB）
- 需要较好的硬件
- 实现复杂度高

**实现思路：**
- 使用 whisper.cpp 或 whisper-node
- 打包时不含模型，首次使用时下载
- 提供 tiny/base/small 等模型选择

### 2. 推荐的混合架构

```
┌─────────────────────────────────────────────────────────────┐
│                    VoiceInputManager                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  统一接口层                          │    │
│  │  start() | stop() | onResult() | onError()          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│           ┌───────────────┼───────────────┐                  │
│           ▼               ▼               ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Web Speech  │  │  Whisper    │  │   Local     │          │
│  │    API      │  │    API      │  │   Whisper   │          │
│  │  (默认)     │  │  (高精度)   │  │  (离线)     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 3. 数据流

```
用户说话
    │
    ▼
┌─────────────┐
│  麦克风采集  │  (Renderer Process - MediaDevices API)
└─────────────┘
    │
    ▼
┌─────────────┐
│  语音识别   │  (Web Speech API / Whisper)
└─────────────┘
    │
    ▼
┌─────────────┐
│  文本后处理  │  (标点、格式化、指令解析)
└─────────────┘
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Terminal│      │ Editor  │      │ Search  │
│  Input  │      │  Input  │      │  Input  │
└─────────┘      └─────────┘      └─────────┘
```

---

## 文件结构

```
src/
├── main/
│   ├── ipc/
│   │   └── voiceInput.ts          # IPC 处理（音频权限、Whisper API）
│   └── services/
│       └── WhisperService.ts      # Whisper API 集成
│
├── renderer/
│   ├── services/
│   │   ├── VoiceInputManager.ts   # 语音输入统一管理器
│   │   ├── WebSpeechRecognition.ts # Web Speech API 实现
│   │   └── WhisperRecognition.ts  # Whisper 实现
│   │
│   ├── components/
│   │   ├── VoiceInput/
│   │   │   ├── VoiceInputButton.tsx    # 麦克风按钮
│   │   │   ├── VoiceInputIndicator.tsx # 录音状态指示器
│   │   │   ├── VoiceInputOverlay.tsx   # 浮动录音面板
│   │   │   └── VoiceWaveform.tsx       # 音量波形显示
│   │   └── Settings/
│   │       └── VoiceInputSettings.tsx  # 语音设置面板
│   │
│   ├── hooks/
│   │   └── useVoiceInput.ts       # 语音输入 React Hook
│   │
│   └── context/
│       └── VoiceInputContext.tsx  # 语音输入状态管理
│
└── types/
    └── voiceInput.ts              # TypeScript 类型定义
```

---

## 设置项

```typescript
interface VoiceInputSettings {
  // 基础设置
  enabled: boolean                    // 是否启用语音输入
  provider: 'web-speech' | 'whisper-api' | 'whisper-local'

  // Push-to-Talk 设置
  pushToTalk: {
    enabled: boolean                  // 启用按住说话
    triggerKey: 'Alt' | 'Meta' | 'Control' | 'Fn' | string  // 触发键
    minHoldDuration: number           // 最小按住时间（ms），默认 200
  }

  // 切换模式设置（备选）
  toggleMode: {
    enabled: boolean                  // 启用切换模式
    shortcut: KeyboardShortcut        // Cmd+Shift+V
  }

  // 识别设置
  language: string                    // 'zh-CN', 'en-US', 'auto'
  continuous: boolean                 // 连续识别模式
  interimResults: boolean             // 显示中间结果（流式）

  // 行为设置
  autoExecuteInTerminal: boolean      // 终端中自动执行（按回车）
  insertMode: 'cursor' | 'newline'    // 插入位置
  enableVoiceCommands: boolean        // 启用语音指令（"执行"、"换行"等）

  // API 设置（仅 Whisper）
  whisperApiKey?: string
  whisperModel?: 'whisper-1'

  // 高级设置
  customVocabulary?: Record<string, string[]>  // 自定义术语
  noiseReduction: boolean             // 降噪
  silenceTimeout: number              // 静音超时（毫秒）
}
```

**设置 UI 布局：**

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
│ ○ Web Speech API (免费，需要网络)                   │
│ ○ OpenAI Whisper API (高精度，需要 API Key)         │
│ ○ 本地 Whisper (离线，需要下载模型)                 │
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
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 实现阶段

### Phase 1: 基础功能（MVP）
- [x] Web Speech API 集成
- [x] 快捷键激活
- [x] 终端文本输入
- [x] 基础 UI 指示器
- [x] 设置面板

### Phase 2: 增强体验
- [ ] 编辑器集成
- [ ] 流式显示识别结果
- [ ] 语音指令支持
- [ ] 多语言切换

### Phase 3: 高级功能
- [ ] Whisper API 集成
- [ ] 自定义术语表
- [ ] 智能上下文适配
- [ ] 本地 Whisper 支持

### Phase 4: 完善优化
- [ ] 语音唤醒
- [ ] 音频降噪
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
    setTimeout(() => {
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

    const holdDuration = holdStartTime.current
      ? Date.now() - holdStartTime.current
      : 0

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
    }
  }, [handleKeyDown, handleKeyUp, onEnd, enabled])
}
```

**使用示例：**
```typescript
// 在组件中使用
usePushToTalk({
  triggerKey: 'Alt',
  minHoldDuration: 200,
  onStart: () => {
    voiceInputManager.startRecording()
    setShowIndicator(true)
  },
  onEnd: () => {
    voiceInputManager.stopRecording()
    setShowIndicator(false)
  },
  enabled: settings.voiceInput?.enabled ?? false
})
```

### 2. 麦克风权限处理

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

### 3. 音频可视化

```typescript
// src/renderer/components/VoiceInput/VoiceWaveform.tsx
const VoiceWaveform: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      analyser.getByteFrequencyData(dataArray)
      // 绘制波形...
      requestAnimationFrame(draw)
    }

    draw()
  }, [stream])

  return <canvas ref={canvasRef} />
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

1. **麦克风权限**
   - 首次使用时请求权限
   - 权限被拒绝时提供清晰的说明
   - 在设置中提供权限状态指示

2. **数据传输**
   - Web Speech API: 音频发送到 Google 服务器
   - Whisper API: 音频发送到 OpenAI 服务器
   - 本地 Whisper: 完全离线处理

3. **API Key 安全**
   - Whisper API Key 存储在 electron-store 中（加密）
   - 不在日志中输出 API Key
   - 提供 API Key 验证功能

4. **用户知情权**
   - 明确说明各方案的数据流向
   - 在使用云服务时显示提示
   - 提供隐私政策链接

---

## 参考资源

- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenAI Whisper](https://openai.com/index/whisper/)
- [Best Speech-to-Text APIs 2025](https://deepgram.com/learn/best-speech-to-text-apis)
- [JavaScript Speech Recognition Guide](https://www.videosdk.live/developer-hub/stt/javascript-speech-recognition)
