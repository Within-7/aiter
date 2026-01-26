import { ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * Standard IPC response type for consistent error handling across all handlers.
 */
export interface IpcResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Creates a standardized IPC response for successful operations.
 */
export function successResponse<T>(data?: T): IpcResponse<T> & T {
  return { success: true, ...data } as IpcResponse<T> & T
}

/**
 * Creates a standardized IPC response for failed operations.
 */
export function errorResponse(error: unknown): IpcResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return { success: false, error: message }
}

/**
 * Type for IPC handler functions that return data to be wrapped in a response.
 */
type IpcHandlerFn<TArgs, TResult> = (args: TArgs) => Promise<TResult>

/**
 * Wraps an IPC handler function with standardized try-catch error handling.
 * This eliminates the need for repetitive try-catch blocks in every handler.
 *
 * @example
 * // Before:
 * ipcMain.handle('fs:readDir', async (_, { path, depth }) => {
 *   try {
 *     const nodes = await fileSystemManager.readDirectory(path, depth || 1)
 *     return { success: true, nodes }
 *   } catch (error) {
 *     const message = error instanceof Error ? error.message : 'Unknown error'
 *     return { success: false, error: message }
 *   }
 * })
 *
 * // After:
 * registerHandler('fs:readDir', async ({ path, depth }) => {
 *   const nodes = await fileSystemManager.readDirectory(path, depth || 1)
 *   return { nodes }
 * })
 */
export function registerHandler<TArgs, TResult extends object>(
  channel: string,
  handler: IpcHandlerFn<TArgs, TResult>
): void {
  ipcMain.handle(channel, async (_event: IpcMainInvokeEvent, args: TArgs) => {
    try {
      const result = await handler(args)
      return { success: true, ...result }
    } catch (error) {
      return errorResponse(error)
    }
  })
}

/**
 * Wraps an IPC handler that returns a simple boolean success value.
 *
 * @example
 * registerBoolHandler('fs:writeFile', async ({ path, content }) => {
 *   return await fileSystemManager.writeFile(path, content)
 * })
 */
export function registerBoolHandler<TArgs>(
  channel: string,
  handler: (args: TArgs) => Promise<boolean>
): void {
  ipcMain.handle(channel, async (_event: IpcMainInvokeEvent, args: TArgs) => {
    try {
      const success = await handler(args)
      return { success }
    } catch (error) {
      return errorResponse(error)
    }
  })
}
