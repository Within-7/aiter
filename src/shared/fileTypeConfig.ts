/**
 * Unified File Type Configuration
 *
 * This module centralizes file type detection and rendering configuration.
 * It's shared between main and renderer processes.
 */

export type FileType =
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

export type RendererType =
  | 'monaco'        // Monaco Editor for code files
  | 'markdown'      // Markdown with preview/edit toggle
  | 'html'          // HTML with iframe preview/edit toggle
  | 'image'         // Image viewer with zoom/pan
  | 'pdf'           // PDF viewer with page navigation
  | 'office'        // Office document viewer
  | 'diff'          // Diff viewer

export interface FileTypeConfig {
  type: FileType
  renderer: RendererType
  extensions: string[]
  monacoLanguage?: string  // For monaco renderer
  supportsPreview?: boolean  // For preview/edit toggle
  mimeType?: string
}

/**
 * File type configurations
 * Order matters for extension matching (first match wins)
 */
export const FILE_TYPE_CONFIGS: FileTypeConfig[] = [
  // Web - HTML with preview
  {
    type: 'html',
    renderer: 'html',
    extensions: ['.html', '.htm'],
    monacoLanguage: 'html',
    supportsPreview: true,
    mimeType: 'text/html'
  },

  // Markdown with preview
  {
    type: 'markdown',
    renderer: 'markdown',
    extensions: ['.md', '.markdown', '.mdx'],
    monacoLanguage: 'markdown',
    supportsPreview: true,
    mimeType: 'text/markdown'
  },

  // JavaScript/TypeScript
  {
    type: 'javascript',
    renderer: 'monaco',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    monacoLanguage: 'javascript',
    mimeType: 'text/javascript'
  },
  {
    type: 'typescript',
    renderer: 'monaco',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    monacoLanguage: 'typescript',
    mimeType: 'text/typescript'
  },

  // Styles
  {
    type: 'css',
    renderer: 'monaco',
    extensions: ['.css', '.scss', '.sass', '.less'],
    monacoLanguage: 'css',
    mimeType: 'text/css'
  },

  // Data formats
  {
    type: 'json',
    renderer: 'monaco',
    extensions: ['.json', '.jsonc', '.json5', '.prettierrc', '.eslintrc', '.babelrc'],
    monacoLanguage: 'json',
    mimeType: 'application/json'
  },

  // Programming languages
  {
    type: 'python',
    renderer: 'monaco',
    extensions: ['.py', '.pyw', '.pyi', '.pyx'],
    monacoLanguage: 'python',
    mimeType: 'text/x-python'
  },
  {
    type: 'java',
    renderer: 'monaco',
    extensions: ['.java', '.jar', '.class'],
    monacoLanguage: 'java',
    mimeType: 'text/x-java-source'
  },
  {
    type: 'c',
    renderer: 'monaco',
    extensions: ['.c', '.h'],
    monacoLanguage: 'c',
    mimeType: 'text/x-c'
  },
  {
    type: 'cpp',
    renderer: 'monaco',
    extensions: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx', '.hh'],
    monacoLanguage: 'cpp',
    mimeType: 'text/x-c++src'
  },
  {
    type: 'go',
    renderer: 'monaco',
    extensions: ['.go'],
    monacoLanguage: 'go',
    mimeType: 'text/x-go'
  },
  {
    type: 'rust',
    renderer: 'monaco',
    extensions: ['.rs'],
    monacoLanguage: 'rust',
    mimeType: 'text/x-rust'
  },
  {
    type: 'ruby',
    renderer: 'monaco',
    extensions: ['.rb', '.erb', '.rake', '.gemspec'],
    monacoLanguage: 'ruby',
    mimeType: 'text/x-ruby'
  },
  {
    type: 'php',
    renderer: 'monaco',
    extensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.phps'],
    monacoLanguage: 'php',
    mimeType: 'application/x-httpd-php'
  },

  // Shell/Scripts
  {
    type: 'shell',
    renderer: 'monaco',
    extensions: ['.sh', '.bash', '.zsh', '.fish', '.ksh', '.csh', '.tcsh', '.ps1', '.psm1', '.bat', '.cmd', '.env'],
    monacoLanguage: 'shell',
    mimeType: 'text/x-shellscript'
  },

  // Database
  {
    type: 'sql',
    renderer: 'monaco',
    extensions: ['.sql', '.mysql', '.pgsql', '.plsql'],
    monacoLanguage: 'sql',
    mimeType: 'text/x-sql'
  },

  // Config formats
  {
    type: 'yaml',
    renderer: 'monaco',
    extensions: ['.yaml', '.yml'],
    monacoLanguage: 'yaml',
    mimeType: 'text/yaml'
  },
  {
    type: 'xml',
    renderer: 'monaco',
    extensions: ['.xml', '.xsd', '.xsl', '.xslt', '.plist'],
    monacoLanguage: 'xml',
    mimeType: 'text/xml'
  },
  {
    type: 'dockerfile',
    renderer: 'monaco',
    extensions: ['.dockerfile'],
    monacoLanguage: 'dockerfile',
    mimeType: 'text/x-dockerfile'
  },

  // Images
  {
    type: 'image',
    renderer: 'image',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.tiff', '.tif', '.svg'],
    mimeType: 'image/*'
  },

  // Documents
  {
    type: 'pdf',
    renderer: 'pdf',
    extensions: ['.pdf'],
    mimeType: 'application/pdf'
  },
  {
    type: 'word',
    renderer: 'office',
    extensions: ['.doc', '.docx', '.rtf', '.odt'],
    mimeType: 'application/msword'
  },
  {
    type: 'excel',
    renderer: 'office',
    extensions: ['.xls', '.xlsx', '.xlsm', '.ods', '.csv'],
    mimeType: 'application/vnd.ms-excel'
  },
  {
    type: 'powerpoint',
    renderer: 'office',
    extensions: ['.ppt', '.pptx', '.odp'],
    mimeType: 'application/vnd.ms-powerpoint'
  },

  // Plain text (fallback before 'other')
  {
    type: 'text',
    renderer: 'monaco',
    extensions: ['.txt', '.log', '.ini', '.cfg', '.conf', '.properties', '.toml', '.gitignore', '.gitattributes', '.editorconfig'],
    monacoLanguage: 'plaintext',
    mimeType: 'text/plain'
  }
]

