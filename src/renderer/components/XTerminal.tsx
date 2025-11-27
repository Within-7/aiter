import { useEffect, useRef, useContext, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { CanvasAddon } from '@xterm/addon-canvas'
import { Terminal as TerminalType, AppSettings } from '../../types'
import { AppContext } from '../context/AppContext'
import '@xterm/xterm/css/xterm.css'
import '../styles/XTerminal.css'

interface XTerminalProps {
  terminal: TerminalType
  settings: AppSettings
}

export function XTerminal({ terminal, settings }: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { state } = useContext(AppContext)
  const [isVisible, setIsVisible] = useState(false)

  // Check visibility periodically until container is visible
  useEffect(() => {
    if (isVisible || !terminalRef.current) return

    const checkVisibility = () => {
      if (!terminalRef.current) return
      const rect = terminalRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setIsVisible(true)
      }
    }

    // Initial check
    checkVisibility()

    // Keep checking until visible
    const interval = setInterval(checkVisibility, 100)
    return () => clearInterval(interval)
  }, [isVisible])

  useEffect(() => {
    if (!terminalRef.current || !isVisible) return
    // Don't recreate if terminal already exists
    if (xtermRef.current) {
      // Just fit the existing terminal
      fitAddonRef.current?.fit()
      return
    }

    // Create terminal instance
    const xterm = new XTerm({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      scrollback: settings.scrollbackLines,
      // Performance optimizations to reduce flickering
      allowProposedApi: true,
      smoothScrollDuration: 0, // Disable smooth scrolling to reduce jank
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      // Prevent cursor/input line flickering
      windowsMode: false,
      convertEol: false,
      // Optimize rendering
      disableStdin: false,
      allowTransparency: false,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      }
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const canvasAddon = new CanvasAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    // Open terminal
    xterm.open(terminalRef.current)

    // Load canvas renderer after opening for better performance and reduced flickering
    try {
      xterm.loadAddon(canvasAddon)
    } catch (error) {
      console.warn('Failed to load canvas renderer, falling back to DOM renderer:', error)
    }

    // Fit terminal after DOM is ready - use requestAnimationFrame for better timing
    const fitTerminal = () => {
      if (!terminalRef.current || !fitAddonRef.current) return

      try {
        // Check if terminal container is visible before fitting
        const rect = terminalRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          fitAddon.fit()
        } else {
          // Terminal is hidden, retry later
          setTimeout(fitTerminal, 100)
        }
      } catch (error) {
        // Silently ignore fit errors during initialization
        // They're usually because the terminal is hidden
      }
    }

    // Use RAF to ensure DOM is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(fitTerminal)
    })

    // Store references
    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle user input
    xterm.onData((data) => {
      window.api.terminal.write(terminal.id, data)
    })

    // Handle terminal data from backend
    const bufferedData = state.terminalDataBuffer.get(terminal.id)
    if (bufferedData) {
      xterm.write(bufferedData)
      state.terminalDataBuffer.delete(terminal.id)
    }

    // Handle resize with debouncing and size change detection to prevent flickering
    let resizeTimeout: NodeJS.Timeout | null = null
    let lastWidth = 0
    let lastHeight = 0

    const resizeObserver = new ResizeObserver((entries) => {
      if (fitAddonRef.current && xtermRef.current) {
        const entry = entries[0]
        if (!entry) return

        const { width, height } = entry.contentRect

        // Only resize if dimensions actually changed significantly (> 5px threshold)
        const widthChanged = Math.abs(width - lastWidth) > 5
        const heightChanged = Math.abs(height - lastHeight) > 5

        if (!widthChanged && !heightChanged) {
          return // Skip if no significant change
        }

        lastWidth = width
        lastHeight = height

        // Clear any pending resize
        if (resizeTimeout) {
          clearTimeout(resizeTimeout)
        }

        // Debounce resize to prevent flickering during animations
        resizeTimeout = setTimeout(() => {
          try {
            fitAddon.fit()
            const dims = fitAddon.proposeDimensions()
            if (dims) {
              window.api.terminal.resize(terminal.id, dims.cols, dims.rows)
            }
          } catch (error) {
            console.error('Error during terminal resize:', error)
          }
        }, 150) // Increased to 150ms for better stability
      }
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // Cleanup only when component unmounts
    return () => {
      // Clear any pending resize timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver.disconnect()
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }
  }, [terminal.id, isVisible])

  // Handle terminal data updates
  useEffect(() => {
    const cleanup = window.api.terminal.onData((id, data) => {
      if (id === terminal.id && xtermRef.current) {
        xtermRef.current.write(data)
      }
    })

    return cleanup
  }, [terminal.id])

  // Update settings - only when specific values change
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options = {
        cursorBlink: settings.cursorBlink,
        cursorStyle: settings.cursorStyle,
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        scrollback: settings.scrollbackLines
      }
      // ResizeObserver will handle fitting when container size changes
      // Only manually fit if font-related settings change
      fitAddonRef.current?.fit()
    }
  }, [
    settings.fontSize,
    settings.fontFamily
  ])

  return <div ref={terminalRef} className="xterm-wrapper" />
}
