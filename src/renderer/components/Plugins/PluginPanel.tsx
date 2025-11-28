import React, { useState, useEffect, useCallback, useContext } from 'react'
import { Plugin, PluginInstallProgress, PluginUpdateProgress } from '../../../types'
import { PluginCard } from './PluginCard'
import { MintoConfigDialog } from './MintoConfigDialog'
import { AppContext } from '../../context/AppContext'
import './Plugins.css'

interface MintoConfig {
  githubToken?: string
  autoCheckUpdates?: boolean
}

// Extended plugin interface for display
interface PluginCardData extends Plugin {
  status: 'installed' | 'not-installed' | 'update-available' | 'installing' | 'updating' | 'removing' | 'error'
  latestVersion: string | null
  hasUpdate: boolean
  platforms: string[]
}

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

  // Load plugins on mount
  const loadPlugins = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.api.plugins.list()
      if (result.success && result.plugins) {
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
        setPlugins(cardData)
      } else {
        setError(result.error || 'Failed to load plugins')
      }
    } catch (err) {
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

  // Listen for install progress
  useEffect(() => {
    const cleanup = window.api.plugins.onInstallProgress((progress: PluginInstallProgress) => {
      console.log(`Install progress: ${progress.pluginId} - ${progress.status} (${progress.progress}%)`)
      // You could show a toast notification or progress bar here
    })

    return cleanup
  }, [])

  // Listen for update progress
  useEffect(() => {
    const cleanup = window.api.plugins.onUpdateProgress((progress: PluginUpdateProgress) => {
      console.log(`Update progress: ${progress.pluginId} - ${progress.status} (${progress.progress}%)`)
      // You could show a toast notification or progress bar here
    })

    return cleanup
  }, [])

  const handleInstall = async (pluginId: string) => {
    try {
      // Get the install command
      const commandResult = await window.api.plugins.getInstallCommand(pluginId)
      if (!commandResult.success || !commandResult.command) {
        setError(commandResult.error || 'Failed to get install command')
        return
      }

      // Get current active project for terminal context
      const activeProject = state.projects.find(p => p.id === state.activeProjectId)
      if (!activeProject) {
        setError('No active project. Please select a project first.')
        return
      }

      // Create a new terminal and execute the install command
      const terminalResult = await window.api.terminal.create({
        cwd: activeProject.path,
        shell: state.settings?.shell || '/bin/bash',
        projectId: activeProject.id,
        projectName: activeProject.name
      })

      if (terminalResult.success && terminalResult.terminal) {
        // Write the command to the terminal
        await window.api.terminal.write({
          id: terminalResult.terminal.id,
          data: commandResult.command + '\r'
        })

        // Close the plugin panel to show the terminal
        dispatch({ type: 'SET_PLUGIN_PANEL', payload: false })

        // Reload plugins after a delay to check installation status
        setTimeout(() => {
          loadPlugins()
        }, 2000)
      } else {
        setError(terminalResult.error || 'Failed to create terminal')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed')
    }
  }

  const handleUpdate = async (pluginId: string) => {
    try {
      // Get the update command
      const commandResult = await window.api.plugins.getUpdateCommand(pluginId)
      if (!commandResult.success || !commandResult.command) {
        setError(commandResult.error || 'Failed to get update command')
        return
      }

      // Get current active project for terminal context
      const activeProject = state.projects.find(p => p.id === state.activeProjectId)
      if (!activeProject) {
        setError('No active project. Please select a project first.')
        return
      }

      // Create a new terminal and execute the update command
      const terminalResult = await window.api.terminal.create({
        cwd: activeProject.path,
        shell: state.settings?.shell || '/bin/bash',
        projectId: activeProject.id,
        projectName: activeProject.name
      })

      if (terminalResult.success && terminalResult.terminal) {
        // Write the command to the terminal
        await window.api.terminal.write({
          id: terminalResult.terminal.id,
          data: commandResult.command + '\r'
        })

        // Close the plugin panel to show the terminal
        dispatch({ type: 'SET_PLUGIN_PANEL', payload: false })

        // Reload plugins after a delay to check update status
        setTimeout(() => {
          loadPlugins()
        }, 2000)
      } else {
        setError(terminalResult.error || 'Failed to create terminal')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleRemove = async (pluginId: string) => {
    if (!confirm(`Are you sure you want to remove ${pluginId}?`)) {
      return
    }

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))

    try {
      const result = await window.api.plugins.remove(pluginId)
      if (result.success) {
        await loadPlugins()
      } else {
        setError(result.error || 'Removal failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Removal failed')
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
            <button
              className="plugin-panel-close"
              onClick={handleClose}
              aria-label="Close plugins panel"
            >
              ×
            </button>
          </div>

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
            ) : (
              <div className="plugin-panel-list">
                {plugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    onInstall={handleInstall}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                    onConfigure={handleConfigure}
                    isProcessing={processingPlugins.has(plugin.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="plugin-panel-footer">
            <a
              href="https://github.com/your-org/aiter-plugins"
              target="_blank"
              rel="noopener noreferrer"
              className="plugin-panel-browse"
            >
              Browse more plugins →
            </a>
          </div>
        </div>
      </div>

      <MintoConfigDialog
        isOpen={configDialogOpen}
        currentConfig={currentConfig}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveConfig}
      />
    </>
  )
}
