/**
 * InputDialog Component
 * A dialog with a single text input for naming files/folders
 */

import React, { useState, useRef, useEffect } from 'react'
import { BaseDialog } from '../shared/BaseDialog'
import './InputDialog.css'

interface InputDialogProps {
  title: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
  validator?: (value: string) => string | null // Returns error message or null if valid
}

export const InputDialog: React.FC<InputDialogProps> = ({
  title,
  placeholder = '',
  defaultValue = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  validator
}) => {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus and select input on mount
    if (inputRef.current) {
      inputRef.current.focus()
      // Select filename without extension for rename
      if (defaultValue) {
        const dotIndex = defaultValue.lastIndexOf('.')
        if (dotIndex > 0) {
          inputRef.current.setSelectionRange(0, dotIndex)
        } else {
          inputRef.current.select()
        }
      }
    }
  }, [defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedValue = value.trim()
    if (!trimmedValue) {
      setError('Name cannot be empty')
      return
    }

    if (validator) {
      const validationError = validator(trimmedValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    onConfirm(trimmedValue)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setError(null)
  }

  const footer = (
    <>
      <button type="button" className="btn-secondary" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button type="submit" form="input-dialog-form" className="btn-primary">
        {confirmLabel}
      </button>
    </>
  )

  return (
    <BaseDialog
      isOpen={true}
      onClose={onCancel}
      title={title}
      footer={footer}
      width="medium"
      showCloseButton={false}
      className="input-dialog-wrapper"
    >
      <form id="input-dialog-form" onSubmit={handleSubmit}>
        <div className="base-dialog-field">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={error ? 'error' : ''}
          />
          {error && <div className="input-dialog-error">{error}</div>}
        </div>
      </form>
    </BaseDialog>
  )
}
