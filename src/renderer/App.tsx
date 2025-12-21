import { useEffect, useReducer, useRef, useCallback } from 'react'
import { AppContext, appReducer, initialState } from './context/AppContext'
import { SessionState } from '../types'
import { Sidebar } from './components/Sidebar'
import { WorkArea } from './components/WorkArea'
import { StatusBar } from './components/StatusBar'
import { PluginPanel } from './components/Plugins/PluginPanel'
import { AboutPanel } from './components/About/AboutPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { UpdateNotification } from './components/UpdateNotification'
import { KeyboardShortcutsHandler } from './components/KeyboardShortcutsHandler'
import './styles/App.css'

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Use refs to access current state values in callbacks without adding them as dependencies
  // This prevents event listeners from being re-registered on every state change
  const stateRef = useRef(state)
  stateRef.current = state

  // Track if session has been restored to avoid overwriting with empty state
  const sessionRestoredRef = useRef(false)

  // Track if initial data has been loaded (prevent double-load in StrictMode)
  const initialDataLoadedRef = useRef(false)

  // Save session state to disk (debounced)
  const saveSessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const saveSession = useCallback(() => {
    if (saveSessionTimeoutRef.current) {
      clearTimeout(saveSessionTimeoutRef.current)
    }

    saveSessionTimeoutRef.current = setTimeout(async () => {
      const currentState = stateRef.current

      // Don't save if session hasn't been restored yet (avoid overwriting with empty state)
      if (!sessionRestoredRef.current) {
        return
      }

      // Only save if there's something to save
      if (currentState.terminals.length === 0 && currentState.editorTabs.length === 0) {
        // Clear session if everything is closed
        await window.api.session.clear()
        return
      }

      const session: SessionState = {
        editorTabs: currentState.editorTabs.map(tab => ({
          id: tab.id,
          filePath: tab.filePath,
          fileName: tab.fileName,
          fileType: tab.fileType,
          serverUrl: tab.serverUrl,
          projectPath: tab.projectPath,
          isDiff: tab.isDiff,
          commitHash: tab.commitHash,
          commitMessage: tab.commitMessage
        })),
        terminals: currentState.terminals.map(t => ({
          id: t.id,
          projectId: t.projectId,
          name: t.name,
          cwd: t.cwd
        })),
        tabOrder: currentState.tabOrder,
        activeTerminalId: currentState.activeTerminalId,
        activeEditorTabId: currentState.activeEditorTabId,
        activeProjectId: currentState.activeProjectId,
        savedAt: Date.now()
      }

      await window.api.session.save(session)
    }, 1000) // Debounce 1 second
  }, [])

  // Auto-save session when state changes
  useEffect(() => {
    saveSession()
  }, [state.terminals, state.editorTabs, state.tabOrder, state.activeTerminalId, state.activeEditorTabId, state.activeProjectId, saveSession])

  useEffect(() => {
    // Load initial data
    const loadInitialData = async () => {
      // Prevent double-load in React StrictMode
      if (initialDataLoadedRef.current) {
        return
      }
      initialDataLoadedRef.current = true

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

      // Restore session state
      const sessionResult = await window.api.session.get()
      if (sessionResult.success && sessionResult.session) {
        const session = sessionResult.session

        // Check if session is not too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours in ms
        if (Date.now() - session.savedAt < maxAge) {
          console.log('[Session] Restoring session:', {
            editorTabs: session.editorTabs.length,
            terminals: session.terminals.length
          })

          // IMPORTANT: Clear session immediately to prevent accumulation bug
          // The session will be re-saved with new IDs after restoration completes
          await window.api.session.clear()

          // Restore editor tabs (reloading content from files)
          for (const tabInfo of session.editorTabs) {
            // Skip diff tabs as they can't be restored easily
            if (tabInfo.isDiff) continue

            try {
              const fileResult = await window.api.fs.readFile(tabInfo.filePath)
              if (fileResult.success && fileResult.content !== undefined) {
                dispatch({
                  type: 'ADD_EDITOR_TAB',
                  payload: {
                    id: tabInfo.id,
                    filePath: tabInfo.filePath,
                    fileName: tabInfo.fileName,
                    fileType: tabInfo.fileType,
                    content: fileResult.content,
                    isDirty: false,
                    serverUrl: tabInfo.serverUrl,
                    projectPath: tabInfo.projectPath
                  }
                })
              }
            } catch (error) {
              console.warn(`[Session] Failed to restore editor tab: ${tabInfo.filePath}`, error)
            }
          }

          // Limit restored terminals to prevent runaway accumulation
          const MAX_RESTORED_TERMINALS = 10
          const terminalsToRestore = session.terminals.slice(0, MAX_RESTORED_TERMINALS)
          if (session.terminals.length > MAX_RESTORED_TERMINALS) {
            console.warn(`[Session] Limiting terminal restoration from ${session.terminals.length} to ${MAX_RESTORED_TERMINALS}`)
          }

          // Restore terminals (create new PTY processes)
          for (const termInfo of terminalsToRestore) {
            try {
              // Find project for this terminal
              const project = projectsResult.projects?.find(p => p.id === termInfo.projectId)
              if (!project) {
                console.warn(`[Session] Project not found for terminal: ${termInfo.projectId}`)
                continue
              }

              const terminalResult = await window.api.terminal.create(
                termInfo.cwd,
                termInfo.projectId,
                project.name
              )

              if (terminalResult.success && terminalResult.terminal) {
                dispatch({
                  type: 'ADD_TERMINAL',
                  payload: terminalResult.terminal
                })
              }
            } catch (error) {
              console.warn(`[Session] Failed to restore terminal: ${termInfo.id}`, error)
            }
          }

          // Note: We don't restore tab order since IDs have changed
          // The new tabs are added in order, so the order is preserved

          // Restore active project
          if (session.activeProjectId) {
            dispatch({ type: 'SET_ACTIVE_PROJECT', payload: session.activeProjectId })
          }

          console.log('[Session] Session restored successfully')
        } else {
          console.log('[Session] Session expired, clearing')
          await window.api.session.clear()
        }
      }

      // Mark session as restored
      sessionRestoredRef.current = true
    }

    loadInitialData()

    // Setup event listeners
    const cleanups = [
      window.api.projects.onUpdated((projects) => {
        dispatch({ type: 'SET_PROJECTS', payload: projects })
      }),

      // Note: Terminal data is handled directly by XTerminal component via its own listener
      // to avoid unnecessary global state updates that cause re-renders and flickering

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

      window.api.menu.onShowAbout(() => {
        dispatch({ type: 'TOGGLE_ABOUT_PANEL' })
      }),

      window.api.menu.onShowSettings(() => {
        dispatch({ type: 'TOGGLE_SETTINGS_PANEL' })
      }),

      window.api.plugins.onAutoUpdateAvailable(async (data) => {
        console.log(`[App] Auto-update available for ${data.pluginName} (${data.pluginId})`)

        // Get the update command
        const commandResult = await window.api.plugins.getUpdateCommand(data.pluginId)
        if (!commandResult.success || !commandResult.command) {
          console.error(`[App] Failed to get update command: ${commandResult.error}`)
          return
        }

        // Get current active project for terminal context using ref to avoid dependency
        const currentState = stateRef.current
        const activeProject = currentState.projects.find(p => p.id === currentState.activeProjectId)
        if (!activeProject) {
          console.warn('[App] No active project for auto-update. Skipping.')
          return
        }

        // Create a new terminal and execute the update command
        const terminalResult = await window.api.terminal.create(
          activeProject.path,
          activeProject.id,
          activeProject.name,
          currentState.settings?.shell || '/bin/bash'
        )

        if (terminalResult.success && terminalResult.terminal) {
          // Add terminal to state
          dispatch({
            type: 'ADD_TERMINAL',
            payload: terminalResult.terminal
          })

          // Write the command to the terminal
          await window.api.terminal.write(
            terminalResult.terminal.id,
            `# Auto-updating ${data.pluginName}...\r${commandResult.command}\r`
          )

          console.log(`[App] Auto-update triggered for ${data.pluginName}`)
        } else {
          console.error(`[App] Failed to create terminal for auto-update: ${terminalResult.error}`)
        }
      })
    ]

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps: listeners registered once, use stateRef for current values

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
        <AboutPanel />
        <SettingsPanel />
        <UpdateNotification />
        <KeyboardShortcutsHandler />
      </div>
    </AppContext.Provider>
  )
}

export default App
