import { BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { createWriteStream, WriteStream } from 'fs'
import * as path from 'path'
import type {
  VoiceBackup,
  VoiceBackupsIndex,
  VoiceRecord,
  VoiceRecordsFile,
  VoiceNotesFile
} from '../../types/voiceInput'
import {
  VOICE_NOTES_DIR,
  AUDIO_BACKUPS_DIR,
  VOICE_NOTES_FILENAME,
  VOICE_RECORDS_FILENAME
} from '../../types/voiceInput'
import { ensureAiterDir, setMainWindow } from '../utils/aiterDir'

const INDEX_FILENAME = 'index.json' // Legacy backup index

// Active streaming sessions - maps backupId to write stream
const activeStreams = new Map<string, WriteStream>()

// ============== Unified Records API ==============

/**
 * Get the unified records file path
 */
function getRecordsPath(projectPath: string): string {
  return path.join(projectPath, VOICE_NOTES_DIR, VOICE_RECORDS_FILENAME)
}

/**
 * Get the legacy voice-notes.json path (for migration)
 */
function getLegacyNotesPath(projectPath: string): string {
  return path.join(projectPath, VOICE_NOTES_DIR, VOICE_NOTES_FILENAME)
}

/**
 * Read unified records file, with automatic migration from legacy formats
 */
async function readRecords(projectPath: string): Promise<VoiceRecordsFile> {
  const recordsPath = getRecordsPath(projectPath)

  try {
    const content = await fs.readFile(recordsPath, 'utf-8')
    return JSON.parse(content) as VoiceRecordsFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - try to migrate from legacy formats
      return await migrateFromLegacy(projectPath)
    }
    throw error
  }
}

/**
 * Write unified records file
 */
async function writeRecords(projectPath: string, records: VoiceRecordsFile): Promise<void> {
  // Use shared utility to ensure .aiter/ is created and added to ignore files
  await ensureAiterDir(projectPath)
  const recordsPath = getRecordsPath(projectPath)
  records.lastUpdated = Date.now()
  await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), 'utf-8')
}

/**
 * Migrate from legacy voice-notes.json and audio-backups/index.json
 */
async function migrateFromLegacy(projectPath: string): Promise<VoiceRecordsFile> {
  const records: VoiceRecord[] = []

  // 1. Migrate from legacy voice-notes.json
  try {
    const notesPath = getLegacyNotesPath(projectPath)
    const notesContent = await fs.readFile(notesPath, 'utf-8')
    const notesFile = JSON.parse(notesContent) as VoiceNotesFile

    for (const note of notesFile.notes) {
      records.push({
        id: note.id,
        timestamp: note.timestamp,
        source: note.source,
        projectId: note.projectId,
        status: 'transcribed',
        text: note.text,
        insertedTo: note.insertedTo
      })
    }
    console.log(`[voiceBackup] Migrated ${notesFile.notes.length} notes from legacy voice-notes.json`)
  } catch (e) {
    // Legacy file doesn't exist or invalid - that's fine
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[voiceBackup] Error reading legacy voice-notes.json:', e)
    }
  }

  // 2. Migrate from legacy audio-backups/index.json
  try {
    const indexPath = getIndexPath(projectPath)
    const indexContent = await fs.readFile(indexPath, 'utf-8')
    const indexFile = JSON.parse(indexContent) as VoiceBackupsIndex

    for (const backup of indexFile.backups) {
      // Skip completed or recording status (completed means already transcribed)
      if (backup.status === 'completed' || backup.status === 'recording') continue

      // Map legacy status to new status
      const newStatus = backup.status as 'pending' | 'retrying' | 'failed'

      records.push({
        id: backup.id,
        timestamp: backup.timestamp,
        source: backup.source,
        projectId: backup.projectId,
        status: newStatus,
        duration: backup.duration,
        sampleRate: backup.sampleRate,
        retryCount: backup.retryCount,
        lastError: backup.lastError
      })
    }
    console.log(`[voiceBackup] Migrated ${indexFile.backups.length} backups from legacy index.json`)
  } catch (e) {
    // Legacy file doesn't exist or invalid - that's fine
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[voiceBackup] Error reading legacy index.json:', e)
    }
  }

  // Sort by timestamp
  records.sort((a, b) => a.timestamp - b.timestamp)

  const migratedData: VoiceRecordsFile = {
    version: 2,
    projectPath,
    records,
    lastUpdated: Date.now()
  }

  // Save the migrated data to the new unified file
  await writeRecords(projectPath, migratedData)
  console.log(`[voiceBackup] Saved ${records.length} records to voice-records.json`)

  // Delete legacy files after successful migration
  try {
    const notesPath = getLegacyNotesPath(projectPath)
    await fs.unlink(notesPath)
    console.log('[voiceBackup] Deleted legacy voice-notes.json')
  } catch (e) {
    // File doesn't exist - that's fine
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[voiceBackup] Error deleting legacy voice-notes.json:', e)
    }
  }

  try {
    const indexPath = getIndexPath(projectPath)
    await fs.unlink(indexPath)
    console.log('[voiceBackup] Deleted legacy audio-backups/index.json')
  } catch (e) {
    // File doesn't exist - that's fine
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[voiceBackup] Error deleting legacy index.json:', e)
    }
  }

  return migratedData
}

