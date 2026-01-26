/**
 * Custom hook for plugin operations
 * Handles install, update, uninstall, delete, configure, and add operations
 */

import { useState, useCallback } from 'react'
import type { MintoConfig } from '../../types/pluginConfigs'
import type { PluginCardData } from './usePluginList'
import { STATUS_MESSAGE_TIMEOUT_MS } from '../../constants'

export interface UsePluginOperationsOptions {
  plugins: PluginCardData[]
  loadPlugins: () => Promise<void>
  setError: (error: string | null) => void
}

export interface UsePluginOperationsReturn {
  // State
  processingPlugins: Set<string>
  statusMessage: string | null
  configDialogOpen: boolean
  configPluginId: string | null
  currentConfig: MintoConfig
  addPluginDialogOpen: boolean

  // Handlers
  handleInstall: (pluginId: string) => Promise<void>
  handleUpdate: (pluginId: string) => Promise<void>
  handleUninstall: (pluginId: string) => Promise<void>
  handleDelete: (pluginId: string) => Promise<void>
  handleConfigure: (pluginId: string) => Promise<void>
  handleSaveConfig: (config: MintoConfig) => Promise<void>
  handleCheckUpdate: (pluginId: string) => Promise<void>
  handleAddPlugin: (urlOrPackageName: string) => Promise<void>

  // Dialog controls
  openAddPluginDialog: () => void
  closeAddPluginDialog: () => void
  closeConfigDialog: () => void
}

