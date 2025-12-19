import React, { useState, useEffect, useContext } from 'react'
import { AppContext } from '../../context/AppContext'
import './AboutPanel.css'

interface VersionInfo {
  current: string
  latest: string | null
  isChecking: boolean
  lastCheckTime: Date | null
  updateAvailable: boolean
  error: string | null
}

export const AboutPanel: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const isOpen = state.showAboutPanel

  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: '0.1.0', // Will be loaded from package.json
    latest: null,
    isChecking: false,
    lastCheckTime: null,
    updateAvailable: false,
    error: null
  })

  // Get current version from autoUpdate API
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const result = await window.api.autoUpdate.getVersion()
        if (result.success && result.version) {
          setVersionInfo(prev => ({ ...prev, current: result.version }))
        }
      } catch (error) {
        console.error('Failed to load version:', error)
      }
    }
    loadVersion()
  }, [])

  // Listen for auto-update status events
  useEffect(() => {
    const unsubscribe = window.api.autoUpdate.onStatus((data) => {
      if (data.status === 'available' && data.info?.version) {
        setVersionInfo(prev => ({
          ...prev,
          latest: data.info?.version || null,
          isChecking: false,
          lastCheckTime: new Date(),
          updateAvailable: true,
          error: null
        }))
      } else if (data.status === 'not-available') {
        setVersionInfo(prev => ({
          ...prev,
          isChecking: false,
          lastCheckTime: new Date(),
          updateAvailable: false,
          error: null
        }))
      } else if (data.status === 'error') {
        setVersionInfo(prev => ({
          ...prev,
          isChecking: false,
          lastCheckTime: new Date(),
          error: data.error || '检查更新失败'
        }))
      }
    })

    return () => unsubscribe()
  }, [])

  const handleClose = () => {
    dispatch({ type: 'SET_ABOUT_PANEL', payload: false })
  }

  const handleCheckUpdate = async () => {
    setVersionInfo(prev => ({ ...prev, isChecking: true, error: null }))

    try {
      // Trigger update check - results come via onStatus callback
      const result = await window.api.autoUpdate.check()

      if (!result.success) {
        setVersionInfo(prev => ({
          ...prev,
          isChecking: false,
          lastCheckTime: new Date(),
          error: result.error || '检查更新失败'
        }))
      } else {
        // Update check started, wait for status events
        // Set a timeout to clear "isChecking" if no response
        setTimeout(() => {
          setVersionInfo(prev => {
            if (prev.isChecking) {
              return {
                ...prev,
                isChecking: false,
                lastCheckTime: new Date()
              }
            }
            return prev
          })
        }, 10000)
      }
    } catch (error) {
      setVersionInfo(prev => ({
        ...prev,
        isChecking: false,
        lastCheckTime: new Date(),
        error: '网络连接失败'
      }))
    }
  }

  const handleOpenDownloadPage = () => {
    window.api.update.download()
  }

  const handleOpenWebsite = () => {
    if (window.api && window.api.shell) {
      window.api.shell.openExternal('http://aiter.within-7.com')
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="about-panel-overlay" onClick={handleOverlayClick}>
      <div className="about-panel">
        <button className="about-close-button" onClick={handleClose}>×</button>

        <div className="about-header">
          <div className="about-logo">
            <span className="about-logo-text">AiTer</span>
          </div>
          <h2 className="about-title">AI Terminal Client</h2>
          <p className="about-subtitle">AI CLI 工具协作终端</p>
        </div>

        <div className="about-content">
          {/* Version Section */}
          <section className="about-section">
            <h3>版本信息</h3>
            <div className="version-display">
              <div className="version-item">
                <span className="version-label">当前版本:</span>
                <span className="version-value current">{versionInfo.current}</span>
              </div>
              {versionInfo.latest && (
                <div className="version-item">
                  <span className="version-label">最新版本:</span>
                  <span className={`version-value ${versionInfo.updateAvailable ? 'latest-new' : 'latest-same'}`}>
                    {versionInfo.latest}
                    {versionInfo.updateAvailable && (
                      <span className="update-badge">有更新</span>
                    )}
                  </span>
                </div>
              )}
              {versionInfo.lastCheckTime && (
                <div className="version-check-time">
                  上次检查: {versionInfo.lastCheckTime.toLocaleString('zh-CN')}
                </div>
              )}
              {versionInfo.error && (
                <div className="version-error">{versionInfo.error}</div>
              )}
            </div>

            <div className="version-actions">
              <button
                className="about-button primary"
                onClick={handleCheckUpdate}
                disabled={versionInfo.isChecking}
              >
                {versionInfo.isChecking ? '检查中...' : '检查更新'}
              </button>
              {versionInfo.updateAvailable && (
                <button
                  className="about-button success"
                  onClick={handleOpenDownloadPage}
                >
                  下载更新
                </button>
              )}
            </div>
          </section>

          {/* Features Section */}
          <section className="about-section">
            <h3>主要功能</h3>
            <ul className="feature-list">
              <li>多项目管理</li>
              <li>多终端标签支持</li>
              <li>HTML 文件实时预览</li>
              <li>Monaco 代码编辑器</li>
              <li>Markdown 预览</li>
              <li>插件系统（Minto CLI 等）</li>
              <li>自动检查更新</li>
              <li>跨平台支持</li>
            </ul>
          </section>

          {/* Links Section */}
          <section className="about-section">
            <h3>相关链接</h3>
            <div className="link-buttons">
              <button className="about-link-button" onClick={handleOpenWebsite}>
                <span className="link-icon">🌐</span>
                <span className="link-text">官方网站</span>
              </button>
              <button className="about-link-button" onClick={handleOpenDownloadPage}>
                <span className="link-icon">⬇️</span>
                <span className="link-text">下载页面</span>
              </button>
            </div>
          </section>

          {/* Tech Stack Section */}
          <section className="about-section">
            <h3>技术栈</h3>
            <div className="tech-tags">
              <span className="tech-tag">Electron 28</span>
              <span className="tech-tag">React 18</span>
              <span className="tech-tag">TypeScript</span>
              <span className="tech-tag">xterm.js</span>
              <span className="tech-tag">Monaco Editor</span>
              <span className="tech-tag">node-pty</span>
            </div>
          </section>

          {/* Copyright Section */}
          <section className="about-footer">
            <p className="copyright">
              © 2025-2026 Within-7.com - 任小姐出海战略咨询
            </p>
            <p className="copyright-note">
              本应用专为 AI CLI 工具协作设计
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
