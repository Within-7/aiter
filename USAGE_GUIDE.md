# Airter 使用指南

## 快速开始

### 开发模式运行

```bash
# 安装依赖
npm install

# 重建原生模块（仅首次或更新 Electron 版本后）
npx electron-rebuild -f

# 启动开发服务器
npm run dev
```

应用将自动启动 Electron 窗口。

## 功能使用

### 1. 添加项目

**方法一：点击添加按钮**
1. 点击左侧边栏顶部的 "+" 按钮
2. 在弹出的文件夹选择对话框中选择项目目录
3. 项目将被添加到侧边栏列表中

**方法二：拖拽文件夹（未来功能）**
- 直接将文件夹拖拽到侧边栏

### 2. 打开终端

1. 在左侧边栏点击任意项目
2. 应用将自动在右侧打开一个该项目目录下的终端标签
3. 终端会自动设置工作目录为项目路径

### 3. 管理终端标签

**新建标签：**
- 点击标签栏右侧的 "+" 按钮
- 或使用快捷键（未来功能）

**切换标签：**
- 点击任意标签激活
- 使用鼠标中键点击关闭标签

**关闭标签：**
- 点击标签上的 "×" 按钮
- 或鼠标中键点击标签

### 4. 删除项目

1. 右键点击项目项
2. 选择 "Remove"
3. 或点击项目项右侧的 "×" 按钮

**注意：** 删除项目不会删除磁盘上的文件，只是从列表中移除。

### 5. 终端操作

**基本功能：**
- 完整的 Shell 支持（bash/zsh/cmd/PowerShell）
- 支持 ANSI 颜色和格式化
- 支持交互式命令（vim、nano等）
- 完美兼容 Minto CLI

**复制粘贴：**
- macOS: Cmd+C / Cmd+V
- Windows: Ctrl+C / Ctrl+V

**文本选择：**
- 鼠标拖动选择文本
- 双击选择单词

## 数据存储

应用数据存储在以下位置：

- **macOS:** `~/Library/Application Support/Airter/`
- **Windows:** `%APPDATA%/Airter/`

存储内容包括：
- 项目列表 (`airter-data.json`)
- 窗口状态 (`window-state.json`)
- 应用设置

## 开发调试

### 查看开发者工具

开发模式下会自动打开 DevTools，可以在其中查看：
- 控制台日志
- 网络请求
- React 组件树（需安装 React DevTools 扩展）

### 常见问题

**Q: 终端无法启动**
- 确保已运行 `npx electron-rebuild -f`
- 检查 node-pty 是否正确编译

**Q: 项目列表为空**
- 首次使用时需要手动添加项目
- 检查数据存储目录权限

**Q: 终端字体太小/太大**
- 未来将支持在设置中调整字体大小
- 当前默认字体大小为 14px

## 构建生产版本

### 构建 macOS 版本

```bash
# Intel 和 Apple Silicon 通用版本
npm run build:mac

# 输出目录
release/<version>/Airter-<version>-mac-x64.dmg
release/<version>/Airter-<version>-mac-arm64.dmg
```

### 构建 Windows 版本

```bash
npm run build:win

# 输出目录
release/<version>/Airter-<version>-win-x64.exe
```

### 构建所有平台

```bash
npm run build:all
```

## 快捷键参考

| 功能 | macOS | Windows |
|------|-------|---------|
| 复制 | Cmd+C | Ctrl+C |
| 粘贴 | Cmd+V | Ctrl+V |
| 新建标签 | 未来功能 | 未来功能 |
| 关闭标签 | 未来功能 | 未来功能 |
| 切换标签 | 未来功能 | 未来功能 |

## 与 Minto CLI 协作

### 最佳实践

1. **为每个项目创建独立终端**
   - 在侧边栏点击项目即可打开新终端
   - 避免在同一终端中切换多个项目

2. **保持终端整洁**
   - 及时关闭不需要的终端标签
   - 使用有意义的项目名称

3. **利用多标签功能**
   - 一个标签运行 Minto
   - 另一个标签运行测试或构建
   - 第三个标签查看日志

### Minto 常用命令

```bash
# 启动 Minto
claude-code

# 查看帮助
claude-code --help

# 在特定目录启动
cd /path/to/project
claude-code
```

## 性能优化建议

1. **限制并发终端数量**
   - 建议同时打开不超过 10 个终端
   - 关闭不使用的终端以释放资源

2. **定期清理项目列表**
   - 删除不再使用的项目
   - 保持项目列表简洁

3. **注意内存使用**
   - 每个终端会占用一定内存
   - 如遇卡顿可关闭部分终端

## 故障排除

### 应用无法启动

```bash
# 1. 清理构建缓存
rm -rf dist-electron dist-renderer node_modules/.vite

# 2. 重新安装依赖
rm -rf node_modules
npm install

# 3. 重建原生模块
npx electron-rebuild -f

# 4. 重新启动
npm run dev
```

### 终端连接失败

1. 检查 PTY 进程是否正常
2. 查看控制台错误日志
3. 尝试重新打开终端标签

### 数据丢失

- 检查数据存储目录是否存在
- 查看 `airter-data.json` 文件权限
- 尝试手动恢复备份（如果有）

## 未来功能预告

- [ ] 快捷键系统
- [ ] 设置面板（字体、主题、Shell 配置）
- [ ] 终端会话恢复
- [ ] 分屏终端
- [ ] SSH 远程连接
- [ ] 终端历史记录搜索
- [ ] 自定义主题
- [ ] 项目模板

## 技术支持

遇到问题？
- 查看 GitHub Issues
- 阅读技术文档 (PRD.md, DEVELOPMENT_PLAN.md)
- 查看控制台日志

## 许可证

MIT License
