import { useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { VscSearch, VscCaseSensitive, VscRegex, VscFile, VscChevronDown, VscChevronRight } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { EditorTab } from '../../types'
import '../styles/SearchView.css'

interface FileResult {
  filePath: string
  fileName: string
  relativePath: string
  projectId: string
  projectName: string
  matches?: MatchResult[]
}

interface MatchResult {
  line: number
  column: number
  preview: string
  contextBefore?: string
  contextAfter?: string
}

export function SearchView() {
  const { state, dispatch } = useContext(AppContext)
  const [searchQuery, setSearchQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [results, setResults] = useState<FileResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchIdRef = useRef(0)

  // Determine default project based on active tab
  const defaultProjectId = useMemo(() => {
    // Check active editor tab first
    if (state.activeEditorTabId) {
      const activeTab = state.editorTabs.find(t => t.id === state.activeEditorTabId)
      if (activeTab) {
        // Find project that contains this file
        const project = state.projects.find(p => activeTab.filePath.startsWith(p.path))
        if (project) return project.id
      }
    }
    // Check active terminal
    if (state.activeTerminalId) {
      const activeTerminal = state.terminals.find(t => t.id === state.activeTerminalId)
      if (activeTerminal) return activeTerminal.projectId
    }
    // No active tab, search all projects
    return 'all'
  }, [state.activeEditorTabId, state.activeTerminalId, state.editorTabs, state.terminals, state.projects])

  // Set initial selected project based on active tab
  useEffect(() => {
    setSelectedProjectId(defaultProjectId)
  }, [defaultProjectId])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([])
      setError(null)
      return
    }

    const currentSearchId = ++searchIdRef.current
    const debounce = setTimeout(() => {
      performSearch(currentSearchId)
    }, 300)

    return () => clearTimeout(debounce)
  }, [searchQuery, caseSensitive, useRegex, state.projects, selectedProjectId])

  const performSearch = async (searchId: number) => {
    // Determine which projects to search
    const projectsToSearch = selectedProjectId === 'all'
      ? state.projects
      : state.projects.filter(p => p.id === selectedProjectId)

    if (projectsToSearch.length === 0) {
      setResults([])
      setError('No projects to search in')
      return
    }

    setIsSearching(true)
    setError(null)
    const allResults: FileResult[] = []

    try {
      for (const project of projectsToSearch) {
        // Check if this search is still valid
        if (searchId !== searchIdRef.current) return

        const options = {
          caseSensitive,
          useRegex,
          includeIgnored: false,
          maxResults: 50
        }

        // Always use content search
        const result = await window.api.fs.searchContent(project.path, searchQuery, options)
        if (result.success && result.results) {
          for (const item of result.results) {
            allResults.push({
              filePath: item.filePath,
              fileName: item.fileName,
              relativePath: item.relativePath,
              projectId: project.id,
              projectName: project.name,
              matches: item.matches
            })
          }
        }
      }

      // Only update if this is still the current search
      if (searchId === searchIdRef.current) {
        setResults(allResults)
        // Auto-expand first few results
        const firstFew = allResults.slice(0, 3).map(r => r.filePath)
        setExpandedFiles(new Set(firstFew))
      }
    } catch (err) {
      if (searchId === searchIdRef.current) {
        const message = err instanceof Error ? err.message : 'Search failed'
        setError(message)
        setResults([])
      }
    } finally {
      if (searchId === searchIdRef.current) {
        setIsSearching(false)
      }
    }
  }

  const handleResultClick = useCallback(async (result: FileResult, match?: MatchResult) => {
    try {
      const fileResult = await window.api.fs.readFile(result.filePath)
      if (fileResult.success && fileResult.content !== undefined && fileResult.fileType) {
        const tab: EditorTab = {
          id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filePath: result.filePath,
          fileName: result.fileName,
          fileType: fileResult.fileType as EditorTab['fileType'],
          content: fileResult.content,
          isDirty: false,
          isPreview: true,
          cursorPosition: match ? { line: match.line, column: match.column } : undefined
        }
        dispatch({ type: 'ADD_EDITOR_TAB', payload: tab })
      }
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }, [dispatch])

  const toggleFileExpanded = useCallback((filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }, [])

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query || useRegex) {
      return text
    }

    const flags = caseSensitive ? 'g' : 'gi'
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, flags)
    const parts = text.split(regex)

    return parts.map((part, i) => {
      if (regex.test(part)) {
        return <span key={i} className="search-highlight">{part}</span>
      }
      return part
    })
  }

  // Group results by project
  const resultsByProject = useMemo(() => {
    const grouped = new Map<string, { project: typeof state.projects[0], results: FileResult[] }>()

    for (const result of results) {
      const project = state.projects.find(p => p.id === result.projectId)
      if (!project) continue

      if (!grouped.has(result.projectId)) {
        grouped.set(result.projectId, { project, results: [] })
      }
      grouped.get(result.projectId)!.results.push(result)
    }

    return Array.from(grouped.values())
  }, [results, state.projects])

  const totalMatches = results.reduce((sum, r) => sum + (r.matches?.length || 1), 0)

  // Track expanded projects
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // Auto-expand projects when results change
  useEffect(() => {
    const projectIds = resultsByProject.map(g => g.project.id)
    setExpandedProjects(new Set(projectIds))
  }, [resultsByProject])

  const toggleProjectExpanded = useCallback((projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  return (
    <div className="search-view">
      <div className="search-view-header">
        <div className="header-title">
          <VscSearch className="header-icon" />
          <h2>Search</h2>
        </div>
        <div className="btn-placeholder" />
      </div>

      <div className="search-input-container">
        <div className="search-input-wrapper">
          <VscSearch className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear"
            >
              &times;
            </button>
          )}
        </div>

        <div className="search-options">
          <select
            className="search-project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            title="Select project to search"
          >
            <option value="all">All Projects</option>
            {state.projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <div className="search-option-buttons">
            <button
              className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match Case"
            >
              <VscCaseSensitive />
            </button>
            <button
              className={`search-option-btn ${useRegex ? 'active' : ''}`}
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression"
            >
              <VscRegex />
            </button>
          </div>
        </div>
      </div>

      <div className="search-results">
        {isSearching && (
          <div className="search-status">Searching...</div>
        )}

        {error && (
          <div className="search-error">{error}</div>
        )}

        {!isSearching && !error && searchQuery.length >= 2 && (
          <div className="search-results-header">
            {results.length > 0 ? (
              <span>
                {results.length} file{results.length !== 1 ? 's' : ''} ({totalMatches} match{totalMatches !== 1 ? 'es' : ''})
              </span>
            ) : (
              <span>No results</span>
            )}
          </div>
        )}

        {resultsByProject.map(({ project, results: projectResults }) => (
          <div key={project.id} className="search-project-item">
            <div
              className="search-project-header"
              onClick={() => toggleProjectExpanded(project.id)}
            >
              {expandedProjects.has(project.id) ? (
                <VscChevronDown className="expand-icon" />
              ) : (
                <VscChevronRight className="expand-icon" />
              )}
              <span
                className="project-color-indicator"
                style={{ backgroundColor: project.color || '#888888' }}
              />
              <span className="project-name">{project.name}</span>
              <span className="project-match-count">
                {projectResults.reduce((sum, r) => sum + (r.matches?.length || 1), 0)}
              </span>
            </div>

            {expandedProjects.has(project.id) && (
              <div className="search-project-files">
                {projectResults.map(result => (
                  <div key={result.filePath} className="search-result-item">
                    <div
                      className="search-result-file"
                      onClick={() => {
                        if (result.matches && result.matches.length > 0) {
                          toggleFileExpanded(result.filePath)
                        } else {
                          handleResultClick(result)
                        }
                      }}
                    >
                      {result.matches && result.matches.length > 0 ? (
                        expandedFiles.has(result.filePath) ? (
                          <VscChevronDown className="expand-icon" />
                        ) : (
                          <VscChevronRight className="expand-icon" />
                        )
                      ) : (
                        <VscFile className="file-icon" />
                      )}
                      <span className="file-name">{highlightMatch(result.fileName, searchQuery)}</span>
                      <span className="file-path">{result.relativePath}</span>
                      {result.matches && (
                        <span className="match-count">{result.matches.length}</span>
                      )}
                    </div>

                    {result.matches && expandedFiles.has(result.filePath) && (
                      <div className="search-matches">
                        {result.matches.map((match, idx) => (
                          <div
                            key={`${result.filePath}-${match.line}-${match.column}-${idx}`}
                            className="search-match"
                            onClick={() => handleResultClick(result, match)}
                          >
                            <span className="match-line-number">{match.line}</span>
                            <div className="match-content">
                              {match.contextBefore && (
                                <div className="match-context">{match.contextBefore}</div>
                              )}
                              <div className="match-preview">
                                {highlightMatch(match.preview, searchQuery)}
                              </div>
                              {match.contextAfter && (
                                <div className="match-context">{match.contextAfter}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {!isSearching && searchQuery.length < 2 && searchQuery.length > 0 && (
          <div className="search-hint">Type at least 2 characters to search</div>
        )}

        {!isSearching && searchQuery.length === 0 && (
          <div className="search-hint">
            <p>Search in file contents</p>
            <p className="search-hint-small">
              Type at least 2 characters to start searching
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
