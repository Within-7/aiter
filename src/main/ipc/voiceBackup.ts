import { BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { createWriteStream, WriteStream } from 'fs'
import * as path from 'path'
import type { VoiceBackup, VoiceBackupsIndex } from '../../types/voiceInput'
import { VOICE_NOTES_DIR, AUDIO_BACKUPS_DIR } from '../../types/voiceInput'

// Reference to main window for sending events
let mainWindow: BrowserWindow | null = null

const INDEX_FILENAME = 'index.json'

// Active streaming sessions - maps backupId to write stream
const activeStreams = new Map<string, WriteStream>()

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
  const dirPath = getBackupsDir(projectPath)
  await fs.mkdir(dirPath, { recursive: true })
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

export function registerVoiceBackupHandlers(window: BrowserWindow) {
  mainWindow = window

  // Save audio backup (audio data as base64)
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

      // Update index
      const index = await readIndex(projectPath)
      // Remove existing backup with same id if any
      index.backups = index.backups.filter(b => b.id !== backup.id)
      index.backups.push(backup)
      await writeIndex(projectPath, index)

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
  ipcMain.handle('voiceBackup:delete', async (_, {
    projectPath,
    backupId
  }: {
    projectPath: string
    backupId: string
  }) => {
    console.log('[voiceBackup:delete] Deleting backup:', backupId)
    try {
      // Delete audio file
      const audioPath = path.join(getBackupsDir(projectPath), `${backupId}.pcm`)
      try {
        await fs.unlink(audioPath)
      } catch (e) {
        // Ignore if file doesn't exist
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }

      // Update index
      const index = await readIndex(projectPath)
      index.backups = index.backups.filter(b => b.id !== backupId)
      await writeIndex(projectPath, index)

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

  // Start a streaming backup session - creates file and registers in index
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

      // Add to index with 'recording' status
      const index = await readIndex(projectPath)
      index.backups = index.backups.filter(b => b.id !== backup.id)
      index.backups.push({ ...backup, status: 'recording' as const })
      await writeIndex(projectPath, index)

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

  // End streaming backup - close file and update index
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

      // Update index with final status
      const index = await readIndex(projectPath)
      const backup = index.backups.find(b => b.id === backupId)
      if (backup) {
        backup.status = finalStatus
        backup.duration = duration
        if (errorMsg) {
          backup.lastError = errorMsg
        }
        await writeIndex(projectPath, index)
      }

      // If completed successfully, delete the audio file
      if (finalStatus === 'completed') {
        const audioPath = path.join(getBackupsDir(projectPath), `${backupId}.pcm`)
        try {
          await fs.unlink(audioPath)
          // Also remove from index
          index.backups = index.backups.filter(b => b.id !== backupId)
          await writeIndex(projectPath, index)
          console.log('[voiceBackup:endStream] Completed backup deleted:', backupId)
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

      // Remove from index
      const index = await readIndex(projectPath)
      index.backups = index.backups.filter(b => b.id !== backupId)
      await writeIndex(projectPath, index)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceBackup:abortStream] Error:', message)
      return { success: false, error: message }
    }
  })
}
