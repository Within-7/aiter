import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDialogBehavior } from '../useDialogBehavior'
import { createRef } from 'react'

describe('useDialogBehavior', () => {
  let onClose: ReturnType<typeof vi.fn>
  let dialogRef: React.RefObject<HTMLDivElement>

  beforeEach(() => {
    onClose = vi.fn()
    dialogRef = createRef()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('escape key handling', () => {
    it('should call onClose when escape is pressed and dialog is open', () => {
      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef,
          closeOnEscape: true
        })
      )

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when dialog is closed', () => {
      renderHook(() =>
        useDialogBehavior({
          isOpen: false,
          onClose,
          dialogRef,
          closeOnEscape: true
        })
      )

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should not call onClose when closeOnEscape is false', () => {
      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef,
          closeOnEscape: false
        })
      )

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should not call onClose for other keys', () => {
      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef,
          closeOnEscape: true
        })
      )

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should clean up event listener when dialog closes', () => {
      const { rerender } = renderHook(
        ({ isOpen }) =>
          useDialogBehavior({
            isOpen,
            onClose,
            dialogRef,
            closeOnEscape: true
          }),
        { initialProps: { isOpen: true } }
      )

      // Close dialog
      rerender({ isOpen: false })

      // Escape should not trigger onClose now
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('click outside handling', () => {
    it('should call onClose when clicking outside dialog', () => {
      // Create a mock dialog element
      const dialogElement = document.createElement('div')
      document.body.appendChild(dialogElement)

      const ref = { current: dialogElement }

      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef: ref,
          closeOnOverlayClick: true
        })
      )

      // Click outside the dialog
      const event = new MouseEvent('mousedown', { bubbles: true })
      document.body.dispatchEvent(event)

      expect(onClose).toHaveBeenCalledTimes(1)

      document.body.removeChild(dialogElement)
    })

    it('should not call onClose when clicking inside dialog', () => {
      // Create a mock dialog element
      const dialogElement = document.createElement('div')
      document.body.appendChild(dialogElement)

      const ref = { current: dialogElement }

      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef: ref,
          closeOnOverlayClick: true
        })
      )

      // Click inside the dialog
      const event = new MouseEvent('mousedown', { bubbles: true })
      dialogElement.dispatchEvent(event)

      expect(onClose).not.toHaveBeenCalled()

      document.body.removeChild(dialogElement)
    })

    it('should not call onClose when closeOnOverlayClick is false', () => {
      const dialogElement = document.createElement('div')
      document.body.appendChild(dialogElement)

      const ref = { current: dialogElement }

      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef: ref,
          closeOnOverlayClick: false
        })
      )

      const event = new MouseEvent('mousedown', { bubbles: true })
      document.body.dispatchEvent(event)

      expect(onClose).not.toHaveBeenCalled()

      document.body.removeChild(dialogElement)
    })
  })

  describe('handleOverlayClick', () => {
    it('should call onClose when target equals currentTarget', () => {
      const { result } = renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef,
          closeOnOverlayClick: true
        })
      )

      const mockEvent = {
        target: document.body,
        currentTarget: document.body
      } as unknown as React.MouseEvent

      result.current.handleOverlayClick(mockEvent)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when target differs from currentTarget', () => {
      const { result } = renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef,
          closeOnOverlayClick: true
        })
      )

      const child = document.createElement('div')
      const mockEvent = {
        target: child,
        currentTarget: document.body
      } as unknown as React.MouseEvent

      result.current.handleOverlayClick(mockEvent)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should not call onClose when closeOnOverlayClick is false', () => {
      const { result } = renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef,
          closeOnOverlayClick: false
        })
      )

      const mockEvent = {
        target: document.body,
        currentTarget: document.body
      } as unknown as React.MouseEvent

      result.current.handleOverlayClick(mockEvent)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('default options', () => {
    it('should enable closeOnOverlayClick by default', () => {
      const dialogElement = document.createElement('div')
      document.body.appendChild(dialogElement)

      const ref = { current: dialogElement }

      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef: ref
          // closeOnOverlayClick not specified, should default to true
        })
      )

      const event = new MouseEvent('mousedown', { bubbles: true })
      document.body.dispatchEvent(event)

      expect(onClose).toHaveBeenCalled()

      document.body.removeChild(dialogElement)
    })

    it('should enable closeOnEscape by default', () => {
      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          onClose,
          dialogRef
          // closeOnEscape not specified, should default to true
        })
      )

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('without onClose callback', () => {
    it('should not throw when escape pressed without onClose', () => {
      renderHook(() =>
        useDialogBehavior({
          isOpen: true,
          dialogRef,
          closeOnEscape: true
          // onClose not provided
        })
      )

      expect(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' })
        document.dispatchEvent(event)
      }).not.toThrow()
    })
  })
})
