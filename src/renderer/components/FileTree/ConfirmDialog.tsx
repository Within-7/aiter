/**
 * ConfirmDialog Component
 * A simple confirmation dialog with customizable title, message, and buttons
 */

import React from 'react'
import { BaseDialog } from '../shared/BaseDialog'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel
}) => {
  const footer = (
    <>
      <button className="btn-secondary" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        className={`btn-primary ${variant === 'danger' ? 'btn-danger' : ''}`}
        onClick={onConfirm}
      >
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
      width="small"
      showCloseButton={false}
      className="confirm-dialog-wrapper"
    >
      <p className="base-dialog-message">{message}</p>
    </BaseDialog>
  )
}
