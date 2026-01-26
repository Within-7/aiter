/**
 * Custom hook for content search functionality
 * Handles debounced search, result management, and expansion state
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Project, EditorTab } from '../../types'
import { generateTabId } from '../utils'

export interface FileResult {
  filePath: string
  fileName: string
  relativePath: string
  projectId: string
  projectName: string
  matches?: MatchResult[]
}

export interface MatchResult {
  line: number
  column: number
  preview: string
  contextBefore?: string
  contextAfter?: string
}

export interface SearchOptions {
  caseSensitive: boolean
  useRegex: boolean
}

export interface UseSearchOptions {
  projects: Project[]
  activeEditorTabId: string | null
  activeTerminalId: string | null
  editorTabs: EditorTab[]
  terminals: { id: string; projectId: string }[]
  dispatch: React.Dispatch<{ type: string; payload?: unknown }>
}

export interface UseSearchReturn {
  // Search state
  searchQuery: string
  setSearchQuery: (query: string) => void
  caseSensitive: boolean
  setCaseSensitive: (value: boolean) => void
  useRegex: boolean
  setUseRegex: (value: boolean) => void
  selectedProjectId: string | 'all'
  setSelectedProjectId: (id: string | 'all') => void

  // Results
  results: FileResult[]
  isSearching: boolean
  error: string | null
  totalMatches: number
  resultsByProject: Array<{ project: Project; results: FileResult[] }>

  // Expansion state
  expandedFiles: Set<string>
  expandedProjects: Set<string>
  toggleFileExpanded: (filePath: string) => void
  toggleProjectExpanded: (projectId: string) => void

  // Actions
  handleResultClick: (result: FileResult, match?: MatchResult) => Promise<void>
}

export function useSearch({
  projects,
  activeEditorTabId,
  activeTerminalId,
  editorTabs,
  terminals,
  dispatch
}: UseSearchOptions): UseSearchReturn {
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | 'all'>('all')

  // Results state
  const [results, setResults] = useState<FileResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Expansion state
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // Search cancellation
  const searchIdRef = useRef(0)

  // Determine default project based on active tab
  const defaultProjectId = useMemo(() => {
    if (activeEditorTabId) {
      const activeTab = editorTabs.find(t => t.id === activeEditorTabId)
      if (activeTab) {
        const project = projects.find(p => activeTab.filePath.startsWith(p.path))
        if (project) return project.id
      }
    }
    if (activeTerminalId) {
      const activeTerminal = terminals.find(t => t.id === activeTerminalId)
      if (activeTerminal) return activeTerminal.projectId
    }
    return 'all'
  }, [activeEditorTabId, activeTerminalId, editorTabs, terminals, projects])

  // Set initial selected project based on active tab
  useEffect(() => {
    setSelectedProjectId(defaultProjectId)
  }, [defaultProjectId])

  // Perform search
  const performSearch = useCallback(async (searchId: number) => {
    const projectsToSearch = selectedProjectId === 'all'
      ? projects
      : projects.filter(p => p.id === selectedProjectId)

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
        if (searchId !== searchIdRef.current) return

        const options = {
          caseSensitive,
          useRegex,
          includeIgnored: false,
          maxResults: 50
        }

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

      if (searchId === searchIdRef.current) {
        setResults(allResults)
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
  }, [projects, selectedProjectId, searchQuery, caseSensitive, useRegex])

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
  }, [searchQuery, caseSensitive, useRegex, projects, selectedProjectId, performSearch])

  // Group results by project
  const resultsByProject = useMemo(() => {
    const grouped = new Map<string, { project: Project; results: FileResult[] }>()

    for (const result of results) {
      const project = projects.find(p => p.id === result.projectId)
      if (!project) continue

      if (!grouped.has(result.projectId)) {
        grouped.set(result.projectId, { project, results: [] })
      }
      grouped.get(result.projectId)!.results.push(result)
    }

    return Array.from(grouped.values())
  }, [results, projects])

  // Auto-expand projects when results change
  useEffect(() => {
    const projectIds = resultsByProject.map(g => g.project.id)
    setExpandedProjects(new Set(projectIds))
  }, [resultsByProject])

  // Calculate total matches
  const totalMatches = useMemo(
    () => results.reduce((sum, r) => sum + (r.matches?.length || 1), 0),
    [results]
  )

  // Toggle file expanded
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

  // Toggle project expanded
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

  // Handle result click - open file in editor
  const handleResultClick = useCallback(async (result: FileResult, match?: MatchResult) => {
    try {
      const fileResult = await window.api.fs.readFile(result.filePath)
      if (fileResult.success && fileResult.content !== undefined && fileResult.fileType) {
        const tab: EditorTab = {
          id: generateTabId(),
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
    } catch (err) {
      console.error('Error opening file:', err)
    }
  }, [dispatch])

  return {
    searchQuery,
    setSearchQuery,
    caseSensitive,
    setCaseSensitive,
    useRegex,
    setUseRegex,
    selectedProjectId,
    setSelectedProjectId,
    results,
    isSearching,
    error,
    totalMatches,
    resultsByProject,
    expandedFiles,
    expandedProjects,
    toggleFileExpanded,
    toggleProjectExpanded,
    handleResultClick
  }
}
