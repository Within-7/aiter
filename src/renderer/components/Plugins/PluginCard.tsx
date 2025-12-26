import React from 'react'

type PluginStatus = 'installed' | 'not-installed' | 'update-available' | 'installing' | 'updating' | 'removing' | 'error'

interface PluginCardData {
  id: string
  name: string
  description: string
  version: string
  author: string
  installed: boolean
  installedVersion?: string
  updateAvailable: boolean
  enabled: boolean
  config?: Record<string, unknown>
  tags?: string[]
  icon?: string
  homepage?: string
  status: PluginStatus
  latestVersion: string | null
  hasUpdate: boolean
  platforms: string[]
  isBuiltIn?: boolean
}

interface PluginCardProps {
  plugin: PluginCardData
  onInstall: (pluginId: string) => void
  onUpdate: (pluginId: string) => void
  onUninstall: (pluginId: string) => void
  onDelete?: (pluginId: string) => void  // Only for custom plugins
  onConfigure: (pluginId: string) => void
  onCheckUpdate: (pluginId: string) => void
  isProcessing: boolean
}

export const PluginCard: React.FC<PluginCardProps> = ({
  plugin,
  onInstall,
  onUpdate,
  onUninstall,
  onDelete,
  onConfigure,
  onCheckUpdate,
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
  const canInstall = plugin.status === 'not-installed' && !isProcessing && !plugin.isBuiltIn  // Built-in plugins auto-install
  const canUpdate = plugin.hasUpdate && !isProcessing
  const canUninstall = isInstalled && !isProcessing && !plugin.isBuiltIn  // Built-in plugins cannot be uninstalled
  const canDelete = !plugin.isBuiltIn && !isProcessing  // Only custom plugins can be deleted
  const canConfigure = isInstalled && !isProcessing

  return (
    <div className="plugin-card">
      <div className="plugin-card-header">
        <div className="plugin-card-title">
          {plugin.icon && <span className="plugin-card-icon">{plugin.icon}</span>}
          <h3>{plugin.name}</h3>
          {plugin.isBuiltIn && (
            <span className="plugin-builtin-badge" title="Built-in system plugin">
              Built-in
            </span>
          )}
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
        {/* Built-in plugins show auto-installing message when not installed */}
        {plugin.isBuiltIn && plugin.status === 'not-installed' && (
          <span className="plugin-auto-install-note">
            Auto-installing...
          </span>
        )}

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

        {isInstalled && (
          <button
            className="plugin-btn plugin-btn-secondary"
            onClick={() => onCheckUpdate(plugin.id)}
            disabled={isProcessing}
            title="Check for updates"
          >
            {isProcessing ? 'Checking...' : 'Check Update'}
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

        {canUninstall && (
          <button
            className="plugin-btn plugin-btn-warning"
            onClick={() => onUninstall(plugin.id)}
            disabled={isProcessing}
            title="Uninstall plugin from system (can be reinstalled)"
          >
            Uninstall
          </button>
        )}

        {canDelete && onDelete && (
          <button
            className="plugin-btn plugin-btn-danger"
            onClick={() => onDelete(plugin.id)}
            disabled={isProcessing}
            title="Delete plugin from list (also uninstalls if installed)"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