/**
 * Get file type configuration by extension
 */
export function getFileTypeConfig(filePath: string): FileTypeConfig {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()

  // Special case: Dockerfile without extension
  if (filePath.toLowerCase().endsWith('dockerfile')) {
    return FILE_TYPE_CONFIGS.find(c => c.type === 'dockerfile')!
  }

  for (const config of FILE_TYPE_CONFIGS) {
    if (config.extensions.includes(ext)) {
      return config
    }
  }

  // Default fallback
  return {
    type: 'other',
    renderer: 'monaco',
    extensions: [],
    monacoLanguage: 'plaintext',
    mimeType: 'text/plain'
  }
}

/**
 * Get file type string from file path
 */
export function getFileType(filePath: string): FileType {
  return getFileTypeConfig(filePath).type
}

/**
 * Get renderer type for a file
 */
export function getRenderer(filePath: string): RendererType {
  return getFileTypeConfig(filePath).renderer
}

/**
 * Check if file type supports preview/edit toggle
 */
export function supportsPreview(filePath: string): boolean {
  return getFileTypeConfig(filePath).supportsPreview ?? false
}

/**
 * Get Monaco language for a file type
 */
export function getMonacoLanguage(fileType: FileType): string {
  const config = FILE_TYPE_CONFIGS.find(c => c.type === fileType)
  return config?.monacoLanguage || 'plaintext'
}

/**
 * Extension to MIME type mapping for HTTP server
 */
export function getMimeType(filePath: string): string {
  return getFileTypeConfig(filePath).mimeType || 'application/octet-stream'
}

/**
 * Check if a file type should use binary reading
 */
export function isBinaryType(fileType: FileType): boolean {
  return ['image', 'pdf', 'word', 'excel', 'powerpoint'].includes(fileType)
}

/**
 * File types that are commonly opened with external applications
 */
export const EXTERNAL_OPEN_CANDIDATES: FileType[] = [
  'pdf',
  'word',
  'excel',
  'powerpoint',
  'image'
]

/**
 * Check if a file type is a candidate for external opening
 */
export function isExternalOpenCandidate(fileType: FileType): boolean {
  return EXTERNAL_OPEN_CANDIDATES.includes(fileType)
}
