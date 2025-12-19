import React, { useState, useRef, useEffect } from 'react'
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
  const dialogRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onCancel()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onCancel])

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

  return (
    <div className="input-dialog-overlay">
      <div ref={dialogRef} className="input-dialog">
        <div className="input-dialog-header">
          <h3>{title}</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-dialog-content">
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
          <div className="input-dialog-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="submit" className="btn-primary">
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
