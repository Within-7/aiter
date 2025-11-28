import { useContext, useState, useEffect } from 'react'
import { AppContext } from '../../context/AppContext'
import { PluginButton, PluginStatus } from './PluginButton'
import { Terminal } from '../../../types'
import './StatusBar.css'

export interface StatusBarProps {
  activeTerminal?: Terminal
}

export function StatusBar({ activeTerminal }: StatusBarProps) {
  const { state } = useContext(AppContext)
  const [pluginStatus, setPluginStatus] = useState<PluginStatus>('no-plugins')
  const [pluginCount, setPluginCount] = useState(0)
  const [hasUpdates, setHasUpdates] = useState(false)

  // Check plugin status on mount and every hour
  useEffect(() => {
    const checkPluginStatus = async () => {
      // TODO: Replace with actual window.api.plugins.getStatus() when plugin system is implemented
      // For now, use placeholder logic
      try {
        // Simulated plugin status check
        // const result = await window.api.plugins.getStatus()
        // if (result.success) {
        //   setPluginCount(result.data?.count || 0)
        //   setHasUpdates(result.data?.hasUpdates || false)
        //
        //   if (result.data?.installing) {
        //     setPluginStatus('installing')
        //   } else if (result.data?.hasUpdates) {
        //     setPluginStatus('update-available')
        //   } else if (result.data?.count > 0) {
        //     setPluginStatus('has-plugins')
        //   } else {
        //     setPluginStatus('no-plugins')
        //   }
        // }

        // Placeholder: Default to no plugins
        setPluginStatus('no-plugins')
        setPluginCount(0)
        setHasUpdates(false)
      } catch (error) {
        console.error('Failed to check plugin status:', error)
        setPluginStatus('no-plugins')
      }
    }

    // Check on mount
    checkPluginStatus()

    // Auto-refresh every hour (3600000ms)
    const intervalId = setInterval(checkPluginStatus, 3600000)

    return () => clearInterval(intervalId)
  }, [])

  // Handle plugin button click
  const handlePluginClick = () => {
    // TODO: Implement plugin panel opening logic
    // For now, just log
    console.log('Plugin panel clicked - to be implemented')
    // Future: dispatch({ type: 'OPEN_PLUGIN_PANEL' })
  }

  // Handle settings button click
  const handleSettingsClick = () => {
    console.log('Settings clicked - to be implemented')
    // Future: dispatch({ type: 'OPEN_SETTINGS' })
  }

  // Get active project info
  const activeProject = state.projects.find(p => p.id === state.activeProjectId)

  // Count stats
  const projectCount = state.projects.length
  const terminalCount = state.terminals.length
  const editorTabCount = state.editorTabs.length

  // Get terminal shell name (last part of path)
  const getShellName = (terminal: Terminal) => {
    return terminal.shell.split('/').pop() || terminal.shell
  }

  return (
    <div className="status-bar">
      {/* Left section: Plugins */}
      <div className="status-bar-section status-bar-left">
        <PluginButton
          pluginCount={pluginCount}
          status={pluginStatus}
          hasUpdates={hasUpdates}
          onClick={handlePluginClick}
        />
      </div>

      {/* Center section: Terminal info */}
      <div className="status-bar-section status-bar-center">
        {activeTerminal && (
          <>
            <span className="status-item" title={`Shell: ${activeTerminal.shell}`}>
              <span className="status-icon">▶</span>
              <span className="status-text">{getShellName(activeTerminal)}</span>
            </span>
            {activeTerminal.pid && (
              <span className="status-item" title="Process ID">
                <span className="status-text">PID: {activeTerminal.pid}</span>
              </span>
            )}
            {activeProject && (
              <span className="status-item" title={`Project: ${activeProject.path}`}>
                <span className="status-icon">📁</span>
                <span className="status-text">{activeProject.name}</span>
              </span>
            )}
          </>
        )}
        {!activeTerminal && activeProject && (
          <span className="status-item" title={`Project: ${activeProject.path}`}>
            <span className="status-icon">📁</span>
            <span className="status-text">{activeProject.name}</span>
          </span>
        )}
      </div>

      {/* Right section: Stats and settings */}
      <div className="status-bar-section status-bar-right">
        {projectCount > 0 && (
          <span className="status-item" title={`${projectCount} project${projectCount !== 1 ? 's' : ''} loaded`}>
            <span className="status-text">
              {projectCount} {projectCount === 1 ? 'Project' : 'Projects'}
            </span>
          </span>
        )}
        {terminalCount > 0 && (
          <span className="status-item" title={`${terminalCount} terminal${terminalCount !== 1 ? 's' : ''} open`}>
            <span className="status-text">
              {terminalCount} {terminalCount === 1 ? 'Terminal' : 'Terminals'}
            </span>
          </span>
        )}
        {editorTabCount > 0 && (
          <span className="status-item" title={`${editorTabCount} editor tab${editorTabCount !== 1 ? 's' : ''} open`}>
            <span className="status-text">
              {editorTabCount} {editorTabCount === 1 ? 'Tab' : 'Tabs'}
            </span>
          </span>
        )}
        <button
          className="status-button settings-button"
          onClick={handleSettingsClick}
          title="Open Settings"
        >
          <span className="status-icon">⚙️</span>
        </button>
      </div>
    </div>
  )
}
