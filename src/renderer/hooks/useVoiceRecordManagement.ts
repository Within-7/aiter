/**
 * Custom hook for voice record management
 * Handles CRUD operations for voice transcriptions and backups with disk persistence
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { VoiceTranscription, VoiceBackup, VoiceRecord } from '../../types/voiceInput'

/**
 * Separates voice records into transcriptions and pending backups
 */
function separateVoiceRecords(records: VoiceRecord[]): {
  transcriptions: VoiceTranscription[]
  backups: VoiceBackup[]
} {
  const transcriptions: VoiceTranscription[] = []
  const backups: VoiceBackup[] = []

  for (const record of records) {
    if (record.status === 'transcribed' && record.text) {
      transcriptions.push({
        id: record.id,
        text: record.text,
        timestamp: record.timestamp,
        source: record.source,
        projectId: record.projectId,
        insertedTo: record.insertedTo
      })
    } else if (record.status !== 'transcribed') {
      backups.push({
        id: record.id,
        timestamp: record.timestamp,
        source: record.source,
        projectId: record.projectId,
        duration: record.duration || 0,
        sampleRate: record.sampleRate || 16000,
        status: record.status as 'pending' | 'retrying' | 'failed' | 'recording' | 'completed',
        retryCount: record.retryCount || 0,
        lastError: record.lastError
      })
    }
  }

  return { transcriptions, backups }
}

export interface UseVoiceRecordManagementOptions {
  isOpen: boolean
  getProjectPath: () => string | null
  dispatch: React.Dispatch<{ type: string; payload?: unknown }>
}

export interface UseVoiceRecordManagementReturn {
  // State
  pendingBackups: VoiceBackup[]

  // Record operations
  loadRecords: () => Promise<void>
  reloadRecords: () => Promise<void>

  // Transcription CRUD
  addTranscription: (transcription: VoiceTranscription) => Promise<void>
  updateTranscription: (id: string, text: string) => Promise<void>
  deleteTranscription: (id: string) => Promise<void>

  // Backup operations
  updateBackupStatus: (backupId: string, updates: Partial<VoiceBackup>) => void
  deleteBackup: (backupId: string) => Promise<void>
}

export function useVoiceRecordManagement({
  isOpen,
  getProjectPath,
  dispatch
}: UseVoiceRecordManagementOptions): UseVoiceRecordManagementReturn {
  const [pendingBackups, setPendingBackups] = useState<VoiceBackup[]>([])
  const lastLoadedProjectRef = useRef<string | null>(null)

  // Load voice records
  const loadRecords = useCallback(async () => {
    const projectPath = getProjectPath()
    if (!projectPath) {
      setPendingBackups([])
      lastLoadedProjectRef.current = null
      return
    }

    lastLoadedProjectRef.current = projectPath

    try {
      const result = await window.api.voiceRecords.list(projectPath)
      if (result.success && result.records) {
        const { transcriptions, backups } = separateVoiceRecords(result.records)
        dispatch({ type: 'SET_VOICE_TRANSCRIPTIONS', payload: transcriptions })
        setPendingBackups(backups)
      }
    } catch (error) {
      console.error('Failed to load voice records:', error)
    }
  }, [getProjectPath, dispatch])

  // Reload records after changes
  const reloadRecords = useCallback(async () => {
    const projectPath = getProjectPath()
    if (!projectPath) return

    try {
      const result = await window.api.voiceRecords.list(projectPath)
      if (result.success && result.records) {
        const { transcriptions, backups } = separateVoiceRecords(result.records)
        dispatch({ type: 'SET_VOICE_TRANSCRIPTIONS', payload: transcriptions })
        setPendingBackups(backups)
      }
    } catch (error) {
      console.error('Failed to reload voice records:', error)
    }
  }, [getProjectPath, dispatch])

  // Load records when panel opens
  useEffect(() => {
    if (isOpen) {
      loadRecords()
    }
  }, [isOpen, loadRecords])

  // Add transcription
  const addTranscription = useCallback(async (transcription: VoiceTranscription) => {
    dispatch({ type: 'ADD_VOICE_TRANSCRIPTION', payload: transcription })

    const projectPath = getProjectPath()
    if (projectPath) {
      const record: VoiceRecord = {
        id: transcription.id,
        timestamp: transcription.timestamp,
        source: transcription.source,
        projectId: transcription.projectId,
        status: 'transcribed',
        text: transcription.text,
        insertedTo: transcription.insertedTo
      }
      await window.api.voiceRecords.add(projectPath, record)
    }
  }, [dispatch, getProjectPath])

  // Update transcription
  const updateTranscription = useCallback(async (id: string, text: string) => {
    dispatch({ type: 'UPDATE_VOICE_TRANSCRIPTION', payload: { id, text } })

    const projectPath = getProjectPath()
    if (projectPath) {
      await window.api.voiceRecords.update(projectPath, id, { text })
    }
  }, [dispatch, getProjectPath])

  // Delete transcription
  const deleteTranscription = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_VOICE_TRANSCRIPTION', payload: id })

    const projectPath = getProjectPath()
    if (projectPath) {
      await window.api.voiceRecords.delete(projectPath, id)
    }
  }, [dispatch, getProjectPath])

  // Update backup status in local state
  const updateBackupStatus = useCallback((backupId: string, updates: Partial<VoiceBackup>) => {
    setPendingBackups(prev => prev.map(b =>
      b.id === backupId ? { ...b, ...updates } : b
    ))
  }, [])

  // Delete backup
  const deleteBackup = useCallback(async (backupId: string) => {
    const projectPath = getProjectPath()
    if (!projectPath) return

    try {
      await window.api.voiceRecords.delete(projectPath, backupId)
      setPendingBackups(prev => prev.filter(b => b.id !== backupId))
    } catch (error) {
      console.error('Failed to delete backup:', error)
    }
  }, [getProjectPath])

  return {
    pendingBackups,
    loadRecords,
    reloadRecords,
    addTranscription,
    updateTranscription,
    deleteTranscription,
    updateBackupStatus,
    deleteBackup
  }
}
