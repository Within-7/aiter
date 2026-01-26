/**
 * BaseDialog Component
 * A reusable dialog component with common behaviors:
 * - Escape key to close
 * - Click outside to close (optional)
 * - Portal rendering (optional)
 * - Consistent structure with header, content, and footer slots
 */

import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialogBehavior, DialogBehaviorOptions } from '../../hooks/useDialogBehavior'
import './BaseDialog.css'

export interface BaseDialogProps extends Omit<DialogBehaviorOptions, 'dialogRef'> {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when the dialog should close */
  onClose: () => void
  /** Dialog title */
  title: string
  /** Dialog content */
  children: React.ReactNode
  /** Optional footer content (action buttons) */
  footer?: React.ReactNode
  /** Whether to render using portal (default: true) */
  usePortal?: boolean
  /** Additional class name for the dialog */
  className?: string
  /** Width variant */
  width?: 'small' | 'medium' | 'large'
  /** Whether to show close button in header (default: true) */
  showCloseButton?: boolean
  /** Disable interactions during async operation */
  isProcessing?: boolean
}

export const BaseDialog: React.FC<BaseDialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  usePortal = true,
  className = '',
  width = 'medium',
  showCloseButton = true,
  isProcessing = false,
  closeOnOverlayClick = true,
  closeOnEscape = true
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Use dialog behavior hook
  useDialogBehavior({
    isOpen,
    onClose: isProcessing ? undefined : onClose,
    dialogRef,
    closeOnOverlayClick: closeOnOverlayClick && !isProcessing,
    closeOnEscape: closeOnEscape && !isProcessing
  })

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && !isProcessing) {
      onClose()
    }
  }

  const handleCloseClick = () => {
    if (!isProcessing) {
      onClose()
    }
  }

  const widthClass = `base-dialog--${width}`

  const dialogContent = (
    <div className="base-dialog-overlay" onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`base-dialog ${widthClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="base-dialog-header">
          <h3 className="base-dialog-title">{title}</h3>
          {showCloseButton && (
            <button
              className="base-dialog-close"
              onClick={handleCloseClick}
              disabled={isProcessing}
              aria-label="Close dialog"
            >
              ×
            </button>
          )}
        </div>
        <div className="base-dialog-content">
          {children}
        </div>
        {footer && (
          <div className="base-dialog-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  if (usePortal) {
    return createPortal(dialogContent, document.body)
  }

  return dialogContent
}

export default BaseDialog
