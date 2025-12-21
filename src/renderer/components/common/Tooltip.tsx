import React, { useState, useRef, useEffect, useCallback } from 'react'
import './Tooltip.css'

interface TooltipProps {
  content: string
  children: React.ReactNode
  /** Delay before showing tooltip in ms (default: 500) */
  delay?: number
  /** Maximum width of tooltip (default: 400) */
  maxWidth?: number
  /** Only show tooltip if text is truncated (default: false) */
  showOnlyWhenTruncated?: boolean
  /** Position of tooltip (default: 'top') */
  position?: 'top' | 'bottom'
}

/**
 * Smart Tooltip component that optionally only shows when content is truncated
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  delay = 500,
  maxWidth = 400,
  showOnlyWhenTruncated = false,
  position = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check if the child element's text is truncated
  const isTruncated = useCallback((): boolean => {
    if (!containerRef.current) return false
    const element = containerRef.current.firstElementChild as HTMLElement
    if (!element) return false
    return element.scrollWidth > element.clientWidth
  }, [])

  const calculatePosition = useCallback(() => {
    if (!containerRef.current || !tooltipRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()

    // Center horizontally
    let x = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2)

    // Ensure tooltip doesn't go off screen horizontally
    const padding = 8
    if (x < padding) x = padding
    if (x + tooltipRect.width > window.innerWidth - padding) {
      x = window.innerWidth - tooltipRect.width - padding
    }

    // Position above or below based on position prop and available space
    let y: number
    if (position === 'bottom') {
      y = containerRect.bottom + 8
      // If not enough space below, flip to top
      if (y + tooltipRect.height > window.innerHeight - padding) {
        y = containerRect.top - tooltipRect.height - 8
      }
    } else {
      y = containerRect.top - tooltipRect.height - 8
      // If not enough space above, flip to bottom
      if (y < padding) {
        y = containerRect.bottom + 8
      }
    }

    setTooltipPosition({ x, y })
  }, [position])

  const handleMouseEnter = useCallback(() => {
    // If showOnlyWhenTruncated is true, only show tooltip when text is truncated
    if (showOnlyWhenTruncated && !isTruncated()) {
      return
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }, [delay, showOnlyWhenTruncated, isTruncated])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }, [])

  // Update position when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to ensure tooltip is rendered before measuring
      requestAnimationFrame(() => {
        calculatePosition()
      })
    }
  }, [isVisible, calculatePosition])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="tooltip-content"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            maxWidth: maxWidth
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}

export default Tooltip
