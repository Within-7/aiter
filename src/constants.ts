/**
 * Application-wide constants
 *
 * This file contains configuration constants that are used across multiple modules.
 * For module-specific constants that are only used in one place, keep them local.
 */

// =============================================================================
// File System Limits
// =============================================================================

/** Maximum file size for reading operations (10MB) */
export const MAX_FILE_READ_SIZE = 10 * 1024 * 1024

/** Maximum file size for write operations - DoS protection (50MB) */
export const MAX_FILE_WRITE_SIZE = 50 * 1024 * 1024

/** Maximum content size for in-file search (1MB) */
export const MAX_CONTENT_SEARCH_SIZE = 1 * 1024 * 1024

// =============================================================================
// File Server
// =============================================================================

/** Maximum concurrent file servers per workspace */
export const MAX_ACTIVE_FILE_SERVERS = 10

/** Idle timeout for file servers before automatic shutdown (5 minutes) */
export const FILE_SERVER_IDLE_TIMEOUT_MS = 5 * 60 * 1000

// =============================================================================
// Terminal
// =============================================================================

/** Maximum buffer size for inactive terminals (1MB) */
export const MAX_INACTIVE_TERMINAL_BUFFER = 1024 * 1024

/** Batch window for terminal data rendering (32ms = ~2 frames) */
export const TERMINAL_BATCH_WINDOW_MS = 32

/** Wait time for graceful terminal shutdown (2 seconds) */
export const TERMINAL_GRACEFUL_KILL_TIMEOUT = 2000

/** Wait time for force kill after graceful fails (3 seconds) */
export const TERMINAL_FORCE_KILL_TIMEOUT = 3000

/** Total timeout for killing all terminals (5 seconds) */
export const TERMINAL_KILL_ALL_TIMEOUT = 5000

// =============================================================================
// UI Components
// =============================================================================

/** Sidebar minimum width in pixels */
export const SIDEBAR_MIN_WIDTH = 200

/** Sidebar maximum width in pixels */
export const SIDEBAR_MAX_WIDTH = 600

/** Sidebar default width in pixels */
export const SIDEBAR_DEFAULT_WIDTH = 300

// =============================================================================
// Polling & Refresh Intervals
// =============================================================================

/** Interval for Git status refresh (10 seconds) */
export const GIT_STATUS_POLL_INTERVAL = 10000

/** Initial interval for file tree Git status (3 seconds) */
export const FILE_TREE_GIT_POLL_INTERVAL = 3000

/** Interval for plugin status check (1 hour) */
export const PLUGIN_STATUS_CHECK_INTERVAL = 3600000

/** Debounce delay for file watcher events (150ms) */
export const FILE_WATCHER_DEBOUNCE_DELAY = 150

// =============================================================================
// Session & Cache
// =============================================================================

/** Maximum age for session state before cleanup (24 hours) */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000
