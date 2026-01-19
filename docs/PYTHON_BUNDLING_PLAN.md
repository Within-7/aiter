# Python + UV 环境封装实现计划

## 目录

1. [概述](#1-概述)
2. [架构设计](#2-架构设计)
3. [资源准备](#3-资源准备)
4. [核心模块实现](#4-核心模块实现)
5. [终端环境集成](#5-终端环境集成)
6. [设置系统扩展](#6-设置系统扩展)
7. [构建系统集成](#7-构建系统集成)
8. [UI 界面扩展](#8-ui-界面扩展)
9. [测试计划](#9-测试计划)
10. [实施阶段](#10-实施阶段)
11. [风险评估与缓解](#11-风险评估与缓解)

---

## 1. 概述

### 1.1 目标

在 AiTer 中封装独立的 Python 环境，采用 **Python Standalone Builds + UV** 的混合模式：

- **Python Standalone**: 提供完整的 Python 运行时环境
- **UV**: 提供高性能的包管理能力（比 pip 快 10-100x）

### 1.2 设计原则

1. **与 Node.js 封装保持一致的架构模式**
2. **保证现有功能的稳定性**（不影响 Node.js、终端、编辑器等）
3. **支持与系统 Python 共存**（用户可选择使用内置或系统 Python）
4. **支持版本管理器检测**（pyenv、conda、poetry 等）

### 1.3 文件大小估算

| 组件 | macOS x64 | macOS ARM64 | Windows x64 |
|------|-----------|-------------|-------------|
| Python 3.12 (standalone) | ~80 MB | ~75 MB | ~70 MB |
| UV | ~15 MB | ~15 MB | ~18 MB |
| **合计** | ~95 MB | ~90 MB | ~88 MB |

对比 Node.js：~82-191 MB，体积相当。

---

## 2. 架构设计

### 2.1 目录结构

```
airter/
├── resources/
│   ├── nodejs/                    # 现有
│   │   ├── darwin-x64/
│   │   ├── darwin-arm64/
│   │   └── win32-x64/
│   └── python/                    # 新增
│       ├── darwin-x64/
│       │   ├── bin/
│       │   │   ├── python3        # Python 解释器
│       │   │   ├── python3.12
│       │   │   ├── pip3
│       │   │   └── uv             # UV 包管理器
│       │   ├── lib/
│       │   │   └── python3.12/
│       │   │       ├── site-packages/
│       │   │       └── ...
│       │   └── include/
│       ├── darwin-arm64/
│       │   └── [同上结构]
│       └── win32-x64/
│           ├── python.exe
│           ├── python3.exe
│           ├── Scripts/
│           │   ├── pip.exe
│           │   └── uv.exe
│           ├── Lib/
│           │   └── site-packages/
│           └── DLLs/
│
├── src/main/
│   ├── nodejs/                    # 现有
│   │   ├── manager.ts
│   │   ├── downloader.ts
│   │   └── detector.ts
│   └── python/                    # 新增
│       ├── manager.ts             # PythonManager 核心类
│       ├── downloader.ts          # Python 下载器
│       ├── detector.ts            # 系统 Python 检测
│       └── uv.ts                  # UV 包管理器封装
```

### 2.2 模块依赖关系

```
                    ┌─────────────────┐
                    │   AppSettings   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐   ┌───────────┐   ┌───────────┐
      │NodeManager│   │PythonMgr  │   │ StoreManager│
      └─────┬─────┘   └─────┬─────┘   └───────────┘
            │               │
            │    ┌──────────┼──────────┐
            │    │          │          │
            │    ▼          ▼          ▼
            │  ┌────┐   ┌────────┐  ┌──────────┐
            │  │ UV │   │Detector│  │Downloader│
            │  └────┘   └────────┘  └──────────┘
            │
            ▼
      ┌───────────┐
      │PTYManager │ ◄──── getTerminalEnv() 合并 Node + Python 环境
      └───────────┘
```

### 2.3 数据流

```
应用启动
    │
    ▼
初始化 PythonManager
    │
    ├── 检查内置 Python 是否存在
    │       │
    │       ├── 是 → 检查版本，必要时升级
    │       │
    │       └── 否 → 从 resources 安装
    │
    ├── 检查 UV 是否存在
    │       │
    │       └── 确保 UV 可执行
    │
    └── 准备终端环境变量
            │
            ▼
      终端创建时
            │
            ├── NodeManager.getTerminalEnv()
            │
            ├── PythonManager.getTerminalEnv()
            │
            └── 合并环境 → PTY.spawn()
```

---

## 3. 资源准备

### 3.1 Python Standalone Builds

**来源**: https://github.com/indygreg/python-build-standalone

**推荐版本**: Python 3.12.x (最新稳定 LTS)

**下载链接模式**:
```
https://github.com/indygreg/python-build-standalone/releases/download/{tag}/cpython-{version}+{build}-{target}-{variant}.tar.gz
```

**目标平台**:

| 平台 | Target 名称 | 文件名示例 |
|------|------------|-----------|
| macOS x64 | `x86_64-apple-darwin` | `cpython-3.12.x+xxx-x86_64-apple-darwin-install_only.tar.gz` |
| macOS ARM64 | `aarch64-apple-darwin` | `cpython-3.12.x+xxx-aarch64-apple-darwin-install_only.tar.gz` |
| Windows x64 | `x86_64-pc-windows-msvc` | `cpython-3.12.x+xxx-x86_64-pc-windows-msvc-install_only.tar.gz` |

**选择 `install_only` 变体**：仅包含安装所需文件，体积最小。

### 3.2 UV 包管理器

**来源**: https://github.com/astral-sh/uv

**下载链接模式**:
```
https://github.com/astral-sh/uv/releases/download/{version}/uv-{target}.tar.gz
```

**目标平台**:

| 平台 | Target 名称 |
|------|------------|
| macOS x64 | `x86_64-apple-darwin` |
| macOS ARM64 | `aarch64-apple-darwin` |
| Windows x64 | `x86_64-pc-windows-msvc` |

### 3.3 资源准备脚本

创建 `scripts/prepare-python.ts`:

```typescript
/**
 * 下载并准备 Python + UV 资源
 *
 * 使用方式:
 *   npx ts-node scripts/prepare-python.ts
 *
 * 功能:
 *   1. 下载 Python standalone builds
 *   2. 下载 UV
 *   3. 解压到 resources/python/{platform}/
 *   4. 设置可执行权限
 */
```

---

## 4. 核心模块实现

### 4.1 PythonManager (`src/main/python/manager.ts`)

**职责**:
- 管理内置 Python 的安装、升级、卸载
- 提供终端环境变量
- 处理版本管理器兼容性

**核心接口**:

```typescript
export interface PythonInfo {
  version: string;           // e.g., "3.12.1"
  pythonPath: string;        // Python 解释器路径
  pipPath: string;           // pip 路径
  uvPath: string;            // UV 路径
  sitePackages: string;      // site-packages 目录
}

export interface PythonUpgradeResult {
  upgraded: boolean;
  oldVersion: string | null;
  newVersion: string | null;
  reason: string;
}

export class PythonManager {
  // 平台信息
  private pythonDir: string;
  private platform: string;
  private arch: string;

  // 路径获取
  getPlatformId(): string;
  getPythonRootPath(): string;
  getPythonBinPath(): string;
  getPythonExecutable(): string;
  getPipExecutable(): string;
  getUvExecutable(): string;
  getSitePackagesPath(): string;

  // 安装管理
  async isInstalled(): Promise<boolean>;
  async getPythonInfo(): Promise<PythonInfo | null>;
  async getBundledPythonVersion(): Promise<string | null>;
  async needsUpgrade(): Promise<{ needed: boolean; reason: string; ... }>;
  async upgradeIfNeeded(): Promise<PythonUpgradeResult>;
  async installFromResources(): Promise<boolean>;
  async uninstall(): Promise<boolean>;

  // 环境变量
  getTerminalEnv(settings?: AppSettings): NodeJS.ProcessEnv;

  // 缓存管理
  async cleanPipCache(): Promise<boolean>;
  async cleanUvCache(): Promise<boolean>;

  // Shell 配置
  getShellInitScript(): string;
  async isShellConfigured(): Promise<boolean>;
  async configureShell(): Promise<boolean>;
}
```

**关键实现细节**:

```typescript
// 最低 Python 版本要求（为了 AI CLI 工具兼容性）
const MINIMUM_PYTHON_VERSION = '3.10.0';

// 终端环境变量注入
getTerminalEnv(settings?: AppSettings): NodeJS.ProcessEnv {
  const binPath = this.getPythonBinPath();
  const rootPath = this.getPythonRootPath();
  const delimiter = this.platform === 'win32' ? ';' : ':';

  const env = { ...process.env };
  const pythonSource = settings?.pythonSource ?? 'builtin';
  const preserveVersionManagers = settings?.preservePythonVersionManagers ?? false;

  // 清理 Python 版本管理器环境变量
  if (!preserveVersionManagers) {
    const varsToClean = PythonVersionManagerDetector.getEnvVarsToClean();
    for (const varName of varsToClean) {
      delete env[varName];
    }
  }

  let finalPath = env.PATH || '';
  const result: NodeJS.ProcessEnv = { ...env };

  if (pythonSource === 'builtin') {
    // 内置 Python 路径优先
    finalPath = `${binPath}${delimiter}${finalPath}`;

    // Python 相关环境变量
    result.PYTHONHOME = rootPath;
    result.PYTHONPATH = this.getSitePackagesPath();
    result.PIP_CACHE_DIR = path.join(this.pythonDir, '.pip-cache');
    result.UV_CACHE_DIR = path.join(this.pythonDir, '.uv-cache');
    result.AITER_PYTHON_PATH = binPath;

    // 禁用用户 site-packages（避免与系统 Python 冲突）
    result.PYTHONNOUSERSITE = '1';
  }

  result.PATH = finalPath;
  return result;
}
```

### 4.2 PythonDownloader (`src/main/python/downloader.ts`)

**职责**:
- 从 python-build-standalone 下载 Python
- 从 astral-sh/uv 下载 UV
- 解压和安装

**核心接口**:

```typescript
export interface DownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message?: string;
}

export class PythonDownloader {
  // 获取下载 URL
  private getPythonDownloadUrl(version: string): string;
  private getUvDownloadUrl(version: string): string;

  // 下载方法
  async downloadPython(version: string, onProgress?: ProgressCallback): Promise<boolean>;
  async downloadUv(version: string, onProgress?: ProgressCallback): Promise<boolean>;

  // 解压方法
  private async extractTarGz(tarPath: string, targetDir: string): Promise<void>;
  private async extractZip(zipPath: string, targetDir: string): Promise<void>;
}
```

### 4.3 PythonDetector (`src/main/python/detector.ts`)

**职责**:
- 检测系统 Python 安装
- 检测版本管理器（pyenv、conda、poetry）

**核心接口**:

```typescript
export interface SystemPythonInfo {
  installed: boolean;
  version?: string;
  pythonPath?: string;
  pipPath?: string;
  pipVersion?: string;
}

export class PythonDetector {
  async detectSystemPython(): Promise<SystemPythonInfo>;
  async checkVersionRequirement(minVersion: string): Promise<boolean>;
  async getRecommendedVersion(): Promise<string | null>;
}
```

### 4.4 UvManager (`src/main/python/uv.ts`)

**职责**:
- 封装 UV 命令调用
- 提供包安装、卸载、列表功能

**核心接口**:

```typescript
export interface UvPackage {
  name: string;
  version: string;
  location?: string;
}

export class UvManager {
  constructor(private pythonManager: PythonManager);

  // 包管理
  async install(packageName: string, onProgress?: ProgressCallback): Promise<boolean>;
  async uninstall(packageName: string): Promise<boolean>;
  async list(): Promise<UvPackage[]>;
  async upgrade(packageName: string): Promise<boolean>;

  // 虚拟环境
  async createVenv(path: string): Promise<boolean>;
  async activateVenv(path: string): NodeJS.ProcessEnv;

  // 工具运行
  async run(tool: string, args: string[]): Promise<{ stdout: string; stderr: string }>;
}
```

### 4.5 扩展 VersionManagerDetector

在 `src/main/shell/VersionManagerDetector.ts` 中添加更多 Python 版本管理器:

```typescript
// 新增 Python 版本管理器定义
{
  name: 'conda',
  envVars: ['CONDA_PREFIX', 'CONDA_DEFAULT_ENV', 'CONDA_EXE', 'CONDA_PYTHON_EXE', '_CE_CONDA', '_CE_M'],
  dirEnvVar: 'CONDA_PREFIX',
  defaultDir: 'miniconda3'  // 或 anaconda3
},
{
  name: 'poetry',
  envVars: ['POETRY_HOME', 'POETRY_VIRTUALENVS_PATH', 'POETRY_CACHE_DIR'],
  dirEnvVar: 'POETRY_HOME',
  defaultDir: '.poetry'
},
{
  name: 'pipenv',
  envVars: ['PIPENV_VENV_IN_PROJECT', 'PIPENV_CACHE_DIR', 'WORKON_HOME'],
  dirEnvVar: 'WORKON_HOME',
  defaultDir: '.virtualenvs'
}
```

---

## 5. 终端环境集成

### 5.1 修改 PTYManager

在 `src/main/pty.ts` 中集成 Python 环境:

```typescript
// 现有代码
import { NodeManager } from './nodejs/manager';

// 新增
import { PythonManager } from './python/manager';

export class PTYManager {
  private nodeManager: NodeManager;
  private pythonManager: PythonManager;  // 新增

  constructor() {
    this.nodeManager = new NodeManager();
    this.pythonManager = new PythonManager();  // 新增
  }

  async create(...) {
    // 获取 Node.js 环境
    const nodeEnv = this.nodeManager.getTerminalEnv(effectiveSettings);

    // 获取 Python 环境（新增）
    const pythonEnv = this.pythonManager.getTerminalEnv(effectiveSettings);

    // 合并环境变量
    const ptyEnv = {
      ...nodeEnv,
      ...pythonEnv,  // Python 环境变量覆盖
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      // ... 其他设置
    };

    // PATH 需要特殊处理（合并而非覆盖）
    const delimiter = process.platform === 'win32' ? ';' : ':';
    ptyEnv.PATH = this.mergePaths([
      pythonEnv.AITER_PYTHON_PATH,  // Python 最高优先级
      nodeEnv.AITER_NODE_PATH,      // Node.js 次优先级
      process.env.PATH              // 系统路径
    ], delimiter);

    // 创建 PTY
    const ptyProcess = pty.spawn(shellPath, args, {
      env: ptyEnv,
      // ...
    });
  }

  private mergePaths(paths: (string | undefined)[], delimiter: string): string {
    return paths.filter(Boolean).join(delimiter);
  }
}
```

### 5.2 IPC 处理器扩展

在 `src/main/ipc/` 中添加 Python 相关 IPC:

```typescript
// src/main/ipc/python.ts

import { ipcMain } from 'electron';
import { PythonManager } from '../python/manager';
import { UvManager } from '../python/uv';

const pythonManager = new PythonManager();
const uvManager = new UvManager(pythonManager);

// Python 信息
ipcMain.handle('python:getInfo', async () => {
  return pythonManager.getPythonInfo();
});

// Python 安装状态
ipcMain.handle('python:isInstalled', async () => {
  return pythonManager.isInstalled();
});

// 升级检查
ipcMain.handle('python:checkUpgrade', async () => {
  return pythonManager.needsUpgrade();
});

// 执行升级
ipcMain.handle('python:upgrade', async () => {
  return pythonManager.upgradeIfNeeded();
});

// UV 包管理
ipcMain.handle('python:uv:install', async (_, packageName: string) => {
  return uvManager.install(packageName);
});

ipcMain.handle('python:uv:uninstall', async (_, packageName: string) => {
  return uvManager.uninstall(packageName);
});

ipcMain.handle('python:uv:list', async () => {
  return uvManager.list();
});

// 缓存清理
ipcMain.handle('python:cleanCache', async () => {
  const pipResult = await pythonManager.cleanPipCache();
  const uvResult = await pythonManager.cleanUvCache();
  return { pip: pipResult, uv: uvResult };
});
```

---

## 6. 设置系统扩展

### 6.1 扩展 AppSettings 接口

在 `src/types/index.ts` 中添加:

```typescript
export interface AppSettings {
  // ... 现有设置 ...

  // ========================================
  // Python 配置（新增）
  // ========================================

  /** Python 来源: builtin=内置, system=系统, auto=自动检测 */
  pythonSource: 'builtin' | 'system' | 'auto';

  /** 是否保留 Python 版本管理器环境变量 (pyenv, conda, poetry) */
  preservePythonVersionManagers: boolean;

  /** 是否启用 UV 加速包管理 */
  uvEnabled: boolean;
}
```

### 6.2 默认设置

在 `src/main/store.ts` 中更新默认值:

```typescript
const defaultSettings: AppSettings = {
  // ... 现有默认值 ...

  // Python 默认设置
  pythonSource: 'builtin',
  preservePythonVersionManagers: false,
  uvEnabled: true,
};
```

### 6.3 扩展 VersionManagerName 类型

在 `src/types/index.ts` 中:

```typescript
// 版本管理器名称（扩展）
export type VersionManagerName =
  | 'nvm' | 'fnm' | 'asdf' | 'volta'           // Node.js
  | 'pyenv' | 'rbenv'                          // 现有
  | 'conda' | 'poetry' | 'pipenv';             // 新增 Python
```

---

## 7. 构建系统集成

### 7.1 更新 electron-builder.yml

```yaml
extraResources:
  # Node.js（现有）
  - from: resources/nodejs
    to: nodejs
    filter:
      - '**/*'

  # Python（新增）
  - from: resources/python
    to: python
    filter:
      - '**/*'

  # 其他资源
  - from: assets
    to: assets
    filter:
      - '**/*'
```

### 7.2 更新 package.json 脚本

```json
{
  "scripts": {
    "prepare:nodejs": "ts-node scripts/prepare-nodejs.ts",
    "prepare:python": "ts-node scripts/prepare-python.ts",
    "prepare:all": "npm run prepare:nodejs && npm run prepare:python",
    "prebuild": "npm run prepare:all",
    "build": "..."
  }
}
```

### 7.3 .gitignore 更新

```gitignore
# Python 资源（与 Node.js 相同处理）
resources/python/darwin-x64/
resources/python/darwin-arm64/
resources/python/win32-x64/

# Python 缓存
**/__pycache__/
**/*.pyc
**/*.pyo
```

---

## 8. UI 界面扩展

### 8.1 设置页面扩展

在设置页面添加 Python 配置区块:

```tsx
// src/renderer/components/Settings/PythonSettings.tsx

export function PythonSettings() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsSection title="Python 配置">
      {/* Python 来源选择 */}
      <SettingsItem
        label="Python 来源"
        description="选择终端使用的 Python 环境"
      >
        <Select
          value={settings.pythonSource}
          onChange={(value) => updateSettings({ pythonSource: value })}
          options={[
            { value: 'builtin', label: '内置 Python (推荐)' },
            { value: 'system', label: '系统 Python' },
            { value: 'auto', label: '自动检测' },
          ]}
        />
      </SettingsItem>

      {/* UV 加速 */}
      <SettingsItem
        label="UV 包管理加速"
        description="使用 UV 替代 pip 进行包管理（速度提升 10-100x）"
      >
        <Switch
          checked={settings.uvEnabled}
          onChange={(checked) => updateSettings({ uvEnabled: checked })}
        />
      </SettingsItem>

      {/* 版本管理器兼容 */}
      <SettingsItem
        label="保留 Python 版本管理器"
        description="保留 pyenv、conda、poetry 等版本管理器的环境变量"
      >
        <Switch
          checked={settings.preservePythonVersionManagers}
          onChange={(checked) => updateSettings({ preservePythonVersionManagers: checked })}
        />
      </SettingsItem>

      {/* Python 信息显示 */}
      <PythonInfoDisplay />

      {/* 缓存管理 */}
      <CacheManagement />
    </SettingsSection>
  );
}
```

### 8.2 Python 状态显示组件

```tsx
// src/renderer/components/Settings/PythonInfoDisplay.tsx

export function PythonInfoDisplay() {
  const [pythonInfo, setPythonInfo] = useState<PythonInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.python.getInfo().then(setPythonInfo).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!pythonInfo) return <Alert type="warning">Python 未安装</Alert>;

  return (
    <InfoCard>
      <InfoRow label="Python 版本" value={pythonInfo.version} />
      <InfoRow label="路径" value={pythonInfo.pythonPath} />
      <InfoRow label="UV 版本" value={pythonInfo.uvVersion || '未安装'} />
    </InfoCard>
  );
}
```

---

## 9. 测试计划

### 9.1 单元测试

```typescript
// tests/python/manager.test.ts

describe('PythonManager', () => {
  describe('getPlatformId', () => {
    it('returns correct platform identifier', () => {
      // ...
    });
  });

  describe('getTerminalEnv', () => {
    it('injects Python paths when source is builtin', () => {
      // ...
    });

    it('does not modify PATH when source is system', () => {
      // ...
    });

    it('cleans version manager vars when not preserving', () => {
      // ...
    });
  });

  describe('installFromResources', () => {
    it('copies Python files correctly', () => {
      // ...
    });

    it('preserves user packages during upgrade', () => {
      // ...
    });
  });
});
```

### 9.2 集成测试

```typescript
// tests/integration/terminal-python.test.ts

describe('Terminal Python Integration', () => {
  it('python command uses bundled Python', async () => {
    const terminal = await createTerminal();
    await terminal.execute('python --version');
    expect(terminal.output).toContain('Python 3.12');
  });

  it('uv command is available', async () => {
    const terminal = await createTerminal();
    await terminal.execute('uv --version');
    expect(terminal.output).toContain('uv');
  });

  it('pip install uses UV when enabled', async () => {
    // ...
  });
});
```

### 9.3 跨平台测试矩阵

| 测试项 | macOS x64 | macOS ARM64 | Windows x64 |
|--------|-----------|-------------|-------------|
| Python 安装 | ○ | ○ | ○ |
| UV 安装 | ○ | ○ | ○ |
| 终端 PATH 注入 | ○ | ○ | ○ |
| 包安装 (uv pip install) | ○ | ○ | ○ |
| 系统 Python 检测 | ○ | ○ | ○ |
| pyenv 兼容 | ○ | ○ | - |
| conda 兼容 | ○ | ○ | ○ |
| 现有 Node.js 功能 | ○ | ○ | ○ |

---

## 10. 实施阶段

### 阶段 1: 基础设施 (Week 1)

**目标**: 建立 Python 管理的核心框架

**任务**:
1. [ ] 创建 `src/main/python/` 目录结构
2. [ ] 实现 `PythonManager` 基础类
   - [ ] 平台检测
   - [ ] 路径获取方法
   - [ ] `isInstalled()` 方法
3. [ ] 实现 `PythonDetector` 类
   - [ ] 系统 Python 检测
   - [ ] 版本解析和比较
4. [ ] 扩展 `VersionManagerDetector`
   - [ ] 添加 conda, poetry, pipenv
5. [ ] 创建资源准备脚本 `scripts/prepare-python.ts`

**验收标准**:
- PythonManager 可以检测 Python 是否安装
- 能够检测系统 Python 版本
- 资源准备脚本可以下载 Python standalone

### 阶段 2: 安装系统 (Week 2)

**目标**: 完成 Python 的安装和升级功能

**任务**:
1. [ ] 实现 `PythonDownloader` 类
   - [ ] 下载 Python standalone
   - [ ] 下载 UV
   - [ ] 解压功能
2. [ ] 完善 `PythonManager`
   - [ ] `installFromResources()` 方法
   - [ ] `upgradeIfNeeded()` 方法
   - [ ] 用户包保留逻辑
3. [ ] 实现 `UvManager` 基础功能
   - [ ] UV 命令封装
   - [ ] 包安装/卸载
4. [ ] 准备 `resources/python/` 资源
   - [ ] darwin-x64
   - [ ] darwin-arm64
   - [ ] win32-x64

**验收标准**:
- 应用启动时能够从 resources 安装 Python
- UV 命令可用
- 升级时保留用户安装的包

### 阶段 3: 终端集成 (Week 3)

**目标**: 将 Python 环境集成到终端系统

**任务**:
1. [ ] 实现 `PythonManager.getTerminalEnv()`
   - [ ] PATH 注入
   - [ ] 环境变量设置
   - [ ] 版本管理器处理
2. [ ] 修改 `PTYManager.create()`
   - [ ] 合并 Node.js 和 Python 环境
   - [ ] PATH 优先级处理
3. [ ] 添加 Python IPC 处理器
   - [ ] `python:getInfo`
   - [ ] `python:isInstalled`
   - [ ] `python:uv:*` 系列
4. [ ] 扩展 `AppSettings`
   - [ ] 添加 Python 相关设置
   - [ ] 更新默认值

**验收标准**:
- 新建终端可以使用内置 Python
- `python --version` 显示内置版本
- `uv` 命令可用
- 设置可以切换 Python 来源

### 阶段 4: 构建和 UI (Week 4)

**目标**: 完成构建集成和用户界面

**任务**:
1. [ ] 更新 `electron-builder.yml`
   - [ ] 添加 Python extraResources
2. [ ] 更新构建脚本
   - [ ] 预构建资源准备
3. [ ] 实现设置页面 UI
   - [ ] Python 设置区块
   - [ ] 状态显示组件
   - [ ] 缓存管理
4. [ ] 更新 preload API
   - [ ] 暴露 Python IPC 方法

**验收标准**:
- 构建产物包含 Python 资源
- 设置页面可以配置 Python
- 状态显示正确

### 阶段 5: 测试和优化 (Week 5)

**目标**: 全面测试和性能优化

**任务**:
1. [ ] 编写单元测试
2. [ ] 跨平台测试
   - [ ] macOS Intel
   - [ ] macOS Apple Silicon
   - [ ] Windows 10/11
3. [ ] 性能优化
   - [ ] 启动时间
   - [ ] 内存占用
4. [ ] 文档更新
   - [ ] CLAUDE.md 更新
   - [ ] 用户手册更新
5. [ ] Bug 修复

**验收标准**:
- 所有测试通过
- 跨平台功能正常
- 无性能退化
- 文档完整

---

## 11. 风险评估与缓解

### 11.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Python standalone 兼容性问题 | 中 | 高 | 选择 `install_only` 变体，充分测试 |
| 与系统 Python 冲突 | 中 | 中 | 使用 `PYTHONNOUSERSITE`，隔离 site-packages |
| UV 版本兼容性 | 低 | 中 | 固定 UV 版本，定期更新 |
| 构建产物体积过大 | 中 | 低 | 使用 `install_only`，移除不必要文件 |
| 版本管理器冲突 | 中 | 中 | 默认清理版本管理器变量，提供保留选项 |

### 11.2 实施风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 影响现有 Node.js 功能 | 低 | 高 | 模块化设计，充分隔离，回归测试 |
| 跨平台问题 | 中 | 中 | 每阶段都进行跨平台测试 |
| 用户设置迁移问题 | 低 | 低 | 提供默认值，兼容旧配置 |

### 11.3 回滚计划

如果发现严重问题，可以快速回滚：

1. **代码回滚**: 所有更改在独立分支开发，合并前充分测试
2. **功能开关**: Python 功能可通过设置禁用
3. **资源隔离**: Python 资源独立于 Node.js，可单独移除

---

## 附录

### A. 参考链接

- [python-build-standalone](https://github.com/indygreg/python-build-standalone)
- [UV 文档](https://docs.astral.sh/uv/)
- [AiTer Node.js 封装实现](../src/main/nodejs/manager.ts)

### B. 相关文件

- `src/main/nodejs/manager.ts` - Node.js 管理器（参考实现）
- `src/main/pty.ts` - 终端管理
- `src/types/index.ts` - 类型定义
- `electron-builder.yml` - 构建配置

### C. 版本历史

| 版本 | 日期 | 作者 | 变更 |
|------|------|------|------|
| 1.0 | 2026-01-19 | Claude | 初始版本 |
