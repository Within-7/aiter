# Airter 研发计划

## 技术架构详细设计

### 1. 主进程架构

**职责：**
- 窗口生命周期管理
- PTY 进程创建和管理
- IPC 通信处理
- 数据持久化

**关键模块：**

#### Window Manager
```typescript
// 管理应用主窗口
- createMainWindow(): 创建主窗口
- setupWindowListeners(): 设置窗口事件监听
- saveWindowState(): 保存窗口状态
- restoreWindowState(): 恢复窗口状态
```

#### PTY Manager
```typescript
// 管理所有终端进程
- createTerminal(cwd, shell): 创建新终端
- writeToTerminal(id, data): 向终端写入数据
- resizeTerminal(id, cols, rows): 调整终端大小
- killTerminal(id): 终止终端进程
- cleanupOrphanTerminals(): 清理孤儿进程
```

#### Store Manager
```typescript
// 数据持久化
- getProjects(): 获取项目列表
- addProject(path, name): 添加项目
- removeProject(id): 移除项目
- getSettings(): 获取设置
- updateSettings(settings): 更新设置
```

### 2. 渲染进程架构

**技术栈：**
- React 18 with Hooks
- TypeScript
- CSS Modules / Styled Components

**组件树：**

```
App
├── Sidebar
│   ├── ProjectList
│   │   └── ProjectItem (多个)
│   └── AddProjectButton
└── TerminalArea
    ├── TabBar
    │   ├── Tab (多个)
    │   └── NewTabButton
    └── TerminalContainer
        └── Terminal (xterm.js)
```

**状态管理：**
- React Context + useReducer
- 全局状态：projects, terminals, activeTerminal, settings

### 3. IPC 通信协议

**渲染进程 → 主进程：**
```typescript
// 项目管理
'project:add' → { path: string, name?: string }
'project:remove' → { id: string }
'project:open' → { path: string }

// 终端管理
'terminal:create' → { cwd: string, shell?: string }
'terminal:write' → { id: string, data: string }
'terminal:resize' → { id: string, cols: number, rows: number }
'terminal:kill' → { id: string }

// 文件系统
'dialog:openFolder' → void
```

**主进程 → 渲染进程：**
```typescript
// 终端输出
'terminal:data' → { id: string, data: string }
'terminal:exit' → { id: string, exitCode: number }

// 项目更新
'projects:updated' → { projects: Project[] }

// 系统事件
'app:error' → { message: string, stack?: string }
```

### 4. 数据模型

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastAccessed?: number;
}

interface Terminal {
  id: string;
  projectId: string;
  name: string;
  cwd: string;
  shell: string;
  createdAt: number;
}

interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  fontFamily: string;
  shell?: string;
  scrollbackLines: number;
}

