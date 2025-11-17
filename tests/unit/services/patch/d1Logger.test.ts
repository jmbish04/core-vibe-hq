/**
 * Unit tests for D1Logger service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { D1Logger } from '../../../../orchestrator/worker/services/patch/d1Logger'
import { Kysely } from 'kysely'

// Mock Kysely
const mockKysely = {
  insertInto: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  executeTakeFirst: vi.fn(),
  execute: vi.fn(),
  selectFrom: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  deleteFrom: vi.fn().mockReturnThis()
}

describe('D1Logger', () => {
  let logger: D1Logger
  let mockDb: Kysely<any>

  beforeEach(() => {
    mockDb = mockKysely as any
    logger = new D1Logger(mockDb)
    vi.clearAllMocks()
  })

  describe('logPatchEvent', () => {
    it('should log valid patch event', async () => {
      const event = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        createdAt: new Date(),
        metadata: { duration: 100 }
      }

      mockDb.executeTakeFirst.mockResolvedValue({ insertId: 123 })

      const result = await logger.logPatchEvent(event)

      expect(result).toBe(123)
      expect(mockDb.insertInto).toHaveBeenCalledWith('patchEvents')
      expect(mockDb.values).toHaveBeenCalledWith({
        patchId: 'patch-456',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        createdAt: event.createdAt,
        metadata: JSON.stringify({ duration: 100 })
      })
    })

    it('should handle events without metadata', async () => {
      const event = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_RECEIVED',
        status: 'pending',
        createdAt: new Date()
      }

      mockDb.executeTakeFirst.mockResolvedValue({ insertId: 456 })

      const result = await logger.logPatchEvent(event)

      expect(result).toBe(456)
      expect(mockDb.values).toHaveBeenCalledWith({
        patchId: 'patch-456',
        eventType: 'PATCH_RECEIVED',
        status: 'pending',
        createdAt: event.createdAt,
        metadata: null
      })
    })

    it('should validate event before logging', async () => {
      const invalidEvent = {
        patchId: 'missing-fields'
        // Missing required fields
      }

      await expect(logger.logPatchEvent(invalidEvent as any)).rejects.toThrow()
    })

    it('should handle database errors', async () => {
      const event = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        createdAt: new Date()
      }

      mockDb.executeTakeFirst.mockRejectedValue(new Error('Database connection failed'))

      await expect(logger.logPatchEvent(event)).rejects.toThrow('Patch event logging failed')
    })
  })

  describe('getEventsForPatch', () => {
    it('should retrieve events for a patch', async () => {
      const mockEvents = [
        {
          id: 1,
          patchId: 'patch-123',
          eventType: 'PATCH_RECEIVED',
          status: 'pending',
          createdAt: new Date('2024-01-01'),
          metadata: '{"source": "api"}'
        },
        {
          id: 2,
          patchId: 'patch-123',
          eventType: 'PATCH_APPLIED',
          status: 'success',
          createdAt: new Date('2024-01-02'),
          metadata: null
        }
      ]

      mockDb.execute.mockResolvedValue(mockEvents)

      const events = await logger.getEventsForPatch('patch-123')

      expect(events).toHaveLength(2)
      expect(events[0].id).toBe('1')
      expect(events[0].patchId).toBe('patch-123')
      expect(events[0].eventType).toBe('PATCH_RECEIVED')
      expect(events[0].metadata).toEqual({ source: 'api' })
      expect(events[1].metadata).toBeUndefined()
    })

    it('should apply limit and offset', async () => {
      mockDb.execute.mockResolvedValue([])

      await logger.getEventsForPatch('patch-123', { limit: 10, offset: 5 })

      expect(mockDb.limit).toHaveBeenCalledWith(10)
      expect(mockDb.offset).toHaveBeenCalledWith(5)
    })

    it('should handle database errors', async () => {
      mockDb.execute.mockRejectedValue(new Error('Query failed'))

      await expect(logger.getEventsForPatch('patch-123')).rejects.toThrow('Event retrieval failed')
    })
  })

  describe('queryEvents', () => {
    it('should query events with filters', async () => {
      const mockEvents = [
        {
          id: 1,
          patchId: 'patch-123',
          eventType: 'PATCH_APPLIED',
          status: 'success',
          createdAt: new Date(),
          metadata: null
        }
      ]

      mockDb.execute.mockResolvedValue(mockEvents)

      const query = {
        patchId: 'patch-123',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        limit: 20,
        offset: 0
      }

      const events = await logger.queryEvents(query)

      expect(mockDb.where).toHaveBeenCalledWith('patchId', '=', 'patch-123')
      expect(mockDb.where).toHaveBeenCalledWith('eventType', '=', 'PATCH_APPLIED')
      expect(mockDb.where).toHaveBeenCalledWith('status', '=', 'success')
      expect(events).toHaveLength(1)
    })

    it('should apply date range filters', async () => {
      mockDb.execute.mockResolvedValue([])

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await logger.queryEvents({ startDate, endDate })

      expect(mockDb.where).toHaveBeenCalledWith('createdAt', '>=', startDate)
      expect(mockDb.where).toHaveBeenCalledWith('createdAt', '<=', endDate)
    })

    it('should use default pagination', async () => {
      mockDb.execute.mockResolvedValue([])

      await logger.queryEvents({})

      expect(mockDb.limit).toHaveBeenCalledWith(50)
      expect(mockDb.offset).toHaveBeenCalledWith(0)
    })
  })

  describe('getEventStats', () => {
    it('should return comprehensive statistics', async () => {
      // Mock total count
      mockDb.executeTakeFirst
        .mockResolvedValueOnce({ count: 100 })
        .mockResolvedValueOnce({ count: 5 }) // failures

      // Mock events by type
      mockDb.execute
        .mockResolvedValueOnce([
          { eventType: 'PATCH_APPLIED', count: 60 },
          { eventType: 'PATCH_RECEIVED', count: 40 }
        ])
        // Mock events by status
        .mockResolvedValueOnce([
          { status: 'success', count: 80 },
          { status: 'failure', count: 20 }
        ])

      const stats = await logger.getEventStats(24)

      expect(stats.totalEvents).toBe(100)
      expect(stats.eventsByType).toEqual({
        PATCH_APPLIED: 60,
        PATCH_RECEIVED: 40
      })
      expect(stats.eventsByStatus).toEqual({
        success: 80,
        failure: 20
      })
      expect(stats.recentFailures).toBe(5)
    })

    it('should handle empty results', async () => {
      mockDb.executeTakeFirst.mockResolvedValue({ count: 0 })
      mockDb.execute.mockResolvedValue([])

      const stats = await logger.getEventStats()

      expect(stats.totalEvents).toBe(0)
      expect(stats.eventsByType).toEqual({})
      expect(stats.eventsByStatus).toEqual({})
      expect(stats.recentFailures).toBe(0)
    })
  })

  describe('cleanupOldEvents', () => {
    it('should delete old events', async () => {
      mockDb.executeTakeFirst.mockResolvedValue({ numDeletedRows: 42 })

      const deleted = await logger.cleanupOldEvents(30)

      expect(deleted).toBe(42)
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('patchEvents')
    })

    it('should use default retention period', async () => {
      mockDb.executeTakeFirst.mockResolvedValue({ numDeletedRows: 0 })

      await logger.cleanupOldEvents()

      // Should be called with 90 days default
      expect(mockDb.where).toHaveBeenCalledWith('createdAt', '<', expect.any(Date))
    })

    it('should handle cleanup errors', async () => {
      mockDb.executeTakeFirst.mockRejectedValue(new Error('Cleanup failed'))

      await expect(logger.cleanupOldEvents()).rejects.toThrow('Event cleanup failed')
    })
  })

  describe('validateEvent', () => {
    it('should validate correct events', () => {
      const event = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        createdAt: new Date()
      }

      expect(() => logger.validateEvent(event)).not.toThrow()
    })

    it('should reject invalid events', () => {
      const invalidEvent = {
        patchId: 'missing-id'
      }

      expect(() => logger.validateEvent(invalidEvent as any)).toThrow()
    })
  })
})
