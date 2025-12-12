# AiTer

A modern terminal client optimized for AI CLI tools collaboration.

**开发者**: Lib
**公司**: 任小姐出海战略咨询
**网站**: [Within-7.com](https://within-7.com)

## 📥 下载安装 / Download

### 团队成员快速下载

访问 [Releases 页面](https://github.com/Within-7/aiter/releases/latest) 下载最新版本。

详细安装说明请查看：[团队下载使用指南](docs/TEAM_DOWNLOAD_GUIDE.md)

### 开发者发布流程

发布新版本请查看：[发布指南](docs/RELEASE_GUIDE.md)

## 📚 Documentation

- **[产品网站](docs/index.html)** - 产品介绍和功能展示
- **[用户手册](docs/USER_MANUAL.md)** - 详细使用指南,快速上手
- **[团队下载指南](docs/TEAM_DOWNLOAD_GUIDE.md)** - 下载安装说明（团队成员必读）
- **[发布指南](docs/RELEASE_GUIDE.md)** - 版本发布流程（开发者）
- **[战略咨询工作流](docs/CONSULTING_WORKFLOW.md)** - 面向咨询团队的工作流程指南
- **[最佳实践](docs/BEST_PRACTICES.md)** - 高效使用技巧和经验总结

## Features

- 🗂️ **Project Management**: Easily switch between multiple projects with a dedicated sidebar
- 🖥️ **Multi-Terminal Tabs**: Open multiple terminal instances per project
- 🎨 **Beautiful UI**: Dark theme optimized for long coding sessions
- ⚡ **High Performance**: Built with Electron, React, and xterm.js
- 🌍 **Cross-Platform**: Runs on macOS (Intel & Apple Silicon) and Windows

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Build for current platform
npm run build

# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for all platforms
npm run build:all
```

## Architecture

```
airter/
├── src/
│   ├── main/         # Electron main process
│   ├── renderer/     # React UI
│   └── preload/      # Preload scripts
├── dist-electron/    # Compiled Electron code
├── dist-renderer/    # Compiled React code
└── release/          # Distribution packages
```

## Tech Stack

- **Framework**: Electron
- **UI**: React + TypeScript
- **Terminal**: xterm.js + node-pty
- **Build**: Vite + electron-builder
- **Storage**: electron-store

## License

**PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**

Copyright © 2025-2026 Within-7.com - 任小姐出海战略咨询

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited.

**RESTRICTIONS:**
- ❌ **NOT Open Source** - Source code is proprietary and confidential
- ❌ **NO Commercial Use** - Commercial use is strictly prohibited
- ❌ **NO Redistribution** - May not be copied, distributed, or shared
- ❌ **NO Modifications** - May not be modified, adapted, or reverse engineered
- ❌ **NO Derivative Works** - Creating derivative works is prohibited
- ✅ **Personal Use Only** - Licensed for personal, non-commercial use only

For licensing inquiries or permission requests, please contact: dev@within-7.com

See [LICENSE](LICENSE) file for complete terms and conditions.

Developed by Lib
