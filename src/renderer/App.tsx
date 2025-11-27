import { useEffect, useReducer } from 'react'
import { AppContext, appReducer, initialState } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { WorkArea } from './components/WorkArea'
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
      })
    ]

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="app">
        <Sidebar />
        <WorkArea />
      </div>
    </AppContext.Provider>
  )
}

export default App
