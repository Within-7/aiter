# Node.js Integration in AiTer

## Overview

AiTer now includes **built-in Node.js support** using a portable approach (方案 C + 策略 B). This allows users to use Node.js and npm commands directly in AiTer terminals without requiring system-level installation.

## Features

- **Portable Node.js**: Each platform gets its own pre-packaged Node.js runtime
- **Automatic PATH Configuration**: Node.js binaries are automatically added to terminal environments
- **Zero System Pollution**: Does not modify user's system Node.js installation
- **Cross-Platform**: Supports macOS (Intel + Apple Silicon) and Windows

## Architecture

### Core Components

1. **NodeManager** (`src/main/nodejs/manager.ts`)
   - Manages Node.js installation and environment configuration
   - Provides terminal environment variables with Node.js paths
   - Handles installation from pre-packaged resources

2. **NodeDetector** (`src/main/nodejs/detector.ts`)
   - Detects system Node.js installations
   - Checks version compatibility
   - Fetches latest LTS version information

3. **NodeDownloader** (`src/main/nodejs/downloader.ts`)
   - Runtime download fallback (if pre-packaging fails)
   - Downloads Node.js from official nodejs.org
   - Supports progress reporting

4. **PTY Integration** (`src/main/pty.ts`)
   - Automatically injects Node.js environment variables into terminal processes
   - No user configuration required

## Directory Structure

```
airter/
├── resources/
│   └── nodejs/
│       ├── darwin-x64/       # macOS Intel binaries
│       ├── darwin-arm64/     # macOS Apple Silicon binaries
│       └── win32-x64/        # Windows binaries
└── src/
    └── main/
        └── nodejs/
            ├── manager.ts    # Node.js lifecycle management
            ├── detector.ts   # System Node.js detection
            └── downloader.ts # Runtime download fallback
```

## How It Works

### 1. Startup

When AiTer starts:
1. `NodeManager` checks if built-in Node.js is installed
2. If not found, it attempts to install from `resources/nodejs/`
3. If resources are missing (dev mode), it can download at runtime

### 2. Terminal Creation

When a new terminal is created:
1. `PTYManager` calls `nodeManager.getTerminalEnv()`
2. Node.js bin path is prepended to `PATH` environment variable
3. Terminal spawns with custom environment

Example environment variables injected:
```bash
PATH=/path/to/airter/nodejs/darwin-arm64/bin:$EXISTING_PATH
NODE_PATH=/path/to/airter/nodejs/darwin-arm64/lib/node_modules
```

### 3. User Experience

From the user's perspective:
```bash
$ node --version
v20.18.0  # AiTer's built-in Node.js

$ npm --version
10.8.2    # AiTer's built-in npm

$ which node
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/bin/node
```

## Development Setup

### Download Node.js Binaries

Before building or testing, download the required Node.js binaries:

```bash
cd scripts
chmod +x download-nodejs.sh
./download-nodejs.sh
```

This will download:
- Node.js v20.18.0 (LTS) for macOS Intel
- Node.js v20.18.0 (LTS) for macOS Apple Silicon
- Node.js v20.18.0 (LTS) for Windows x64

Total size: ~150MB (50MB per platform)

### Test in Development

```bash
npm run dev
```

Open a terminal in AiTer and test:
```bash
node --version
npm --version
```

### Build with Pre-packaged Node.js

The electron-builder configuration includes Node.js in the final package:

```bash
npm run build:mac   # Includes macOS Node.js binaries
npm run build:win   # Includes Windows Node.js binaries
```

## electron-builder Configuration

Add to `electron-builder.json5`:

```json5
{
  "files": [
    "dist-electron/**/*",
    "dist-renderer/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "resources/nodejs/${os}-${arch}",
      "to": "nodejs",
      "filter": ["**/*"]
    }
  ]
}
```

This ensures Node.js binaries are included in the packaged app.

## API Reference

### IPC Channels

```typescript
// Check if built-in Node.js is installed
window.api.nodejs.checkBuiltin()
// Returns: { success: boolean, installed: boolean, info?: NodeInfo }

// Check system Node.js
window.api.nodejs.checkSystem()
// Returns: { success: boolean, systemNode: SystemNodeInfo }

// Install from resources
window.api.nodejs.install()
// Returns: { success: boolean }

// Download at runtime (fallback)
window.api.nodejs.download(version: string)
// Returns: { success: boolean }

// Get recommended LTS version
window.api.nodejs.getRecommendedVersion()
// Returns: { success: boolean, version?: string }

// Uninstall built-in Node.js
window.api.nodejs.uninstall()
// Returns: { success: boolean }

// Listen to download progress
window.api.nodejs.onDownloadProgress((progress) => {
  console.log(progress.percent, progress.status, progress.message)
})
```

## Deployment Considerations

### Pros
- ✅ Zero system requirements
- ✅ Consistent Node.js version across all users
- ✅ No conflicts with user's existing Node.js
- ✅ No admin permissions required
- ✅ Offline-ready (after initial download)

### Cons
- ❌ Increases app bundle size by ~50MB per platform
- ❌ Requires maintenance when updating Node.js versions

### Recommended Approach
1. **Pre-package for production**: Include Node.js in release builds
2. **Runtime download for dev**: Download on-demand during development
3. **Version pinning**: Update Node.js version every 6 months (LTS cycle)

## Troubleshooting

### Node.js not found in terminal
```bash
# Check if built-in Node.js is installed
ls ~/Library/Application\ Support/AiTer/nodejs/
```

If empty, the installation failed. Check logs in:
- Console app (macOS)
- Electron DevTools Console

### Permission errors (macOS/Linux)
```bash
# Fix executable permissions
chmod +x ~/Library/Application\ Support/AiTer/nodejs/darwin-arm64/bin/node
chmod +x ~/Library/Application\ Support/AiTer/nodejs/darwin-arm64/bin/npm
```

### System Node.js takes precedence
This shouldn't happen, but if it does:
1. Check terminal environment: `echo $PATH`
2. AiTer's Node.js should appear first in PATH
3. Restart AiTer

## Future Enhancements

- [ ] Auto-update Node.js when new LTS is released
- [ ] Allow users to choose Node.js version
- [ ] UI for Node.js management (install/uninstall/update)
- [ ] Pre-install popular npm packages (typescript, eslint, etc.)
- [ ] Support for multiple Node.js versions (like nvm)

## References

- [Node.js Official Downloads](https://nodejs.org/dist/)
- [Electron Process Architecture](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
