import { useContext, useState, useEffect, useRef } from 'react'
import { VscFiles, VscSourceControl, VscSearch } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { ExplorerView } from './ExplorerView'
import { GitView } from './GitView'
import { SearchView } from './SearchView'
import { WorkspaceSelector } from './WorkspaceSelector'
import '../styles/Sidebar.css'

const MIN_WIDTH = 200
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 300
const STORAGE_KEY = 'sidebar-width'

export function Sidebar() {
  const { state, dispatch } = useContext(AppContext)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Monitor fullscreen state changes via Electron API
  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Get initial fullscreen state from Electron
    window.api.window.isFullScreen()
      .then((result) => {
        if (result.success && result.isFullScreen !== undefined) {
          setIsFullscreen(result.isFullScreen)
        }
      })
      .catch((err) => {
        console.warn('Failed to get fullscreen state:', err)
      })

    // Listen for fullscreen state changes from Electron
    try {
      unsubscribe = window.api.window.onFullScreenChanged((isFs) => {
        setIsFullscreen(isFs)
      })
    } catch (err) {
      console.warn('Failed to subscribe to fullscreen changes:', err)
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // Use refs to track resizing state and width without causing useEffect re-runs
  const isResizingRef = useRef(false)
  const sidebarWidthRef = useRef(sidebarWidth)

  // Keep refs in sync with state
  isResizingRef.current = isResizing
  sidebarWidthRef.current = sidebarWidth

  // Handle sidebar resizing - register listeners once, use refs to track state
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return

      const newWidth = e.clientX
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        setIsResizing(false)
        localStorage.setItem(STORAGE_KEY, sidebarWidthRef.current.toString())
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, []) // Empty deps - listeners registered once, use refs for current state

  // Handle cursor style changes when resizing starts/stops
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  return (
    <div className="sidebar" ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-header">
        <h2 className={!isFullscreen ? 'has-traffic-lights' : ''}>AiTer</h2>
        <WorkspaceSelector onManageWorkspaces={() => dispatch({ type: 'SET_WORKSPACE_MANAGER', payload: true })} />
      </div>

      {/* View Switcher */}
      <div className="view-switcher">
        <button
          className={`view-button ${state.sidebarView === 'explorer' ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_SIDEBAR_VIEW', payload: 'explorer' })}
          title="Explorer"
        >
          <VscFiles />
        </button>
        <button
          className={`view-button ${state.sidebarView === 'git' ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_SIDEBAR_VIEW', payload: 'git' })}
          title="Source Control"
        >
          <VscSourceControl />
        </button>
        <button
          className={`view-button ${state.sidebarView === 'search' ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_SIDEBAR_VIEW', payload: 'search' })}
          title="Search"
        >
          <VscSearch />
        </button>
      </div>

      {/* View Content */}
      <div className="sidebar-content">
        {state.sidebarView === 'explorer' && <ExplorerView />}
        {state.sidebarView === 'git' && <GitView />}
        {state.sidebarView === 'search' && <SearchView />}
      </div>

      {/* Resize Handle */}
      <div
        className={`sidebar-resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
      />
    </div>
  )
}
