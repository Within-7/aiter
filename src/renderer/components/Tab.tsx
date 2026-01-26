import { memo } from 'react'
import { Terminal } from '../../types'
import '../styles/Tab.css'

interface TabProps {
  terminal: Terminal
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

/**
 * Memoized Tab component
 * Prevents unnecessary re-renders when other terminals change
 */
export const Tab = memo(function Tab({ terminal, isActive, onSelect, onClose }: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }

  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      onMouseDown={handleMiddleClick}
      title={terminal.cwd}
    >
      <span className="tab-icon">⚡</span>
      <span className="tab-name">{terminal.name}</span>
      <button className="btn-icon btn-close-tab" onClick={handleClose} title="Close">
        ×
      </button>
    </div>
  )
})