export function usePluginOperations({
  plugins,
  loadPlugins,
  setError
}: UsePluginOperationsOptions): UsePluginOperationsReturn {
  const [processingPlugins, setProcessingPlugins] = useState<Set<string>>(new Set())
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configPluginId, setConfigPluginId] = useState<string | null>(null)
  const [currentConfig, setCurrentConfig] = useState<MintoConfig>({})
  const [addPluginDialogOpen, setAddPluginDialogOpen] = useState(false)

  // Helper to add plugin to processing set
  const startProcessing = useCallback((pluginId: string) => {
    setProcessingPlugins((prev) => new Set(prev).add(pluginId))
  }, [])

  // Helper to remove plugin from processing set
  const stopProcessing = useCallback((pluginId: string) => {
    setProcessingPlugins((prev) => {
      const next = new Set(prev)
      next.delete(pluginId)
      return next
    })
  }, [])

  // Helper to set status with auto-clear
  const setStatusWithAutoClear = useCallback((message: string) => {
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(null), STATUS_MESSAGE_TIMEOUT_MS)
  }, [])

  // Helper to get plugin name
  const getPluginName = useCallback((pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    return plugin?.name || pluginId
  }, [plugins])

  const handleInstall = useCallback(async (pluginId: string) => {
    const pluginName = getPluginName(pluginId)

    startProcessing(pluginId)
    setStatusMessage(`Installing ${pluginName}...`)
    setError(null)

    try {
      const result = await window.api.plugins.install(pluginId)

      if (result.success) {
        setStatusWithAutoClear(`✓ ${pluginName} installed successfully${result.version ? ` (v${result.version})` : ''}`)
        await loadPlugins()
      } else {
        const errorMsg = result.error || 'Installation failed'
        setStatusWithAutoClear(`✗ ${errorMsg}`)
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Installation failed'
      setStatusWithAutoClear(`✗ ${errorMsg}`)
      setError(errorMsg)
    } finally {
      stopProcessing(pluginId)
    }
  }, [getPluginName, startProcessing, stopProcessing, setStatusWithAutoClear, setError, loadPlugins])

  const handleUpdate = useCallback(async (pluginId: string) => {
    const pluginName = getPluginName(pluginId)

    startProcessing(pluginId)
    setStatusMessage(`Updating ${pluginName}...`)
    setError(null)

    try {
      const result = await window.api.plugins.update(pluginId)

      if (result.success) {
        setStatusWithAutoClear(`✓ ${pluginName} updated successfully${result.version ? ` (v${result.version})` : ''}`)
        await loadPlugins()
      } else {
        const errorMsg = result.error || 'Update failed'
        setStatusWithAutoClear(`✗ ${errorMsg}`)
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Update failed'
      setStatusWithAutoClear(`✗ ${errorMsg}`)
      setError(errorMsg)
    } finally {
      stopProcessing(pluginId)
    }
  }, [getPluginName, startProcessing, stopProcessing, setStatusWithAutoClear, setError, loadPlugins])

  const handleUninstall = useCallback(async (pluginId: string) => {
    const pluginName = getPluginName(pluginId)

    if (!confirm(`Are you sure you want to uninstall ${pluginName}? You can reinstall it later.`)) {
      return
    }

    startProcessing(pluginId)
    setStatusMessage(`Uninstalling ${pluginName}...`)

    try {
      const result = await window.api.plugins.remove(pluginId)
      if (result.success) {
        setStatusWithAutoClear(`✓ ${pluginName} uninstalled successfully`)
        await loadPlugins()
      } else {
        const errorMsg = result.error || 'Uninstall failed'
        setStatusWithAutoClear(`✗ ${errorMsg}`)
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Uninstall failed'
      setStatusWithAutoClear(`✗ ${errorMsg}`)
      setError(errorMsg)
    } finally {
      stopProcessing(pluginId)
    }
  }, [getPluginName, startProcessing, stopProcessing, setStatusWithAutoClear, setError, loadPlugins])

  const handleDelete = useCallback(async (pluginId: string) => {
    const plugin = plugins.find(p => p.id === pluginId)
    const pluginName = plugin?.name || pluginId

    if (!confirm(`Are you sure you want to delete ${pluginName}? This will uninstall and remove it from the plugin list. This action cannot be undone.`)) {
      return
    }

    startProcessing(pluginId)
    setStatusMessage(`Deleting ${pluginName}...`)

    try {
      // First uninstall if installed
      if (plugin?.installed) {
        await window.api.plugins.remove(pluginId)
      }

      // Then remove from registry
      const result = await window.api.plugins.removeCustom(pluginId)
      if (result.success) {
        setStatusWithAutoClear(`✓ ${pluginName} deleted successfully`)
        await loadPlugins()
      } else {
        const errorMsg = result.error || 'Delete failed'
        setStatusWithAutoClear(`✗ ${errorMsg}`)
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Delete failed'
      setStatusWithAutoClear(`✗ ${errorMsg}`)
      setError(errorMsg)
    } finally {
      stopProcessing(pluginId)
    }
  }, [plugins, startProcessing, stopProcessing, setStatusWithAutoClear, setError, loadPlugins])

  const handleConfigure = useCallback(async (pluginId: string) => {
    setConfigPluginId(pluginId)

    const plugin = plugins.find((p) => p.id === pluginId)
    if (plugin?.config) {
      setCurrentConfig(plugin.config as MintoConfig)
    } else {
      setCurrentConfig({})
    }

    setConfigDialogOpen(true)
  }, [plugins])

  const handleSaveConfig = useCallback(async (config: MintoConfig) => {
    if (!configPluginId) {
      return
    }

    const result = await window.api.plugins.configure(configPluginId, config as Record<string, unknown>)
    if (!result.success) {
      throw new Error(result.error || 'Configuration failed')
    }

    await loadPlugins()
  }, [configPluginId, loadPlugins])

  const handleCheckUpdate = useCallback(async (pluginId: string) => {
    const pluginName = getPluginName(pluginId)

    startProcessing(pluginId)
    setStatusMessage(`Checking for updates for ${pluginName}...`)

    try {
      const result = await window.api.plugins.checkForUpdate(pluginId)
      if (result.success && result.data) {
        await loadPlugins()

        if (result.data.hasUpdate) {
          setStatusWithAutoClear(`✓ Update available for ${pluginName}: ${result.data.currentVersion} → ${result.data.latestVersion}`)
          console.log(`[PluginPanel] Update available for ${pluginId}: ${result.data.currentVersion} → ${result.data.latestVersion}`)
        } else {
          setStatusWithAutoClear(`✓ ${pluginName} is up to date (v${result.data.currentVersion})`)
          console.log(`[PluginPanel] No update available for ${pluginId}`)
        }
      } else {
        const errorMsg = result.error || 'Failed to check for updates'
        setStatusWithAutoClear(`✗ ${errorMsg}`)
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check for updates'
      setStatusWithAutoClear(`✗ ${errorMsg}`)
      setError(errorMsg)
    } finally {
      stopProcessing(pluginId)
    }
  }, [getPluginName, startProcessing, stopProcessing, setStatusWithAutoClear, setError, loadPlugins])

  const handleAddPlugin = useCallback(async (urlOrPackageName: string) => {
    setStatusMessage('Adding plugin...')
    setError(null)

    const result = await window.api.plugins.addCustom(urlOrPackageName)

    if (result.success) {
      setStatusWithAutoClear(`✓ Plugin added successfully: ${result.pluginId}`)
      await loadPlugins()
    } else {
      const errorMsg = result.error || 'Failed to add plugin'
      setStatusWithAutoClear(`✗ ${errorMsg}`)
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }, [setStatusWithAutoClear, setError, loadPlugins])

  const openAddPluginDialog = useCallback(() => {
    setAddPluginDialogOpen(true)
  }, [])

  const closeAddPluginDialog = useCallback(() => {
    setAddPluginDialogOpen(false)
  }, [])

  const closeConfigDialog = useCallback(() => {
    setConfigDialogOpen(false)
  }, [])

  return {
    processingPlugins,
    statusMessage,
    configDialogOpen,
    configPluginId,
    currentConfig,
    addPluginDialogOpen,
    handleInstall,
    handleUpdate,
    handleUninstall,
    handleDelete,
    handleConfigure,
    handleSaveConfig,
    handleCheckUpdate,
    handleAddPlugin,
    openAddPluginDialog,
    closeAddPluginDialog,
    closeConfigDialog
  }
}
