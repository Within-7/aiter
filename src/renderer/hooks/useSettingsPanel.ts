/**
 * Custom hook for SettingsPanel state management
 * Handles shell detection, version managers, proxy status, and config isolation
 */

import { useState, useEffect, useCallback, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import {
  AppSettings,
  DetectedShell,
  VersionManagerInfo,
  ShellType,
  ShortcutConfig,
  KeyboardShortcut,
  ConfigIsolationSettings,
  DEFAULT_CONFIG_ISOLATION_TOOLS
} from '../../types'
import { VoiceInputSettings as VoiceInputSettingsType } from '../../types/voiceInput'
import { changeLanguage, type LanguageCode } from '../i18n'

// Default shortcuts for reset
export const defaultShortcuts: ShortcutConfig[] = [
  { action: 'newTerminal', label: 'New Terminal', shortcut: { key: 't', metaKey: true }, enabled: true },
  { action: 'closeTab', label: 'Close Tab', shortcut: { key: 'w', metaKey: true }, enabled: true },
  { action: 'saveFile', label: 'Save File', shortcut: { key: 's', metaKey: true }, enabled: true },
  { action: 'openSettings', label: 'Open Settings', shortcut: { key: ',', metaKey: true }, enabled: true },
  { action: 'newWindow', label: 'New Window', shortcut: { key: 'n', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'toggleSidebar', label: 'Toggle Sidebar', shortcut: { key: 'b', metaKey: true }, enabled: true },
  { action: 'nextTab', label: 'Next Tab', shortcut: { key: ']', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'prevTab', label: 'Previous Tab', shortcut: { key: '[', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'focusTerminal', label: 'Focus Terminal', shortcut: { key: '`', ctrlKey: true }, enabled: true },
  { action: 'focusEditor', label: 'Focus Editor', shortcut: { key: 'e', metaKey: true, shiftKey: true }, enabled: true }
]

export interface SystemProxyStatus {
  mode: string
  url?: string
  active: boolean
}

export interface UseSettingsPanelReturn {
  // State
  settings: AppSettings
  availableShells: DetectedShell[]
  detectedVersionManagers: VersionManagerInfo[]
  currentConfigFiles: string[]
  systemProxyStatus: SystemProxyStatus | null
  defaultConfigPath: string
  isWindows: boolean
  isMac: boolean
  shortcuts: ShortcutConfig[]

  // Settings handlers
  handleSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
  handleLanguageChange: (newLanguage: LanguageCode) => Promise<void>

  // Shortcut handlers
  handleShortcutChange: (action: string, newShortcut: KeyboardShortcut) => void
  handleShortcutToggle: (action: string, enabled: boolean) => void
  handleResetShortcuts: () => void

  // Voice settings handler
  handleVoiceSettingsChange: (voiceSettings: VoiceInputSettingsType) => void

  // Config isolation handlers
  getConfigIsolation: () => ConfigIsolationSettings
  handleConfigIsolationToggle: (enabled: boolean) => void
  handleToolIsolationToggle: (toolId: string, enabled: boolean) => void
  handleToolCustomPath: (toolId: string, customPath: string | undefined) => void
  handleBasePathChange: (basePath: string | undefined) => void

  // Utility
  formatPath: (path: string) => string
}

export function useSettingsPanel(isOpen: boolean): UseSettingsPanelReturn {
  const { state, dispatch } = useContext(AppContext)
  const { settings } = state

  // Shell and version manager detection state
  const [availableShells, setAvailableShells] = useState<DetectedShell[]>([])
  const [detectedVersionManagers, setDetectedVersionManagers] = useState<VersionManagerInfo[]>([])
  const [currentConfigFiles, setCurrentConfigFiles] = useState<string[]>([])
  const [isWindows] = useState(() => navigator.platform.toLowerCase().includes('win'))
  const [isMac] = useState(() => navigator.platform.toLowerCase().includes('mac'))

  // Proxy status state
  const [systemProxyStatus, setSystemProxyStatus] = useState<SystemProxyStatus | null>(null)

  // Config isolation default path
  const [defaultConfigPath, setDefaultConfigPath] = useState<string>('~/.aiter/config')

  // Fetch available shells, version managers, and proxy status on mount
  useEffect(() => {
    if (isOpen) {
      // Detect available shells
      window.api.shell.detectAvailable()
        .then(result => {
          if (result.success && result.shells) {
            setAvailableShells(result.shells)
          }
        })
        .catch(error => {
          console.error('Failed to detect available shells:', error)
        })

      // Detect version managers
      window.api.versionManager.getDetected()
        .then(result => {
          if (result.success && result.managers) {
            setDetectedVersionManagers(result.managers)
          }
        })
        .catch(error => {
          console.error('Failed to detect version managers:', error)
        })

      // Get proxy status
      window.api.proxy.getStatus()
        .then(result => {
          if (result.success) {
            setSystemProxyStatus({
              mode: result.mode || 'off',
              url: result.url,
              active: result.active || false
            })
          }
        })
        .catch(error => {
          console.error('Failed to get proxy status:', error)
        })

      // Get default config isolation path
      window.api.nodejs.getDefaultConfigPath()
        .then(result => {
          if (result.success && result.path) {
            setDefaultConfigPath(result.path)
          }
        })
        .catch(error => {
          console.error('Failed to get default config path:', error)
        })
    }
  }, [isOpen])

  // Update config files when shell changes
  useEffect(() => {
    if (isOpen && settings.shell) {
      // Determine shell type from path
      const shellName = settings.shell.split('/').pop()?.split('\\').pop()?.toLowerCase() || ''
      let shellType: ShellType = 'other'
      if (shellName.includes('zsh')) shellType = 'zsh'
      else if (shellName.includes('bash')) shellType = 'bash'
      else if (shellName.includes('fish')) shellType = 'fish'
      else if (shellName.includes('powershell')) shellType = 'powershell'
      else if (shellName.includes('pwsh')) shellType = 'pwsh'
      else if (shellName.includes('cmd')) shellType = 'cmd'

      window.api.shell.getConfigFiles(shellType)
        .then(result => {
          if (result.success && result.files) {
            setCurrentConfigFiles(result.files)
          }
        })
        .catch(error => {
          console.error('Failed to get shell config files:', error)
        })
    } else if (isOpen && availableShells.length > 0) {
      // Use default shell's config files
      const defaultShell = availableShells.find(s => s.isDefault) || availableShells[0]
      if (defaultShell) {
        setCurrentConfigFiles(defaultShell.configFiles)
      }
    }
  }, [isOpen, settings.shell, availableShells])

  // Settings change handler
  const handleSettingChange = useCallback(async <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } })
    await window.api.settings.update({ [key]: value })
  }, [dispatch])

  // Language change handler
  const handleLanguageChange = useCallback(async (newLanguage: LanguageCode) => {
    await changeLanguage(newLanguage)
    handleSettingChange('language', newLanguage)
  }, [handleSettingChange])

  // Get current shortcuts or use defaults
  const shortcuts = settings.shortcuts || defaultShortcuts

  // Shortcut handlers
  const handleShortcutChange = useCallback((action: string, newShortcut: KeyboardShortcut) => {
    const updatedShortcuts = shortcuts.map(s =>
      s.action === action ? { ...s, shortcut: newShortcut } : s
    )
    handleSettingChange('shortcuts', updatedShortcuts)
  }, [shortcuts, handleSettingChange])

  const handleShortcutToggle = useCallback((action: string, enabled: boolean) => {
    const updatedShortcuts = shortcuts.map(s =>
      s.action === action ? { ...s, enabled } : s
    )
    handleSettingChange('shortcuts', updatedShortcuts)
  }, [shortcuts, handleSettingChange])

  const handleResetShortcuts = useCallback(() => {
    handleSettingChange('shortcuts', defaultShortcuts)
  }, [handleSettingChange])

  // Voice settings handler
  const handleVoiceSettingsChange = useCallback((voiceSettings: VoiceInputSettingsType) => {
    handleSettingChange('voiceInput', voiceSettings)
  }, [handleSettingChange])

  // Config isolation handlers
  const getConfigIsolation = useCallback((): ConfigIsolationSettings => {
    return settings.configIsolation || {
      enabled: false,
      basePath: undefined,
      tools: DEFAULT_CONFIG_ISOLATION_TOOLS
    }
  }, [settings.configIsolation])

  const handleConfigIsolationToggle = useCallback((enabled: boolean) => {
    const current = getConfigIsolation()
    handleSettingChange('configIsolation', { ...current, enabled })
  }, [getConfigIsolation, handleSettingChange])

  const handleToolIsolationToggle = useCallback((toolId: string, enabled: boolean) => {
    const current = getConfigIsolation()
    const updatedTools = current.tools.map(tool =>
      tool.id === toolId ? { ...tool, enabled } : tool
    )
    handleSettingChange('configIsolation', { ...current, tools: updatedTools })
  }, [getConfigIsolation, handleSettingChange])

  const handleToolCustomPath = useCallback((toolId: string, customPath: string | undefined) => {
    const current = getConfigIsolation()
    const updatedTools = current.tools.map(tool =>
      tool.id === toolId ? { ...tool, customPath } : tool
    )
    handleSettingChange('configIsolation', { ...current, tools: updatedTools })
  }, [getConfigIsolation, handleSettingChange])

  const handleBasePathChange = useCallback((basePath: string | undefined) => {
    const current = getConfigIsolation()
    handleSettingChange('configIsolation', { ...current, basePath })
  }, [getConfigIsolation, handleSettingChange])

  // Format path for display (shorten home directory)
  const formatPath = useCallback((path: string): string => {
    const homePatterns = isWindows
      ? [/^C:\\Users\\[^\\]+/, /^\/c\/Users\/[^/]+/]
      : [/^\/Users\/[^/]+/, /^\/home\/[^/]+/]

    for (const pattern of homePatterns) {
      const match = path.match(pattern)
      if (match) {
        return '~' + path.slice(match[0].length)
      }
    }
    return path
  }, [isWindows])

  return {
    settings,
    availableShells,
    detectedVersionManagers,
    currentConfigFiles,
    systemProxyStatus,
    defaultConfigPath,
    isWindows,
    isMac,
    shortcuts,
    handleSettingChange,
    handleLanguageChange,
    handleShortcutChange,
    handleShortcutToggle,
    handleResetShortcuts,
    handleVoiceSettingsChange,
    getConfigIsolation,
    handleConfigIsolationToggle,
    handleToolIsolationToggle,
    handleToolCustomPath,
    handleBasePathChange,
    formatPath
  }
}
