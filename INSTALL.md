# AiTer 安装指南 / Installation Guide

[English](#english) | [中文](#中文)

---

## 中文

### 一键安装（推荐）

使用自动安装脚本，自动处理系统检测、下载和权限问题：

#### macOS / Linux

```bash
# 一键安装
curl -fsSL https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.sh | bash

# 或者下载后执行
curl -O https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.sh
chmod +x install.sh
./install.sh
```

#### Windows

```powershell
# 以管理员身份运行 PowerShell，然后执行：

# 一键安装（推荐）
irm https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.ps1 | iex

# 或者下载后执行
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.ps1" -OutFile "install.ps1"
powershell -ExecutionPolicy Bypass -File install.ps1

# 静默安装（无 UI）
irm https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.ps1 | iex -Silent

# 完全自定义
powershell -ExecutionPolicy Bypass -File install.ps1 -Silent -NoDesktopShortcut
```

**注意：** Windows 脚本需要管理员权限。右键点击 PowerShell 选择"以管理员身份运行"。

### 手动安装

#### macOS

1. **下载安装包**
   - Intel Mac: 下载 `AiTer-{version}-mac-x64.dmg`
   - Apple Silicon (M1/M2/M3): 下载 `AiTer-{version}-mac-arm64.dmg`

2. **安装应用**
   ```bash
   # 打开 DMG 文件
   open AiTer-{version}-mac-{arch}.dmg

   # 拖拽 AiTer.app 到 Applications 文件夹
   ```

3. **解决安全限制**

   macOS 可能会阻止未签名应用的运行。有以下几种解决方法：

   **方法 1：通过系统设置（推荐）**
   1. 尝试打开 AiTer，系统会显示安全警告
   2. 打开"系统设置" > "隐私与安全性"
   3. 在底部找到"仍然打开"按钮并点击
   4. 确认打开应用

   **方法 2：移除隔离属性（命令行）**
   ```bash
   # 移除应用的隔离属性
   sudo xattr -cr /Applications/AiTer.app

   # 添加到 Gatekeeper 白名单
   sudo spctl --add /Applications/AiTer.app
   ```

   **方法 3：完全禁用 Gatekeeper（不推荐，仅限开发环境）**
   ```bash
   # 禁用 Gatekeeper
   sudo spctl --master-disable

   # 使用后重新启用
   sudo spctl --master-enable
   ```

#### Windows

1. **下载安装包**
   - 下载 `AiTer-{version}-win-x64.exe`

2. **运行安装程序**
   - 双击 `.exe` 文件
   - 如果出现 SmartScreen 警告：
     1. 点击"更多信息"
     2. 点击"仍要运行"

3. **安装选项**
   - 选择安装路径（默认：`C:\Program Files\AiTer`）
   - 选择是否创建桌面快捷方式
   - 选择是否创建开始菜单快捷方式

### 验证安装

安装完成后，打开 AiTer 验证以下功能：

1. ✅ 应用成功启动
2. ✅ 可以创建项目
3. ✅ 可以打开终端
4. ✅ 可以安装 Minto 插件

### 常见问题

#### macOS: "无法打开 AiTer，因为无法验证开发者"

这是 macOS Gatekeeper 的安全机制。请按照上面的"解决安全限制"部分操作。

#### macOS: "AiTer 已损坏，无法打开"

这通常是因为下载过程中文件损坏，或者隔离属性问题：

```bash
# 移除隔离属性
sudo xattr -cr /Applications/AiTer.app

# 如果还不行，重新下载安装包
```

#### Windows: SmartScreen 阻止运行

Windows SmartScreen 可能会阻止未签名的应用：

1. 点击"更多信息"
2. 点击"仍要运行"

或者暂时禁用 SmartScreen（不推荐）：
- 设置 > 更新和安全 > Windows 安全中心 > 应用和浏览器控制 > 基于信誉的保护设置

#### 安装脚本失败

如果自动安装脚本失败：

1. 检查网络连接（需要访问 GitHub）
2. 检查是否有 `curl` 命令
3. 查看错误日志，手动下载对应版本
4. 在 GitHub Issues 报告问题

### 卸载

#### macOS

```bash
# 删除应用
rm -rf /Applications/AiTer.app

# 删除用户数据（可选）
rm -rf ~/Library/Application\ Support/AiTer
```

#### Windows

1. 通过"设置" > "应用" > "应用和功能"卸载
2. 或运行安装目录下的 `Uninstall.exe`

删除用户数据（可选）：
```
%APPDATA%\AiTer
```

---

## English

### One-Click Installation (Recommended)

Use the automatic installation script that handles system detection, download, and permissions:

#### macOS / Linux

```bash
# One-click install
curl -fsSL https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.sh | bash

# Or download and run
curl -O https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.sh
chmod +x install.sh
./install.sh
```

#### Windows

```powershell
# Run PowerShell as Administrator, then execute:

# One-click install (Recommended)
irm https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.ps1 | iex

# Or download and run
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.ps1" -OutFile "install.ps1"
powershell -ExecutionPolicy Bypass -File install.ps1

# Silent install (no UI)
irm https://raw.githubusercontent.com/within-7/aiter/main/scripts/install.ps1 | iex -Silent

# Full customization
powershell -ExecutionPolicy Bypass -File install.ps1 -Silent -NoDesktopShortcut
```

**Note:** Windows script requires administrator privileges. Right-click PowerShell and select "Run as Administrator".

### Manual Installation

#### macOS

1. **Download Installer**
   - Intel Mac: Download `AiTer-{version}-mac-x64.dmg`
   - Apple Silicon (M1/M2/M3): Download `AiTer-{version}-mac-arm64.dmg`

2. **Install Application**
   ```bash
   # Open DMG file
   open AiTer-{version}-mac-{arch}.dmg

   # Drag AiTer.app to Applications folder
   ```

3. **Bypass Security Restrictions**

   macOS may block unsigned applications. Here are solutions:

   **Method 1: System Settings (Recommended)**
   1. Try to open AiTer, system will show security warning
   2. Open "System Preferences" > "Privacy & Security"
   3. Find "Open Anyway" button at the bottom and click it
   4. Confirm to open the app

   **Method 2: Remove Quarantine Attribute (Command Line)**
   ```bash
   # Remove quarantine attribute
   sudo xattr -cr /Applications/AiTer.app

   # Add to Gatekeeper whitelist
   sudo spctl --add /Applications/AiTer.app
   ```

   **Method 3: Disable Gatekeeper Completely (Not Recommended)**
   ```bash
   # Disable Gatekeeper
   sudo spctl --master-disable

   # Re-enable after use
   sudo spctl --master-enable
   ```

#### Windows

1. **Download Installer**
   - Download `AiTer-{version}-win-x64.exe`

2. **Run Installer**
   - Double-click the `.exe` file
   - If SmartScreen warning appears:
     1. Click "More info"
     2. Click "Run anyway"

3. **Installation Options**
   - Choose installation path (default: `C:\Program Files\AiTer`)
   - Choose whether to create desktop shortcut
   - Choose whether to create start menu shortcut

### Verify Installation

After installation, open AiTer and verify:

1. ✅ Application starts successfully
2. ✅ Can create projects
3. ✅ Can open terminals
4. ✅ Can install Minto plugin

### Troubleshooting

#### macOS: "Cannot open AiTer because the developer cannot be verified"

This is macOS Gatekeeper's security mechanism. Follow the "Bypass Security Restrictions" section above.

#### macOS: "AiTer is damaged and can't be opened"

This is usually due to file corruption during download or quarantine attributes:

```bash
# Remove quarantine attribute
sudo xattr -cr /Applications/AiTer.app

# If still doesn't work, re-download the installer
```

#### Windows: SmartScreen Blocks Execution

Windows SmartScreen may block unsigned applications:

1. Click "More info"
2. Click "Run anyway"

Or temporarily disable SmartScreen (not recommended):
- Settings > Update & Security > Windows Security > App & browser control > Reputation-based protection settings

#### Installation Script Fails

If the automatic installation script fails:

1. Check network connection (requires GitHub access)
2. Check if `curl` command is available
3. Check error logs and manually download the version
4. Report issue on GitHub Issues

### Uninstall

#### macOS

```bash
# Remove application
rm -rf /Applications/AiTer.app

# Remove user data (optional)
rm -rf ~/Library/Application\ Support/AiTer
```

#### Windows

1. Uninstall via Settings > Apps > Apps & features
2. Or run `Uninstall.exe` in installation directory

Remove user data (optional):
```
%APPDATA%\AiTer
```

---

## 获取帮助 / Get Help

- GitHub Issues: https://github.com/within-7/aiter/issues
- 文档 / Documentation: https://github.com/within-7/aiter/wiki

## 许可证 / License

PROPRIETARY - Copyright © 2025-2026 Within-7.com
