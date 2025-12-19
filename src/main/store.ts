import Store from 'electron-store'
import { Project, AppSettings } from '../types'

interface StoreSchema {
  projects: Project[]
  settings: AppSettings
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 12,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  scrollbackLines: 1000,
  cursorBlink: true,
  cursorStyle: 'block',
  terminalTheme: 'homebrew',

  // Shell configuration
  shellLoginMode: true,              // Enable login shell by default (load ~/.zshrc etc.)

  // macOS-specific
  macOptionIsMeta: true,             // Use Option key as Meta key by default

  // Node.js configuration
  nodeSource: 'builtin',             // Use built-in Node.js by default
  preserveVersionManagers: false,    // Don't preserve version manager vars by default

  // Windows-specific
  windowsUseUtf8: true               // Enable UTF-8 on Windows by default
}

export class StoreManager {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'airter-data',
      defaults: {
        projects: [],
        settings: defaultSettings
      }
    })

    // Clean up duplicate projects on initialization
    this.deduplicateProjects()
  }

  // Remove duplicate projects (same path or same id)
  private deduplicateProjects(): void {
    const projects = this.getProjects()
    const seenPaths = new Set<string>()
    const seenIds = new Set<string>()
    const uniqueProjects: Project[] = []

    for (const project of projects) {
      // Skip if we've seen this path or id before
      if (seenPaths.has(project.path) || seenIds.has(project.id)) {
        console.log(`Removing duplicate project: ${project.name} (${project.path})`)
        continue
      }

      seenPaths.add(project.path)
      seenIds.add(project.id)
      uniqueProjects.push(project)
    }

    // Only update if we found duplicates
    if (uniqueProjects.length < projects.length) {
      console.log(`Removed ${projects.length - uniqueProjects.length} duplicate projects`)
      this.store.set('projects', uniqueProjects)
    }
  }

  // Project management
  getProjects(): Project[] {
    return this.store.get('projects', [])
  }

  addProject(path: string, name?: string): Project {
    const projects = this.getProjects()

    // Check if project already exists
    const existing = projects.find((p) => p.path === path)
    if (existing) {
      // Update last accessed time
      existing.lastAccessed = Date.now()
      this.store.set('projects', projects)
      return existing
    }

    // Create new project
    const project: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || path.split('/').pop() || path.split('\\').pop() || 'Unnamed',
      path,
      addedAt: Date.now(),
      lastAccessed: Date.now()
    }

    projects.push(project)
    this.store.set('projects', projects)
    return project
  }

  removeProject(id: string): boolean {
    const projects = this.getProjects()
    const index = projects.findIndex((p) => p.id === id)

    if (index === -1) {
      return false
    }

    projects.splice(index, 1)
    this.store.set('projects', projects)
    return true
  }

  updateProjectAccess(id: string): boolean {
    const projects = this.getProjects()
    const project = projects.find((p) => p.id === id)

    if (!project) {
      return false
    }

    project.lastAccessed = Date.now()
    this.store.set('projects', projects)
    return true
  }

  getProjectById(id: string): Project | undefined {
    return this.getProjects().find((p) => p.id === id)
  }

  // Settings management
  getSettings(): AppSettings {
    return this.store.get('settings', defaultSettings)
  }

  updateSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const updated = { ...current, ...settings }
    this.store.set('settings', updated)
    return updated
  }

  resetSettings(): AppSettings {
    this.store.set('settings', defaultSettings)
    return defaultSettings
  }

  // Utility
  clear(): void {
    this.store.clear()
  }

  getStorePath(): string {
    return this.store.path
  }
}
