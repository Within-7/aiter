import React, { useState, useEffect, useCallback, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { AppContext } from '../context/AppContext'
import './UpdateNotification.css'

type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'installing' | 'error'

type UpdateMode = 'electron-updater' | 'install-script'

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
  const { t } = useTranslation('update')
  const { state, dispatch } = useContext(AppContext)
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [isBackgroundDownload, setIsBackgroundDownload] = useState(false)
  const [updateMode, setUpdateMode] = useState<UpdateMode>('electron-updater')

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
      if (data.status === 'available' || data.status === 'downloaded' || data.status === 'error' || data.status === 'installing') {
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
      } else if (result.skipDownload) {
        // install-script 模式: 跳过下载，直接显示更新按钮
        // 因为 install.sh 脚本会自己下载
        setUpdateMode('install-script')
        setStatus('downloaded')
      }
    } catch (err) {
      console.error('[UpdateNotification] Download error:', err)
      setError('Download failed')
    }
  }, [])

  const handleInstall = useCallback(async () => {
    try {
      const result = await window.api.autoUpdate.install()

      if (!result.success) {
        setError(result.error || 'Installation failed')
        return
      }

      if (result.mode === 'install-script' && result.command) {
        // install-script 模式：在终端中运行更新命令
        // 关闭更新通知和 About 弹窗
        setIsVisible(false)
        dispatch({ type: 'SET_ABOUT_PANEL', payload: false })

        // 获取用户主目录作为工作目录（不依赖项目）
        const homePath = await window.api.app.getPath('home')

        // 创建新终端来执行更新命令
        // terminal.create 签名: (cwd, projectId, projectName, shell?, skipStartupCommand?)
        // 使用特殊的 'system' projectId，并跳过启动命令（如 minto）
        const terminalResult = await window.api.terminal.create(
          homePath || '/',                        // cwd: 用户主目录
          'system',                               // projectId: 系统级终端
          'AiTer Update',                         // projectName: 显示名称
          state.settings?.shell,                  // shell (可选)
          true                                    // skipStartupCommand: 跳过启动命令
        )

        if (terminalResult.success && terminalResult.terminal) {
          // 添加终端到状态
          dispatch({ type: 'ADD_TERMINAL', payload: terminalResult.terminal })

          // 等待终端初始化后发送命令
          setTimeout(() => {
            window.api.terminal.write(terminalResult.terminal!.id, result.command + '\r')
          }, 500)
        }
      }
      // electron-updater 模式会自动退出并安装，不需要额外处理
    } catch (err) {
      console.error('[UpdateNotification] Install error:', err)
      setError('Installation failed')
    }
  }, [state.settings?.shell, dispatch])

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

  if (!isVisible) {
    return null
  }

  return (
    <div className="update-notification-overlay" onClick={handleOverlayClick}>
      <div className="update-notification">
        <button className="update-close-button" onClick={handleClose}>×</button>

        <div className="update-header">
          <div className="update-icon">
            {status === 'error' ? '❌' : status === 'downloaded' ? '✅' : status === 'installing' ? '⏳' : '🎉'}
          </div>
          <h2>
            {status === 'available' && t('status.available')}
            {status === 'downloading' && t('status.downloading')}
            {status === 'downloaded' && t('status.ready')}
            {status === 'installing' && t('status.installing')}
            {status === 'error' && t('status.failed')}
          </h2>
        </div>

        {status === 'error' ? (
          <div className="update-error">
            <p>{error || t('messages.unknownError')}</p>
            <button className="update-button dismiss" onClick={handleDismiss}>
              {t('actions.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="update-version-info">
              <div className="version-badge current">
                {t('version.current')} {currentVersion}
              </div>
              <div className="version-arrow">→</div>
              <div className="version-badge latest">
                {t('version.latest')} {updateInfo?.version || t('version.unknown')}
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
                    {t('actions.downloadNow')}
                  </button>
                  <button className="update-button dismiss" onClick={handleDismiss}>
                    {t('actions.remindLater')}
                  </button>
                </>
              )}

              {status === 'downloading' && (
                <button className="update-button dismiss" onClick={handleBackgroundDownload}>
                  {t('actions.backgroundDownload')}
                </button>
              )}

              {status === 'downloaded' && (
                <>
                  <button
                    className="update-button install"
                    onClick={handleInstall}
                  >
                    {updateMode === 'install-script'
                      ? t('actions.updateNow')
                      : t('actions.installRestart')}
                  </button>
                  <button className="update-button dismiss" onClick={handleDismiss}>
                    {t('actions.installLater')}
                  </button>
                </>
              )}

              {status === 'installing' && (
                <div className="update-installing">
                  <div className="installing-spinner"></div>
                  <p>{t('messages.installing')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
