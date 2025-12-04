# CLI Tools Isolation in AiTer

## 概述

AiTer 通过环境变量配置实现了完整的 Node.js 和 npm 环境隔离。这意味着你可以在 AiTer 中安装和使用与系统不同版本的 CLI 工具，而不会相互干扰。

## 工作原理

### 1. PATH 优先级

AiTer 在创建终端时会修改 `PATH` 环境变量：

```bash
PATH=/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/bin:$SYSTEM_PATH
```

这确保 shell 首先搜索 AiTer 的 Node.js bin 目录，然后才搜索系统路径。

### 2. npm 全局安装配置

AiTer 设置了两个关键的 npm 环境变量：

```bash
npm_config_prefix=/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64
npm_config_cache=/Users/xxx/Library/Application Support/AiTer/nodejs/.npm-cache
```

**效果**：
- `npm install -g some-tool` 会安装到 AiTer 的 bin 目录
- npm 缓存隔离，不污染系统 npm 缓存

### 3. CLI 工具查找顺序

当你在 AiTer 终端中运行一个命令时，shell 会按照 PATH 的顺序查找：

1. **AiTer 的 bin 目录** (`~/Library/Application Support/AiTer/nodejs/darwin-arm64/bin`)
   - AiTer 内置的 Node.js、npm、npx
   - 通过 `npm install -g` 在 AiTer 中安装的 CLI 工具

2. **系统路径** (`/usr/local/bin`, `/usr/bin`, 等)
   - 系统安装的 Node.js 和 CLI 工具

## 使用示例

### 场景：同时使用不同版本的 TypeScript

**系统环境（macOS 终端）**：
```bash
$ which tsc
/usr/local/bin/tsc

$ tsc --version
Version 4.9.5
```

**AiTer 终端**：
```bash
# 在 AiTer 中安装最新版本
$ npm install -g typescript

# 验证安装位置
$ which tsc
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/bin/tsc

# 验证版本
$ tsc --version
Version 5.3.3
```

**结果**：
- ✅ AiTer 终端使用 TypeScript 5.3.3
- ✅ 系统终端仍然使用 TypeScript 4.9.5
- ✅ 两个环境互不干扰

### 场景：安装专用于项目的 CLI 工具

**示例：为某个项目安装特定版本的 ESLint**

```bash
# 在 AiTer 终端中
$ npm install -g eslint@8.50.0

# 验证
$ eslint --version
v8.50.0

$ which eslint
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/bin/eslint
```

这个版本只在 AiTer 中可用，不会影响系统或其他项目的 ESLint 版本。

## 验证环境隔离

### 在 AiTer 终端中验证

```bash
# 1. 查看 Node.js 版本和位置
$ node --version
v20.18.0

$ which node
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/bin/node

# 2. 查看 npm 配置
$ npm config get prefix
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64

$ npm config get cache
/Users/xxx/Library/Application Support/AiTer/nodejs/.npm-cache

# 3. 查看 PATH（AiTer 路径应该在最前面）
$ echo $PATH
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/bin:/usr/local/bin:/usr/bin:...

# 4. 列出全局安装的包
$ npm list -g --depth=0
/Users/xxx/Library/Application Support/AiTer/nodejs/darwin-arm64/lib
└── (your globally installed packages)
```

### 在系统终端中验证

```bash
# 打开 macOS 自带的 Terminal.app

# 查看 Node.js（应该是系统版本）
$ node --version
v18.19.0  # 或者你系统安装的版本

$ which node
/usr/local/bin/node  # 或其他系统路径

# 查看 npm 配置（应该是系统配置）
$ npm config get prefix
/usr/local

# PATH 中没有 AiTer 路径
$ echo $PATH
/usr/local/bin:/usr/bin:/bin:...
```

## 常见问题

### Q1: 如果我在 AiTer 中全局安装了一个 CLI 工具，它在系统终端可用吗？

