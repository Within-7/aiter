/**
 * Search-related type definitions.
 */

/**
 * Options for file or content search
 */
export interface SearchOptions {
  pattern: string                        // Search pattern
  searchType: 'filename' | 'content'     // Search type
  caseSensitive?: boolean                // Case sensitive matching
  useRegex?: boolean                     // Use regular expression
  includeIgnored?: boolean               // Include gitignored files
  maxResults?: number                    // Maximum results (default 100)
}

/**
 * A single match within a file
 */
export interface SearchMatch {
  line: number                           // Line number (1-based)
  column: number                         // Column number (1-based)
  preview: string                        // Preview text with context
  contextBefore?: string                 // Line before match
  contextAfter?: string                  // Line after match
}

/**
 * Search result for a file
 */
export interface SearchResult {
  filePath: string                       // Full file path
  fileName: string                       // File name
  relativePath: string                   // Path relative to project root
  projectId: string                      // Project ID
  projectName: string                    // Project name
  matches?: SearchMatch[]                // Content matches (for content search)
}
