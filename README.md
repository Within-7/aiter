# AiTer

A modern terminal client optimized for Minto CLI collaboration.

**开发者**: Lib
**公司**: 任小姐出海战略咨询
**网站**: [Within-7.com](https://within-7.com)

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

MIT License

Copyright © 2025-2026 Within-7.com - 任小姐出海战略咨询

Developed by Lib
