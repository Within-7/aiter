import { FaPuzzlePiece } from 'react-icons/fa'
import './StatusBar.css'

export type PluginStatus = 'no-plugins' | 'has-plugins' | 'update-available' | 'installing'

export interface PluginButtonProps {
  pluginCount: number
  status: PluginStatus
  hasUpdates?: boolean
  onClick: () => void
}

export function PluginButton({ pluginCount, status, hasUpdates, onClick }: PluginButtonProps) {

  // Determine display text based on status
  const getDisplayText = () => {
    switch (status) {
      case 'no-plugins':
        return 'No Plugins'
      case 'installing':
        return 'Installing...'
      case 'update-available':
        return `${pluginCount} Plugin${pluginCount !== 1 ? 's' : ''}`
      case 'has-plugins':
        return `${pluginCount} Plugin${pluginCount !== 1 ? 's' : ''}`
      default:
        return 'Plugins'
    }
  }

  // Determine tooltip text
  const getTooltip = () => {
    switch (status) {
      case 'no-plugins':
        return 'No plugins installed. Click to browse plugins.'
      case 'installing':
        return 'Plugin installation in progress...'
      case 'update-available':
        return `${pluginCount} plugin${pluginCount !== 1 ? 's' : ''} installed. Updates available!`
      case 'has-plugins':
        return `${pluginCount} plugin${pluginCount !== 1 ? 's' : ''} installed. Click to manage.`
      default:
        return 'Manage plugins'
    }
  }

  // Determine if badge should be shown
  const showBadge = status === 'update-available' || (status === 'has-plugins' && hasUpdates)

  return (
    <button
      className={`plugin-button status-button ${status}`}
      onClick={onClick}
      title={getTooltip()}
      disabled={status === 'installing'}
    >
      <span className="plugin-icon">
        <FaPuzzlePiece />
      </span>
      <span className="plugin-text">{getDisplayText()}</span>
      {showBadge && (
        <span className="plugin-badge">
          {status === 'update-available' ? 'UPDATE' : 'NEW'}
        </span>
      )}
    </button>
  )
}