**答**: 不可用。AiTer 中通过 `npm install -g` 安装的工具只在 AiTer 终端中可用。

### Q2: 如果系统和 AiTer 中都安装了同一个 CLI 工具，会冲突吗？

**答**: 不会冲突。两者完全隔离：
- 在 AiTer 终端中使用 AiTer 安装的版本
- 在系统终端中使用系统安装的版本

### Q3: 我可以在不同的 AiTer 项目中使用不同版本的 CLI 工具吗？

**答**: 当前版本的 AiTer 所有项目共享同一个 Node.js 环境。如果你需要为不同项目使用不同版本的工具，建议：
- 使用项目本地安装（`npm install` 不带 `-g`）
- 使用 `npx` 运行特定版本的工具
- 未来版本可能支持项目级别的 Node.js 版本管理

### Q4: 如何卸载 AiTer 中安装的全局包？

```bash
# 在 AiTer 终端中
$ npm uninstall -g package-name
```

### Q5: AiTer 的 npm 缓存在哪里？

```bash
/Users/xxx/Library/Application Support/AiTer/nodejs/.npm-cache
```

如果需要清理缓存：
```bash
$ npm cache clean --force
```

## 技术实现细节

### 环境变量注入（src/main/nodejs/manager.ts）

```typescript
getTerminalEnv(): NodeJS.ProcessEnv {
  const binPath = this.getNodeBinPath();
  const rootPath = this.getNodeRootPath();

  return {
    ...process.env,
    // 1. 将 AiTer Node.js bin 放在 PATH 最前面
    PATH: `${binPath}:${process.env.PATH}`,

    // 2. 设置 Node.js 模块查找路径
    NODE_PATH: path.join(binPath, '../lib/node_modules'),

    // 3. 配置 npm 全局安装目录
    npm_config_prefix: rootPath,

    // 4. 隔离 npm 缓存
    npm_config_cache: path.join(this.nodejsDir, '.npm-cache'),
  };
}
```

### PTY 进程创建（src/main/pty.ts）

```typescript
create(projectId: string, cwd: string, cols: number, rows: number) {
  // 获取包含 Node.js 配置的环境变量
  const nodeEnv = this.nodeManager.getTerminalEnv();

  // 创建带有自定义环境的终端进程
  const ptyProcess = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols, rows, cwd,
    env: nodeEnv,  // 使用包含 Node.js 配置的环境
  });
}
```

## 目录结构

```
~/Library/Application Support/AiTer/
└── nodejs/
    ├── darwin-arm64/           # macOS Apple Silicon
    │   ├── bin/
    │   │   ├── node            # Node.js 可执行文件
    │   │   ├── npm             # npm 命令行工具
    │   │   ├── npx             # npx 命令行工具
    │   │   └── [CLI tools]     # npm install -g 安装的工具
    │   └── lib/
    │       └── node_modules/   # 全局 npm 包
    └── .npm-cache/             # npm 缓存目录
```

## 优势总结

1. **完全隔离**: AiTer 和系统环境互不影响
2. **版本自由**: 可以使用不同版本的 CLI 工具
3. **零污染**: 不修改系统 Node.js 和全局包
4. **易于管理**: 卸载 AiTer 即可清理所有相关文件
5. **一致性**: 所有用户使用相同的 Node.js v20.18.0
6. **开箱即用**: 无需用户配置或安装 Node.js

## 进阶用法

### 使用 npx 运行特定版本的工具

```bash
# 不安装，直接运行特定版本
$ npx create-react-app@latest my-app

# 使用最新版本的 TypeScript 编译
$ npx typescript@latest tsc --noEmit
```

### 查看已安装的全局包

```bash
# 列出所有全局包
$ npm list -g --depth=0

# 查看特定包的信息
$ npm info eslint

# 查看包的安装位置
$ npm root -g
```

### 更新全局包

```bash
# 更新特定包
$ npm update -g typescript

# 更新所有全局包
$ npm update -g
```
