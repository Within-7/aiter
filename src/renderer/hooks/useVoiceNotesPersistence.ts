import { useEffect, useRef, useCallback, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import type { VoiceTranscription } from '../../types/voiceInput'

/**
 * Hook for persisting voice notes to project directories.
 *
 * This hook handles:
 * - Loading voice notes when the active project changes
 * - Auto-saving voice notes when transcriptions are modified (debounced)
 * - Filtering transcriptions by project for multi-project scenarios
 *
 * Voice notes are stored in `.aiter/voice-notes.json` within each project.
 */
export function useVoiceNotesPersistence() {
  const { state, dispatch } = useContext(AppContext)
  const { activeProjectId, projects, voiceTranscriptions } = state

  // Track the last saved state to avoid unnecessary saves
  const lastSavedRef = useRef<string>('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track which project we've successfully loaded data for
  // This is the KEY to preventing race conditions:
  // - null = never loaded
  // - projectId = successfully loaded for this project, safe to save
  const loadedForProjectRef = useRef<string | null>(null)

  // Track the project we're currently loading (to ignore stale loads)
  const loadingProjectRef = useRef<string | null>(null)

  // Get current project path
  const activeProject = projects.find(p => p.id === activeProjectId)
  const projectPath = activeProject?.path

  /**
   * Load voice notes from project directory
   */
  const loadNotes = useCallback(async (path: string, projectId: string) => {
    // Mark that we're loading this project
    loadingProjectRef.current = projectId
    console.log('[VoiceNotesPersistence] Starting load for project:', projectId)

    try {
      const result = await window.api.voiceNotes.load(path)

      // Check if we're still supposed to load this project (user might have switched)
      if (loadingProjectRef.current !== projectId) {
        console.log('[VoiceNotesPersistence] Ignoring stale load for:', projectId, 'current:', loadingProjectRef.current)
        return
      }

      let loadedNotes: VoiceTranscription[] = []

      if (result.success && result.data && result.data.notes.length > 0) {
        // Add projectId to loaded notes if missing
        loadedNotes = result.data.notes.map(note => ({
          ...note,
          projectId: note.projectId || projectId
        }))
        console.log(`[VoiceNotesPersistence] Loaded ${loadedNotes.length} notes from disk`)
      } else {
        console.log('[VoiceNotesPersistence] No existing notes on disk for project:', projectId)
      }

      // Set what's on disk as the "last saved" state
      lastSavedRef.current = JSON.stringify(loadedNotes)

      // Update UI state with loaded notes
      dispatch({ type: 'SET_VOICE_TRANSCRIPTIONS', payload: loadedNotes })

      // Mark as successfully loaded - NOW it's safe to save changes
      loadedForProjectRef.current = projectId

      console.log('[VoiceNotesPersistence] Load complete, now safe to save for project:', projectId)
    } catch (error) {
      console.error('[VoiceNotesPersistence] Failed to load notes:', error)
      // Even on error, mark as loaded so user can start fresh
      lastSavedRef.current = '[]'
      loadedForProjectRef.current = projectId
    }
  }, [dispatch])

  /**
   * Save voice notes to project directory
   */
  const saveNotes = useCallback(async (path: string, notes: VoiceTranscription[], forProjectId: string) => {
    // Only save notes for the specified project
    const projectNotes = notes.filter(n => n.projectId === forProjectId)
    const serialized = JSON.stringify(projectNotes)

    // Skip if nothing changed from what's on disk
    if (serialized === lastSavedRef.current) {
      console.log('[VoiceNotesPersistence] Skipping save: data matches disk')
      return
    }

    console.log('[VoiceNotesPersistence] Saving', projectNotes.length, 'notes to:', path)

    try {
      const result = await window.api.voiceNotes.save(path, projectNotes)

      if (result.success) {
        lastSavedRef.current = serialized
        console.log('[VoiceNotesPersistence] Save successful')
      } else {
        console.error('[VoiceNotesPersistence] Save failed:', result.error)
      }
    } catch (error) {
      console.error('[VoiceNotesPersistence] Save error:', error)
    }
  }, [])

  /**
   * Debounced save - waits 1 second after last change before saving
   */
  const debouncedSave = useCallback((path: string, notes: VoiceTranscription[], forProjectId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(path, notes, forProjectId)
      saveTimeoutRef.current = null
    }, 1000)
  }, [saveNotes])

  /**
   * Load notes when project changes
   */
  useEffect(() => {
    if (!projectPath || !activeProjectId) {
      console.log('[VoiceNotesPersistence] No project path or activeProjectId')
      return
    }

    // Always reload when project changes
    if (loadedForProjectRef.current !== activeProjectId) {
      console.log('[VoiceNotesPersistence] Project changed from', loadedForProjectRef.current, 'to', activeProjectId)
      // Reset save state for new project
      loadedForProjectRef.current = null
      lastSavedRef.current = ''
      loadNotes(projectPath, activeProjectId)
    }
  }, [activeProjectId, projectPath, loadNotes])

  /**
   * Save notes when transcriptions change (only after successful load)
   */
  useEffect(() => {
    // Critical: Only save if we've completed loading for THIS project
    if (loadedForProjectRef.current !== activeProjectId) {
      console.log('[VoiceNotesPersistence] Skipping save: not yet loaded for', activeProjectId)
      return
    }

    if (!projectPath) {
      return
    }

    console.log('[VoiceNotesPersistence] Transcriptions changed, scheduling save')
    debouncedSave(projectPath, voiceTranscriptions, activeProjectId)
  }, [voiceTranscriptions, projectPath, activeProjectId, debouncedSave])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    saveNow: useCallback(() => {
      if (projectPath && activeProjectId && loadedForProjectRef.current === activeProjectId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = null
        }
        saveNotes(projectPath, voiceTranscriptions, activeProjectId)
      }
    }, [projectPath, activeProjectId, voiceTranscriptions, saveNotes]),

    reload: useCallback(() => {
      if (projectPath && activeProjectId) {
        loadedForProjectRef.current = null
        loadNotes(projectPath, activeProjectId)
      }
    }, [projectPath, activeProjectId, loadNotes])
  }
}
