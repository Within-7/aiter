/**
 * Custom hook for common dialog behaviors
 * Handles escape key, click outside, and focus management
 */

import { useEffect, useCallback, RefObject } from 'react'

export interface DialogBehaviorOptions {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when the dialog should close */
  onClose?: () => void
  /** Ref to the dialog element */
  dialogRef: RefObject<HTMLElement | null>
  /** Whether to close on overlay click (default: true) */
  closeOnOverlayClick?: boolean
  /** Whether to close on escape key (default: true) */
  closeOnEscape?: boolean
}

export interface UseDialogBehaviorReturn {
  /** Handler for overlay click */
  handleOverlayClick: (e: React.MouseEvent) => void
}

export function useDialogBehavior({
  isOpen,
  onClose,
  dialogRef,
  closeOnOverlayClick = true,
  closeOnEscape = true
}: DialogBehaviorOptions): UseDialogBehaviorReturn {
  // Handle click outside dialog
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (!closeOnOverlayClick || !onClose) return
    if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
      onClose()
    }
  }, [closeOnOverlayClick, onClose, dialogRef])

  // Handle escape key
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (!closeOnEscape || !onClose) return
    if (event.key === 'Escape') {
      onClose()
    }
  }, [closeOnEscape, onClose])

  // Set up event listeners
  useEffect(() => {
    if (!isOpen) return

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClickOutside, handleEscape])

  // Handler for overlay click (for React event handling)
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (!closeOnOverlayClick || !onClose) return
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [closeOnOverlayClick, onClose])

  return {
    handleOverlayClick
  }
}
