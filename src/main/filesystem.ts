import * as fs from 'fs'
import * as path from 'path'
import { FileNode } from '../types'
import { v4 as uuidv4 } from 'uuid'
import ignore, { Ignore } from 'ignore'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
// Only exclude truly internal/system directories, show all other hidden files
const EXCLUDED_DIRS = ['.git', '.DS_Store']

// Cache for gitignore instances per project root
const gitignoreCache = new Map<string, { ig: Ignore; mtime: number }>()

/**
 * Find the git root by traversing up the directory tree
 */
async function findGitRoot(startPath: string): Promise<string | null> {
  let currentPath = startPath

  while (currentPath !== path.dirname(currentPath)) {
    const gitPath = path.join(currentPath, '.git')
    try {
      const stats = await fs.promises.stat(gitPath)
      if (stats.isDirectory()) {
        return currentPath
      }
    } catch {
      // .git not found, continue up
    }
    currentPath = path.dirname(currentPath)
  }

  return null
}

/**
 * Load and cache gitignore for a project root
 */
async function getGitignore(projectRoot: string): Promise<Ignore | null> {
  const gitignorePath = path.join(projectRoot, '.gitignore')

  try {
    const stats = await fs.promises.stat(gitignorePath)
    const mtime = stats.mtimeMs

    // Check cache
    const cached = gitignoreCache.get(projectRoot)
    if (cached && cached.mtime === mtime) {
      return cached.ig
    }

    // Load and parse .gitignore
    const content = await fs.promises.readFile(gitignorePath, 'utf-8')
    const ig = ignore().add(content)

    // Cache it
    gitignoreCache.set(projectRoot, { ig, mtime })

    return ig
  } catch {
    // No .gitignore file or can't read it
    return null
  }
}

/**
 * Check if a directory itself is ignored by gitignore
 */
