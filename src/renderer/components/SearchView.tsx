/**
 * SearchView Component
 * Content search across projects with match highlighting
 */

import { useContext, useEffect, useRef, useCallback } from 'react'
import { VscSearch, VscCaseSensitive, VscRegex, VscFile, VscChevronDown, VscChevronRight } from 'react-icons/vsc'
import { AppContext } from '../context/AppContext'
import { useSearch, FileResult, MatchResult } from '../hooks/useSearch'
import { getProjectColor } from '../utils'
import '../styles/SearchView.css'

export function SearchView() {
  const { state, dispatch } = useContext(AppContext)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use search hook
  const search = useSearch({
    projects: state.projects,
    activeEditorTabId: state.activeEditorTabId,
    activeTerminalId: state.activeTerminalId,
    editorTabs: state.editorTabs,
    terminals: state.terminals,
    dispatch
  })

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Highlight match in text (kept in component for JSX creation)
  const highlightMatch = useCallback((text: string, query: string): React.ReactNode => {
    if (!query || search.useRegex) {
      return text
    }

    const flags = search.caseSensitive ? 'g' : 'gi'
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, flags)
    const parts = text.split(regex)

    return parts.map((part, i) => {
      if (regex.test(part)) {
        return <span key={i} className="search-highlight">{part}</span>
      }
      return part
    })
  }, [search.useRegex, search.caseSensitive])

  // Handle file click with optional match
  const onFileClick = useCallback((result: FileResult, match?: MatchResult) => {
    if (result.matches && result.matches.length > 0 && !match) {
      search.toggleFileExpanded(result.filePath)
    } else {
      search.handleResultClick(result, match)
    }
  }, [search])

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
            value={search.searchQuery}
            onChange={(e) => search.setSearchQuery(e.target.value)}
          />
          {search.searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => search.setSearchQuery('')}
              title="Clear"
            >
              &times;
            </button>
          )}
        </div>

        <div className="search-options">
          <select
            className="search-project-select"
            value={search.selectedProjectId}
            onChange={(e) => search.setSelectedProjectId(e.target.value)}
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
              className={`search-option-btn ${search.caseSensitive ? 'active' : ''}`}
              onClick={() => search.setCaseSensitive(!search.caseSensitive)}
              title="Match Case"
            >
              <VscCaseSensitive />
            </button>
            <button
              className={`search-option-btn ${search.useRegex ? 'active' : ''}`}
              onClick={() => search.setUseRegex(!search.useRegex)}
              title="Use Regular Expression"
            >
              <VscRegex />
            </button>
          </div>
        </div>
      </div>

      <div className="search-results">
        {search.isSearching && (
          <div className="search-status">Searching...</div>
        )}

        {search.error && (
          <div className="search-error">{search.error}</div>
        )}

        {!search.isSearching && !search.error && search.searchQuery.length >= 2 && (
          <div className="search-results-header">
            {search.results.length > 0 ? (
              <span>
                {search.results.length} file{search.results.length !== 1 ? 's' : ''} ({search.totalMatches} match{search.totalMatches !== 1 ? 'es' : ''})
              </span>
            ) : (
              <span>No results</span>
            )}
          </div>
        )}

        {search.resultsByProject.map(({ project, results: projectResults }) => (
          <div key={project.id} className="search-project-item">
            <div
              className="search-project-header"
              onClick={() => search.toggleProjectExpanded(project.id)}
            >
              {search.expandedProjects.has(project.id) ? (
                <VscChevronDown className="expand-icon" />
              ) : (
                <VscChevronRight className="expand-icon" />
              )}
              <span
                className="project-color-indicator"
                style={{ backgroundColor: getProjectColor(project.id, project.color) }}
              />
              <span className="project-name">{project.name}</span>
              <span className="project-match-count">
                {projectResults.reduce((sum, r) => sum + (r.matches?.length || 1), 0)}
              </span>
            </div>

            {search.expandedProjects.has(project.id) && (
              <div className="search-project-files">
                {projectResults.map(result => (
                  <div key={result.filePath} className="search-result-item">
                    <div
                      className="search-result-file"
                      onClick={() => onFileClick(result)}
                    >
                      {result.matches && result.matches.length > 0 ? (
                        search.expandedFiles.has(result.filePath) ? (
                          <VscChevronDown className="expand-icon" />
                        ) : (
                          <VscChevronRight className="expand-icon" />
                        )
                      ) : (
                        <VscFile className="file-icon" />
                      )}
                      <span className="file-name">{highlightMatch(result.fileName, search.searchQuery)}</span>
                      <span className="file-path">{result.relativePath}</span>
                      {result.matches && (
                        <span className="match-count">{result.matches.length}</span>
                      )}
                    </div>

                    {result.matches && search.expandedFiles.has(result.filePath) && (
                      <div className="search-matches">
                        {result.matches.map((match, idx) => (
                          <div
                            key={`${result.filePath}-${match.line}-${match.column}-${idx}`}
                            className="search-match"
                            onClick={() => search.handleResultClick(result, match)}
                          >
                            <span className="match-line-number">{match.line}</span>
                            <div className="match-content">
                              {match.contextBefore && (
                                <div className="match-context">{match.contextBefore}</div>
                              )}
                              <div className="match-preview">
                                {highlightMatch(match.preview, search.searchQuery)}
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

        {!search.isSearching && search.searchQuery.length < 2 && search.searchQuery.length > 0 && (
          <div className="search-hint">Type at least 2 characters to search</div>
        )}

        {!search.isSearching && search.searchQuery.length === 0 && (
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
