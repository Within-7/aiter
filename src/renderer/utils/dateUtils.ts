/**
 * Date and time formatting utilities.
 */

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago").
 * Falls back to locale date string for dates older than 7 days.
 */
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

/**
 * Format a timestamp as a time string (HH:MM).
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format a duration in seconds to a readable string.
 * @example formatDuration(3.5) => '3.5s'
 */
export function formatDuration(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

/**
 * Format a timestamp as a full date-time string.
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}
