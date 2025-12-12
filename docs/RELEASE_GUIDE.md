# AiTer 发布指南

本文档说明如何通过 GitHub Actions 自动构建和发布 AiTer 应用程序。

## 🚀 发布流程

### 方法一：通过 Git Tag 触发（推荐）

这是最常用的发布方式，通过创建版本标签自动触发构建和发布：

```bash
# 1. 确保所有更改已提交
git add .
git commit -m "feat: Ready for release v0.1.1"

# 2. 创建版本标签（格式：v主版本.次版本.修订号）
git tag v0.1.1

# 3. 推送标签到 GitHub
git push origin v0.1.1

# 4. GitHub Actions 会自动：
#    - 在 macOS 和 Windows 上构建应用
#    - 创建 GitHub Release
#    - 上传所有安装包
```

### 方法二：手动触发

如果需要手动触发构建（不创建 Release）：

1. 访问 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 选择 **Build and Release** 工作流
4. 点击 **Run workflow** 按钮
5. 选择分支并点击 **Run workflow**

## 📦 构建产物

每次发布会生成以下文件：

### macOS
- `AiTer-{version}-mac-arm64.dmg` - Apple Silicon (M1/M2/M3) 安装包
- `AiTer-{version}-mac-arm64.zip` - Apple Silicon 压缩包
- `AiTer-{version}-mac-x64.dmg` - Intel 芯片安装包
- `AiTer-{version}-mac-x64.zip` - Intel 芯片压缩包

### Windows
- `AiTer-{version}-win-x64.exe` - Windows 安装程序
- `AiTer-{version}-win-x64.zip` - Windows 压缩包

## 📝 版本号规范

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)（Semantic Versioning）：

```
v主版本.次版本.修订号

例如：v0.1.0, v1.0.0, v1.2.3
```

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### 版本示例

```bash
# 首次发布
git tag v0.1.0

# 修复 Bug
git tag v0.1.1

# 新增功能（向下兼容）
git tag v0.2.0

# 重大更新（可能不兼容）
git tag v1.0.0
```

## 🔄 构建流程详解

GitHub Actions 工作流执行以下步骤：

### 构建阶段（并行）

1. **macOS 构建**
   - 检出代码
   - 安装 Node.js 20
   - 安装依赖
   - TypeScript 类型检查
   - 构建 macOS 应用（Intel + Apple Silicon）
   - 上传构建产物

2. **Windows 构建**
   - 检出代码
   - 安装 Node.js 20
   - 安装依赖
   - TypeScript 类型检查
   - 构建 Windows 应用
   - 上传构建产物

### 发布阶段（仅在打 Tag 时）

1. 下载所有构建产物
2. 提取版本号
3. 创建 GitHub Release
4. 上传所有安装包到 Release

## 📥 团队成员下载指南

### 前提条件

团队成员需要：
1. GitHub 账号
2. 对 `Within-7/aiter` 仓库的访问权限（至少 Read 权限）

### 下载步骤

1. **访问 Releases 页面**
   ```
   https://github.com/Within-7/aiter/releases
   ```

2. **选择版本**
   - 点击最新版本（通常在页面顶部）
   - 或选择特定版本

3. **下载对应平台的安装包**

   **macOS 用户：**
   - Apple Silicon (M1/M2/M3/M4)：下载 `AiTer-*-mac-arm64.dmg`
   - Intel 芯片：下载 `AiTer-*-mac-x64.dmg`

   **Windows 用户：**
   - 下载 `AiTer-*-win-x64.exe`

4. **安装应用**
   - 参考 Release 说明中的安装步骤

## 🔐 权限和安全

### 仓库权限

- **Private Repository**：只有团队成员可以访问和下载
- **Public Repository**：任何人都可以下载（当前为 private）

### GitHub Token

工作流使用 `GITHUB_TOKEN` 自动生成的令牌：
- 自动提供，无需手动配置
- 仅在工作流运行期间有效
- 具有创建 Release 所需的权限

## 🛠️ 故障排除

### 构建失败

如果构建失败，检查：

1. **类型检查失败**
   ```bash
   # 本地运行类型检查
   npm run type-check
   ```

2. **依赖问题**
   - 确保 `package.json` 和 `package-lock.json` 已提交
   - 检查 Node.js 版本要求（>=18.0.0）

3. **查看构建日志**
   - GitHub Actions 页面 → 点击失败的工作流
   - 查看详细错误信息

### Release 未创建

如果构建成功但未创建 Release：

1. **检查 Tag 格式**
   - 必须以 `v` 开头
   - 格式：`v主版本.次版本.修订号`
   - 示例：`v0.1.0`（正确），`0.1.0`（错误）

2. **检查权限**
   - 确保仓库设置允许 Actions 创建 Release
   - Settings → Actions → General → Workflow permissions

## 📊 工作流状态查看

1. 访问仓库的 **Actions** 标签
2. 查看最近的工作流运行
3. 绿色 ✓ = 成功，红色 ✗ = 失败
4. 点击查看详细日志

## 🔄 更新现有 Release

如果需要更新已发布的版本：

```bash
# 1. 删除本地标签
git tag -d v0.1.0

# 2. 删除远程标签
git push origin :refs/tags/v0.1.0

# 3. 重新创建标签
git tag v0.1.0

# 4. 推送标签
git push origin v0.1.0

# 注意：GitHub 上的旧 Release 需要手动删除
```

## 📧 联系支持

如有问题，请联系：
- **开发者**：Lib
- **邮箱**：dev@within-7.com
- **公司**：任小姐出海战略咨询

---

**版权所有 © 2025-2026 Within-7.com**
