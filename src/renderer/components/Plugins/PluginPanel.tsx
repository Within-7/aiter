/**
 * Plugin Panel Component
 * Displays and manages AI CLI tool plugins
 */

import React, { useContext } from 'react'
import { PluginCard } from './PluginCard'
import { MintoConfigDialog } from './MintoConfigDialog'
import { AddPluginDialog } from './AddPluginDialog'
import { AppContext } from '../../context/AppContext'
import { usePluginList } from '../../hooks/usePluginList'
import { usePluginOperations } from '../../hooks/usePluginOperations'
import './Plugins.css'

export const PluginPanel: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const isOpen = state.showPluginPanel

  // Plugin list management
  const pluginList = usePluginList(isOpen)

  // Plugin operations
  const pluginOps = usePluginOperations({
    plugins: pluginList.plugins,
    loadPlugins: pluginList.loadPlugins,
    setError: pluginList.setError
  })

  const handleClose = () => {
    dispatch({ type: 'SET_PLUGIN_PANEL', payload: false })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="plugin-panel-overlay" onClick={handleOverlayClick}>
        <div className="plugin-panel">
          <div className="plugin-panel-header">
            <h2>Plugins</h2>
            <div className="plugin-panel-header-actions">
              <button
                className="plugin-panel-add-button"
                onClick={pluginOps.openAddPluginDialog}
                aria-label="Add custom plugin"
              >
                + Add Plugin
              </button>
              <button
                className="plugin-panel-close"
                onClick={handleClose}
                aria-label="Close plugins panel"
              >
                ×
              </button>
            </div>
          </div>

          {/* Filter buttons */}
          <div className="plugin-panel-filters">
            <button
              className={`plugin-filter-btn ${pluginList.filter === 'all' ? 'active' : ''}`}
              onClick={() => pluginList.setFilter('all')}
            >
              All ({pluginList.plugins.length})
            </button>
            <button
              className={`plugin-filter-btn ${pluginList.filter === 'built-in' ? 'active' : ''}`}
              onClick={() => pluginList.setFilter('built-in')}
            >
              Built-in ({pluginList.builtInCount})
            </button>
            <button
              className={`plugin-filter-btn ${pluginList.filter === 'custom' ? 'active' : ''}`}
              onClick={() => pluginList.setFilter('custom')}
            >
              Custom ({pluginList.customCount})
            </button>
            <button
              className={`plugin-filter-btn ${pluginList.filter === 'installed' ? 'active' : ''}`}
              onClick={() => pluginList.setFilter('installed')}
            >
              Installed ({pluginList.installedCount})
            </button>
            <button
              className={`plugin-filter-btn ${pluginList.filter === 'not-installed' ? 'active' : ''}`}
              onClick={() => pluginList.setFilter('not-installed')}
            >
              Not Installed ({pluginList.notInstalledCount})
            </button>
            {pluginList.updatesAvailableCount > 0 && (
              <button
                className={`plugin-filter-btn plugin-filter-btn-updates ${pluginList.filter === 'updates-available' ? 'active' : ''}`}
                onClick={() => pluginList.setFilter('updates-available')}
              >
                Updates ({pluginList.updatesAvailableCount})
              </button>
            )}
          </div>

          {pluginOps.statusMessage && (
            <div className="plugin-panel-status">
              {pluginOps.statusMessage}
            </div>
          )}

          <div className="plugin-panel-content">
            {pluginList.isLoading ? (
              <div className="plugin-panel-loading">
                <div className="plugin-panel-spinner"></div>
                <p>Loading plugins...</p>
              </div>
            ) : pluginList.error ? (
              <div className="plugin-panel-error">
                <span className="plugin-panel-error-icon">⚠️</span>
                <p>{pluginList.error}</p>
                <button className="plugin-panel-retry" onClick={pluginList.loadPlugins}>
                  Retry
                </button>
              </div>
            ) : pluginList.plugins.length === 0 ? (
              <div className="plugin-panel-empty">
                <p>No plugins available</p>
              </div>
            ) : pluginList.sortedAndFilteredPlugins.length === 0 ? (
              <div className="plugin-panel-empty">
                <p>No plugins found for this filter</p>
              </div>
            ) : (
              <div className="plugin-panel-list">
                {/* Built-in plugins section */}
                {pluginList.builtInPlugins.length > 0 && (
                  <div className="plugin-section">
                    <h3 className="plugin-section-title">Built-in Plugins</h3>
                    {pluginList.builtInPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onInstall={pluginOps.handleInstall}
                        onUpdate={pluginOps.handleUpdate}
                        onUninstall={pluginOps.handleUninstall}
                        onConfigure={pluginOps.handleConfigure}
                        onCheckUpdate={pluginOps.handleCheckUpdate}
                        isProcessing={pluginOps.processingPlugins.has(plugin.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Custom plugins section */}
                {pluginList.customPlugins.length > 0 && (
                  <div className="plugin-section">
                    <h3 className="plugin-section-title">Custom Plugins</h3>
                    {pluginList.customPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onInstall={pluginOps.handleInstall}
                        onUpdate={pluginOps.handleUpdate}
                        onUninstall={pluginOps.handleUninstall}
                        onDelete={pluginOps.handleDelete}
                        onConfigure={pluginOps.handleConfigure}
                        onCheckUpdate={pluginOps.handleCheckUpdate}
                        isProcessing={pluginOps.processingPlugins.has(plugin.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      <MintoConfigDialog
        isOpen={pluginOps.configDialogOpen}
        currentConfig={pluginOps.currentConfig}
        onClose={pluginOps.closeConfigDialog}
        onSave={pluginOps.handleSaveConfig}
      />

      <AddPluginDialog
        isOpen={pluginOps.addPluginDialogOpen}
        onClose={pluginOps.closeAddPluginDialog}
        onAdd={pluginOps.handleAddPlugin}
      />
    </>
  )
}
