import React, { useState, useEffect, useCallback } from 'react'
import { PluginListItem } from '../../../types/plugin'
import { PluginCard } from './PluginCard'
import { MintoConfigDialog } from './MintoConfigDialog'
import './Plugins.css'

interface PluginPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface MintoConfig {
  githubToken?: string
  autoCheckUpdates?: boolean
}

interface ProgressEvent {
  pluginId: string
  progress: number
  phase: string
  message: string
}

export const PluginPanel: React.FC<PluginPanelProps> = ({ isOpen, onClose }) => {
  const [plugins, setPlugins] = useState<PluginListItem[]>([])
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
      // Check if plugins API exists
      if (!window.api?.plugins) {
        // Mock data for development until backend is implemented
        setPlugins([
          {
            id: 'minto',
            name: 'Minto CLI',
            description: 'AI-powered commit message generator and Git workflow assistant',
            icon: '🤖',
            status: 'not-installed',
            installedVersion: null,
            latestVersion: '1.2.0',
            hasUpdate: false,
            enabled: true,
            platforms: ['darwin', 'linux', 'win32'],
            tags: ['git', 'ai', 'productivity']
          },
          {
            id: 'claude-code',
            name: 'Claude Code CLI',
            description: 'Official Claude AI CLI for code generation and assistance',
            icon: '🔮',
            status: 'not-installed',
            installedVersion: null,
            latestVersion: '2.0.1',
            hasUpdate: false,
            enabled: true,
            platforms: ['darwin', 'linux', 'win32'],
            tags: ['ai', 'code-generation']
          },
          {
            id: 'gemini-cli',
            name: 'Gemini CLI',
            description: 'Google Gemini AI CLI tool for development workflows',
            icon: '💎',
            status: 'not-installed',
            installedVersion: null,
            latestVersion: '1.0.5',
            hasUpdate: false,
            enabled: true,
            platforms: ['darwin', 'linux', 'win32'],
            tags: ['ai', 'google']
          }
        ])
        setIsLoading(false)
        return
      }

      const result = await window.api.plugins.list()
      if (result.success && result.plugins) {
        setPlugins(result.plugins)
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
    if (!window.api?.plugins?.onInstallProgress) return

    const cleanup = window.api.plugins.onInstallProgress((event: ProgressEvent) => {
      console.log(`Install progress: ${event.pluginId} - ${event.message}`)
      // You could show a toast notification or progress bar here
    })

    return cleanup
  }, [])

  // Listen for update progress
  useEffect(() => {
    if (!window.api?.plugins?.onUpdateProgress) return

    const cleanup = window.api.plugins.onUpdateProgress((event: ProgressEvent) => {
      console.log(`Update progress: ${event.pluginId} - ${event.message}`)
      // You could show a toast notification or progress bar here
    })

    return cleanup
  }, [])

  const handleInstall = async (pluginId: string) => {
    if (!window.api?.plugins) {
      alert('Plugin system not available. Backend implementation needed.')
      return
    }

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))

    try {
      const result = await window.api.plugins.install(pluginId)
      if (result.success) {
        await loadPlugins()
      } else {
        setError(result.error || 'Installation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed')
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleUpdate = async (pluginId: string) => {
    if (!window.api?.plugins) {
      alert('Plugin system not available. Backend implementation needed.')
      return
    }

    setProcessingPlugins((prev) => new Set(prev).add(pluginId))

    try {
      const result = await window.api.plugins.update(pluginId)
      if (result.success) {
        await loadPlugins()
      } else {
        setError(result.error || 'Update failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setProcessingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(pluginId)
        return next
      })
    }
  }

  const handleRemove = async (pluginId: string) => {
    if (!window.api?.plugins) {
      alert('Plugin system not available. Backend implementation needed.')
      return
    }

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

    // Load current configuration
    if (window.api?.plugins?.getConfiguration) {
      try {
        const result = await window.api.plugins.getConfiguration(pluginId)
        if (result.success && result.config) {
          setCurrentConfig(result.config as MintoConfig)
        }
      } catch (err) {
        console.error('Failed to load configuration:', err)
      }
    }

    setConfigDialogOpen(true)
  }

  const handleSaveConfig = async (config: MintoConfig) => {
    if (!configPluginId || !window.api?.plugins) {
      alert('Plugin system not available. Backend implementation needed.')
      return
    }

    const result = await window.api.plugins.configure(configPluginId, config)
    if (!result.success) {
      throw new Error(result.error || 'Configuration failed')
    }

    await loadPlugins()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
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
              onClick={onClose}
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
