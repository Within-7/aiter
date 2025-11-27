import * as fs from 'fs'
import * as path from 'path'
import { FileNode } from '../types'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const EXCLUDED_DIRS = ['node_modules', '.git', '.DS_Store', 'dist', 'build', '.next', '.vscode']

export class SecureFileSystemManager {
  /**
   * Validate and normalize file path to prevent directory traversal attacks
   */
  private validatePath(filePath: string): string {
    const normalizedPath = path.normalize(filePath)
    const resolvedPath = path.resolve(normalizedPath)

    // Check for directory traversal attempts
    if (!resolvedPath.startsWith(path.resolve('/'))) {
      throw new Error('Invalid path: directory traversal detected')
    }

    return resolvedPath
  }

  /**
   * Check if a directory should be excluded
   */
  private shouldExclude(name: string): boolean {
    return EXCLUDED_DIRS.includes(name) || name.startsWith('.')
  }

  /**
   * Detect file type based on extension
   */
  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()

    const typeMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'css',
      '.sass': 'css',
      '.less': 'css',
      '.json': 'json',
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.txt': 'text',
      '.xml': 'text',
      '.yaml': 'text',
      '.yml': 'text',
      '.log': 'text',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.webp': 'image',
    }

    return typeMap[ext] || 'other'
  }

  /**
   * Read directory contents recursively with depth limit
   */
  async readDirectory(dirPath: string, depth: number = 1): Promise<FileNode[]> {
    try {
      const validPath = this.validatePath(dirPath)

      // Check if path exists and is a directory
      const stats = await fs.promises.stat(validPath)
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory')
      }

      const entries = await fs.promises.readdir(validPath, { withFileTypes: true })
      const nodes: FileNode[] = []

      for (const entry of entries) {
        // Skip excluded directories
        if (this.shouldExclude(entry.name)) {
          continue
        }

        const fullPath = path.join(validPath, entry.name)
        const entryStats = await fs.promises.stat(fullPath)

        const node: FileNode = {
          id: uuidv4(),
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? entryStats.size : undefined,
          modifiedTime: entryStats.mtimeMs,
          isExpanded: false,
        }

        // Recursively read subdirectories if depth allows
        if (entry.isDirectory() && depth > 1) {
          node.children = await this.readDirectory(fullPath, depth - 1)
        }

        nodes.push(node)
      }

      // Sort: directories first, then by name
      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name)
        }
        return a.type === 'directory' ? -1 : 1
      })
    } catch (error) {
      console.error('Error reading directory:', error)
      throw error
    }
  }

  /**
   * Read file contents with size limit
   */
  async readFile(filePath: string): Promise<{ content: string; fileType: string }> {
    try {
      const validPath = this.validatePath(filePath)

      // Check file size
      const stats = await fs.promises.stat(validPath)
      if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
      }

      // Check if it's a file
      if (!stats.isFile()) {
        throw new Error('Path is not a file')
      }

      const fileType = this.getFileType(validPath)

      // Read file based on type
      let content: string
      if (fileType === 'image') {
        // For images, return base64 encoded data
        const buffer = await fs.promises.readFile(validPath)
        content = `data:image/${path.extname(validPath).slice(1)};base64,${buffer.toString('base64')}`
      } else {
        // For text files, read as UTF-8
        content = await fs.promises.readFile(validPath, 'utf-8')
      }

      return { content, fileType }
    } catch (error) {
      console.error('Error reading file:', error)
      throw error
    }
  }

  /**
   * Write file contents
   */
  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(filePath)

      // Ensure directory exists
      const dir = path.dirname(validPath)
      await fs.promises.mkdir(dir, { recursive: true })

      // Write file
      await fs.promises.writeFile(validPath, content, 'utf-8')

      return true
    } catch (error) {
      console.error('Error writing file:', error)
      throw error
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(filePath)
      await fs.promises.access(validPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<fs.Stats> {
    const validPath = this.validatePath(filePath)
    return await fs.promises.stat(validPath)
  }
}

// Singleton instance
export const fileSystemManager = new SecureFileSystemManager()
