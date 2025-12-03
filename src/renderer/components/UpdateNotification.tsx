import React, { useState, useEffect } from 'react';
import './UpdateNotification.css';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  changelog: string[];
  releaseDate: string;
}

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // 监听更新可用事件
    const unsubscribe = window.api.update.onAvailable((data) => {
      console.log('[UpdateNotification] Update available:', data);
      setUpdateInfo(data);
      setIsVisible(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDownload = async () => {
    if (!updateInfo) return;

    setIsDownloading(true);
    try {
      const result = await window.api.update.download();
      if (result.success) {
        console.log('[UpdateNotification] Download started successfully');
        // 下载成功后可以选择关闭通知
        // setIsVisible(false);
      } else {
        console.error('[UpdateNotification] Download failed:', result.error);
        alert('下载更新失败: ' + result.error);
      }
    } catch (error) {
      console.error('[UpdateNotification] Download error:', error);
      alert('下载更新时出错');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className="update-notification-overlay">
      <div className="update-notification">
        <button className="update-close-button" onClick={handleClose}>×</button>

        <div className="update-header">
          <div className="update-icon">🎉</div>
          <h2>发现新版本</h2>
        </div>

        <div className="update-version-info">
          <div className="version-badge current">
            当前版本: {updateInfo.currentVersion}
          </div>
          <div className="version-arrow">→</div>
          <div className="version-badge latest">
            最新版本: {updateInfo.latestVersion}
          </div>
        </div>

        <div className="update-release-date">
          发布日期: {updateInfo.releaseDate}
        </div>

        <div className="update-changelog">
          <h3>更新内容</h3>
          <ul>
            {updateInfo.changelog.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="update-actions">
          <button
            className="update-button download"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? '正在打开下载页面...' : '立即下载'}
          </button>
          <button className="update-button dismiss" onClick={handleDismiss}>
            稍后提醒
          </button>
        </div>
      </div>
    </div>
  );
};
