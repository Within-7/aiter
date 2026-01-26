import { describe, it, expect } from 'vitest'

describe('Test Infrastructure', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have window.api mock available', () => {
    expect(window.api).toBeDefined()
    expect(window.api.projects).toBeDefined()
    expect(window.api.terminal).toBeDefined()
    expect(window.api.fs).toBeDefined()
    expect(window.api.git).toBeDefined()
    expect(window.api.fileWatcher).toBeDefined()
  })

  it('should have ResizeObserver mock available', () => {
    expect(global.ResizeObserver).toBeDefined()
  })

  it('should have matchMedia mock available', () => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    expect(mediaQuery).toBeDefined()
    expect(mediaQuery.matches).toBe(false)
  })
})
