import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFileTreeData, countNodes } from '../useFileTreeData'
import type { FileNode } from '../../../types'

describe('useFileTreeData', () => {
  const mockProjectPath = '/test/project'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('countNodes utility', () => {
    it('should count empty array as 0', () => {
      expect(countNodes([])).toBe(0)
    })

    it('should count flat list correctly', () => {
      const nodes: FileNode[] = [
        { id: '1', name: 'file1.ts', path: '/file1.ts', type: 'file' },
        { id: '2', name: 'file2.ts', path: '/file2.ts', type: 'file' }
      ]
      expect(countNodes(nodes)).toBe(2)
    })

    it('should count nested nodes correctly', () => {
      const nodes: FileNode[] = [
        {
          id: '1',
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            { id: '2', name: 'index.ts', path: '/src/index.ts', type: 'file' },
            {
              id: '3',
              name: 'utils',
              path: '/src/utils',
              type: 'directory',
              children: [
                { id: '4', name: 'helper.ts', path: '/src/utils/helper.ts', type: 'file' }
              ]
            }
          ]
        }
      ]
      expect(countNodes(nodes)).toBe(4)
    })

    it('should handle directories without children', () => {
      const nodes: FileNode[] = [
        { id: '1', name: 'empty', path: '/empty', type: 'directory' }
      ]
      expect(countNodes(nodes)).toBe(1)
    })
  })

  describe('hook initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      expect(result.current.nodes).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.nodesRef.current).toEqual([])
    })
  })

  describe('loadDirectory', () => {
    it('should load directory and update nodes', async () => {
      const mockNodes: FileNode[] = [
        { id: '1', name: 'file.ts', path: '/test/project/file.ts', type: 'file' }
      ]

      vi.mocked(window.api.fs.readDir).mockResolvedValue({
        success: true,
        nodes: mockNodes
      })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      expect(result.current.nodes).toEqual(mockNodes)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set error on failure', async () => {
      vi.mocked(window.api.fs.readDir).mockResolvedValue({
        success: false,
        error: 'Directory not found'
      })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      expect(result.current.nodes).toEqual([])
      expect(result.current.error).toBe('Directory not found')
    })

    it('should handle exceptions', async () => {
      vi.mocked(window.api.fs.readDir).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      expect(result.current.error).toBe('Network error')
    })

    it('should set loading state during load', async () => {
      let resolveReadDir: (value: unknown) => void
      vi.mocked(window.api.fs.readDir).mockImplementation(() =>
        new Promise(resolve => {
          resolveReadDir = resolve
        })
      )

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      // Start loading
      act(() => {
        result.current.loadDirectory(mockProjectPath)
      })

      // Should be loading
      expect(result.current.loading).toBe(true)

      // Complete loading
      await act(async () => {
        resolveReadDir!({ success: true, nodes: [] })
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('handleToggle', () => {
    it('should not toggle non-directory nodes', async () => {
      const mockNodes: FileNode[] = [
        { id: '1', name: 'file.ts', path: '/file.ts', type: 'file' }
      ]

      vi.mocked(window.api.fs.readDir).mockResolvedValue({
        success: true,
        nodes: mockNodes
      })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      await act(async () => {
        await result.current.handleToggle(result.current.nodes[0])
      })

      // Should not call readDir again for file
      expect(window.api.fs.readDir).toHaveBeenCalledTimes(1)
    })

    it('should toggle directory with existing children', async () => {
      const mockNodes: FileNode[] = [
        {
          id: '1',
          name: 'src',
          path: '/src',
          type: 'directory',
          isExpanded: false,
          children: [
            { id: '2', name: 'index.ts', path: '/src/index.ts', type: 'file' }
          ]
        }
      ]

      vi.mocked(window.api.fs.readDir).mockResolvedValue({
        success: true,
        nodes: mockNodes
      })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      await act(async () => {
        await result.current.handleToggle(result.current.nodes[0])
      })

      expect(result.current.nodes[0].isExpanded).toBe(true)
      // Should not call readDir again since children exist
      expect(window.api.fs.readDir).toHaveBeenCalledTimes(1)
    })

    it('should load children for directory without children', async () => {
      const mockNodes: FileNode[] = [
        {
          id: '1',
          name: 'src',
          path: '/src',
          type: 'directory',
          isExpanded: false
        }
      ]

      const mockChildren: FileNode[] = [
        { id: '2', name: 'index.ts', path: '/src/index.ts', type: 'file' }
      ]

      vi.mocked(window.api.fs.readDir)
        .mockResolvedValueOnce({ success: true, nodes: mockNodes })
        .mockResolvedValueOnce({ success: true, nodes: mockChildren })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      await act(async () => {
        await result.current.handleToggle(result.current.nodes[0])
      })

      expect(result.current.nodes[0].isExpanded).toBe(true)
      expect(result.current.nodes[0].children).toEqual(mockChildren)
    })
  })

  describe('refreshTree', () => {
    it('should reload the project directory', async () => {
      const mockNodes: FileNode[] = [
        { id: '1', name: 'file.ts', path: '/test/project/file.ts', type: 'file' }
      ]

      vi.mocked(window.api.fs.readDir).mockResolvedValue({
        success: true,
        nodes: mockNodes
      })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.refreshTree()
      })

      expect(window.api.fs.readDir).toHaveBeenCalledWith(mockProjectPath, 1)
      expect(result.current.nodes).toEqual(mockNodes)
    })
  })

  describe('nodesRef', () => {
    it('should keep ref in sync with nodes', async () => {
      const mockNodes: FileNode[] = [
        { id: '1', name: 'file.ts', path: '/file.ts', type: 'file' }
      ]

      vi.mocked(window.api.fs.readDir).mockResolvedValue({
        success: true,
        nodes: mockNodes
      })

      const { result } = renderHook(() =>
        useFileTreeData({ projectPath: mockProjectPath })
      )

      await act(async () => {
        await result.current.loadDirectory(mockProjectPath)
      })

      expect(result.current.nodesRef.current).toEqual(mockNodes)
    })
  })
})
