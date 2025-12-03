# AiTer 自动更新系统使用指南

本文档说明如何使用 AiTer 的自动更新和发布系统。

## 概述

AiTer 包含完整的自动更新系统，包括：

1. **发布页面生成** - 自动生成美观的下载页面
2. **版本 API** - 提供 JSON API 供客户端查询最新版本
3. **自动检查更新** - 客户端每 6 小时自动检查一次更新
4. **更新通知** - 发现新版本时显示美观的弹窗通知

## 发布新版本流程

### 1. 更新版本号

编辑 `package.json`，修改 `version` 字段：

```json
{
  "version": "0.2.0"
}
```

### 2. 更新 CHANGELOG.md

在 `CHANGELOG.md` 中添加新版本的更新内容：

```markdown
## [0.2.0] - 2025-12-10

### Added
- 新增功能 A
- 新增功能 B

### Fixed
- 修复问题 X
- 修复问题 Y
```

### 3. 构建发布版本

根据目标平台运行相应的构建命令：

```bash
# macOS 版本
npm run build:mac

# Windows 版本
npm run build:win

# 所有平台
npm run build:all
```

构建完成后，会自动：
1. 编译应用程序
2. 打包成安装文件 (.dmg, .exe)
3. 在 `release/` 目录生成以下文件：
   - `index.html` - 下载页面
   - `latest.json` - 版本 API
   - `README.md` - 发布说明
   - 安装文件 (.dmg, .exe)

### 4. 部署到服务器

将 `release/` 目录的所有文件上传到你的服务器：

```bash
# 示例：使用 rsync 上传
rsync -avz release/ user@your-server.com:/var/www/airter/

# 或使用其他方式（FTP、SCP 等）
```

**重要**：确保 `latest.json` 可以通过 HTTPS 访问，例如：
```
https://your-server.com/airter/latest.json
```

### 5. 配置更新检查 URL

编辑 `src/main/index.ts`，设置更新检查 URL：

```typescript
const UPDATE_CHECK_URL = 'https://your-server.com/airter/latest.json'
```

或者通过环境变量配置：

```bash
export UPDATE_CHECK_URL=https://your-server.com/airter/latest.json
npm run build:mac
```

## 文件说明

### 生成的文件

#### index.html
美观的下载页面，包含：
- 版本信息展示
- 分平台下载链接（macOS arm64/x64, Windows）
- 核心特性介绍
- 更新日志

#### latest.json
版本 API，格式：
```json
{
  "version": "0.2.0",
  "releaseDate": "2025-12-10",
  "changelog": [
    "新增功能 A",
    "修复问题 X"
  ],
  "downloads": {
    "mac": {
      "arm64": {
        "url": "AiTer-0.2.0-arm64.dmg",
        "size": "120 MB",
        "sha256": "abc123..."
      },
      "x64": {
        "url": "AiTer-0.2.0-x64.dmg",
        "size": "125 MB",
        "sha256": "def456..."
      }
    },
    "win": {
      "x64": {
        "url": "AiTer-Setup-0.2.0.exe",
        "size": "110 MB",
        "sha256": "ghi789..."
      }
    }
  }
}
```

### 模板文件

#### release-template/index.html
下载页面的 HTML 模板，使用占位符：
- `{{VERSION}}` - 版本号
- `{{RELEASE_DATE}}` - 发布日期
- `{{MAC_ARM_FILE}}` - macOS ARM 文件名
- `{{MAC_ARM_SIZE}}` - 文件大小
- `{{CHANGELOG_ITEMS}}` - 更新日志列表

#### release-template/latest.json
版本 API 的 JSON 模板

## 自动更新工作原理

### 客户端检查流程

1. 应用启动后，初始化 `UpdateManager`
2. 立即检查一次更新
3. 之后每 6 小时自动检查一次
4. 发现新版本时：
   - 显示更新通知弹窗
   - 展示版本号、发布日期、更新内容
   - 提供"立即下载"和"稍后提醒"按钮

### 版本比较

使用语义化版本号比较：
- `0.1.0` < `0.2.0`
- `0.2.0` < `1.0.0`
- `1.0.0` < `1.1.0`

### 下载流程

点击"立即下载"后：
1. 根据当前平台选择对应的下载链接
2. 在默认浏览器中打开下载页面
3. 用户手动下载并安装新版本

## 自定义配置

### 修改检查间隔

编辑 `src/main/updater.ts` 中的间隔时间：

```typescript
// 当前是 6 小时
this.checkInterval = setInterval(() => {
  this.checkForUpdates(window);
}, 6 * 60 * 60 * 1000);

// 改为 24 小时
this.checkInterval = setInterval(() => {
  this.checkForUpdates(window);
}, 24 * 60 * 60 * 1000);
```

### 自定义下载页面样式

编辑 `release-template/index.html` 的 CSS 部分来修改页面样式。

### 添加更多平台

在 `scripts/generate-release.js` 中添加对其他平台的支持（Linux 等）。

## 故障排查

### 客户端无法检查更新

1. 检查 `UPDATE_CHECK_URL` 是否正确配置
2. 确保 URL 可以通过 HTTPS 访问
3. 检查控制台输出：`[UpdateManager] Checking for updates...`

### 下载页面显示异常

1. 检查 `CHANGELOG.md` 格式是否正确
2. 确保所有安装文件都在 `release/` 目录
3. 重新运行 `npm run generate-release`

### 更新通知不显示

1. 确保版本号已更新
2. 检查 `latest.json` 是否正确生成
3. 查看浏览器控制台是否有错误

## 安全注意事项

1. **HTTPS Only** - 更新检查必须使用 HTTPS，防止中间人攻击
2. **SHA256 校验** - 生成的 `latest.json` 包含文件 SHA256，可用于验证下载完整性
3. **代码签名** - 建议对 macOS 和 Windows 安装包进行代码签名

## 示例部署配置

### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name your-server.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /airter/ {
        root /var/www;
        autoindex on;

        # 允许跨域访问（如果需要）
        add_header Access-Control-Allow-Origin *;
    }
}
```

### Apache 配置

```apache
<VirtualHost *:443>
    ServerName your-server.com

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    DocumentRoot /var/www

    <Directory /var/www/airter>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted

        # 允许跨域访问（如果需要）
        Header set Access-Control-Allow-Origin "*"
    </Directory>
</VirtualHost>
```

## 最佳实践

1. **版本管理**
   - 遵循语义化版本号规范
   - 每个版本打 Git tag
   - 保持 CHANGELOG.md 更新

2. **发布流程**
   - 先在测试环境验证
   - 确保所有平台都构建成功
   - 上传前检查文件完整性

3. **用户体验**
   - 不要过于频繁地检查更新
   - 提供清晰的更新说明
   - 允许用户选择更新时间

4. **回滚策略**
   - 保留旧版本的发布文件
   - 必要时可以修改 `latest.json` 回退版本

## 支持与反馈

如有问题，请联系：
- Email: dev@within-7.com
- Website: https://within-7.com
