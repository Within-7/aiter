import React, { useState, useEffect, useCallback, useContext } from 'react'
import { Plugin, PluginInstallProgress, PluginUpdateProgress } from '../../../types'
import { MintoConfig } from '../../../types/pluginConfigs'
import { PluginCard } from './PluginCard'
import { MintoConfigDialog } from './MintoConfigDialog'
import { AddPluginDialog } from './AddPluginDialog'
import { AppContext } from '../../context/AppContext'
import './Plugins.css'

// Extended plugin interface for display
interface PluginCardData extends Plugin {
  status: 'installed' | 'not-installed' | 'update-available' | 'installing' | 'updating' | 'removing' | 'error'
  latestVersion: string | null
  hasUpdate: boolean
  platforms: string[]
}

type PluginFilter = 'all' | 'installed' | 'not-installed'

export const PluginPanel: React.FC = () => {
  const { state, dispatch } = useContext(AppContext)
  const isOpen = state.showPluginPanel

  const handleClose = () => {
    dispatch({ type: 'SET_PLUGIN_PANEL', payload: false })
  }
  const [plugins, setPlugins] = useState<PluginCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingPlugins, setProcessingPlugins] = useState<Set<string>>(new Set())
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configPluginId, setConfigPluginId] = useState<string | null>(null)
  const [currentConfig, setCurrentConfig] = useState<MintoConfig>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [addPluginDialogOpen, setAddPluginDialogOpen] = useState(false)
  const [filter, setFilter] = useState<PluginFilter>('all')

  // Load plugins on mount
  const loadPlugins = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[PluginPanel] Refreshing plugin status...')
      // Refresh plugin installation status and versions
      await window.api.plugins.refreshStatus()

      console.log('[PluginPanel] Loading plugins...')
      const result = await window.api.plugins.list()
      console.log('[PluginPanel] Plugins list result:', result)

      if (result.success && result.plugins) {
        console.log('[PluginPanel] Raw plugins:', result.plugins)
        // Transform Plugin to PluginCardData
        const cardData: PluginCardData[] = result.plugins.map((plugin) => ({
          ...plugin,
          status: plugin.installed
            ? plugin.updateAvailable
              ? 'update-available'
              : 'installed'
            : 'not-installed',
          latestVersion: plugin.version,
          hasUpdate: plugin.updateAvailable,
          platforms: ['darwin', 'linux', 'win32'], // Default platforms
          installedVersion: plugin.installedVersion
        }))
        console.log('[PluginPanel] Transformed plugins:', cardData)
        setPlugins(cardData)
      } else {
        console.error('[PluginPanel] Failed to load plugins:', result.error)
        setError(result.error || 'Failed to load plugins')
      }
    } catch (err) {
      console.error('[PluginPanel] Error loading plugins:', err)
      setError(err instanceof Error ? err.message : 'Failed to load plugins')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadPlugins()
    }
  }, [isOpen, loadPlugins])

  // Listen for plugin initialization complete
  useEffect(() => {
    const cleanup = window.api.plugins.onInitialized(() => {
      console.log('[PluginPanel] Plugins initialized, reloading...')
      if (isOpen) {
        loadPlugins()
      }
    })
    return cleanup
  }, [isOpen, loadPlugins])

  // Listen for install progress
  useEffect(() => {
    const cleanup = window.api.plugins.onInstallProgress((progress: any) => {
      console.log(`Install progress: ${progress.phase} - ${progress.message} (${progress.percentage}%)`)
      // You could show a toast notification or progress bar here
    })

    return cleanup
  }, [])

  // Listen for update progress
  useEffect(() => {
    const cleanup = window.api.plugins.onUpdateProgress((progress: any) => {
      console.log(`Update progress: ${progress.phase} - ${progress.message} (${progress.percentage}%)`)
      // You could show a toast notification or progress bar here
    })

    return cleanup
  }, [])

  // Listen for plugin status changes (e.g., after auto-install completes)
  useEffect(() => {
    const cleanup = window.api.plugins.onStatusChanged(() => {
      console.log('[PluginPanel] Plugin status changed, reloading...')
      if (isOpen) {
        loadPlugins()
      }
    })
    return cleanup
  }, [isOpen, loadPlugins])

  const handleInstall = async (pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    const pluginName = plugin?.name || pluginId

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))
    setStatusMessage(`Installing ${pluginName}...`)
    setError(null)

    try {
      // Call backend to install plugin directly (no terminal needed)
      const result = await window.api.plugins.install(pluginId)

      if (result.success) {
        setStatusMessage(`✓ ${pluginName} installed successfully${result.version ? ` (v${result.version})` : ''}`)

        // Reload plugins to update status
        await loadPlugins()

        // Auto-clear status message after 5 seconds
        setTimeout(() => setStatusMessage(null), 5000)
      } else {
        const errorMsg = result.error || 'Installation failed'
        setStatusMessage(`✗ ${errorMsg}`)
        setError(errorMsg)
        setTimeout(() => setStatusMessage(null), 5000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Installation failed'
      setStatusMessage(`✗ ${errorMsg}`)
      setError(errorMsg)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleUpdate = async (pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    const pluginName = plugin?.name || pluginId

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))
    setStatusMessage(`Updating ${pluginName}...`)
    setError(null)

    try {
      // Call backend to update plugin directly (no terminal needed)
      const result = await window.api.plugins.update(pluginId)

      if (result.success) {
        setStatusMessage(`✓ ${pluginName} updated successfully${result.version ? ` (v${result.version})` : ''}`)

        // Reload plugins to update status
        await loadPlugins()

        // Auto-clear status message after 5 seconds
        setTimeout(() => setStatusMessage(null), 5000)
      } else {
        const errorMsg = result.error || 'Update failed'
        setStatusMessage(`✗ ${errorMsg}`)
        setError(errorMsg)
        setTimeout(() => setStatusMessage(null), 5000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Update failed'
      setStatusMessage(`✗ ${errorMsg}`)
      setError(errorMsg)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleUninstall = async (pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    const pluginName = plugin?.name || pluginId

    if (!confirm(`Are you sure you want to uninstall ${pluginName}? You can reinstall it later.`)) {
      return
    }

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))
    setStatusMessage(`Uninstalling ${pluginName}...`)

    try {
      const result = await window.api.plugins.remove(pluginId)
      if (result.success) {
        setStatusMessage(`✓ ${pluginName} uninstalled successfully`)
        await loadPlugins()
        setTimeout(() => setStatusMessage(null), 5000)
      } else {
        const errorMsg = result.error || 'Uninstall failed'
        setStatusMessage(`✗ ${errorMsg}`)
        setError(errorMsg)
        setTimeout(() => setStatusMessage(null), 5000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Uninstall failed'
      setStatusMessage(`✗ ${errorMsg}`)
      setError(errorMsg)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleDelete = async (pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    const pluginName = plugin?.name || pluginId

    if (!confirm(`Are you sure you want to delete ${pluginName}? This will uninstall and remove it from the plugin list. This action cannot be undone.`)) {
      return
    }

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))
    setStatusMessage(`Deleting ${pluginName}...`)

    try {
      // First uninstall if installed
      if (plugin?.installed) {
        await window.api.plugins.remove(pluginId)
      }

      // Then remove from registry
      const result = await window.api.plugins.removeCustom(pluginId)
      if (result.success) {
        setStatusMessage(`✓ ${pluginName} deleted successfully`)
        await loadPlugins()
        setTimeout(() => setStatusMessage(null), 5000)
      } else {
        const errorMsg = result.error || 'Delete failed'
        setStatusMessage(`✗ ${errorMsg}`)
        setError(errorMsg)
        setTimeout(() => setStatusMessage(null), 5000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Delete failed'
      setStatusMessage(`✗ ${errorMsg}`)
      setError(errorMsg)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleConfigure = async (pluginId: string) => {
    setConfigPluginId(pluginId)

    // Load current configuration from the plugin's config field
    const plugin = plugins.find((p) => p.id === pluginId)
    if (plugin?.config) {
      setCurrentConfig(plugin.config as MintoConfig)
    } else {
      setCurrentConfig({})
    }

    setConfigDialogOpen(true)
  }

  const handleSaveConfig = async (config: MintoConfig) => {
    if (!configPluginId) {
      return
    }

    const result = await window.api.plugins.configure(configPluginId, config as Record<string, unknown>)
    if (!result.success) {
      throw new Error(result.error || 'Configuration failed')
    }

    await loadPlugins()
  }

  const handleCheckUpdate = async (pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    const pluginName = plugin?.name || pluginId

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))
    setStatusMessage(`Checking for updates for ${pluginName}...`)

    try {
      const result = await window.api.plugins.checkForUpdate(pluginId)
      if (result.success && result.data) {
        // Reload plugins to get updated status
        await loadPlugins()

        if (result.data.hasUpdate) {
          setStatusMessage(`✓ Update available for ${pluginName}: ${result.data.currentVersion} → ${result.data.latestVersion}`)
          console.log(`[PluginPanel] Update available for ${pluginId}: ${result.data.currentVersion} → ${result.data.latestVersion}`)
        } else {
          setStatusMessage(`✓ ${pluginName} is up to date (v${result.data.currentVersion})`)
          console.log(`[PluginPanel] No update available for ${pluginId}`)
        }

        // Auto-clear status message after 5 seconds
        setTimeout(() => setStatusMessage(null), 5000)
      } else {
        const errorMsg = result.error || 'Failed to check for updates'
        setStatusMessage(`✗ ${errorMsg}`)
        setError(errorMsg)
        setTimeout(() => setStatusMessage(null), 5000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check for updates'
      setStatusMessage(`✗ ${errorMsg}`)
      setError(errorMsg)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleAddPlugin = async (urlOrPackageName: string) => {
    setStatusMessage('Adding plugin...')
    setError(null)

    const result = await window.api.plugins.addCustom(urlOrPackageName)

    if (result.success) {
      setStatusMessage(`✓ Plugin added successfully: ${result.pluginId}`)
      await loadPlugins()
      setTimeout(() => setStatusMessage(null), 5000)
    } else {
      const errorMsg = result.error || 'Failed to add plugin'
      setStatusMessage(`✗ ${errorMsg}`)
      setError(errorMsg)
      setTimeout(() => setStatusMessage(null), 5000)
      throw new Error(errorMsg)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  // Sort and filter plugins
  const sortedAndFilteredPlugins = React.useMemo(() => {
    // Define built-in plugin order (lower index = higher priority)
    const builtInOrder: Record<string, number> = {
      'minto': 0,
      'jetr': 1,
    }

    // First, filter plugins based on selected filter
    let filtered = plugins
    if (filter === 'installed') {
      filtered = plugins.filter(p => p.installed)
    } else if (filter === 'not-installed') {
      filtered = plugins.filter(p => !p.installed)
    }

    // Then, sort: installed plugins first, then not-installed
    return filtered.sort((a, b) => {
      // Built-in plugins: use defined order
      if (a.isBuiltIn && b.isBuiltIn) {
        const orderA = builtInOrder[a.id] ?? 999
        const orderB = builtInOrder[b.id] ?? 999
        return orderA - orderB
      }

      // Installed plugins come first
      if (a.installed && !b.installed) return -1
      if (!a.installed && b.installed) return 1

      // Within same installation status, sort by name
      return a.name.localeCompare(b.name)
    })
  }, [plugins, filter])

  // Separate built-in and custom plugins after sorting/filtering
  const builtInPlugins = sortedAndFilteredPlugins.filter(p => p.isBuiltIn)
  const customPlugins = sortedAndFilteredPlugins.filter(p => !p.isBuiltIn)

  // Count plugins by status
  const installedCount = plugins.filter(p => p.installed).length
  const notInstalledCount = plugins.filter(p => !p.installed).length

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
                onClick={() => setAddPluginDialogOpen(true)}
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
              className={`plugin-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({plugins.length})
            </button>
            <button
              className={`plugin-filter-btn ${filter === 'installed' ? 'active' : ''}`}
              onClick={() => setFilter('installed')}
            >
              Installed ({installedCount})
            </button>
            <button
              className={`plugin-filter-btn ${filter === 'not-installed' ? 'active' : ''}`}
              onClick={() => setFilter('not-installed')}
            >
              Not Installed ({notInstalledCount})
            </button>
          </div>

          {statusMessage && (
            <div className="plugin-panel-status">
              {statusMessage}
            </div>
          )}

          <div className="plugin-panel-content">
            {isLoading ? (
              <div className="plugin-panel-loading">
                <div className="plugin-panel-spinner"></div>
                <p>Loading plugins...</p>
              </div>
            ) : error ? (
              <div className="plugin-panel-error">
                <span className="plugin-panel-error-icon">⚠️</span>
                <p>{error}</p>
                <button className="plugin-panel-retry" onClick={loadPlugins}>
                  Retry
                </button>
              </div>
            ) : plugins.length === 0 ? (
              <div className="plugin-panel-empty">
                <p>No plugins available</p>
              </div>
            ) : sortedAndFilteredPlugins.length === 0 ? (
              <div className="plugin-panel-empty">
                <p>No plugins found for this filter</p>
              </div>
            ) : (
              <div className="plugin-panel-list">
                {/* Built-in plugins section */}
                {builtInPlugins.length > 0 && (
                  <div className="plugin-section">
                    <h3 className="plugin-section-title">Built-in Plugins</h3>
                    {builtInPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onInstall={handleInstall}
                        onUpdate={handleUpdate}
                        onUninstall={handleUninstall}
                        onConfigure={handleConfigure}
                        onCheckUpdate={handleCheckUpdate}
                        isProcessing={processingPlugins.has(plugin.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Custom plugins section */}
                {customPlugins.length > 0 && (
                  <div className="plugin-section">
                    <h3 className="plugin-section-title">Custom Plugins</h3>
                    {customPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onInstall={handleInstall}
                        onUpdate={handleUpdate}
                        onUninstall={handleUninstall}
                        onDelete={handleDelete}
                        onConfigure={handleConfigure}
                        onCheckUpdate={handleCheckUpdate}
                        isProcessing={processingPlugins.has(plugin.id)}
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
        isOpen={configDialogOpen}
        currentConfig={currentConfig}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveConfig}
      />

      <AddPluginDialog
        isOpen={addPluginDialogOpen}
        onClose={() => setAddPluginDialogOpen(false)}
        onAdd={handleAddPlugin}
      />
    </>
  )
}
