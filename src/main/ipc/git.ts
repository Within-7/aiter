import { gitManager } from '../git'
import { registerHandler, registerBoolHandler } from './utils'

export function registerGitHandlers() {
  // Git status operations
  registerHandler('git:getStatus', async ({ projectPath }: { projectPath: string }) => {
    const status = await gitManager.getStatus(projectPath)
    return { status }
  })

  registerHandler('git:getRecentCommits', async ({ projectPath, count }: { projectPath: string; count?: number }) => {
    const commits = await gitManager.getRecentCommits(projectPath, count || 10)
    return { commits }
  })

  registerBoolHandler('git:initRepo', async ({ projectPath }: { projectPath: string }) => {
    return await gitManager.initRepo(projectPath)
  })

  registerHandler('git:getFileChanges', async ({ projectPath }: { projectPath: string }) => {
    const changes = await gitManager.getFileChanges(projectPath)
    return { changes }
  })

  registerBoolHandler('git:commitAll', async ({ projectPath, message }: { projectPath: string; message: string }) => {
    return await gitManager.commitAll(projectPath, message)
  })

  // Branch operations
  registerHandler('git:getBranches', async ({ projectPath }: { projectPath: string }) => {
    const branches = await gitManager.getBranches(projectPath)
    return { branches }
  })

  registerBoolHandler('git:createBranch', async ({ projectPath, branchName }: { projectPath: string; branchName: string }) => {
    return await gitManager.createBranch(projectPath, branchName)
  })

  registerBoolHandler('git:switchBranch', async ({ projectPath, branchName }: { projectPath: string; branchName: string }) => {
    return await gitManager.switchBranch(projectPath, branchName)
  })

  registerBoolHandler('git:deleteBranch', async ({ projectPath, branchName, force }: { projectPath: string; branchName: string; force?: boolean }) => {
    return await gitManager.deleteBranch(projectPath, branchName, force)
  })

  // Remote operations
  registerBoolHandler('git:pull', async ({ projectPath }: { projectPath: string }) => {
    return await gitManager.pull(projectPath)
  })

  registerBoolHandler('git:push', async ({ projectPath }: { projectPath: string }) => {
    return await gitManager.push(projectPath)
  })

  registerBoolHandler('git:fetch', async ({ projectPath }: { projectPath: string }) => {
    return await gitManager.fetch(projectPath)
  })

  // File staging operations
  registerBoolHandler('git:stageFile', async ({ projectPath, filePath }: { projectPath: string; filePath: string }) => {
    return await gitManager.stageFile(projectPath, filePath)
  })

  registerBoolHandler('git:unstageFile', async ({ projectPath, filePath }: { projectPath: string; filePath: string }) => {
    return await gitManager.unstageFile(projectPath, filePath)
  })

  // Diff operations
  registerHandler('git:getFileDiff', async ({ projectPath, filePath }: { projectPath: string; filePath: string }) => {
    const diff = await gitManager.getFileDiff(projectPath, filePath)
    return { diff }
  })

  registerHandler('git:getCommitFiles', async ({ projectPath, commitHash }: { projectPath: string; commitHash: string }) => {
    const files = await gitManager.getCommitFiles(projectPath, commitHash)
    return { files }
  })

  registerHandler('git:getCommitFileDiff', async ({ projectPath, commitHash, filePath }: { projectPath: string; commitHash: string; filePath: string }) => {
    const diff = await gitManager.getCommitFileDiff(projectPath, commitHash, filePath)
    return { diff }
  })
}
