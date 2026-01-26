import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'

// Mock window.api for Electron preload bridge
const mockApi = {
  projects: {
    getAll: vi.fn().mockResolvedValue({ success: true, projects: [] }),
    add: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    update: vi.fn().mockResolvedValue({ success: true })
  },
  terminal: {
    create: vi.fn().mockResolvedValue({ success: true, id: 'test-terminal-1' }),
    write: vi.fn().mockResolvedValue({ success: true }),
    resize: vi.fn().mockResolvedValue({ success: true }),
    kill: vi.fn().mockResolvedValue({ success: true }),
    onData: vi.fn().mockReturnValue(() => {}),
    onExit: vi.fn().mockReturnValue(() => {}),
    onTitleChange: vi.fn().mockReturnValue(() => {})
  },
  fs: {
    readDir: vi.fn().mockResolvedValue({ success: true, files: [] }),
    readFile: vi.fn().mockResolvedValue({ success: true, content: '' }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    exists: vi.fn().mockResolvedValue({ success: true, exists: true })
  },
  git: {
    getFileChanges: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    getRecentCommits: vi.fn().mockResolvedValue({ success: true, commits: [] }),
    getCommitFiles: vi.fn().mockResolvedValue({ success: true, files: [] })
  },
  fileServer: {
    getUrl: vi.fn().mockResolvedValue({ success: true, url: 'http://localhost:3000/test' }),
    stop: vi.fn().mockResolvedValue({ success: true }),
    getStats: vi.fn().mockResolvedValue({ success: true, stats: {} })
  },
  fileWatcher: {
    watch: vi.fn(),
    unwatch: vi.fn(),
    isWatching: vi.fn().mockReturnValue(false),
    onChanged: vi.fn().mockReturnValue(() => {})
  },
  settings: {
    get: vi.fn().mockResolvedValue({ success: true, settings: {} }),
    set: vi.fn().mockResolvedValue({ success: true })
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ success: true, filePaths: [] })
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue({ success: true })
  }
}

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true
})

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks()
})

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})
