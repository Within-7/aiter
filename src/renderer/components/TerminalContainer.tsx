import React, { memo } from 'react'
import { Terminal as TerminalType, AppSettings } from '../../types'
import { XTerminalLazy } from './XTerminalLazy'
import '../styles/TerminalContainer.css'

interface TerminalContainerProps {
  terminals: TerminalType[]
  activeTerminalId?: string
  settings: AppSettings
}

/**
 * Container component for managing multiple terminal instances.
 * Uses React.memo to prevent unnecessary re-renders when parent state changes
 * but terminal-related props remain the same.
 */
export const TerminalContainer = memo(function TerminalContainer({
  terminals,
  activeTerminalId,
  settings
}: TerminalContainerProps) {
  return (
    <div className="terminal-container">
      {terminals.map((terminal) => {
        const isActive = terminal.id === activeTerminalId
        return (
          <div
            key={terminal.id}
            className={`terminal-wrapper ${isActive ? 'active' : 'hidden'}`}
          >
            <XTerminalLazy
              terminal={terminal}
              settings={settings}
              isActive={isActive}
            />
          </div>
        )
      })}
    </div>
  )
})
