/**
 * AddPluginDialog Component
 * Dialog for adding custom plugins via URL or package name
 */

import React, { useState } from 'react'
import { BaseDialog } from '../shared/BaseDialog'
import './Plugins.css'

interface AddPluginDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (urlOrPackageName: string) => Promise<void>
}

export const AddPluginDialog: React.FC<AddPluginDialogProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [urlOrPackageName, setUrlOrPackageName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!urlOrPackageName.trim()) {
      setError('Please enter a package URL or name')
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      await onAdd(urlOrPackageName.trim())
      setUrlOrPackageName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plugin')
    } finally {
      setIsAdding(false)
    }
  }

  const handleClose = () => {
    if (!isAdding) {
      setUrlOrPackageName('')
      setError(null)
      onClose()
    }
  }

  const footer = (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={handleClose}
        disabled={isAdding}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="add-plugin-form"
        className="btn-primary"
        disabled={isAdding}
      >
        {isAdding ? 'Adding...' : 'Add Plugin'}
      </button>
    </>
  )

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Custom Plugin"
      footer={footer}
      width="medium"
      isProcessing={isAdding}
      className="add-plugin-dialog"
    >
      <form id="add-plugin-form" onSubmit={handleSubmit}>
        <div className="base-dialog-field">
          <label htmlFor="plugin-url">Package URL or Name</label>
          <input
            id="plugin-url"
            type="text"
            value={urlOrPackageName}
            onChange={(e) => setUrlOrPackageName(e.target.value)}
            placeholder="https://www.npmjs.com/package/@within-7/minto or @within-7/minto"
            disabled={isAdding}
            autoFocus
          />
          <p className="base-dialog-hint">
            Enter an npm package URL (e.g., https://www.npmjs.com/package/package-name) or
            package name (e.g., @scope/package-name)
          </p>
        </div>

        {error && (
          <div className="base-dialog-error">
            <span className="base-dialog-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </form>
    </BaseDialog>
  )
}
