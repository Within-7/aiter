/**
 * Tests for IPC handler utilities
 *
 * Note: These tests use minimal mocking to verify handler behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IpcMainInvokeEvent } from 'electron'
import {
  createHandler,
  createStatusHandler,
  createNoArgsHandler,
  createHandlerFactory,
  clearRateLimits,
  IPCResult
} from '../handler'

// Mock IpcMainInvokeEvent
const createMockEvent = (): IpcMainInvokeEvent => {
  return {
    sender: {
      id: 1,
      getURL: () => 'http://localhost:3000'
    }
  } as unknown as IpcMainInvokeEvent
}

describe('IPC Handler Utilities', () => {
  beforeEach(() => {
    clearRateLimits()
    vi.clearAllMocks()
  })

  describe('createHandler', () => {
    it('should return success result when handler succeeds', async () => {
      const handler = createHandler(async ({ value }: { value: number }) => {
        return value * 2
      })

      const result = await handler(createMockEvent(), { value: 5 })

      expect(result).toEqual({
        success: true,
        data: 10
      })
    })

    it('should return error result when handler throws', async () => {
      const handler = createHandler(async () => {
        throw new Error('Test error')
      })

      const result = await handler(createMockEvent(), {})

      expect(result).toEqual({
        success: false,
        error: 'Test error'
      })
    })

    it('should handle synchronous handlers', async () => {
      const handler = createHandler(({ value }: { value: number }) => {
        return value + 1
      })

      const result = await handler(createMockEvent(), { value: 5 })

      expect(result).toEqual({
        success: true,
        data: 6
      })
    })

    it('should extract error message from string errors', async () => {
      const handler = createHandler(async () => {
        throw 'String error'
      })

      const result = await handler(createMockEvent(), {})

      expect(result).toEqual({
        success: false,
        error: 'String error'
      })
    })

    it('should handle unknown error types', async () => {
      const handler = createHandler(async () => {
        throw { custom: 'error' }
      })

      const result = await handler(createMockEvent(), {})

      expect(result).toEqual({
        success: false,
        error: 'Unknown error'
      })
    })

    it('should pass event object to handler', async () => {
      let receivedEvent: IpcMainInvokeEvent | undefined

      const handler = createHandler(async (args, event) => {
        receivedEvent = event
        return true
      })

      const mockEvent = createMockEvent()
      await handler(mockEvent, {})

      expect(receivedEvent).toBe(mockEvent)
    })
  })

  describe('createStatusHandler', () => {
    it('should return success status when handler returns true', async () => {
      const handler = createStatusHandler(async () => true)

      const result = await handler(createMockEvent(), {})

      expect(result).toEqual({
        success: true,
        data: true
      })
    })

    it('should return failure status when handler returns false', async () => {
      const handler = createStatusHandler(async () => false)

      const result = await handler(createMockEvent(), {})

      expect(result).toEqual({
        success: true,
        data: false
      })
    })
  })

  describe('createNoArgsHandler', () => {
    it('should work with handlers that take no arguments', async () => {
      const handler = createNoArgsHandler(async () => {
        return { data: 'test' }
      })

      const result = await handler(createMockEvent())

      expect(result).toEqual({
        success: true,
        data: { data: 'test' }
      })
    })

    it('should handle errors in no-args handlers', async () => {
      const handler = createNoArgsHandler(async () => {
        throw new Error('No args error')
      })

      const result = await handler(createMockEvent())

      expect(result).toEqual({
        success: false,
        error: 'No args error'
      })
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should enforce rate limit', async () => {
      const mockFn = vi.fn(async () => true)
      const handler = createHandler(mockFn, { rateLimit: 1000 })

      // First call should succeed
      const result1 = await handler(createMockEvent(), {})
      expect(result1.success).toBe(true)
      expect(mockFn).toHaveBeenCalledTimes(1)

      // Second immediate call should be rate limited
      const result2 = await handler(createMockEvent(), {})
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('Rate limited')
      expect(mockFn).toHaveBeenCalledTimes(1)

      // After time passes, should work again
      vi.advanceTimersByTime(1001)
      const result3 = await handler(createMockEvent(), {})
      expect(result3.success).toBe(true)
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should include remaining time in rate limit error', async () => {
      const handler = createHandler(async () => true, { rateLimit: 1000 })

      await handler(createMockEvent(), {})

      vi.advanceTimersByTime(300)

      const result = await handler(createMockEvent(), {})
      expect(result.error).toMatch(/wait \d+ms/)
    })

    it('should allow clearing rate limits', async () => {
      const mockFn = vi.fn(async () => true)
      const handler = createHandler(mockFn, { rateLimit: 1000 })

      await handler(createMockEvent(), {})

      // Should be rate limited
      let result = await handler(createMockEvent(), {})
      expect(result.success).toBe(false)

      // Clear rate limits
      clearRateLimits()

      // Should work again
      result = await handler(createMockEvent(), {})
      expect(result.success).toBe(true)
    })
  })

  describe('Error Logging', () => {
    it('should log errors by default', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      const handler = createHandler(async () => {
        throw new Error('Test error')
      })

      await handler(createMockEvent(), {})

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should not log errors when disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      const handler = createHandler(
        async () => {
          throw new Error('Test error')
        },
        { logErrors: false }
      )

      await handler(createMockEvent(), {})

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should use custom logger', async () => {
      const mockLogger = vi.fn()

      const handler = createHandler(
        async () => {
          throw new Error('Test error')
        },
        { logger: mockLogger }
      )

      await handler(createMockEvent(), {})

      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[IPC Error]'),
        'error'
      )
    })
  })

  describe('Error Transformer', () => {
    it('should use custom error transformer', async () => {
      const handler = createHandler(
        async () => {
          throw new Error('ENOENT: file not found')
        },
        {
          errorTransformer: (error) => {
            if (error instanceof Error && error.message.includes('ENOENT')) {
              return 'Custom: File not found'
            }
            return 'Unknown error'
          }
        }
      )

      const result = await handler(createMockEvent(), {})

      expect(result).toEqual({
        success: false,
        error: 'Custom: File not found'
      })
    })
  })

  describe('createHandlerFactory', () => {
    it('should create handlers with shared options', async () => {
      const mockLogger = vi.fn()

      const createCustomHandler = createHandlerFactory({
        logger: mockLogger,
        logErrors: true
      })

      const handler1 = createCustomHandler(async () => {
        throw new Error('Error 1')
      })

      const handler2 = createCustomHandler(async () => {
        throw new Error('Error 2')
      })

      await handler1(createMockEvent(), {})
      await handler2(createMockEvent(), {})

      expect(mockLogger).toHaveBeenCalledTimes(4) // 2 errors × 2 logs each (message + stack)
    })

    it('should allow overriding factory options', async () => {
      const mockLogger = vi.fn()

      const createCustomHandler = createHandlerFactory({
        logger: mockLogger,
        logErrors: true
      })

      const handler = createCustomHandler(
        async () => {
          throw new Error('Test')
        },
        { logErrors: false } // Override
      )

      await handler(createMockEvent(), {})

      expect(mockLogger).not.toHaveBeenCalled()
    })
  })

  describe('TypeScript Type Inference', () => {
    it('should infer correct types', async () => {
      interface TestArgs {
        name: string
        value: number
      }

      interface TestResult {
        computed: string
      }

      const handler = createHandler<TestArgs, TestResult>(async ({ name, value }) => {
        return { computed: `${name}-${value}` }
      })

      const result = await handler(createMockEvent(), { name: 'test', value: 42 })

      if (result.success) {
        // TypeScript should know that result.data is TestResult
        expect(result.data.computed).toBe('test-42')
      }
    })
  })
})