/**
 * Get the audio backups directory path for a project
 */
function getBackupsDir(projectPath: string): string {
  return path.join(projectPath, VOICE_NOTES_DIR, AUDIO_BACKUPS_DIR)
}

/**
 * Get the index file path
 */
function getIndexPath(projectPath: string): string {
  return path.join(getBackupsDir(projectPath), INDEX_FILENAME)
}

/**
 * Ensure the audio backups directory exists
 */
async function ensureBackupsDir(projectPath: string): Promise<void> {
  // Use shared utility to ensure .aiter/ is created and added to ignore files,
  // then create the audio-backups subdirectory
  await ensureAiterDir(projectPath, AUDIO_BACKUPS_DIR)
}

/**
 * Read backups index
 */
async function readIndex(projectPath: string): Promise<VoiceBackupsIndex> {
  const indexPath = getIndexPath(projectPath)
  try {
    const content = await fs.readFile(indexPath, 'utf-8')
    return JSON.parse(content) as VoiceBackupsIndex
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, backups: [], lastUpdated: Date.now() }
    }
    throw error
  }
}

/**
 * Write backups index
 */
async function writeIndex(projectPath: string, index: VoiceBackupsIndex): Promise<void> {
  await ensureBackupsDir(projectPath)
  const indexPath = getIndexPath(projectPath)
  index.lastUpdated = Date.now()
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
}

