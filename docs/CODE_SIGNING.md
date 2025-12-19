# 代码签名配置指南

本文档介绍如何为 AiTer 配置 macOS 和 Windows 的代码签名，以支持自动更新功能。

## 目录

1. [为什么需要代码签名](#为什么需要代码签名)
2. [macOS 签名配置](#macos-签名配置)
3. [Windows 签名配置](#windows-签名配置)
4. [GitHub Actions 配置](#github-actions-配置)
5. [本地构建](#本地构建)

---

## 为什么需要代码签名

### macOS
- **Gatekeeper**: macOS 10.15+ 要求应用必须经过公证才能运行
- **自动更新**: electron-updater 要求应用必须签名才能进行无缝更新
- **用户信任**: 签名的应用不会显示"无法验证开发者"警告

### Windows
- **SmartScreen**: 未签名的应用会触发 Windows Defender SmartScreen 警告
- **企业部署**: 企业环境可能需要签名的应用
- **用户信任**: 减少安装时的安全警告

---

## macOS 签名配置

### 1. 获取开发者证书

需要加入 [Apple Developer Program](https://developer.apple.com/programs/) (每年 $99)。

1. 登录 [Apple Developer](https://developer.apple.com/account)
2. 进入 "Certificates, Identifiers & Profiles"
3. 创建 "Developer ID Application" 证书
4. 下载证书并双击安装到 Keychain

### 2. 创建 App 专用密码

用于公证服务的认证：

1. 访问 [appleid.apple.com](https://appleid.apple.com)
2. 登录你的 Apple ID
3. 进入 "Sign-In and Security" → "App-Specific Passwords"
4. 生成新的应用专用密码
5. 保存密码（只显示一次）

### 3. 环境变量配置

#### 方式 A: 使用 Keychain (推荐本地开发)

```bash
# 证书会自动从 Keychain 中查找
# 如果有多个证书，可以指定名称
export CSC_NAME="Developer ID Application: Your Name (XXXXXXXXXX)"
```

#### 方式 B: 使用 .p12 文件 (CI/CD)

```bash
# 证书文件（base64 编码）
export CSC_LINK="base64_encoded_p12_content"
# 或文件路径
export CSC_LINK="/path/to/certificate.p12"

# 证书密码
export CSC_KEY_PASSWORD="your_certificate_password"
```

#### 公证配置

```bash
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"  # 10位团队 ID
```

### 4. 查找 Team ID

Team ID 可以在以下位置找到：
- [Apple Developer 成员详情](https://developer.apple.com/account/#/membership)
- 证书的 Common Name 中的括号部分，如 `Developer ID Application: John Doe (ABC123XYZ)`

---

## Windows 签名配置

### 1. 获取代码签名证书

Windows 代码签名证书可从以下 CA 购买：

- [DigiCert](https://www.digicert.com/signing/code-signing-certificates)
- [Sectigo (原 Comodo)](https://sectigo.com/ssl-certificates-tls/code-signing)
- [GlobalSign](https://www.globalsign.com/en/code-signing-certificate)
- [SSL.com](https://www.ssl.com/certificates/ev-code-signing/)

**证书类型**：
- **标准代码签名证书**: ~$200-400/年，需要建立信任
- **EV 代码签名证书**: ~$400-600/年，立即获得 SmartScreen 信任

### 2. 导出 .pfx 证书

将证书导出为 .pfx (PKCS#12) 格式：

```powershell
# Windows 中导出
# 1. 打开 certmgr.msc
# 2. 找到你的代码签名证书
# 3. 右键 → 所有任务 → 导出
# 4. 选择"是，导出私钥"
# 5. 选择 PKCS #12 格式
# 6. 设置密码并保存
```

### 3. 环境变量配置

```bash
# 证书文件（base64 编码）
export WIN_CSC_LINK="base64_encoded_pfx_content"
# 或文件路径
export WIN_CSC_LINK="/path/to/certificate.pfx"

# 证书密码
export WIN_CSC_KEY_PASSWORD="your_certificate_password"
```

### 4. 时间戳服务器

`electron-builder.yml` 中已配置 DigiCert 时间戳服务器：

```yaml
win:
  timeStampServer: http://timestamp.digicert.com
```

其他可用的时间戳服务器：
- Sectigo: `http://timestamp.sectigo.com`
- GlobalSign: `http://timestamp.globalsign.com/scripts/timstamp.dll`

---

## GitHub Actions 配置

### 1. 添加 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

#### macOS Secrets
- `CSC_LINK`: base64 编码的 .p12 证书
- `CSC_KEY_PASSWORD`: 证书密码
- `APPLE_ID`: Apple ID 邮箱
- `APPLE_APP_SPECIFIC_PASSWORD`: App 专用密码
- `APPLE_TEAM_ID`: 团队 ID

#### Windows Secrets
- `WIN_CSC_LINK`: base64 编码的 .pfx 证书
- `WIN_CSC_KEY_PASSWORD`: 证书密码

#### GitHub Token
- `GH_TOKEN`: GitHub Personal Access Token（用于发布 Release）

### 2. Base64 编码证书

```bash
# macOS
base64 -i certificate.p12 | tr -d '\n' > certificate_base64.txt

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) > certificate_base64.txt
```

### 3. GitHub Actions 工作流示例

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build and Release (macOS)
        if: matrix.os == 'macos-latest'
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: npm run build:mac -- --publish always

      - name: Build and Release (Windows)
        if: matrix.os == 'windows-latest'
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: npm run build:win -- --publish always
```

---

## 本地构建

### 无签名构建（开发/测试）

```bash
# 跳过签名
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build
```

### 有签名构建

```bash
# macOS - 使用 Keychain 中的证书
npm run build:mac

# Windows - 需要设置环境变量
export WIN_CSC_LINK="/path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="password"
npm run build:win
```

---

## 故障排除

### macOS 公证失败

1. **检查 entitlements**: 确保 `build/entitlements.mac.plist` 存在且正确
2. **Hardened Runtime**: 确保启用了 `hardenedRuntime: true`
3. **检查日志**: 公证失败时会有详细的错误日志

### Windows SmartScreen 警告

1. **使用 EV 证书**: EV 证书可以立即获得 SmartScreen 信任
2. **建立信任**: 标准证书需要一定的下载量才能建立信任
3. **时间戳**: 确保使用了时间戳服务器

### 证书过期

- 证书过期后，已签名的应用仍可使用（如果使用了时间戳）
- 需要在过期前更新证书并重新发布

---

## 参考链接

- [electron-builder 代码签名文档](https://www.electron.build/code-signing)
- [Apple 公证服务](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Electron 自动更新指南](https://www.electronjs.org/docs/latest/tutorial/updates)
