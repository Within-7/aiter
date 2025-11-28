import { useEffect, useReducer } from 'react'
import { AppContext, appReducer, initialState } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { WorkArea } from './components/WorkArea'
import { StatusBar } from './components/StatusBar'
import { PluginPanel } from './components/Plugins/PluginPanel'
import './styles/App.css'

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    // Load initial data
    const loadInitialData = async () => {
      // Load projects
      const projectsResult = await window.api.projects.list()
      if (projectsResult.success && projectsResult.projects) {
        dispatch({ type: 'SET_PROJECTS', payload: projectsResult.projects })
      }

      // Load settings
      const settingsResult = await window.api.settings.get()
      if (settingsResult.success && settingsResult.settings) {
        dispatch({ type: 'SET_SETTINGS', payload: settingsResult.settings })
      }
    }

    loadInitialData()

    // Setup event listeners
    const cleanups = [
      window.api.projects.onUpdated((projects) => {
        dispatch({ type: 'SET_PROJECTS', payload: projects })
      }),

      window.api.terminal.onData((id, data) => {
        dispatch({ type: 'TERMINAL_DATA', payload: { id, data } })
      }),

      window.api.terminal.onExit((id, exitCode) => {
        dispatch({ type: 'TERMINAL_EXIT', payload: { id, exitCode } })
      }),

      window.api.terminal.onNameUpdated((id, name) => {
        dispatch({ type: 'UPDATE_TERMINAL_NAME', payload: { id, name } })
      }),

      window.api.settings.onUpdated((settings) => {
        dispatch({ type: 'SET_SETTINGS', payload: settings })
      }),

      window.api.app.onError((error) => {
        console.error('App error:', error)
        // Could show a toast notification here
      }),

      window.api.plugins.onAutoUpdateAvailable(async (data) => {
        console.log(`[App] Auto-update available for ${data.pluginName} (${data.pluginId})`)

        // Get the update command
        const commandResult = await window.api.plugins.getUpdateCommand(data.pluginId)
        if (!commandResult.success || !commandResult.command) {
          console.error(`[App] Failed to get update command: ${commandResult.error}`)
          return
        }

        // Get current active project for terminal context
        const activeProject = state.projects.find(p => p.id === state.activeProjectId)
        if (!activeProject) {
          console.warn('[App] No active project for auto-update. Skipping.')
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
          // Add terminal to state
          dispatch({
            type: 'ADD_TERMINAL',
            payload: terminalResult.terminal
          })

          // Write the command to the terminal
          await window.api.terminal.write({
            id: terminalResult.terminal.id,
            data: `# Auto-updating ${data.pluginName}...\r${commandResult.command}\r`
          })

          console.log(`[App] Auto-update triggered for ${data.pluginName}`)
        } else {
          console.error(`[App] Failed to create terminal for auto-update: ${terminalResult.error}`)
        }
      })
    ]

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [state.projects, state.activeProjectId, state.settings])

  // Get active terminal for StatusBar
  const activeTerminal = state.terminals.find(t => t.id === state.activeTerminalId)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="app">
        <div className="app-main">
          <Sidebar />
          <WorkArea />
        </div>
        <StatusBar activeTerminal={activeTerminal} />
        <PluginPanel />
      </div>
    </AppContext.Provider>
  )
}

export default App
