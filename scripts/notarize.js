/**
 * macOS 公证脚本
 *
 * 此脚本在 electron-builder 签名完成后运行，将应用提交到 Apple 进行公证。
 * 公证是 macOS 10.15+ 要求的安全措施，确保应用来自已知开发者且未被篡改。
 *
 * 环境变量要求:
 * - APPLE_ID: Apple ID 邮箱
 * - APPLE_APP_SPECIFIC_PASSWORD: App 专用密码 (从 https://appleid.apple.com 生成)
 * - APPLE_TEAM_ID: Apple Developer Team ID (10位字符)
 *
 * 如果未设置环境变量，脚本将跳过公证（用于本地开发）
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // 只在 macOS 上运行
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization: not macOS');
    return;
  }

  // 检查环境变量
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: missing environment variables');
    console.log('Required: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);
  console.log('This may take several minutes...');

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });

    console.log('Notarization completed successfully!');
  } catch (error) {
    console.error('Notarization failed:', error);
    // 不抛出错误，允许构建继续（本地开发时）
    // 如果需要强制公证，取消下面的注释
    // throw error;
  }
};
