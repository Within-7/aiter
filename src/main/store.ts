import Store from 'electron-store'
import { Project, AppSettings, ShortcutConfig, SessionState } from '../types'

// Default keyboard shortcuts
const defaultShortcuts: ShortcutConfig[] = [
  { action: 'newTerminal', label: '新建终端', shortcut: { key: 't', metaKey: true }, enabled: true },
  { action: 'closeTab', label: '关闭标签页', shortcut: { key: 'w', metaKey: true }, enabled: true },
  { action: 'saveFile', label: '保存文件', shortcut: { key: 's', metaKey: true }, enabled: true },
  { action: 'openSettings', label: '打开设置', shortcut: { key: ',', metaKey: true }, enabled: true },
  { action: 'newWindow', label: '新窗口', shortcut: { key: 'n', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'toggleSidebar', label: '切换侧边栏', shortcut: { key: 'b', metaKey: true }, enabled: true },
  { action: 'nextTab', label: '下一个标签页', shortcut: { key: ']', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'prevTab', label: '上一个标签页', shortcut: { key: '[', metaKey: true, shiftKey: true }, enabled: true },
  { action: 'focusTerminal', label: '聚焦终端', shortcut: { key: '`', ctrlKey: true }, enabled: true },
  { action: 'focusEditor', label: '聚焦编辑器', shortcut: { key: 'e', metaKey: true, shiftKey: true }, enabled: true }
]

interface StoreSchema {
  projects: Project[]
  settings: AppSettings
  session: SessionState | null
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
  windowsUseUtf8: true,              // Enable UTF-8 on Windows by default

  // Keyboard shortcuts
  shortcuts: defaultShortcuts,

  // AI CLI integration
  autoStartMinto: true,              // Auto-start Minto when opening a new terminal (default: enabled)
  mintoInstalled: false              // Track Minto CLI installation status
}

export class StoreManager {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'airter-data',
      defaults: {
        projects: [],
        settings: defaultSettings,
        session: null
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

  reorderProjects(projectIds: string[]): Project[] {
    const projects = this.getProjects()
    const projectMap = new Map(projects.map(p => [p.id, p]))

    // Reorder based on provided IDs
    const reordered: Project[] = []
    for (const id of projectIds) {
      const project = projectMap.get(id)
      if (project) {
        reordered.push(project)
        projectMap.delete(id)
      }
    }

    // Add any remaining projects that weren't in the list
    for (const project of projectMap.values()) {
      reordered.push(project)
    }

    this.store.set('projects', reordered)
    return reordered
  }

  getProjectById(id: string): Project | undefined {
    return this.getProjects().find((p) => p.id === id)
  }

  // Settings management
  getSettings(): AppSettings {
    const stored = this.store.get('settings', defaultSettings)
    // Merge with defaults to ensure new settings fields are included
    // This handles the case where stored settings are missing new fields
    return { ...defaultSettings, ...stored }
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

  // Session management
  saveSession(session: SessionState): void {
    this.store.set('session', session)
    console.log('[StoreManager] Session saved:', {
      editorTabs: session.editorTabs.length,
      terminals: session.terminals.length,
      tabOrder: session.tabOrder.length
    })
  }

  getSession(): SessionState | null {
    return this.store.get('session', null)
  }

  clearSession(): void {
    this.store.set('session', null)
    console.log('[StoreManager] Session cleared')
  }

  // Utility
  clear(): void {
    this.store.clear()
  }

  getStorePath(): string {
    return this.store.path
  }
}
