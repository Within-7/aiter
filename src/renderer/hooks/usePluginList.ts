/**
 * Custom hook for plugin list management
 * Handles plugin loading, event listeners, filtering, and sorting
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Plugin } from '../../types'

// Extended plugin interface for display
export interface PluginCardData extends Plugin {
  status: 'installed' | 'not-installed' | 'update-available' | 'installing' | 'updating' | 'removing' | 'error'
  latestVersion: string | null
  hasUpdate: boolean
  platforms: string[]
}

export type PluginFilter = 'all' | 'installed' | 'not-installed' | 'built-in' | 'custom' | 'updates-available'

export interface UsePluginListReturn {
  // State
  plugins: PluginCardData[]
  isLoading: boolean
  error: string | null
  filter: PluginFilter

  // Derived data
  sortedAndFilteredPlugins: PluginCardData[]
  builtInPlugins: PluginCardData[]
  customPlugins: PluginCardData[]
  installedCount: number
  notInstalledCount: number
  builtInCount: number
  customCount: number
  updatesAvailableCount: number

  // Actions
  loadPlugins: () => Promise<void>
  setFilter: (filter: PluginFilter) => void
  setError: (error: string | null) => void
}

export function usePluginList(isOpen: boolean): UsePluginListReturn {
  const [plugins, setPlugins] = useState<PluginCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PluginFilter>('all')

  // Load plugins
  const loadPlugins = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[PluginPanel] Refreshing plugin status...')
      await window.api.plugins.refreshStatus()

      console.log('[PluginPanel] Loading plugins...')
      const result = await window.api.plugins.list()
      console.log('[PluginPanel] Plugins list result:', result)

      if (result.success && result.plugins) {
        console.log('[PluginPanel] Raw plugins:', result.plugins)
        const cardData: PluginCardData[] = result.plugins.map((plugin) => ({
          ...plugin,
          status: plugin.installed
            ? plugin.updateAvailable
              ? 'update-available'
              : 'installed'
            : 'not-installed',
          latestVersion: plugin.version,
          hasUpdate: plugin.updateAvailable,
          platforms: ['darwin', 'linux', 'win32'],
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

  // Load plugins when panel opens
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
    const cleanup = window.api.plugins.onInstallProgress((progress: unknown) => {
      const p = progress as { phase: string; message: string; percentage: number }
      console.log(`Install progress: ${p.phase} - ${p.message} (${p.percentage}%)`)
    })
    return cleanup
  }, [])

  // Listen for update progress
  useEffect(() => {
    const cleanup = window.api.plugins.onUpdateProgress((progress: unknown) => {
      const p = progress as { phase: string; message: string; percentage: number }
      console.log(`Update progress: ${p.phase} - ${p.message} (${p.percentage}%)`)
    })
    return cleanup
  }, [])

  // Listen for plugin status changes
  useEffect(() => {
    const cleanup = window.api.plugins.onStatusChanged(() => {
      console.log('[PluginPanel] Plugin status changed, reloading...')
      if (isOpen) {
        loadPlugins()
      }
    })
    return cleanup
  }, [isOpen, loadPlugins])

  // Sort and filter plugins
  const sortedAndFilteredPlugins = useMemo(() => {
    const builtInOrder: Record<string, number> = {
      'minto': 0,
      'jetr': 1,
    }

    let filtered = plugins
    if (filter === 'installed') {
      filtered = plugins.filter(p => p.installed)
    } else if (filter === 'not-installed') {
      filtered = plugins.filter(p => !p.installed)
    } else if (filter === 'built-in') {
      filtered = plugins.filter(p => p.isBuiltIn)
    } else if (filter === 'custom') {
      filtered = plugins.filter(p => !p.isBuiltIn)
    } else if (filter === 'updates-available') {
      filtered = plugins.filter(p => p.hasUpdate)
    }

    return filtered.sort((a, b) => {
      if (a.isBuiltIn && b.isBuiltIn) {
        const orderA = builtInOrder[a.id] ?? 999
        const orderB = builtInOrder[b.id] ?? 999
        return orderA - orderB
      }

      if (a.installed && !b.installed) return -1
      if (!a.installed && b.installed) return 1

      return a.name.localeCompare(b.name)
    })
  }, [plugins, filter])

  // Separate built-in and custom plugins
  const builtInPlugins = useMemo(
    () => sortedAndFilteredPlugins.filter(p => p.isBuiltIn),
    [sortedAndFilteredPlugins]
  )

  const customPlugins = useMemo(
    () => sortedAndFilteredPlugins.filter(p => !p.isBuiltIn),
    [sortedAndFilteredPlugins]
  )

  // Count plugins by status and type
  const installedCount = useMemo(() => plugins.filter(p => p.installed).length, [plugins])
  const notInstalledCount = useMemo(() => plugins.filter(p => !p.installed).length, [plugins])
  const builtInCount = useMemo(() => plugins.filter(p => p.isBuiltIn).length, [plugins])
  const customCount = useMemo(() => plugins.filter(p => !p.isBuiltIn).length, [plugins])
  const updatesAvailableCount = useMemo(() => plugins.filter(p => p.hasUpdate).length, [plugins])

  return {
    plugins,
    isLoading,
    error,
    filter,
    sortedAndFilteredPlugins,
    builtInPlugins,
    customPlugins,
    installedCount,
    notInstalledCount,
    builtInCount,
    customCount,
    updatesAvailableCount,
    loadPlugins,
    setFilter,
    setError
  }
}
