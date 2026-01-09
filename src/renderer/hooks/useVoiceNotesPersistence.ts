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
 * Voice notes are stored in `.airter/voice-notes.json` within each project.
 */
export function useVoiceNotesPersistence() {
  const { state, dispatch } = useContext(AppContext)
  const { activeProjectId, projects, voiceTranscriptions } = state

  // Track the last saved state to avoid unnecessary saves
  const lastSavedRef = useRef<string>('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadedProjectRef = useRef<string | null>(null)

  // Get current project path
  const activeProject = projects.find(p => p.id === activeProjectId)
  const projectPath = activeProject?.path

  /**
   * Load voice notes from project directory
   */
  const loadNotes = useCallback(async (path: string) => {
    try {
      console.log('[VoiceNotesPersistence] Loading notes for project:', path)
      const result = await window.api.voiceNotes.load(path)

      if (result.success && result.data) {
        // Merge loaded notes with existing notes from other projects
        const existingOtherProjectNotes = voiceTranscriptions.filter(
          t => t.projectId && t.projectId !== activeProjectId
        )

        // Add projectId to loaded notes if missing
        const loadedNotes = result.data.notes.map(note => ({
          ...note,
          projectId: note.projectId || activeProjectId
        }))

        // Combine: other projects' notes + loaded project's notes
        const combinedNotes = [...existingOtherProjectNotes, ...loadedNotes]

        dispatch({ type: 'SET_VOICE_TRANSCRIPTIONS', payload: combinedNotes })
        lastSavedRef.current = JSON.stringify(loadedNotes)
        loadedProjectRef.current = activeProjectId || null

        console.log(`[VoiceNotesPersistence] Loaded ${loadedNotes.length} notes`)
      } else {
        console.log('[VoiceNotesPersistence] No existing notes or empty file')
        loadedProjectRef.current = activeProjectId || null
      }
    } catch (error) {
      console.error('[VoiceNotesPersistence] Failed to load notes:', error)
    }
  }, [activeProjectId, voiceTranscriptions, dispatch])

  /**
   * Save voice notes to project directory
   */
  const saveNotes = useCallback(async (path: string, notes: VoiceTranscription[]) => {
    // Only save notes for the current project
    const projectNotes = notes.filter(n => n.projectId === activeProjectId)
    const serialized = JSON.stringify(projectNotes)

    // Skip if nothing changed
    if (serialized === lastSavedRef.current) {
      return
    }

    try {
      console.log('[VoiceNotesPersistence] Saving notes to:', path)
      const result = await window.api.voiceNotes.save(path, projectNotes)

      if (result.success) {
        lastSavedRef.current = serialized
        console.log(`[VoiceNotesPersistence] Saved ${projectNotes.length} notes`)
      } else {
        console.error('[VoiceNotesPersistence] Failed to save:', result.error)
      }
    } catch (error) {
      console.error('[VoiceNotesPersistence] Error saving notes:', error)
    }
  }, [activeProjectId])

  /**
   * Debounced save - waits 1 second after last change before saving
   */
  const debouncedSave = useCallback((path: string, notes: VoiceTranscription[]) => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(path, notes)
      saveTimeoutRef.current = null
    }, 1000) // 1 second debounce
  }, [saveNotes])

  /**
   * Load notes when project changes
   */
  useEffect(() => {
    if (!projectPath || !activeProjectId) {
      return
    }

    // Only load if we haven't loaded for this project yet
    if (loadedProjectRef.current !== activeProjectId) {
      loadNotes(projectPath)
    }
  }, [activeProjectId, projectPath, loadNotes])

  /**
   * Save notes when transcriptions change
   */
  useEffect(() => {
    if (!projectPath || !activeProjectId) {
      return
    }

    // Only save if we've already loaded for this project (avoid saving on initial load)
    if (loadedProjectRef.current === activeProjectId) {
      debouncedSave(projectPath, voiceTranscriptions)
    }
  }, [voiceTranscriptions, projectPath, activeProjectId, debouncedSave])

  /**
   * Save immediately when component unmounts or project changes
   */
  useEffect(() => {
    return () => {
      // Clear debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }

      // Immediately save any pending changes
      if (projectPath && activeProjectId && loadedProjectRef.current === activeProjectId) {
        const projectNotes = voiceTranscriptions.filter(n => n.projectId === activeProjectId)
        const serialized = JSON.stringify(projectNotes)

        if (serialized !== lastSavedRef.current) {
          // Use sync-ish approach for unmount (best effort)
          window.api.voiceNotes.save(projectPath, projectNotes)
            .catch(err => console.error('[VoiceNotesPersistence] Unmount save failed:', err))
        }
      }
    }
  }, [projectPath, activeProjectId, voiceTranscriptions])

  return {
    /** Manually trigger a save (useful for explicit save actions) */
    saveNow: useCallback(() => {
      if (projectPath) {
        // Clear debounced save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = null
        }
        saveNotes(projectPath, voiceTranscriptions)
      }
    }, [projectPath, voiceTranscriptions, saveNotes]),

    /** Manually reload notes from disk */
    reload: useCallback(() => {
      if (projectPath) {
        loadedProjectRef.current = null // Force reload
        loadNotes(projectPath)
      }
    }, [projectPath, loadNotes])
  }
}
