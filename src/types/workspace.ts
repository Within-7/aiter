/**
 * Workspace type definitions for multi-instance support.
 */

/**
 * Workspace configuration
 */
export interface Workspace {
  id: string
  name: string
  description?: string
  visibleProjectIds: string[]  // Empty array = show all projects
  color?: string
  createdAt: number
  lastUsedAt: number
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  workspaces: Workspace[]
  lastUsedWorkspaceId?: string
}
