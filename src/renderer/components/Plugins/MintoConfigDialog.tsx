/**
 * MintoConfigDialog Component
 * Configuration dialog for Minto plugin settings
 */

import React, { useState, useEffect } from 'react'
import { BaseDialog } from '../shared/BaseDialog'
import { MintoConfig } from '../../../types/pluginConfigs'
import './Plugins.css'

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
  const [autoUpdate, setAutoUpdate] = useState(
    currentConfig.autoUpdate ?? false
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setAutoUpdate(currentConfig.autoUpdate ?? false)
      setError(null)
    }
  }, [isOpen, currentConfig])

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    try {
      const config: MintoConfig = {
        autoUpdate
      }

      await onSave(config)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const footer = (
    <>
      <button
        className="btn-secondary"
        onClick={onClose}
        disabled={isSaving}
      >
        Cancel
      </button>
      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save Configuration'}
      </button>
    </>
  )

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Minto Configuration"
      footer={footer}
      width="medium"
      isProcessing={isSaving}
      className="minto-config-dialog"
    >
      <div className="base-dialog-field">
        <label className="base-dialog-checkbox">
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
            disabled={isSaving}
          />
          <span>Automatically update Minto</span>
        </label>
        <p className="base-dialog-hint">
          Automatically update Minto CLI to the latest version when updates are available (updates run in terminal)
        </p>
      </div>

      {error && (
        <div className="base-dialog-error">
          <span className="base-dialog-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </BaseDialog>
  )
}
