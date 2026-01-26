/**
 * IPC Communication Types
 *
 * Standard types for IPC communication between main and renderer processes.
 * These types ensure consistent error handling across all IPC handlers.
 */

/**
 * Standard IPC response type for consistent error handling.
 *
 * @template T - The type of additional data fields in the response
 *
 * @example
 * // Success response with data
 * const response: IpcResponse<{ users: User[] }> = {
 *   success: true,
 *   users: [{ id: '1', name: 'John' }]
 * }
 *
 * @example
 * // Error response
 * const response: IpcResponse = {
 *   success: false,
 *   error: 'File not found'
 * }
 */
export interface IpcResponse<T = unknown> {
  /** Whether the operation was successful */
  success: boolean
  /** Error message if the operation failed */
  error?: string
  /** Generic data field (optional, prefer spread fields) */
  data?: T
}

/**
 * Helper type for IPC responses that include additional data fields.
 * The data fields are spread into the response object alongside success/error.
 *
 * @template T - The type of additional data fields
 *
 * @example
 * type ReadDirResponse = IpcResponseWithData<{ nodes: FileNode[] }>
 * // Equivalent to: { success: boolean; error?: string; nodes: FileNode[] }
 */
export type IpcResponseWithData<T extends object> = IpcResponse & T

/**
 * Helper type for boolean-only IPC responses.
 * Used for operations that only return success/failure.
 */
export type IpcBoolResponse = Pick<IpcResponse, 'success' | 'error'>
