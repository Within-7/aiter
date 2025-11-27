import { useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { TabBar } from './TabBar'
import { TerminalContainer } from './TerminalContainer'
import '../styles/TerminalArea.css'

export function TerminalArea() {
  const { state, dispatch } = useContext(AppContext)

  const handleNewTab = async () => {
    if (!state.activeProjectId) {
      alert('Please select a project first')
      return
    }

    const project = state.projects.find((p) => p.id === state.activeProjectId)
    if (!project) return

    const result = await window.api.terminal.create(project.path, project.id, project.name)
    if (result.success && result.terminal) {
      dispatch({ type: 'ADD_TERMINAL', payload: result.terminal })
    }
  }

  const handleCloseTab = async (id: string) => {
    await window.api.terminal.kill(id)
    dispatch({ type: 'REMOVE_TERMINAL', payload: id })
  }

  const handleSelectTab = (id: string) => {
    dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: id })
  }

  if (state.terminals.length === 0) {
    return (
      <div className="terminal-area">
        <div className="terminal-empty">
          <h2>No Terminal Open</h2>
          <p>Select a project from the sidebar to open a terminal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="terminal-area">
      <TabBar
        terminals={state.terminals}
        activeTerminalId={state.activeTerminalId}
        onSelect={handleSelectTab}
        onClose={handleCloseTab}
        onNew={handleNewTab}
      />
      <TerminalContainer
        terminals={state.terminals}
        activeTerminalId={state.activeTerminalId}
        settings={state.settings}
      />
    </div>
  )
}
