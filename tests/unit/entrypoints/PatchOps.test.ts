/**
 * Unit tests for PatchOps entrypoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PatchBatch, PatchEvent } from '@shared/contracts'

// Mock all the dependencies
vi.mock('../../../orchestrator/worker/services/patch/patchRunner')
vi.mock('../../../orchestrator/worker/services/patch/coordResolver')
vi.mock('../../../orchestrator/worker/services/patch/patchBridge')
vi.mock('../../../orchestrator/worker/services/patch/d1Logger')
vi.mock('../../../orchestrator/worker/services/websocket/websocketHub')
vi.mock('@shared/base/workerEntrypoint', () => ({
  BaseWorkerEntrypoint: class {
    dbOps: any
    dbProjects: any
    dbChats: any
    dbHealth: any

    constructor(ctx: any, env: any) {
      this.dbOps = env.DB_OPS
      this.dbProjects = env.DB_PROJECTS
      this.dbChats = env.DB_CHATS
      this.dbHealth = env.DB_HEALTH
    }
  }
}))

import { PatchOps } from '../../../orchestrator/worker/entrypoints/PatchOps'

// Import the mocked classes
import { PatchRunner } from '../../../orchestrator/worker/services/patch/patchRunner'
import { CoordResolver } from '../../../orchestrator/worker/services/patch/coordResolver'
import { PatchBridge } from '../../../orchestrator/worker/services/patch/patchBridge'
import { D1Logger } from '../../../orchestrator/worker/services/patch/d1Logger'
import { WebSocketHub } from '../../../orchestrator/worker/services/websocket/websocketHub'

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
  }
})

describe('PatchOps', () => {
  let patchOps: PatchOps
  let mockCtx: any
  let mockEnv: any
  let mockPatchRunner: any
  let mockCoordResolver: any
  let mockPatchBridge: any
  let mockD1Logger: any
  let mockWebSocketHub: any

  beforeEach(() => {
    // Mock execution context
    mockCtx = {}

    // Mock environment
    mockEnv = {
      DB_OPS: {},
      DB_PROJECTS: {},
      DB_CHATS: {},
      DB_HEALTH: {}
    }

    // Mock services
    mockPatchRunner = {
      applyOperation: vi.fn()
    }

    mockCoordResolver = {}

    mockPatchBridge = {}

    mockD1Logger = {
      logEvent: vi.fn().mockResolvedValue(undefined)
    }

    mockWebSocketHub = {
      broadcastPatchEvent: vi.fn()
    }

    // Apply mocks
    ;(PatchRunner as any).mockImplementation(() => mockPatchRunner)
    ;(CoordResolver as any).mockImplementation(() => mockCoordResolver)
    ;(PatchBridge as any).mockImplementation(() => mockPatchBridge)
    ;(D1Logger as any).mockImplementation(() => mockD1Logger)
    ;(WebSocketHub as any).mockImplementation(() => mockWebSocketHub)

    patchOps = new PatchOps(mockCtx, mockEnv)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('applyPatches', () => {
    it('should successfully apply a patch batch', async () => {
      const batch: PatchBatch = {
        id: 'batch-123',
        patches: [
          {
            op: 'add',
            path: '/users/123',
            value: { name: 'John' }
          }
        ]
      }

      const request = { batch, options: { dryRun: false } }

      mockPatchRunner.applyOperation.mockResolvedValue(undefined)

      const result = await patchOps.applyPatches(request)

      expect(result.success).toBe(true)
      expect(result.appliedOperations).toBe(1)
      expect(result.failedOperations).toBe(0)
      expect(result.errors).toEqual([])
      expect(result.events).toHaveLength(3) // start, operation success, completion

      // Verify events were logged (start, operation success, completion)
      expect(mockD1Logger.logEvent).toHaveBeenCalledTimes(3)
      // Verify WebSocket broadcasts (start and completion events only)
      expect(mockWebSocketHub.broadcastPatchEvent).toHaveBeenCalledTimes(2)
    })

    it('should handle validation-only requests', async () => {
      const batch: PatchBatch = {
        id: 'batch-456',
        patches: [
          {
            op: 'add',
            path: '/users/456',
            value: { name: 'Jane' }
          }
        ]
      }

      const request = { batch, options: { validateOnly: true } }

      const result = await patchOps.applyPatches(request)

      expect(result.success).toBe(true)
      expect(result.appliedOperations).toBe(1)
      expect(result.failedOperations).toBe(0)
      expect(mockPatchRunner.applyOperation).not.toHaveBeenCalled()
    })

    it('should handle patch application failures with rollback', async () => {
      const batch: PatchBatch = {
        id: 'batch-789',
        patches: [
          {
            op: 'add',
            path: '/users/789',
            value: { name: 'Bob' }
          },
          {
            op: 'invalid',
            path: '/invalid',
            value: null
          }
        ]
      }

      const request = { batch, options: { rollbackOnFailure: true } }

      // First operation succeeds, second fails
      mockPatchRunner.applyOperation
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Invalid operation'))

      const result = await patchOps.applyPatches(request)

      expect(result.success).toBe(false)
      expect(result.appliedOperations).toBe(1)
      expect(result.failedOperations).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.rollbackId).toBeDefined()

      // Should have logged rollback event
      expect(mockD1Logger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PATCH_ROLLBACK_COMPLETED'
        })
      )
    })

    it('should handle dry run requests', async () => {
      const batch: PatchBatch = {
        id: 'batch-dry',
        patches: [
          {
            op: 'replace',
            path: '/config/debug',
            value: true
          }
        ]
      }

      const request = { batch, options: { dryRun: true } }

      mockPatchRunner.applyOperation.mockResolvedValue(undefined)

      const result = await patchOps.applyPatches(request)

      expect(result.success).toBe(true)
      expect(mockPatchRunner.applyOperation).not.toHaveBeenCalled() // Dry run shouldn't apply operations
      // Verify dry run is passed through
    })

    it('should handle empty patch batches', async () => {
      const batch: PatchBatch = {
        id: 'batch-empty',
        patches: []
      }

      const request = { batch }

      const result = await patchOps.applyPatches(request)

      expect(result.success).toBe(true)
      expect(result.appliedOperations).toBe(0)
      expect(result.failedOperations).toBe(0)
    })

    it('should handle batch processing errors', async () => {
      const batch: PatchBatch = {
        id: 'batch-error',
        patches: [
          {
            op: 'add',
            path: '/test',
            value: 'test'
          }
        ]
      }

      const request = { batch }

      // Mock the start event logging to fail
      mockD1Logger.logEvent.mockRejectedValueOnce(new Error('Database error'))

      const result = await patchOps.applyPatches(request)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Batch processing failed')
    })
  })

  describe('getPatchStatus', () => {
    it('should return patch status for existing batch', async () => {
      const batchId = 'batch-123'
      const mockEvents = [
        {
          id: 'event-1',
          patchId: batchId,
          eventType: 'PATCH_PROCESSING_STARTED',
          status: 'success',
          createdAt: new Date(),
          metadata: { operationCount: 2 }
        },
        {
          id: 'event-2',
          patchId: batchId,
          eventType: 'PATCH_OPERATION_APPLIED',
          status: 'success',
          createdAt: new Date()
        }
      ]

      // Mock the database query
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEvents)
      }

      ;(patchOps as any).dbOps = mockDb

      const result = await patchOps.getPatchStatus(batchId)

      expect(result).not.toBeNull()
      expect(result!.batchId).toBe(batchId)
      expect(result!.status).toBe('processing')
      expect(result!.progress.total).toBe(2)
      expect(result!.progress.applied).toBe(1)
      expect(result!.events).toHaveLength(2)
    })

    it('should return null for non-existent batch', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      }

      ;(patchOps as any).dbOps = mockDb

      const result = await patchOps.getPatchStatus('non-existent')

      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(new Error('DB error'))
      }

      ;(patchOps as any).dbOps = mockDb

      const result = await patchOps.getPatchStatus('batch-123')

      expect(result).toBeNull()
    })
  })

  describe('rollbackPatch', () => {
    it('should successfully rollback operations', async () => {
      const request = {
        rollbackId: 'rollback-123',
        reason: 'Test rollback'
      }

      const result = await patchOps.rollbackPatch(request)

      expect(result.success).toBe(true)
      expect(result.rolledBackOperations).toBe(0) // Placeholder implementation
      expect(result.errors).toEqual([])

      // Verify rollback event was logged
      expect(mockD1Logger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PATCH_ROLLBACK_COMPLETED',
          metadata: expect.objectContaining({
            reason: 'Test rollback'
          })
        })
      )
    })

    it('should handle rollback errors', async () => {
      const request = {
        rollbackId: 'rollback-error',
        reason: 'Error rollback'
      }

      mockD1Logger.logEvent.mockRejectedValue(new Error('Rollback failed'))

      const result = await patchOps.rollbackPatch(request)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Rollback failed')
    })
  })

  describe('private methods', () => {
    describe('validateOperation', () => {
      it('should validate correct operations', async () => {
        const operation = {
          op: 'add',
          path: '/users/123',
          value: { name: 'John' }
        }

        // Should not throw
        await expect((patchOps as any).validateOperation(operation)).resolves.not.toThrow()
      })

      it('should reject operations without required fields', async () => {
        const operation = {
          op: 'add',
          // missing path
          value: { name: 'John' }
        }

        await expect((patchOps as any).validateOperation(operation)).rejects.toThrow('missing required fields')
      })

      it('should reject invalid operation types', async () => {
        const operation = {
          op: 'invalid-op',
          path: '/users/123',
          value: { name: 'John' }
        }

        await expect((patchOps as any).validateOperation(operation)).rejects.toThrow('Invalid operation type')
      })

      it('should reject invalid paths', async () => {
        const operation = {
          op: 'add',
          path: 'users/123', // missing leading slash
          value: { name: 'John' }
        }

        await expect((patchOps as any).validateOperation(operation)).rejects.toThrow('Invalid path format')
      })
    })

    describe('createReverseOperation', () => {
      it('should create reverse operations for supported types', () => {
        const addOp = {
          op: 'add',
          path: '/users/123',
          value: { name: 'John' }
        }

        const reverseOp = (patchOps as any).createReverseOperation(addOp)

        expect(reverseOp.op).toBe('remove')
        expect(reverseOp.path).toBe('/users/123')
      })

      it('should throw for unsupported reverse operations', () => {
        const replaceOp = {
          op: 'replace',
          path: '/users/123/name',
          value: 'Jane'
        }

        expect(() => (patchOps as any).createReverseOperation(replaceOp)).toThrow('Cannot rollback replace operation')
      })
    })
  })
})
