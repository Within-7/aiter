import { BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { VoiceBackup, VoiceBackupsIndex } from '../../types/voiceInput'
import { VOICE_NOTES_DIR, AUDIO_BACKUPS_DIR } from '../../types/voiceInput'

// Reference to main window for sending events
let mainWindow: BrowserWindow | null = null

const INDEX_FILENAME = 'index.json'

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
}
