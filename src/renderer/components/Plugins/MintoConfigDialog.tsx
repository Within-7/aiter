import React, { useState, useEffect } from 'react'

interface MintoConfig {
  githubToken?: string
  autoCheckUpdates?: boolean
}

interface MintoConfigDialogProps {
  isOpen: boolean
  currentConfig: MintoConfig
  onClose: () => void
  onSave: (config: MintoConfig) => Promise<void>
}

export const MintoConfigDialog: React.FC<MintoConfigDialogProps> = ({
  isOpen,
  currentConfig,
  onClose,
  onSave
}) => {
  const [githubToken, setGithubToken] = useState(currentConfig.githubToken || '')
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(
    currentConfig.autoCheckUpdates ?? true
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setGithubToken(currentConfig.githubToken || '')
      setAutoCheckUpdates(currentConfig.autoCheckUpdates ?? true)
      setError(null)
    }
  }, [isOpen, currentConfig])

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    try {
      const config: MintoConfig = {
        githubToken: githubToken.trim() || undefined,
        autoCheckUpdates
      }

      await onSave(config)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="minto-config-overlay" onClick={handleOverlayClick}>
      <div className="minto-config-dialog">
        <div className="minto-config-header">
          <h2>Minto Configuration</h2>
          <button
            className="minto-config-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="minto-config-content">
          <div className="minto-config-field">
            <label htmlFor="github-token">
              GitHub Personal Access Token
              <span className="minto-config-optional">(optional)</span>
            </label>
            <div className="minto-config-input-wrapper">
              <input
                id="github-token"
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="minto-config-input"
                disabled={isSaving}
              />
              <button
                type="button"
                className="minto-config-toggle-visibility"
                onClick={() => setShowToken(!showToken)}
                disabled={isSaving}
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="minto-config-hint">
              Required for private repositories and higher rate limits.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:org"
                target="_blank"
                rel="noopener noreferrer"
                className="minto-config-link"
              >
                Create token →
              </a>
            </p>
          </div>

          <div className="minto-config-field">
            <label className="minto-config-checkbox-label">
              <input
                type="checkbox"
                checked={autoCheckUpdates}
                onChange={(e) => setAutoCheckUpdates(e.target.checked)}
                disabled={isSaving}
              />
              <span>Automatically check for updates</span>
            </label>
            <p className="minto-config-hint">
              Check for new Minto versions when opening projects
            </p>
          </div>

          {error && (
            <div className="minto-config-error">
              <span className="minto-config-error-icon">⚠️</span>
              {error}
            </div>
          )}
        </div>

        <div className="minto-config-footer">
          <button
            className="minto-config-btn minto-config-btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="minto-config-btn minto-config-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}
