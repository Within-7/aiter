import { fileSystemManager } from '../filesystem'
import { registerHandler, registerBoolHandler } from './utils'

export function registerFilesystemHandlers() {
  // File system operations
  registerHandler('fs:readDir', async ({ path, depth }: { path: string; depth?: number }) => {
    const nodes = await fileSystemManager.readDirectory(path, depth || 1)
    return { nodes }
  })

  registerHandler('fs:readFile', async ({ path }: { path: string }) => {
    const result = await fileSystemManager.readFile(path)
    return result
  })

  registerBoolHandler('fs:writeFile', async ({ path, content }: { path: string; content: string }) => {
    return await fileSystemManager.writeFile(path, content)
  })

  registerHandler('fs:fileExists', async ({ path }: { path: string }) => {
    const exists = await fileSystemManager.fileExists(path)
    return { exists }
  })

  registerBoolHandler('fs:createFile', async ({ path, content }: { path: string; content?: string }) => {
    return await fileSystemManager.createFile(path, content || '')
  })

  registerBoolHandler('fs:createDirectory', async ({ path }: { path: string }) => {
    return await fileSystemManager.createDirectory(path)
  })

  registerBoolHandler('fs:rename', async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
    return await fileSystemManager.rename(oldPath, newPath)
  })

  registerBoolHandler('fs:delete', async ({ path }: { path: string }) => {
    return await fileSystemManager.delete(path)
  })

  registerHandler('fs:copyFiles', async ({ sourcePaths, destDir }: { sourcePaths: string[]; destDir: string }) => {
    const result = await fileSystemManager.copyFiles(sourcePaths, destDir)
    return result
  })

  // File search operations
  registerHandler('fs:searchFiles', async ({ projectPath, pattern, options }: { projectPath: string; pattern: string; options?: unknown }) => {
    const results = await fileSystemManager.searchFiles(projectPath, pattern, options)
    return { results }
  })

  registerHandler('fs:searchContent', async ({ projectPath, pattern, options }: { projectPath: string; pattern: string; options?: unknown }) => {
    const results = await fileSystemManager.searchContent(projectPath, pattern, options)
    return { results }
  })
}
