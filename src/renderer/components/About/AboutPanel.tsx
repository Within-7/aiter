import React, { useState, useEffect, useContext } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('about')
  const { t: tCommon } = useTranslation('common')
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
          error: data.error || t('version.checkFailed', 'Update check failed')
        }))
      }
    })

    return () => unsubscribe()
  }, [t])

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
          error: result.error || t('version.checkFailed', 'Update check failed')
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
        error: t('version.networkError', 'Network connection failed')
      }))
    }
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
          <h2 className="about-title">{t('tagline')}</h2>
          <p className="about-subtitle">{t('subtitle')}</p>
        </div>

        <div className="about-content">
          {/* Version Section */}
          <section className="about-section">
            <h3>{t('version.title')}</h3>
            <div className="version-card">
              {/* Current Version - Always visible */}
              <div className="version-current">
                <span className="version-number">v{versionInfo.current}</span>
                <span className="version-label-inline">{t('version.current')}</span>
              </div>

              {/* Update Status Area */}
              <div className="version-status">
                {versionInfo.isChecking ? (
                  // Checking state
                  <div className="status-checking">
                    <span className="checking-spinner"></span>
                    <span className="checking-text">{t('version.checking')}</span>
                  </div>
                ) : versionInfo.error ? (
                  // Error state
                  <div className="status-error">
                    <span className="status-icon">⚠</span>
                    <span className="status-text">{versionInfo.error}</span>
                  </div>
                ) : versionInfo.updateAvailable && versionInfo.latest ? (
                  // Update available state
                  <div className="status-update-available">
                    <div className="update-info">
                      <span className="status-icon">🎉</span>
                      <span className="status-text">
                        {t('version.newVersionAvailable', 'New version available')}: <strong>v{versionInfo.latest}</strong>
                      </span>
                    </div>
                  </div>
                ) : versionInfo.lastCheckTime ? (
                  // Up to date state
                  <div className="status-up-to-date">
                    <span className="status-icon">✓</span>
                    <span className="status-text">{t('version.upToDate', 'You are up to date')}</span>
                  </div>
                ) : (
                  // Initial state - not checked yet
                  <div className="status-initial">
                    <span className="status-text">{t('version.clickToCheck', 'Click to check for updates')}</span>
                  </div>
                )}
              </div>

              {/* Check Update Button */}
              <button
                className={`version-check-button ${versionInfo.updateAvailable ? 'has-update' : ''}`}
                onClick={handleCheckUpdate}
                disabled={versionInfo.isChecking}
              >
                {versionInfo.isChecking
                  ? t('version.checking')
                  : versionInfo.updateAvailable
                    ? t('version.downloadUpdate', 'Download Update')
                    : t('version.checkUpdate')}
              </button>

              {/* Last Check Time - subtle footer */}
              {versionInfo.lastCheckTime && !versionInfo.isChecking && (
                <div className="version-last-check">
                  {t('version.lastCheck')} {versionInfo.lastCheckTime.toLocaleTimeString()}
                </div>
              )}
            </div>
          </section>

          {/* Features Section */}
          <section className="about-section">
            <h3>{t('features.title')}</h3>
            <ul className="feature-list">
              <li>{t('features.multiProject')}</li>
              <li>{t('features.multiTerminal')}</li>
              <li>{t('features.htmlPreview')}</li>
              <li>{t('features.monacoEditor')}</li>
              <li>{t('features.markdownPreview')}</li>
              <li>{t('features.pluginSystem')}</li>
              <li>{t('features.autoUpdate')}</li>
              <li>{t('features.crossPlatform')}</li>
            </ul>
          </section>

          {/* Links Section */}
          <section className="about-section">
            <h3>{t('links.title')}</h3>
            <div className="link-buttons">
              <button className="about-link-button" onClick={handleOpenWebsite}>
                <span className="link-icon">🌐</span>
                <span className="link-text">{t('links.website')}</span>
              </button>
            </div>
          </section>

          {/* Tech Stack Section */}
          <section className="about-section">
            <h3>{t('techStack.title')}</h3>
            <div className="tech-tags">
              <span className="tech-tag">{t('techStack.electron')}</span>
              <span className="tech-tag">{t('techStack.react')}</span>
              <span className="tech-tag">{t('techStack.typescript')}</span>
              <span className="tech-tag">{t('techStack.xterm')}</span>
              <span className="tech-tag">{t('techStack.monaco')}</span>
              <span className="tech-tag">{t('techStack.nodePty')}</span>
            </div>
          </section>

          {/* Copyright Section */}
          <section className="about-footer">
            <p className="copyright">
              {t('copyright.text')}
            </p>
            <p className="copyright-note">
              {t('description')}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
