# Airter 新功能实施指南

## 概述

本指南详细说明如何在现有 Airter 基础上添加：
1. 文件树浏览器
2. 文件预览和编辑器
3. Git 仓库管理

## 准备工作

### 1. 更新依赖

已经在 `package.json` 中添加了新依赖，现在安装：

```bash
npm install
npx electron-rebuild -f
```

新增的依赖包括：
- `@monaco-editor/react` - Monaco Editor React 包装器
- `monaco-editor` - VS Code 编辑器核心
- `marked` - Markdown 解析器
- `dompurify` - XSS 防护
- `highlight.js` - 代码高亮
- `chokidar` - 文件监听
- `simple-git` - Git 操作库

### 2. 类型定义更新

类型定义已在 `src/types/index.ts` 中更新，包括：
- `FileNode` - 文件树节点
- `EditorTab` - 编辑器标签
- `GitRepository` - Git 仓库信息

## Phase 1: 文件系统功能

### 实施步骤

#### Step 1: 创建文件系统管理器

创建文件 `src/main/filesystem.ts`，实现：
- `readDirectory()` - 读取目录内容
- `readFile()` - 读取文件内容
- `writeFile()` - 写入文件
- `getFileType()` - 识别文件类型

**关键安全措施：**
- 路径验证（防止目录遍历攻击）
- 文件大小限制（10MB）
- 排除敏感目录（node_modules、.git）

#### Step 2: 添加 IPC 处理器

在 `src/main/ipc.ts` 中添加新的 IPC 处理器：

```typescript
// 需要添加的 IPC 事件：
'fs:readDir' - 读取目录
'fs:readFile' - 读取文件
'fs:writeFile' - 写入文件
```

#### Step 3: 更新 Preload 脚本

在 `src/preload/index.ts` 中暴露文件系统 API：

```typescript
// 添加到 window.api
fs: {
  readDir(path: string)
  readFile(path: string)
  writeFile(path: string, content: string)
}
```

#### Step 4: 创建文件树组件

创建以下组件文件：

1. `src/renderer/components/FileTree/FileTree.tsx`
   - 文件树容器组件
   - 管理展开/折叠状态
   - 处理文件点击事件

2. `src/renderer/components/FileTree/FileTreeNode.tsx`
   - 单个节点组件（递归）
   - 显示文件/文件夹图标
   - Git 状态图标

3. `src/renderer/components/FileTree/FileTree.css`
   - 样式定义
   - 缩进、图标、状态颜色

#### Step 5: 更新 Sidebar 组件

修改 `src/renderer/components/Sidebar.tsx`：
- 点击项目时不再直接打开终端
- 而是展开文件树
- 保留添加/删除项目功能

## Phase 2: 文件编辑器

### 实施步骤

#### Step 1: 集成 Monaco Editor

创建 `src/renderer/components/Editor/MonacoEditor.tsx`：

**功能要点：**
- 使用 `@monaco-editor/react` 包装器
- 支持语法高亮（JavaScript、TypeScript、CSS、HTML、JSON等）
- 添加保存快捷键（Ctrl/Cmd+S）
- 主题：VS Code Dark

**配置选项：**
- 关闭 minimap（节省空间）
- 启用自动布局
- 字体大小 14px
- 行号显示

#### Step 2: 创建 Markdown 编辑器

创建 `src/renderer/components/Editor/MarkdownEditor.tsx`：

**布局：** 左右分屏
- 左侧：textarea 编辑区
- 右侧：实时预览区

**实现要点：**
1. 使用 `marked` 解析 Markdown
2. **必须使用 DOMPurify 清理 HTML**（安全关键）
3. 支持 GFM（GitHub Flavored Markdown）
4. 代码高亮（highlight.js）

**安全配置示例：**
```typescript
import DOMPurify from 'dompurify'

// 清理配置
const cleanHTML = DOMPurify.sanitize(rawHTML, {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'a', 'code', 'pre', ...],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class']
})
```

#### Step 3: 创建 HTML 预览

