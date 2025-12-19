import React, { useState, useEffect, useCallback } from 'react'
import './UpdateNotification.css'

type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

interface UpdateInfo {
  version?: string
  releaseDate?: string
  releaseNotes?: string | null
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

interface UpdateEventData {
  status: UpdateStatus
  info?: UpdateInfo
  progress?: DownloadProgress
  error?: string
}

export const UpdateNotification: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [isBackgroundDownload, setIsBackgroundDownload] = useState(false)

  // Get current version on mount
  useEffect(() => {
    window.api.autoUpdate.getVersion().then(result => {
      if (result.success && result.version) {
        setCurrentVersion(result.version)
      }
    })
  }, [])

  // Listen for update events
  useEffect(() => {
    const unsubscribe = window.api.autoUpdate.onStatus((data: UpdateEventData) => {
      console.log('[UpdateNotification] Status update:', data)

      setStatus(data.status)

      if (data.info) {
        setUpdateInfo(data.info)
      }

      if (data.progress) {
        setProgress(data.progress)
      }

      if (data.error) {
        setError(data.error)
      }

      // Show notification for these statuses (except when background downloading)
      if (data.status === 'available' || data.status === 'downloaded' || data.status === 'error') {
        setIsVisible(true)
      } else if (data.status === 'downloading' && !isBackgroundDownload) {
        setIsVisible(true)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isBackgroundDownload])

  const handleDownload = useCallback(async () => {
    try {
      const result = await window.api.autoUpdate.download()
      if (!result.success) {
        setError(result.error || 'Download failed')
      }
    } catch (err) {
      console.error('[UpdateNotification] Download error:', err)
      setError('Download failed')
    }
  }, [])

  const handleInstall = useCallback(async () => {
    try {
      await window.api.autoUpdate.install()
    } catch (err) {
      console.error('[UpdateNotification] Install error:', err)
      setError('Installation failed')
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
  }

  const handleBackgroundDownload = () => {
    setIsBackgroundDownload(true)
    setIsVisible(false)
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Format speed
  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }

  // Parse release notes into array
  const parseReleaseNotes = (notes: string | null | undefined): string[] => {
    if (!notes) return []
    return notes.split('\n').filter(line => line.trim())
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="update-notification-overlay" onClick={handleOverlayClick}>
      <div className="update-notification">
        <button className="update-close-button" onClick={handleClose}>×</button>

        <div className="update-header">
          <div className="update-icon">
            {status === 'error' ? '❌' : status === 'downloaded' ? '✅' : '🎉'}
          </div>
          <h2>
            {status === 'available' && '发现新版本'}
            {status === 'downloading' && '正在下载更新'}
            {status === 'downloaded' && '更新已就绪'}
            {status === 'error' && '更新失败'}
          </h2>
        </div>

        {status === 'error' ? (
          <div className="update-error">
            <p>{error || '未知错误'}</p>
            <button className="update-button dismiss" onClick={handleDismiss}>
              关闭
            </button>
          </div>
        ) : (
          <>
            <div className="update-version-info">
              <div className="version-badge current">
                当前版本: {currentVersion}
              </div>
              <div className="version-arrow">→</div>
              <div className="version-badge latest">
                最新版本: {updateInfo?.version || '未知'}
              </div>
            </div>

            {status === 'downloading' && progress && (
              <div className="update-progress">
                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span className="progress-percent">{progress.percent.toFixed(1)}%</span>
                  <span className="progress-size">
                    {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                  </span>
                  <span className="progress-speed">{formatSpeed(progress.bytesPerSecond)}</span>
                </div>
              </div>
            )}

            <div className="update-actions">
              {status === 'available' && (
                <>
                  <button
                    className="update-button download"
                    onClick={handleDownload}
                  >
                    立即下载
                  </button>
                  <button className="update-button dismiss" onClick={handleDismiss}>
                    稍后提醒
                  </button>
                </>
              )}

              {status === 'downloading' && (
                <button className="update-button dismiss" onClick={handleBackgroundDownload}>
                  后台下载
                </button>
              )}

              {status === 'downloaded' && (
                <>
                  <button
                    className="update-button install"
                    onClick={handleInstall}
                  >
                    立即安装并重启
                  </button>
                  <button className="update-button dismiss" onClick={handleDismiss}>
                    稍后安装
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
