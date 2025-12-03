import { useContext, useState, useEffect } from 'react'
import { AppContext } from '../../context/AppContext'
import { PluginButton, PluginStatus } from './PluginButton'
import { Terminal } from '../../../types'
import { AiOutlineInfoCircle } from 'react-icons/ai'
import './StatusBar.css'

export interface StatusBarProps {
  activeTerminal?: Terminal
}

export function StatusBar({ activeTerminal }: StatusBarProps) {
  const { state, dispatch } = useContext(AppContext)
  const [pluginStatus, setPluginStatus] = useState<PluginStatus>('no-plugins')
  const [pluginCount, setPluginCount] = useState(0)
  const [hasUpdates, setHasUpdates] = useState(false)

  // Check plugin status on mount and every hour
  useEffect(() => {
    const checkPluginStatus = async () => {
      try {
        const result = await window.api.plugins.list()
        if (result.success && result.plugins) {
          const installed = result.plugins.filter(p => p.installed)
          const updates = result.plugins.filter(p => p.updateAvailable)

          setPluginCount(installed.length)
          setHasUpdates(updates.length > 0)

          if (updates.length > 0) {
            setPluginStatus('update-available')
          } else if (installed.length > 0) {
            setPluginStatus('has-plugins')
          } else {
            setPluginStatus('no-plugins')
          }
        }
      } catch (error) {
        console.error('Failed to check plugin status:', error)
        setPluginStatus('no-plugins')
      }
    }

    // Check on mount
    checkPluginStatus()

    // Setup install/update progress listeners to update status
    const cleanupInstall = window.api.plugins.onInstallProgress((progress) => {
      if (progress.status === 'installing' || progress.status === 'downloading') {
        setPluginStatus('installing')
      } else if (progress.status === 'complete') {
        checkPluginStatus()
      }
    })

    const cleanupUpdate = window.api.plugins.onUpdateProgress((progress) => {
      if (progress.status === 'installing' || progress.status === 'downloading') {
        setPluginStatus('installing')
      } else if (progress.status === 'complete') {
        checkPluginStatus()
      }
    })

    // Auto-refresh every hour (3600000ms)
    const intervalId = setInterval(checkPluginStatus, 3600000)

    return () => {
      clearInterval(intervalId)
      cleanupInstall()
      cleanupUpdate()
    }
  }, [])

  // Handle plugin button click
  const handlePluginClick = () => {
    dispatch({ type: 'TOGGLE_PLUGIN_PANEL' })
  }

  // Handle about button click
  const handleAboutClick = () => {
    dispatch({ type: 'TOGGLE_ABOUT_PANEL' })
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
          className="status-button about-button"
          onClick={handleAboutClick}
          title="About AiTer"
        >
          <AiOutlineInfoCircle className="status-icon" />
          <span className="status-text">About</span>
        </button>
      </div>
    </div>
  )
}
