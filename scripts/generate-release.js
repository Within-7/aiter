#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 读取 package.json 获取版本号
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
);

const VERSION = packageJson.version;
const RELEASE_DATE = new Date().toISOString().split('T')[0];

// 发布目录
const RELEASE_DIR = path.join(__dirname, '../release');
const TEMPLATE_DIR = path.join(__dirname, '../release-template');

// 确保 release 目录存在
if (!fs.existsSync(RELEASE_DIR)) {
  console.error('Error: release directory not found. Please run build first.');
  process.exit(1);
}

// 计算文件 SHA256
function calculateSHA256(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// 获取文件信息
function getFileInfo(fileName) {
  const filePath = path.join(RELEASE_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${fileName} not found`);
    return { exists: false, size: '0 B', sha256: '' };
  }
  const stats = fs.statSync(filePath);
  return {
    exists: true,
    size: formatFileSize(stats.size),
    sha256: calculateSHA256(filePath),
  };
}

// 查找发布文件
function findReleaseFiles() {
  const files = fs.readdirSync(RELEASE_DIR);

  // macOS arm64 (Apple Silicon)
  let macArmFile = files.find(f =>
    f.includes('arm64') && f.endsWith('.dmg')
  ) || `AiTer-${VERSION}-arm64.dmg`;

  // macOS x64 (Intel)
  let macIntelFile = files.find(f =>
    f.includes('x64') && f.endsWith('.dmg') && !f.includes('arm64')
  ) || `AiTer-${VERSION}-x64.dmg`;

  // Windows
  let winFile = files.find(f =>
    f.endsWith('.exe')
  ) || `AiTer-Setup-${VERSION}.exe`;

  return { macArmFile, macIntelFile, winFile };
}

// 读取 CHANGELOG.md 提取最新版本的更新内容
function extractChangelog() {
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.warn('Warning: CHANGELOG.md not found, using default changelog');
    return {
      items: [
        '修复已知问题',
        '性能优化',
        '提升用户体验'
      ]
    };
  }

  const content = fs.readFileSync(changelogPath, 'utf-8');
  const lines = content.split('\n');

  const items = [];
  let inCurrentVersion = false;

  for (const line of lines) {
    // 检测版本标题
    if (line.startsWith('## ') && line.includes(VERSION)) {
      inCurrentVersion = true;
      continue;
    }

    // 遇到下一个版本标题则停止
    if (inCurrentVersion && line.startsWith('## ')) {
      break;
    }

    // 提取列表项
    if (inCurrentVersion && line.trim().startsWith('-')) {
      const item = line.trim().substring(1).trim();
      if (item) {
        items.push(item);
      }
    }
  }

  // 如果没有找到对应版本的更新日志，使用默认内容
  if (items.length === 0) {
    return {
      items: [
        '新版本发布',
        '性能优化',
        '用户体验提升'
      ]
    };
  }

  return { items };
}

// 生成文件
function generateReleaseFiles() {
  const { macArmFile, macIntelFile, winFile } = findReleaseFiles();

  const macArmInfo = getFileInfo(macArmFile);
  const macIntelInfo = getFileInfo(macIntelFile);
  const winInfo = getFileInfo(winFile);

  const changelog = extractChangelog();

  // 生成 HTML 页面
  let htmlTemplate = fs.readFileSync(
    path.join(TEMPLATE_DIR, 'index.html'),
    'utf-8'
  );

  // 生成 changelog HTML 列表
  const changelogHTML = changelog.items.map(item => `<li>${item}</li>`).join('\n            ');

  htmlTemplate = htmlTemplate
    .replace(/{{VERSION}}/g, VERSION)
    .replace(/{{RELEASE_DATE}}/g, RELEASE_DATE)
    .replace(/{{MAC_ARM_FILE}}/g, macArmFile)
    .replace(/{{MAC_ARM_SIZE}}/g, macArmInfo.size)
    .replace(/{{MAC_INTEL_FILE}}/g, macIntelFile)
    .replace(/{{MAC_INTEL_SIZE}}/g, macIntelInfo.size)
    .replace(/{{WIN_FILE}}/g, winFile)
    .replace(/{{WIN_SIZE}}/g, winInfo.size)
    .replace(/{{CHANGELOG_ITEMS}}/g, changelogHTML);

  fs.writeFileSync(path.join(RELEASE_DIR, 'index.html'), htmlTemplate);
  console.log('✓ Generated index.html');

  // 生成 JSON API
  let jsonTemplate = fs.readFileSync(
    path.join(TEMPLATE_DIR, 'latest.json'),
    'utf-8'
  );

  // 生成 changelog JSON 数组
  const changelogJSON = changelog.items.map(item => `"${item}"`).join(',\n    ');

  jsonTemplate = jsonTemplate
    .replace(/{{VERSION}}/g, VERSION)
    .replace(/{{RELEASE_DATE}}/g, RELEASE_DATE)
    .replace(/{{MAC_ARM_FILE}}/g, macArmFile)
    .replace(/{{MAC_ARM_SIZE}}/g, macArmInfo.size)
    .replace(/{{MAC_ARM_SHA256}}/g, macArmInfo.sha256)
    .replace(/{{MAC_INTEL_FILE}}/g, macIntelFile)
    .replace(/{{MAC_INTEL_SIZE}}/g, macIntelInfo.size)
    .replace(/{{MAC_INTEL_SHA256}}/g, macIntelInfo.sha256)
    .replace(/{{WIN_FILE}}/g, winFile)
    .replace(/{{WIN_SIZE}}/g, winInfo.size)
    .replace(/{{WIN_SHA256}}/g, winInfo.sha256)
    .replace(/{{CHANGELOG_JSON}}/g, changelogJSON);

  fs.writeFileSync(path.join(RELEASE_DIR, 'latest.json'), jsonTemplate);
  console.log('✓ Generated latest.json');

  // 生成 README
  const readmeContent = `# AiTer ${VERSION} Release

Release Date: ${RELEASE_DATE}

## Downloads

- macOS (Apple Silicon): [${macArmFile}](./${macArmFile}) (${macArmInfo.size})
- macOS (Intel): [${macIntelFile}](./${macIntelFile}) (${macIntelInfo.size})
- Windows: [${winFile}](./${winFile}) (${winInfo.size})

## Changelog

${changelog.items.map(item => `- ${item}`).join('\n')}

## Installation

### macOS
1. Download the appropriate DMG file for your Mac (Apple Silicon or Intel)
2. Open the DMG file
3. Drag AiTer to Applications folder
4. Launch AiTer from Applications

### Windows
1. Download the EXE installer
2. Run the installer
3. Follow the installation wizard
4. Launch AiTer from Start Menu

## Update Server

This release includes:
- \`index.html\`: Download page for users
- \`latest.json\`: API endpoint for auto-update checking

You can host these files on any static file server.

---

Copyright © 2025-2026 Within-7.com - 任小姐出海战略咨询
`;

  fs.writeFileSync(path.join(RELEASE_DIR, 'README.md'), readmeContent);
  console.log('✓ Generated README.md');

  console.log('\n✅ Release files generated successfully!');
  console.log(`\nVersion: ${VERSION}`);
  console.log(`Release Date: ${RELEASE_DATE}`);
  console.log('\nFiles in release directory:');
  console.log(`  - index.html (download page)`);
  console.log(`  - latest.json (version API)`);
  console.log(`  - README.md (release notes)`);
  if (macArmInfo.exists) console.log(`  - ${macArmFile} (${macArmInfo.size})`);
  if (macIntelInfo.exists) console.log(`  - ${macIntelFile} (${macIntelInfo.size})`);
  if (winInfo.exists) console.log(`  - ${winFile} (${winInfo.size})`);
}

// 运行
try {
  generateReleaseFiles();
} catch (error) {
  console.error('Error generating release files:', error);
  process.exit(1);
}
