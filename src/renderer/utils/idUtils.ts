/**
 * ID generation utilities for creating unique identifiers.
 */

/**
 * Generate a unique ID with optional prefix.
 * Format: {prefix}-{timestamp}-{random}
 * @example generateId('tab') => 'tab-1706123456789-k2j9f8h3m'
 * @example generateId() => '1706123456789-k2j9f8h3m'
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 11)
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

/**
 * Generate a tab ID.
 * @example generateTabId() => 'tab-1706123456789-k2j9f8h3m'
 */
export function generateTabId(): string {
  return generateId('tab')
}

/**
 * Generate a markdown editor instance ID.
 * @example generateMarkdownId() => 'md-1706123456789-k2j9f8h3m'
 */
export function generateMarkdownId(): string {
  return generateId('md')
}