interface AppState {
  projects: Project[];
  terminals: Terminal[];
  activeTerminalId?: string;
  settings: AppSettings;
}
```

## 开发任务分解

### Task 1: 项目初始化
- [x] 创建项目目录结构
- [ ] 初始化 package.json
- [ ] 配置 TypeScript
- [ ] 配置 Vite（主进程 + 渲染进程）
- [ ] 配置 electron-builder
- [ ] 安装核心依赖

### Task 2: 主进程开发
- [ ] 创建主窗口
- [ ] 实现 PTY 管理器
- [ ] 实现数据存储
- [ ] 实现 IPC 处理器
- [ ] 实现菜单栏

### Task 3: 渲染进程基础
- [ ] 创建 App 根组件
- [ ] 实现布局组件
- [ ] 创建上下文和状态管理
- [ ] 实现 IPC 客户端封装

### Task 4: 项目侧边栏
- [ ] 实现 Sidebar 组件
- [ ] 实现 ProjectList 组件
- [ ] 实现 ProjectItem 组件
- [ ] 实现添加项目对话框
- [ ] 实现右键菜单
- [ ] 实现拖拽添加

### Task 5: 终端功能
- [ ] 集成 xterm.js
- [ ] 实现 Terminal 组件
- [ ] 实现终端与 PTY 的双向通信
- [ ] 实现终端主题
- [ ] 实现终端配置（字体、大小等）

### Task 6: 标签管理
- [ ] 实现 TabBar 组件
- [ ] 实现 Tab 组件
- [ ] 实现标签切换
- [ ] 实现标签关闭
- [ ] 实现标签拖拽排序
- [ ] 实现快捷键

### Task 7: 项目管理功能
- [ ] 实现添加项目
- [ ] 实现删除项目
- [ ] 实现项目持久化
- [ ] 实现项目切换
- [ ] 实现项目排序

### Task 8: 用户体验优化
- [ ] 实现快捷键系统
- [ ] 实现错误提示
- [ ] 实现加载状态
- [ ] 实现空状态提示
- [ ] 实现设置面板

### Task 9: 跨平台打包
- [ ] 配置 macOS 打包（x64 + arm64）
- [ ] 配置 Windows 打包
- [ ] 测试 macOS 打包
- [ ] 测试 Windows 打包
- [ ] 生成安装程序

### Task 10: 测试和优化
- [ ] 性能测试
- [ ] 内存泄漏检测
- [ ] 多终端压力测试
- [ ] 跨平台兼容性测试
- [ ] Bug 修复

## 并发开发策略

### 第一轮并发（基础设施）
可以并行进行：
1. 项目配置和依赖安装
2. TypeScript 类型定义
3. UI 设计和样式系统

### 第二轮并发（核心功能）
可以并行进行：
1. 主进程 PTY 管理器开发
2. 渲染进程侧边栏组件开发
3. 渲染进程终端组件开发

### 第三轮并发（功能集成）
依赖关系处理后并行：
1. 项目管理功能完善
2. 标签管理功能完善
3. 快捷键和菜单系统

### 第四轮并发（打包测试）
可以并行进行：
1. macOS 打包和测试
2. Windows 打包和测试
3. 文档编写

## 技术选型依据

### Electron
- **优势:** 成熟的跨平台方案、丰富的生态、VS Code 同技术栈
- **劣势:** 包体积较大、内存占用高
- **替代方案:** Tauri（更轻量但生态不成熟）

### xterm.js
- **优势:** VS Code 同款、功能完整、性能优秀
- **替代方案:** terminal.js（功能较弱）

### node-pty
- **优势:** 完整的 PTY 支持、跨平台、活跃维护
- **替代方案:** 原生 PTY（需要针对不同平台实现）

### React
- **优势:** 组件化、生态丰富、开发效率高
- **替代方案:** Vue、Svelte（团队熟悉度考虑）

## 性能优化策略

1. **终端渲染优化**
   - 使用 xterm.js 的 canvas 渲染器
   - 限制 scrollback buffer 大小
   - 虚拟滚动优化

2. **内存管理**
   - 及时清理已关闭的终端
   - 限制最大并发终端数（可配置）
   - 实现终端休眠机制

3. **启动优化**
   - 延迟加载非关键模块
   - 预加载脚本优化
   - 窗口显示前最小化初始化

4. **IPC 优化**
   - 批量处理终端输出
   - 使用 MessagePort 优化大数据传输
   - 减少不必要的序列化

## 开发环境要求

- Node.js 18+
- npm 或 yarn
- macOS: Xcode Command Line Tools
- Windows: Visual Studio Build Tools
- Git

## 估时（按天计）

- 项目初始化和配置: 1天
- 主进程核心功能: 2天
- 渲染进程 UI 开发: 3天
- 功能集成和联调: 2天
- 跨平台打包配置: 1天
- 测试和优化: 2天
- **总计: 11天** （可通过并发缩短到 7-8天）

## 下一步行动

立即开始并发开发：
1. 创建项目结构
2. 配置构建工具
3. 安装依赖
4. 开始核心模块开发
