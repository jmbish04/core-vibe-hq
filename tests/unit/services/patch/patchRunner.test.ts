/**
 * Unit tests for PatchRunner service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatchRunner } from '../../../../orchestrator/worker/services/patch/patchRunner'
import { D1Logger } from '../../../../orchestrator/worker/services/patch/d1Logger'
import { PatchBatchSchema, type PatchBatch } from '@shared/contracts'

// Mock D1Logger
vi.mock('../../../../orchestrator/worker/services/patch/d1Logger', () => ({
  D1Logger: vi.fn().mockImplementation(() => ({
    logPatchEvent: vi.fn().mockResolvedValue(123)
  }))
}))

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn()
}))

describe('PatchRunner', () => {
  let patchRunner: PatchRunner
  let mockLogger: D1Logger

  beforeEach(() => {
    mockLogger = new D1Logger({} as any)
    patchRunner = new PatchRunner(mockLogger)
  })

  describe('validatePatchBatch', () => {
    it('should validate a correct patch batch', () => {
      const validBatch: PatchBatch = {
        patchId: 'test-batch',
        operations: [
          {
            op: 'add',
            path: '/test/file.ts',
            value: 'test content'
          }
        ]
      }

      expect(() => patchRunner.validatePatchBatch(validBatch)).not.toThrow()
    })

    it('should reject invalid patch batch', () => {
      const invalidBatch = {
        operations: [] // Missing patchId
      }

      expect(() => patchRunner.validatePatchBatch(invalidBatch)).toThrow()
    })
  })

  describe('validatePatchOperation', () => {
    it('should validate a correct patch operation', () => {
      const validOperation = {
        op: 'add',
        path: '/test/file.ts',
        value: 'test content'
      }

      expect(() => patchRunner.validatePatchOperation(validOperation)).not.toThrow()
    })

    it('should reject invalid patch operation', () => {
      const invalidOperation = {
        op: 'add'
        // Missing path
      }

      expect(() => patchRunner.validatePatchOperation(invalidOperation)).toThrow()
    })
  })

  describe('createBatchFile', () => {
    it('should create batch file data structure', async () => {
      const batch: PatchBatch = {
        patchId: 'test-batch-123',
        operations: [
          {
            op: 'replace-block',
            path: 'test.py',
            start: 1,
            end: 1,
            block: 'new content',
            taskId: 'task-1'
          }
        ]
      }

      // Since we're mocking file operations, just test the method exists
      const result = await (patchRunner as any).createBatchFile(batch)
      expect(typeof result).toBe('string')
      expect(result).toContain('patch-batch')
    })
  })

  describe('executePythonScript', () => {
    it('should handle successful script execution', async () => {
      const mockSpawn = vi.fn()
      const mockProcess = {
        stdout: { on: vi.fn((event, callback) => callback('{"success": true, "results": []}')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      vi.doMock('child_process', () => ({ spawn: mockSpawn }))

      const result = await (patchRunner as any).executePythonScript('/tmp/test.json')
      expect(result).toEqual([])
    })

    it('should handle script execution errors', async () => {
      const mockSpawn = vi.fn()
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event, callback) => callback('Script error')) },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(1)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      vi.doMock('child_process', () => ({ spawn: mockSpawn }))

      await expect((patchRunner as any).executePythonScript('/tmp/test.json')).rejects.toThrow()
    })
  })
})