async function isDirectoryIgnored(dirPath: string, gitRoot: string): Promise<boolean> {
  const ig = await getGitignore(gitRoot)
  if (!ig) return false

  const relativePath = path.relative(gitRoot, dirPath)
  if (!relativePath) return false // dirPath is the git root itself

  // Check with trailing slash for directory
  return ig.ignores(relativePath + '/')
}

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
   * Check if a directory should be excluded (only system directories)
   */
  private shouldExclude(name: string): boolean {
    return EXCLUDED_DIRS.includes(name)
  }

  /**
   * Detect file type based on extension
   */
  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()

    const typeMap: Record<string, string> = {
      // JavaScript/TypeScript
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.mts': 'typescript',
      '.cts': 'typescript',
      // Web
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'css',
      '.sass': 'css',
      '.less': 'css',
      // Data formats
      '.json': 'json',
      '.jsonc': 'json',
      '.json5': 'json',
      // Markdown
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.mdx': 'markdown',
      // Python
      '.py': 'python',
      '.pyw': 'python',
      '.pyi': 'python',
      '.pyx': 'python',
      // Java
      '.java': 'java',
      '.jar': 'java',
      '.class': 'java',
      // C/C++
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.hpp': 'cpp',
      '.hxx': 'cpp',
      '.hh': 'cpp',
      // Go
      '.go': 'go',
      // Rust
      '.rs': 'rust',
      // Ruby
      '.rb': 'ruby',
      '.erb': 'ruby',
      '.rake': 'ruby',
      '.gemspec': 'ruby',
      // PHP
      '.php': 'php',
      '.phtml': 'php',
      '.php3': 'php',
      '.php4': 'php',
      '.php5': 'php',
      '.php7': 'php',
      '.phps': 'php',
      // Shell
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
      '.ksh': 'shell',
      '.csh': 'shell',
      '.tcsh': 'shell',
      '.ps1': 'shell',
      '.psm1': 'shell',
      '.bat': 'shell',
      '.cmd': 'shell',
      // SQL
      '.sql': 'sql',
      '.mysql': 'sql',
      '.pgsql': 'sql',
      '.plsql': 'sql',
      // YAML
      '.yaml': 'yaml',
      '.yml': 'yaml',
      // XML
      '.xml': 'xml',
      '.xsd': 'xml',
      '.xsl': 'xml',
      '.xslt': 'xml',
      '.plist': 'xml',
      // Docker
      '.dockerfile': 'dockerfile',
      // Config files (treat as their format)
      '.env': 'shell',
      '.gitignore': 'text',
      '.gitattributes': 'text',
      '.editorconfig': 'text',
      '.prettierrc': 'json',
      '.eslintrc': 'json',
      '.babelrc': 'json',
      // Text
      '.txt': 'text',
      '.log': 'text',
      '.ini': 'text',
      '.cfg': 'text',
      '.conf': 'text',
      '.properties': 'text',
      '.toml': 'text',
      // Images
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.webp': 'image',
      '.bmp': 'image',
      '.ico': 'image',
      '.tiff': 'image',
      '.tif': 'image',
      '.svg': 'image',
      // PDF
      '.pdf': 'pdf',
      // Office documents
      '.doc': 'word',
      '.docx': 'word',
      '.rtf': 'word',
      '.odt': 'word',
      '.xls': 'excel',
      '.xlsx': 'excel',
      '.xlsm': 'excel',
      '.ods': 'excel',
      '.csv': 'excel',
      '.ppt': 'powerpoint',
      '.pptx': 'powerpoint',
      '.odp': 'powerpoint',
    }

    return typeMap[ext] || 'other'
  }

  /**
   * Read directory contents recursively with depth limit
   * @param dirPath - Directory path to read
   * @param depth - Recursion depth limit (default 1)
   * @param projectRoot - Project root for gitignore checking (optional, auto-detected from git)
   * @param parentIgnored - Whether the parent directory is ignored (for inheritance)
   */
  async readDirectory(dirPath: string, depth: number = 1, projectRoot?: string, parentIgnored: boolean = false): Promise<FileNode[]> {
    try {
      const validPath = this.validatePath(dirPath)

      // Check if path exists and is a directory
      const stats = await fs.promises.stat(validPath)
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory')
      }

      // Find git root if not provided
      const root = projectRoot || await findGitRoot(validPath) || validPath

      // Load gitignore for the project root
      const ig = await getGitignore(root)

      // Check if the current directory itself is ignored (for when expanding a folder)
      // This handles the case where the folder was already marked as ignored
      let currentDirIgnored = parentIgnored
      if (!parentIgnored && root !== validPath) {
        currentDirIgnored = await isDirectoryIgnored(validPath, root)
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

        // Calculate relative path from project root for gitignore matching
        const relativePath = path.relative(root, fullPath)
        // For directories, add trailing slash for proper gitignore matching
        const gitignorePath = entry.isDirectory() ? relativePath + '/' : relativePath

        // Check if file/directory is ignored by .gitignore
        // If current directory or parent is ignored, children inherit the ignored status
        const isGitIgnored = currentDirIgnored || (ig ? ig.ignores(gitignorePath) : false)

        const node: FileNode = {
          id: uuidv4(),
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? entryStats.size : undefined,
          modifiedTime: entryStats.mtimeMs,
          isExpanded: false,
          isGitIgnored,
        }

        // Recursively read subdirectories if depth allows
        // Pass isGitIgnored to children so they inherit the ignored status
        if (entry.isDirectory() && depth > 1) {
          node.children = await this.readDirectory(fullPath, depth - 1, root, isGitIgnored)
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

  /**
   * Create a new empty file
   */
  async createFile(filePath: string, content: string = ''): Promise<boolean> {
    try {
      const validPath = this.validatePath(filePath)

      // Check if file already exists
      try {
        await fs.promises.access(validPath)
        throw new Error('File already exists')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err
        }
      }

      // Ensure parent directory exists
      const dir = path.dirname(validPath)
      await fs.promises.mkdir(dir, { recursive: true })

      // Create the file
      await fs.promises.writeFile(validPath, content, 'utf-8')

      return true
    } catch (error) {
      console.error('Error creating file:', error)
      throw error
    }
  }

  /**
   * Create a new directory
   */
  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(dirPath)

      // Check if directory already exists
      try {
        const stats = await fs.promises.stat(validPath)
        if (stats.isDirectory()) {
          throw new Error('Directory already exists')
        }
        throw new Error('A file with this name already exists')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err
        }
      }

      // Create the directory
      await fs.promises.mkdir(validPath, { recursive: true })

      return true
    } catch (error) {
      console.error('Error creating directory:', error)
      throw error
    }
  }

  /**
   * Rename a file or directory
   */
  async rename(oldPath: string, newPath: string): Promise<boolean> {
    try {
      const validOldPath = this.validatePath(oldPath)
      const validNewPath = this.validatePath(newPath)

      // Check if source exists
      await fs.promises.access(validOldPath)

      // Check if destination already exists
      try {
        await fs.promises.access(validNewPath)
        throw new Error('A file or directory with this name already exists')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err
        }
      }

      // Rename
      await fs.promises.rename(validOldPath, validNewPath)

      return true
    } catch (error) {
      console.error('Error renaming:', error)
      throw error
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(targetPath: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(targetPath)

      const stats = await fs.promises.stat(validPath)

      if (stats.isDirectory()) {
        // Recursively delete directory
        await fs.promises.rm(validPath, { recursive: true, force: true })
      } else {
        // Delete file
        await fs.promises.unlink(validPath)
      }

      return true
    } catch (error) {
      console.error('Error deleting:', error)
      throw error
    }
  }

  /**
   * Copy files from external paths to a destination directory
   */
  async copyFiles(sourcePaths: string[], destDir: string): Promise<{ success: boolean; copied: string[]; errors: string[] }> {
    const copied: string[] = []
    const errors: string[] = []

    try {
      const validDestDir = this.validatePath(destDir)

      // Ensure destination directory exists
      await fs.promises.mkdir(validDestDir, { recursive: true })

      for (const sourcePath of sourcePaths) {
        try {
          const validSourcePath = this.validatePath(sourcePath)
          const fileName = path.basename(validSourcePath)
          const destPath = path.join(validDestDir, fileName)

          const stats = await fs.promises.stat(validSourcePath)

          if (stats.isDirectory()) {
            // Copy directory recursively
            await this.copyDirectoryRecursive(validSourcePath, destPath)
          } else {
            // Copy file
            await fs.promises.copyFile(validSourcePath, destPath)
          }

          copied.push(fileName)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`${path.basename(sourcePath)}: ${message}`)
        }
      }

      return { success: errors.length === 0, copied, errors }
    } catch (error) {
      console.error('Error copying files:', error)
      throw error
    }
  }

  /**
   * Helper to recursively copy a directory
   */
  private async copyDirectoryRecursive(source: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true })

    const entries = await fs.promises.readdir(source, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(srcPath, destPath)
      } else {
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
  }
}

// Singleton instance
export const fileSystemManager = new SecureFileSystemManager()