创建 `src/renderer/components/Editor/HTMLPreview.tsx`：

**关键点：**
- 使用 `<iframe>` 隔离执行环境
- 必须设置 `sandbox` 属性
- 推荐：`sandbox="allow-same-origin allow-scripts"`

#### Step 4: 创建编辑器区域

创建 `src/renderer/components/Editor/EditorArea.tsx`：

**功能：**
- 管理多个编辑器标签
- 根据文件类型选择编辑器
- 显示未保存状态（标签上的圆点）
- 标签右键菜单

#### Step 5: 更新 App 状态

在 `src/renderer/context/AppContext.tsx` 中添加：

```typescript
// 新增状态
editorTabs: EditorTab[]
activeEditorTabId?: string

// 新增 Actions
ADD_EDITOR_TAB
REMOVE_EDITOR_TAB
SET_ACTIVE_EDITOR_TAB
UPDATE_EDITOR_CONTENT
MARK_TAB_DIRTY
```

## Phase 3: Git 集成

### 实施步骤

#### Step 1: 创建 Git 管理器

创建 `src/main/git.ts`：

**核心方法：**
- `isGitRepo()` - 检测是否为 Git 仓库
- `initRepo()` - 初始化仓库
- `getStatus()` - 获取文件状态
- `getCurrentBranch()` - 获取当前分支
- `commit()` - 提交更改
- `getLog()` - 获取提交历史

**使用 simple-git 库：**
```typescript
import simpleGit from 'simple-git'

const git = simpleGit(projectPath)
```

#### Step 2: 添加 Git IPC 处理器

在 `src/main/ipc.ts` 中添加：

```typescript
// Git 相关 IPC 事件
'git:check' - 检查是否为 Git 仓库
'git:init' - 初始化仓库
'git:status' - 获取状态
'git:branch' - 获取分支
'git:commit' - 提交
'git:log' - 获取历史
```

#### Step 3: 更新项目添加逻辑

修改 `src/main/store.ts` 的 `addProject()`：

**流程：**
1. 添加项目到列表
2. 检查是否为 Git 仓库
3. 如果不是，提示是否初始化
4. 更新项目的 `isGitRepo` 标志

#### Step 4: 在文件树中显示 Git 状态

更新 `FileTreeNode` 组件：

**状态标识：**
- M (Modified) - 已修改 - 黄色
- A (Added) - 新增 - 绿色
- D (Deleted) - 删除 - 红色
- ? (Untracked) - 未跟踪 - 灰色

#### Step 5: 创建 Git 面板（可选）

创建 `src/renderer/components/GitPanel/`：
- `GitStatus.tsx` - 状态显示
- `GitHistory.tsx` - 提交历史
- `GitDiff.tsx` - 差异查看

## 布局调整

### 新的三栏布局

修改 `src/renderer/App.tsx`：

```
┌────────┬──────────┬──────────┐
│ Files  │ Editor   │ Terminal │
│ Tree   │ Tabs     │ Tabs     │
│        │          │          │
│ 20%    │ 40%      │ 40%      │
└────────┴──────────┴──────────┘
```

**实现方式：**
- 使用 Flexbox 布局
- 可拖拽调整宽度（可选）
- 响应式设计

## 样式参考

### 文件树样式

```css
.file-tree {
  background: #252526;
  color: #cccccc;
  padding: 10px;
  overflow-y: auto;
}

.file-tree-item {
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-tree-item:hover {
  background: #2a2d2e;
}

.file-icon {
  font-size: 16px;
}

.git-status {
  margin-left: auto;
  font-size: 12px;
  font-weight: bold;
}

.git-status.modified { color: #f9e64f; }
.git-status.added { color: #73c991; }
.git-status.deleted { color: #f14c4c; }
.git-status.untracked { color: #888; }
```

### 编辑器样式

参考 VS Code Dark 主题：
- 背景：#1e1e1e
- 前景：#cccccc
- 标签栏：#2d2d30
- 活动标签：#1e1e1e

## 文件类型图标映射

