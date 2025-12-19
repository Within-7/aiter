import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { Workspace, WorkspaceSettings } from '../types'

const DEFAULT_WORKSPACE_ID = 'default'
const SAVE_DEBOUNCE_MS = 100

export class WorkspaceManager {
  private currentWorkspaceId: string
  private settingsPath: string
  private settings: WorkspaceSettings
  private saveTimeout: NodeJS.Timeout | null = null
  private isSaving = false

  constructor(workspaceId?: string) {
    this.settingsPath = path.join(app.getPath('userData'), 'workspaces.json')
    this.settings = this.loadSettings()
    this.currentWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID

    // Update last used timestamp for the current workspace
    if (this.currentWorkspaceId !== DEFAULT_WORKSPACE_ID) {
      const workspace = this.getWorkspace(this.currentWorkspaceId)
      if (workspace) {
        workspace.lastUsedAt = Date.now()
      }
    }

    // Update last used workspace id and save once (sync on startup)
    this.settings.lastUsedWorkspaceId = this.currentWorkspaceId
    this.saveSettingsSync()
  }

  private loadSettings(): WorkspaceSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('[WorkspaceManager] Failed to load settings:', error)
    }
    return { workspaces: [] }
  }

  private saveSettings(): void {
    // Debounce saves to avoid blocking main thread with frequent writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(() => {
      this.doSave()
    }, SAVE_DEBOUNCE_MS)
  }

  private doSave(): void {
    if (this.isSaving) return

    this.isSaving = true
    const data = JSON.stringify(this.settings, null, 2)

    fs.writeFile(this.settingsPath, data, (error) => {
      this.isSaving = false
      if (error) {
        console.error('[WorkspaceManager] Failed to save settings:', error)
      }
    })
  }

  // Synchronous save for critical operations (e.g., app shutdown)
  saveSettingsSync(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2))
    } catch (error) {
      console.error('[WorkspaceManager] Failed to save settings:', error)
    }
  }

  getCurrentWorkspaceId(): string {
    return this.currentWorkspaceId
  }

  getCurrentWorkspace(): Workspace | null {
    if (this.currentWorkspaceId === DEFAULT_WORKSPACE_ID) {
      return {
        id: DEFAULT_WORKSPACE_ID,
        name: 'Default',
        visibleProjectIds: [],
        createdAt: 0,
        lastUsedAt: Date.now()
      }
    }
    return this.getWorkspace(this.currentWorkspaceId)
  }

  getWorkspaces(): Workspace[] {
    // Always include default workspace at the beginning
    const defaultWorkspace: Workspace = {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Default',
      description: 'Shows all projects',
      visibleProjectIds: [],
      createdAt: 0,
      lastUsedAt: this.currentWorkspaceId === DEFAULT_WORKSPACE_ID ? Date.now() : 0
    }
    return [defaultWorkspace, ...this.settings.workspaces]
  }

  getWorkspace(id: string): Workspace | null {
    if (id === DEFAULT_WORKSPACE_ID) {
      return this.getCurrentWorkspace()
    }
    return this.settings.workspaces.find(w => w.id === id) || null
  }

  createWorkspace(name: string, projectIds?: string[]): Workspace {
    const workspace: Workspace = {
      id: `workspace-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      visibleProjectIds: projectIds || [],
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    }
    this.settings.workspaces.push(workspace)
    this.saveSettings()
    return workspace
  }

  updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | null {
    if (id === DEFAULT_WORKSPACE_ID) {
      console.warn('[WorkspaceManager] Cannot update default workspace')
      return null
    }

    const index = this.settings.workspaces.findIndex(w => w.id === id)
    if (index === -1) {
      return null
    }

    // Don't allow changing the id - eslint-disable-next-line
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...safeUpdates } = updates
    this.settings.workspaces[index] = {
      ...this.settings.workspaces[index],
      ...safeUpdates
    }
    this.saveSettings()
    return this.settings.workspaces[index]
  }

  deleteWorkspace(id: string): boolean {
    if (id === DEFAULT_WORKSPACE_ID) {
      console.warn('[WorkspaceManager] Cannot delete default workspace')
      return false
    }

    const index = this.settings.workspaces.findIndex(w => w.id === id)
    if (index === -1) {
      return false
    }

    this.settings.workspaces.splice(index, 1)
    this.saveSettings()
    return true
  }

  // Returns null if showing all projects (default workspace or empty visibleProjectIds)
  getVisibleProjectIds(): string[] | null {
    if (this.currentWorkspaceId === DEFAULT_WORKSPACE_ID) {
      return null
    }

    const workspace = this.getWorkspace(this.currentWorkspaceId)
    if (!workspace || workspace.visibleProjectIds.length === 0) {
      return null
    }

    return workspace.visibleProjectIds
  }

  addProjectToWorkspace(workspaceId: string, projectId: string): boolean {
    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      return false
    }

    const workspace = this.getWorkspace(workspaceId)
    if (!workspace) {
      return false
    }

    if (!workspace.visibleProjectIds.includes(projectId)) {
      workspace.visibleProjectIds.push(projectId)
      this.saveSettings()
    }
    return true
  }

  removeProjectFromWorkspace(workspaceId: string, projectId: string): boolean {
    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      return false
    }

    const workspace = this.getWorkspace(workspaceId)
    if (!workspace) {
      return false
    }

    const index = workspace.visibleProjectIds.indexOf(projectId)
    if (index !== -1) {
      workspace.visibleProjectIds.splice(index, 1)
      this.saveSettings()
    }
    return true
  }

  // Called when a project is deleted - remove it from all workspaces
  onProjectDeleted(projectId: string): void {
    let changed = false
    for (const workspace of this.settings.workspaces) {
      const index = workspace.visibleProjectIds.indexOf(projectId)
      if (index !== -1) {
        workspace.visibleProjectIds.splice(index, 1)
        changed = true
      }
    }
    if (changed) {
      this.saveSettings()
    }
  }

  // Get workspace name for window title
  getWindowTitle(): string {
    if (this.currentWorkspaceId === DEFAULT_WORKSPACE_ID) {
      return 'AiTer'
    }
    const workspace = this.getCurrentWorkspace()
    return workspace ? `AiTer - ${workspace.name}` : 'AiTer'
  }
}
