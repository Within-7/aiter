/**
 * Shared utility for .aiter/ directory management.
 * Ensures the directory is created and added to all ignore files.
 */
import { BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { VOICE_NOTES_DIR } from '../../types/voiceInput'

// Track which project paths have already been processed this session
// to avoid redundant ignore file checks
const processedPaths = new Set<string>()

// Reference to main window for sending file tree refresh events
let mainWindowRef: BrowserWindow | null = null

/**
 * Set the main window reference for file tree refresh notifications
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window
}

/**
 * Find all ignore files in the project root directory.
 * Matches files that:
 * - End with 'ignore' (e.g., .gitignore, .dockerignore, .prettierignore)
 * - Are hidden files (start with .)
 */
async function findIgnoreFiles(projectPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true })
    return entries
      .filter(entry =>
        entry.isFile() &&
        entry.name.startsWith('.') &&
        entry.name.toLowerCase().endsWith('ignore')
      )
      .map(entry => entry.name)
  } catch (error) {
    console.warn('[aiterDir] Failed to read project directory:', error)
    return []
  }
}

/**
 * Add .aiter/ to an ignore file if it doesn't already contain the entry
 */
async function addToIgnoreFile(projectPath: string, ignoreFile: string): Promise<void> {
  const filePath = path.join(projectPath, ignoreFile)
  const ignoreEntry = `${VOICE_NOTES_DIR}/`

  try {
    const content = await fs.readFile(filePath, 'utf-8')

    // Check if .aiter/ is already in the file (with various formats)
    const lines = content.split('\n')
    const hasEntry = lines.some(line => {
      const trimmed = line.trim()
      return trimmed === VOICE_NOTES_DIR ||
             trimmed === `${VOICE_NOTES_DIR}/` ||
             trimmed === `/${VOICE_NOTES_DIR}` ||
             trimmed === `/${VOICE_NOTES_DIR}/`
    })

    if (!hasEntry) {
      // Add .aiter/ to the end of the file
      const newContent = content.endsWith('\n')
        ? `${content}${ignoreEntry}\n`
        : `${content}\n${ignoreEntry}\n`
      await fs.writeFile(filePath, newContent, 'utf-8')
      console.log(`[aiterDir] Added ${ignoreEntry} to ${ignoreFile}`)
    }
  } catch (error) {
    console.warn(`[aiterDir] Failed to update ${ignoreFile}:`, error)
  }
}

/**
 * Ensure the .aiter directory exists and is added to all ignore files.
 * This is the canonical function that should be used by all code that creates
 * the .aiter/ directory or any subdirectories within it.
 *
 * @param projectPath - The project root path
 * @param subDir - Optional subdirectory within .aiter/ to create (e.g., 'audio-backups')
 * @returns The full path to the created directory
 */
export async function ensureAiterDir(projectPath: string, subDir?: string): Promise<string> {
  const aiterPath = path.join(projectPath, VOICE_NOTES_DIR)
  const targetPath = subDir ? path.join(aiterPath, subDir) : aiterPath

  // Check if we need to handle ignore files (only once per project per session)
  const needsIgnoreFileCheck = !processedPaths.has(projectPath)

  // Check if .aiter directory already exists
  let aiterDirExists = false
  try {
    const stat = await fs.stat(aiterPath)
    aiterDirExists = stat.isDirectory()
  } catch {
    // Directory doesn't exist
  }

  // Create the target directory (handles both .aiter and subdirectories)
  try {
    await fs.mkdir(targetPath, { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }

  // If .aiter was just created (didn't exist before), update ignore files
  if (!aiterDirExists && needsIgnoreFileCheck) {
    console.log(`[aiterDir] Created directory: ${aiterPath}`)

    // Find and update all ignore files in the project
    const ignoreFiles = await findIgnoreFiles(projectPath)
    if (ignoreFiles.length > 0) {
      console.log(`[aiterDir] Found ignore files: ${ignoreFiles.join(', ')}`)
      await Promise.all(ignoreFiles.map(file => addToIgnoreFile(projectPath, file)))
    }

    // Mark this project as processed
    processedPaths.add(projectPath)

    // Notify renderer to refresh file tree
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      console.log(`[aiterDir] Sending file tree refresh for ${projectPath}`)
      mainWindowRef.webContents.send('fileWatcher:changed', {
        projectPath,
        changeCount: 1
      })
    }
  } else if (needsIgnoreFileCheck) {
    // Directory already exists, but we haven't checked ignore files this session
    // Mark as processed to avoid redundant checks
    processedPaths.add(projectPath)
  }

  return targetPath
}

/**
 * Clear the processed paths cache (useful for testing or after project removal)
 */
export function clearProcessedPaths(): void {
  processedPaths.clear()
}
