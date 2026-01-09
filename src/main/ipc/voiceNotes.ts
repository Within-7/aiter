import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { VoiceTranscription, VoiceNotesFile } from '../../types/voiceInput'
import { VOICE_NOTES_DIR, VOICE_NOTES_FILENAME } from '../../types/voiceInput'

/**
 * Voice Notes IPC handlers for persisting voice transcriptions to project directories.
 *
 * Voice notes are stored in `.aiter/voice-notes.json` within each project directory.
 * This allows:
 * - Project-level organization of voice notes
 * - Version control integration (user can choose to gitignore or track)
 * - AI agents to read voice notes directly from the project
 * - Data portability - notes stay with the project even if AiTer is reinstalled
 */

/**
 * Get the path to voice notes file for a project
 */
function getVoiceNotesPath(projectPath: string): string {
  return path.join(projectPath, VOICE_NOTES_DIR, VOICE_NOTES_FILENAME)
}

/**
 * Ensure the .aiter directory exists
 */
async function ensureVoiceNotesDir(projectPath: string): Promise<void> {
  const dirPath = path.join(projectPath, VOICE_NOTES_DIR)
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    // Directory might already exist
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * Read voice notes from a project
 */
async function readVoiceNotes(projectPath: string): Promise<VoiceNotesFile> {
  const filePath = getVoiceNotesPath(projectPath)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content) as VoiceNotesFile
    return data
  } catch (error) {
    // File doesn't exist or is invalid - return empty structure
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        version: 1,
        projectPath,
        notes: [],
        lastUpdated: Date.now()
      }
    }
    throw error
  }
}

/**
 * Write voice notes to a project
 */
async function writeVoiceNotes(projectPath: string, data: VoiceNotesFile): Promise<void> {
  await ensureVoiceNotesDir(projectPath)
  const filePath = getVoiceNotesPath(projectPath)
  const content = JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, content, 'utf-8')
}

export function registerVoiceNotesHandlers() {
  // Load voice notes for a project
  ipcMain.handle('voiceNotes:load', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const data = await readVoiceNotes(projectPath)
      return { success: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceNotes:load] Error:', message)
      return { success: false, error: message }
    }
  })

  // Save voice notes for a project (full replacement)
  ipcMain.handle('voiceNotes:save', async (_, { projectPath, notes }: {
    projectPath: string
    notes: VoiceTranscription[]
  }) => {
    console.log('[voiceNotes:save] Called with:', { projectPath, notesCount: notes.length })
    try {
      const data: VoiceNotesFile = {
        version: 1,
        projectPath,
        notes,
        lastUpdated: Date.now()
      }
      console.log('[voiceNotes:save] Writing to:', getVoiceNotesPath(projectPath))
      await writeVoiceNotes(projectPath, data)
      console.log('[voiceNotes:save] Success!')
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceNotes:save] Error:', message, error)
      return { success: false, error: message }
    }
  })

  // Add a single note to a project
  ipcMain.handle('voiceNotes:add', async (_, { projectPath, note }: {
    projectPath: string
    note: VoiceTranscription
  }) => {
    try {
      const data = await readVoiceNotes(projectPath)
      data.notes.push(note)
      data.lastUpdated = Date.now()
      await writeVoiceNotes(projectPath, data)
      return { success: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceNotes:add] Error:', message)
      return { success: false, error: message }
    }
  })

  // Update a note in a project
  ipcMain.handle('voiceNotes:update', async (_, { projectPath, noteId, text }: {
    projectPath: string
    noteId: string
    text: string
  }) => {
    try {
      const data = await readVoiceNotes(projectPath)
      const note = data.notes.find(n => n.id === noteId)
      if (note) {
        note.text = text
        data.lastUpdated = Date.now()
        await writeVoiceNotes(projectPath, data)
      }
      return { success: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceNotes:update] Error:', message)
      return { success: false, error: message }
    }
  })

  // Delete a note from a project
  ipcMain.handle('voiceNotes:delete', async (_, { projectPath, noteId }: {
    projectPath: string
    noteId: string
  }) => {
    try {
      const data = await readVoiceNotes(projectPath)
      data.notes = data.notes.filter(n => n.id !== noteId)
      data.lastUpdated = Date.now()
      await writeVoiceNotes(projectPath, data)
      return { success: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceNotes:delete] Error:', message)
      return { success: false, error: message }
    }
  })

  // Clear all notes for a project
  ipcMain.handle('voiceNotes:clear', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const data: VoiceNotesFile = {
        version: 1,
        projectPath,
        notes: [],
        lastUpdated: Date.now()
      }
      await writeVoiceNotes(projectPath, data)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[voiceNotes:clear] Error:', message)
      return { success: false, error: message }
    }
  })
}
