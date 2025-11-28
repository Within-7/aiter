import React from 'react'
import { PluginListItem, PluginStatus } from '../../../types/plugin'

interface PluginCardProps {
  plugin: PluginListItem
  onInstall: (pluginId: string) => void
  onUpdate: (pluginId: string) => void
  onRemove: (pluginId: string) => void
  onConfigure: (pluginId: string) => void
  isProcessing: boolean
}

export const PluginCard: React.FC<PluginCardProps> = ({
  plugin,
  onInstall,
  onUpdate,
  onRemove,
  onConfigure,
  isProcessing
}) => {
  const getStatusColor = (status: PluginStatus): string => {
    switch (status) {
      case 'installed':
        return '#4caf50'
      case 'not-installed':
        return '#757575'
      case 'update-available':
        return '#ff9800'
      case 'installing':
      case 'updating':
      case 'removing':
        return '#2196f3'
      case 'error':
        return '#f44336'
      default:
        return '#757575'
    }
  }

  const getStatusText = (status: PluginStatus): string => {
    switch (status) {
      case 'installed':
        return 'Installed'
      case 'not-installed':
        return 'Not Installed'
      case 'update-available':
        return 'Update Available'
      case 'installing':
        return 'Installing...'
      case 'updating':
        return 'Updating...'
      case 'removing':
        return 'Removing...'
      case 'error':
        return 'Error'
      default:
        return status
    }
  }

  const isInstalled = plugin.status === 'installed' || plugin.status === 'update-available'
  const canInstall = plugin.status === 'not-installed' && !isProcessing
  const canUpdate = plugin.hasUpdate && !isProcessing
  const canRemove = isInstalled && !isProcessing
  const canConfigure = isInstalled && !isProcessing

  return (
    <div className="plugin-card">
      <div className="plugin-card-header">
        <div className="plugin-card-title">
          {plugin.icon && <span className="plugin-icon">{plugin.icon}</span>}
          <h3>{plugin.name}</h3>
        </div>
        <div className="plugin-card-status" style={{ color: getStatusColor(plugin.status) }}>
          {getStatusText(plugin.status)}
          {plugin.hasUpdate && (
            <span className="plugin-update-badge" title="Update available">
              !
            </span>
          )}
        </div>
      </div>

      <p className="plugin-card-description">{plugin.description}</p>

      <div className="plugin-card-meta">
        {plugin.installedVersion && (
          <span className="plugin-version">v{plugin.installedVersion}</span>
        )}
        {plugin.hasUpdate && plugin.latestVersion && (
          <span className="plugin-version-latest">→ v{plugin.latestVersion}</span>
        )}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="plugin-tags">
            {plugin.tags.map((tag) => (
              <span key={tag} className="plugin-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="plugin-card-actions">
        {canInstall && (
          <button
            className="plugin-btn plugin-btn-primary"
            onClick={() => onInstall(plugin.id)}
            disabled={isProcessing}
          >
            Install
          </button>
        )}

        {canUpdate && (
          <button
            className="plugin-btn plugin-btn-update"
            onClick={() => onUpdate(plugin.id)}
            disabled={isProcessing}
          >
            Update
          </button>
        )}

        {canConfigure && (
          <button
            className="plugin-btn plugin-btn-secondary"
            onClick={() => onConfigure(plugin.id)}
            disabled={isProcessing}
          >
            Configure
          </button>
        )}

        {canRemove && (
          <button
            className="plugin-btn plugin-btn-danger"
            onClick={() => onRemove(plugin.id)}
            disabled={isProcessing}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
