/**
 * Path manipulation utilities for consistent path operations across the app.
 * These work with forward-slash paths (POSIX-style) used throughout the codebase.
 */

/**
 * Get the parent directory of a path.
 * @example getParentDir('/foo/bar/baz.txt') => '/foo/bar'
 * @example getParentDir('/foo') => ''
 */
export function getParentDir(path: string): string {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash > 0 ? path.substring(0, lastSlash) : ''
}

/**
 * Get the file/folder name from a path.
 * @example getFileName('/foo/bar/baz.txt') => 'baz.txt'
 * @example getFileName('/foo/bar/') => 'bar'
 */
export function getFileName(path: string): string {
  // Remove trailing slash if present
  const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path
  return cleanPath.substring(cleanPath.lastIndexOf('/') + 1)
}

/**
 * Get the file extension including the dot.
 * @example getFileExtension('file.txt') => '.txt'
 * @example getFileExtension('file.min.js') => '.js'
 * @example getFileExtension('file') => ''
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot > 0 ? fileName.substring(lastDot) : ''
}

/**
 * Join path segments with forward slash.
 * @example joinPath('/foo', 'bar', 'baz.txt') => '/foo/bar/baz.txt'
 */
export function joinPath(...segments: string[]): string {
  return segments
    .map((s, i) => {
      if (i === 0) return s.replace(/\/+$/, '')
      return s.replace(/^\/+|\/+$/g, '')
    })
    .filter(Boolean)
    .join('/')
}

/**
 * Check if a path is a child of a parent path.
 * @example isChildPath('/foo/bar', '/foo') => true
 * @example isChildPath('/foo', '/foo/bar') => false
 */
export function isChildPath(childPath: string, parentPath: string): boolean {
  return childPath.startsWith(parentPath + '/')
}

/**
 * Get the directory for a file operation based on whether the target is a directory.
 * If target is a directory, use it; otherwise use its parent.
 */
export function getTargetDirectory(targetPath: string, isDirectory: boolean): string {
  return isDirectory ? targetPath : getParentDir(targetPath)
}
