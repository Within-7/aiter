# Airter 功能路线图与总结

## 当前状态 ✅

### 已完成功能
- ✅ 项目管理（添加/删除/持久化）
- ✅ 多终端标签支持
- ✅ 完整的 Shell 集成（xterm.js + node-pty）
- ✅ 跨平台支持（macOS Intel/M系列、Windows）
- ✅ 数据持久化（electron-store）
- ✅ 窗口状态保存

### 技术栈
- Electron 28 + React 18 + TypeScript 5.3
- xterm.js 5.5 (终端模拟)
- node-pty 1.0 (PTY 进程管理)
- Vite 5 (构建工具)

## 新增功能需求

### 1️⃣ 文件树浏览器
**功能描述：** 点击项目展开，显示文件夹内的文件和子目录

**核心要点：**
- 递归目录读取（可控深度，避免性能问题）
- 展开/折叠交互
- 文件类型图标
- 排序：文件夹优先，按名称排序
- 过滤：跳过 node_modules、.git、隐藏文件

**技术实现：**
- 主进程：Node.js fs 模块读取目录
- IPC：`fs:readDir` 返回 FileNode[]
- 渲染进程：递归 React 组件渲染树

### 2️⃣ 文件预览和编辑
**功能描述：** 点击文件在右侧打开编辑器/预览

**支持的文件类型：**
- **HTML**: Monaco Editor 编辑 + iframe 预览
- **Markdown**: 分屏编辑器（左编辑右预览）
- **JSON/JS/TS/CSS**: Monaco Editor 代码编辑
- **其他**: 纯文本编辑

**核心技术：**
- Monaco Editor: VS Code 同款编辑器
- Marked: Markdown 解析
- DOMPurify: XSS 防护（必须）
- Highlight.js: 代码高亮

**安全措施：**
- 所有 HTML 内容通过 DOMPurify 清理
- iframe 使用 sandbox 属性
- 文件大小限制（10MB）
- 路径验证（防止目录遍历）

### 3️⃣ Git 仓库管理
**功能描述：** 自动初始化 Git 仓库，显示文件状态

**核心功能：**
- 添加项目时检测是否有 .git 目录
- 如果没有则提示初始化
- 文件树显示 Git 状态（M/A/D/?）
- 显示当前分支
- 查看提交历史

**技术实现：**
- simple-git: Git 操作库
- 主进程：Git 命令执行
- 渲染进程：状态展示

## 实施优先级

### 🔴 Phase 1: 文件树（1-2天）
最高优先级，是其他功能的基础

**任务：**
1. 添加文件系统 IPC API
2. 创建 FileTree 组件
3. 实现展开/折叠逻辑
4. 添加文件图标

### 🟡 Phase 2: 文件编辑器（2-3天）
高优先级，核心功能

**任务：**
1. 集成 Monaco Editor
2. 实现 Markdown 编辑器
3. 实现 HTML 预览
4. 实现文件保存（Ctrl/Cmd+S）
5. 标签管理

### 🟢 Phase 3: Git 集成（1-2天）
中等优先级，增强功能

**任务：**
1. Git 初始化检测
2. 文件状态检测
3. 基础 Git 操作
4. UI 集成

## 新架构设计

### 布局变更

```
原布局：
┌─────────────┬──────────────────┐
│  Projects   │   Terminals      │
│  List       │   (Tabs)         │
└─────────────┴──────────────────┘

新布局：
┌──────┬──────────┬──────────────┐
│ File │ Editor   │  Terminal    │
│ Tree │ (Tabs)   │  (Tabs)      │
│      │          │              │
│  📁  │  Monaco  │  xterm.js    │
│  📄  │  or      │              │
│  📝  │  Preview │              │
└──────┴──────────┴──────────────┘
```

### 数据流

```
用户点击文件
  ↓
FileTree 组件触发 onFileClick
  ↓
App 调用 window.api.fs.readFile(path)
  ↓
主进程读取文件内容
  ↓
返回 { content, type }
  ↓
渲染进程创建 EditorTab
  ↓
根据 type 选择编辑器组件
  ↓
显示内容
```

## 依赖更新

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "monaco-editor": "^0.45.0",
    "marked": "^11.0.0",
    "dompurify": "^3.0.6",
    "highlight.js": "^11.9.0",
    "chokidar": "^3.5.3",
    "simple-git": "^3.21.0"
  }
}
```

## 开发指导原则

### 安全第一 🔒
1. 所有 HTML 渲染必须使用 DOMPurify
2. 所有文件路径必须验证
3. 文件大小必须限制
4. 使用 iframe sandbox 隔离

### 性能优化 ⚡
1. 文件树懒加载（按需读取子目录）
2. 虚拟滚动（大型文件树）
3. 编辑器内容缓存
4. 防抖/节流

### 用户体验 ✨
1. 加载状态指示
2. 错误提示
3. 快捷键支持
4. 自动保存

## 快速开始

### 安装新依赖
```bash
npm install
npx electron-rebuild -f
```

### 开发模式
```bash
npm run dev
```

### 构建
```bash
npm run build:mac  # macOS
npm run build:win  # Windows
```

## 文档结构

- `PRD.md` - 产品需求文档
- `DEVELOPMENT_PLAN.md` - 研发计划
- `OPTIMIZATION_PLAN.md` - 优化方案
- `IMPLEMENTATION_GUIDE.md` - 实施指南（包含完整代码）
- `FEATURE_ROADMAP.md` - 本文档（路线图）
- `PROJECT_SUMMARY.md` - 项目总结
- `USAGE_GUIDE.md` - 使用指南

## 下一步行动

1. **阅读文档**：理解整体架构和安全要求
2. **安装依赖**：运行 `npm install`
3. **实施 Phase 1**：按照 IMPLEMENTATION_GUIDE.md 开始文件树功能
4. **测试验证**：每个阶段完成后充分测试
5. **持续优化**：根据使用反馈优化体验

## 预期成果

完成所有功能后，Airter 将成为一个：
- 📁 强大的文件浏览器
- ✏️ 完整的代码编辑器
- 🖥️ 多功能终端
- 🔀 Git 版本管理工具

**All in one Minto 协作终端！**

---

**开发者备注：**
所有详细实现代码请参考 `IMPLEMENTATION_GUIDE.md`
所有安全实践请参考项目中的现有代码规范
