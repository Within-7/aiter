/**
 * Editor-related type definitions.
 */

/**
 * Supported file types for the editor
 */
export type EditorFileType =
  | 'html'
  | 'markdown'
  | 'json'
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'text'
  | 'other'
  | 'diff'
  | 'python'
  | 'java'
  | 'c'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'shell'
  | 'sql'
  | 'yaml'
  | 'xml'
  | 'dockerfile'
  | 'image'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'

/**
 * Editor tab representing an open file or scratch document
 */
export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  fileType: EditorFileType
  content: string
  originalContent?: string // Original content when file was opened, used to detect if content changed
  isDirty: boolean
  isPreview?: boolean // Preview tab (VSCode-like behavior): replaced on next file click, unless pinned
  isScratchpad?: boolean // Temporary scratchpad tab, not associated with a file
  cursorPosition?: { line: number; column: number }
  serverUrl?: string // HTTP server URL for HTML preview
  // Diff view properties
  isDiff?: boolean
  diffContent?: string
  commitHash?: string
  commitMessage?: string
  projectPath?: string
}