```typescript
const iconMap: Record<string, string> = {
  'directory-open': '📂',
  'directory-closed': '📁',
  'javascript': '📄',
  'typescript': '📘',
  'react': '⚛️',
  'html': '🌐',
  'css': '🎨',
  'json': '📋',
  'markdown': '📝',
  'text': '📄',
  'image': '🖼️',
  'other': '📄'
}
```

## 快捷键实现

### 编辑器快捷键

在 Monaco Editor 中添加：
- `Ctrl/Cmd + S` - 保存文件
- `Ctrl/Cmd + F` - 查找
- `Ctrl/Cmd + H` - 替换
- `Ctrl/Cmd + /` - 注释/取消注释

### 应用级快捷键

在 App 组件中添加：
- `Ctrl/Cmd + P` - 快速打开文件
- `Ctrl/Cmd + W` - 关闭当前标签
- `Ctrl/Cmd + Tab` - 切换标签

## 性能优化建议

### 1. 文件树懒加载

只在展开时加载子目录：
```typescript
// 初始只加载一级
const nodes = await readDirectory(path, depth: 1)

// 展开时加载子级
if (node.isExpanded && !node.children) {
  node.children = await readDirectory(node.path, depth: 1)
}
```

### 2. 虚拟滚动

对于大型文件列表使用 `react-window`：
```bash
npm install react-window
```

### 3. 编辑器内容缓存

缓存已打开文件的内容：
```typescript
const contentCache = new Map<string, string>()
```

### 4. 防抖处理

文件保存、搜索等操作使用防抖：
```typescript
const debouncedSave = debounce(saveFile, 1000)
```

## 错误处理

### 统一错误处理

创建 `src/renderer/utils/errorHandler.ts`：

```typescript
export function handleFileError(error: Error) {
  // 显示用户友好的错误提示
  showNotification(error.message, 'error')

  // 记录详细错误日志
  console.error('File operation failed:', error)
}
```

### 常见错误

1. **文件读取失败** - 权限不足或文件不存在
2. **文件过大** - 超过 10MB 限制
3. **路径无效** - 路径验证失败
4. **Git 操作失败** - 仓库状态异常

## 测试清单

### 功能测试

- [ ] 文件树展开/折叠
- [ ] 各类文件正确打开
- [ ] 文件编辑和保存
- [ ] Markdown 预览正确
- [ ] HTML 预览安全隔离
- [ ] Git 状态正确显示
- [ ] 快捷键工作正常

### 性能测试

- [ ] 1000+ 文件的项目性能
- [ ] 大文件（5MB+）编辑性能
- [ ] 多个编辑器标签内存占用
- [ ] 文件树滚动流畅度

### 安全测试

- [ ] XSS 攻击防护
- [ ] 路径遍历防护
- [ ] 文件大小限制
- [ ] iframe sandbox 隔离

## 开发流程建议

### 迭代开发

1. **第一周**：实现文件树基础功能
2. **第二周**：集成 Monaco Editor
3. **第三周**：实现 Markdown 和 HTML 预览
4. **第四周**：集成 Git 功能
5. **第五周**：优化和测试

### 并发开发策略

可以并行开发：
- 文件树 UI 和文件系统 API
- Monaco Editor 集成和 Markdown 编辑器
- Git 检测和 UI 显示

## 参考资源

### 官方文档

- Monaco Editor: https://microsoft.github.io/monaco-editor/
- Marked.js: https://marked.js.org/
- DOMPurify: https://github.com/cure53/DOMPurify
- simple-git: https://github.com/steveukx/git-js

### 示例项目

- VS Code: https://github.com/microsoft/vscode
- 参考本项目中的 `company-docs/markdown-editor.html`

## 总结

按照本指南逐步实施，可以为 Airter 添加完整的文件管理和编辑功能。记住：

1. **安全第一** - 所有 HTML 都要清理
2. **性能优先** - 懒加载和缓存
3. **用户体验** - 错误提示和加载状态
4. **渐进增强** - 先核心功能，后优化

祝开发顺利！🚀