export function registerVoiceBackupHandlers(_window: BrowserWindow) {
  // Set main window reference for file tree refresh notifications
  setMainWindow(_window)

  // ============== Unified Records API ==============

  // List all voice records (transcriptions + pending backups)
  ipcMain.handle('voiceRecords:list', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const recordsFile = await readRecords(projectPath)
      return { success: true, records: recordsFile.records }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceRecords:list] Error:', message)
      return { success: false, error: message, records: [] }
    }
  })

  // Add a new voice record (either transcribed or pending)
  ipcMain.handle('voiceRecords:add', async (_, {
    projectPath,
    record
  }: {
    projectPath: string
    record: VoiceRecord
  }) => {
    try {
      const recordsFile = await readRecords(projectPath)
      // Remove existing record with same id if any
      recordsFile.records = recordsFile.records.filter(r => r.id !== record.id)
      recordsFile.records.push(record)
      // Sort by timestamp
      recordsFile.records.sort((a, b) => a.timestamp - b.timestamp)
      await writeRecords(projectPath, recordsFile)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceRecords:add] Error:', message)
      return { success: false, error: message }
    }
  })

  // Update a voice record
  ipcMain.handle('voiceRecords:update', async (_, {
    projectPath,
    recordId,
    updates
  }: {
    projectPath: string
    recordId: string
    updates: Partial<VoiceRecord>
  }) => {
    try {
      const recordsFile = await readRecords(projectPath)
      const record = recordsFile.records.find(r => r.id === recordId)
      if (record) {
        Object.assign(record, updates)
        await writeRecords(projectPath, recordsFile)
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceRecords:update] Error:', message)
      return { success: false, error: message }
    }
  })

  // Delete a voice record
  ipcMain.handle('voiceRecords:delete', async (_, {
    projectPath,
    recordId
  }: {
    projectPath: string
    recordId: string
  }) => {
    try {
      const recordsFile = await readRecords(projectPath)
      recordsFile.records = recordsFile.records.filter(r => r.id !== recordId)
      await writeRecords(projectPath, recordsFile)

      // Also delete audio file if it exists
      const audioPath = path.join(getBackupsDir(projectPath), `${recordId}.pcm`)
      try {
        await fs.unlink(audioPath)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceRecords:delete] Error:', message)
      return { success: false, error: message }
    }
  })

  // Clear all voice records
  ipcMain.handle('voiceRecords:clear', async (_, { projectPath }: { projectPath: string }) => {
    try {
      // Remove unified records file
      const recordsPath = getRecordsPath(projectPath)
      try {
        await fs.unlink(recordsPath)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }

      // Remove audio backups directory
      const backupsDir = getBackupsDir(projectPath)
      try {
        await fs.rm(backupsDir, { recursive: true, force: true })
      } catch (e) {
        // Ignore errors
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceRecords:clear] Error:', message)
      return { success: false, error: message }
    }
  })

  // ============== Audio File Operations ==============

  // Save audio backup (audio data as base64) - uses unified records
  ipcMain.handle('voiceBackup:save', async (_, {
    projectPath,
    backup,
    audioData
  }: {
    projectPath: string
    backup: VoiceBackup
    audioData: string  // base64 encoded PCM data
  }) => {
    console.log('[voiceBackup:save] Saving backup:', backup.id, 'to:', projectPath)
    try {
      await ensureBackupsDir(projectPath)

      // Save audio file
      const audioPath = path.join(getBackupsDir(projectPath), `${backup.id}.pcm`)
      const audioBuffer = Buffer.from(audioData, 'base64')
      await fs.writeFile(audioPath, audioBuffer)
      console.log('[voiceBackup:save] Audio saved:', audioPath, 'size:', audioBuffer.length)

      // Update unified records (not legacy index.json)
      const recordsFile = await readRecords(projectPath)
      // Remove existing record with same id if any
      recordsFile.records = recordsFile.records.filter(r => r.id !== backup.id)
      // Add as a VoiceRecord
      recordsFile.records.push({
        id: backup.id,
        timestamp: backup.timestamp,
        source: backup.source,
        projectId: backup.projectId,
        status: backup.status as 'pending' | 'retrying' | 'failed',
        duration: backup.duration,
        sampleRate: backup.sampleRate,
        retryCount: backup.retryCount,
        lastError: backup.lastError
      })
      await writeRecords(projectPath, recordsFile)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:save] Error:', message)
      return { success: false, error: message }
    }
  })

  // List all backups for a project
  ipcMain.handle('voiceBackup:list', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const index = await readIndex(projectPath)
      return { success: true, backups: index.backups }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:list] Error:', message)
      return { success: false, error: message, backups: [] }
    }
  })

  // Read audio data for a backup (for retry)
  ipcMain.handle('voiceBackup:read', async (_, {
    projectPath,
    backupId
  }: {
    projectPath: string
    backupId: string
  }) => {
    try {
      const audioPath = path.join(getBackupsDir(projectPath), `${backupId}.pcm`)
      const audioBuffer = await fs.readFile(audioPath)
      const audioData = audioBuffer.toString('base64')
      return { success: true, audioData }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:read] Error:', message)
      return { success: false, error: message }
    }
  })

  // Update backup metadata (e.g., after retry attempt)
  ipcMain.handle('voiceBackup:update', async (_, {
    projectPath,
    backupId,
    updates
  }: {
    projectPath: string
    backupId: string
    updates: Partial<VoiceBackup>
  }) => {
    try {
      const index = await readIndex(projectPath)
      const backup = index.backups.find(b => b.id === backupId)
      if (backup) {
        Object.assign(backup, updates)
        await writeIndex(projectPath, index)
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:update] Error:', message)
      return { success: false, error: message }
    }
  })

  // Delete a backup (after successful transcription or manual delete)
  // Note: This only deletes the audio file, not the record in voice-records.json
  // Use voiceRecords:delete to remove from records
  ipcMain.handle('voiceBackup:delete', async (_, {
    projectPath,
    backupId
  }: {
    projectPath: string
    backupId: string
  }) => {
    console.log('[voiceBackup:delete] Deleting backup audio:', backupId)
    try {
      // Delete audio file only
      const audioPath = path.join(getBackupsDir(projectPath), `${backupId}.pcm`)
      try {
        await fs.unlink(audioPath)
      } catch (e) {
        // Ignore if file doesn't exist
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:delete] Error:', message)
      return { success: false, error: message }
    }
  })

  // Clear all backups for a project
  ipcMain.handle('voiceBackup:clear', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const backupsDir = getBackupsDir(projectPath)
      // Remove entire directory
      await fs.rm(backupsDir, { recursive: true, force: true })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:clear] Error:', message)
      return { success: false, error: message }
    }
  })

  // === Streaming backup API ===

  // Start a streaming backup session - creates file and registers in unified records
  ipcMain.handle('voiceBackup:startStream', async (_, {
    projectPath,
    backup
  }: {
    projectPath: string
    backup: VoiceBackup
  }) => {
    console.log('[voiceBackup:startStream] Starting stream:', backup.id)
    try {
      await ensureBackupsDir(projectPath)

      // Create write stream for audio file
      const audioPath = path.join(getBackupsDir(projectPath), `${backup.id}.pcm`)
      const stream = createWriteStream(audioPath)

      // Store stream reference
      activeStreams.set(backup.id, stream)

      // Add to unified records with 'recording' status
      const recordsFile = await readRecords(projectPath)
      recordsFile.records = recordsFile.records.filter(r => r.id !== backup.id)
      recordsFile.records.push({
        id: backup.id,
        timestamp: backup.timestamp,
        source: backup.source,
        projectId: backup.projectId,
        status: 'recording',
        duration: backup.duration,
        sampleRate: backup.sampleRate,
        retryCount: backup.retryCount
      })
      await writeRecords(projectPath, recordsFile)

      console.log('[voiceBackup:startStream] Stream started:', audioPath)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:startStream] Error:', message)
      return { success: false, error: message }
    }
  })

  // Append audio chunk to streaming backup
  ipcMain.handle('voiceBackup:appendChunk', async (_, {
    backupId,
    audioChunk
  }: {
    backupId: string
    audioChunk: string  // base64 encoded PCM chunk
  }) => {
    try {
      const stream = activeStreams.get(backupId)
      if (!stream) {
        // Stream not found - might have been closed or never started
        // This is not necessarily an error (e.g., recording started without project)
        return { success: false, error: 'Stream not found' }
      }

      const buffer = Buffer.from(audioChunk, 'base64')
      stream.write(buffer)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:appendChunk] Error:', message)
      return { success: false, error: message }
    }
  })

  // End streaming backup - close file and update unified records
  ipcMain.handle('voiceBackup:endStream', async (_, {
    projectPath,
    backupId,
    finalStatus,
    duration,
    error: errorMsg
  }: {
    projectPath: string
    backupId: string
    finalStatus: 'pending' | 'completed'
    duration: number
    error?: string
  }) => {
    console.log('[voiceBackup:endStream] Ending stream:', backupId, 'status:', finalStatus)
    try {
      // Close the write stream
      const stream = activeStreams.get(backupId)
      if (stream) {
        await new Promise<void>((resolve, reject) => {
          stream.end((err: Error | null | undefined) => {
            if (err) reject(err)
            else resolve()
          })
        })
        activeStreams.delete(backupId)
      }

      // Update unified records with final status
      const recordsFile = await readRecords(projectPath)
      const record = recordsFile.records.find(r => r.id === backupId)
      if (record) {
        record.status = finalStatus === 'completed' ? 'transcribed' : finalStatus
        record.duration = duration
        if (errorMsg) {
          record.lastError = errorMsg
        }
        await writeRecords(projectPath, recordsFile)
      }

      // If completed successfully, delete the audio file only (keep record for text update)
      // The record will be updated with transcription text by the renderer
      if (finalStatus === 'completed') {
        const audioPath = path.join(getBackupsDir(projectPath), `${backupId}.pcm`)
        try {
          await fs.unlink(audioPath)
          console.log('[voiceBackup:endStream] Audio file deleted:', backupId)
        } catch (e) {
          // Ignore if file doesn't exist
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
        }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:endStream] Error:', message)
      return { success: false, error: message }
    }
  })

  // Abort streaming backup - close and delete incomplete file
  ipcMain.handle('voiceBackup:abortStream', async (_, {
    projectPath,
    backupId
  }: {
    projectPath: string
    backupId: string
  }) => {
    console.log('[voiceBackup:abortStream] Aborting stream:', backupId)
    try {
      // Close the write stream
      const stream = activeStreams.get(backupId)
      if (stream) {
        stream.destroy()
        activeStreams.delete(backupId)
      }

      // Delete the incomplete audio file
      const audioPath = path.join(getBackupsDir(projectPath), `${backupId}.pcm`)
      try {
        await fs.unlink(audioPath)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }

      // Remove from unified records
      const recordsFile = await readRecords(projectPath)
      recordsFile.records = recordsFile.records.filter(r => r.id !== backupId)
      await writeRecords(projectPath, recordsFile)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:abortStream] Error:', message)
      return { success: false, error: message }
    }
  })
}
