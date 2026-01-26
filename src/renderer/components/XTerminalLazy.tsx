import React, { Suspense, lazy } from 'react'
import type { Terminal as TerminalType, AppSettings } from '../../types'
import './XTerminalLazy.css'

// Lazy load XTerminal component (includes xterm.js and all addons)
const XTerminal = lazy(() =>
  import('./XTerminal').then(module => ({ default: module.XTerminal }))
)

interface XTerminalLazyProps {
  terminal: TerminalType
  settings: AppSettings
  isActive?: boolean
}

// Loading skeleton that mimics terminal appearance
const XTerminalSkeleton: React.FC = () => {
  return (
    <div className="xterminal-skeleton">
      <div className="xterminal-skeleton-body">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="xterminal-skeleton-line">
            <span className="xterminal-skeleton-prompt">$</span>
            <div
              className="xterminal-skeleton-content"
              style={{ width: `${Math.random() * 50 + 20}%` }}
            ></div>
          </div>
        ))}
      </div>
      <div className="xterminal-skeleton-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading terminal...</div>
      </div>
    </div>
  )
}

// Lazy-loaded XTerminal with Suspense boundary
export const XTerminalLazy: React.FC<XTerminalLazyProps> = (props) => {
  return (
    <Suspense fallback={<XTerminalSkeleton />}>
      <XTerminal {...props} />
    </Suspense>
  )
}
