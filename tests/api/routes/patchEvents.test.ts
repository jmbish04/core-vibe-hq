import { setupPatchEventsRoutes, PatchEventsRouteContext } from '../../../../orchestrator/worker/api/routes/patchEvents';
import { WebSocketHub } from '../../../../orchestrator/worker/services/websocket/websocketHub';
import { D1Logger } from '../../../../orchestrator/worker/services/patch/d1Logger';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Patch Events Router', () => {
  let mockContext: PatchEventsRouteContext;
  let app: Hono<any>;

  beforeEach(() => {
    // Create mock database with Kysely chainable methods
    const createMockQuery = () => {
      const mockQuery: any = {};
      mockQuery.selectFrom = vi.fn().mockReturnThis();
      mockQuery.selectAll = vi.fn().mockReturnThis();
      mockQuery.select = vi.fn().mockReturnThis();
      mockQuery.where = vi.fn().mockReturnThis();
      mockQuery.orderBy = vi.fn().mockReturnThis();
      mockQuery.limit = vi.fn().mockReturnThis();
      mockQuery.offset = vi.fn().mockReturnThis();
      mockQuery.groupBy = vi.fn().mockReturnThis();
      mockQuery.execute = vi.fn().mockResolvedValue([]);
      mockQuery.executeTakeFirst = vi.fn().mockResolvedValue(null);
      mockQuery.updateTable = vi.fn().mockReturnThis();
      mockQuery.set = vi.fn().mockReturnThis();
      mockQuery.fn = {
        count: vi.fn().mockReturnValue('count')
      };
      return mockQuery;
    };

    mockContext = {
      db: createMockQuery(),
      wsHub: {
        broadcastPatchEvent: vi.fn().mockResolvedValue(undefined)
      } as unknown as WebSocketHub,
      d1Logger: {
        logEvent: vi.fn().mockResolvedValue(undefined)
      } as unknown as D1Logger
    };

    app = new Hono();
    setupPatchEventsRoutes(app, mockContext);
  });

  describe('POST /api/patches/events', () => {
    it('should successfully process a valid patch event', async () => {
      const validEvent = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_PROCESSING_STARTED',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        metadata: { test: 'data' }
      };

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.eventId).toBe('event-123');
      expect(data.eventType).toBe('PATCH_PROCESSING_STARTED');

      expect(mockContext.d1Logger.logEvent).toHaveBeenCalledWith(validEvent);
      expect(mockContext.wsHub.broadcastPatchEvent).toHaveBeenCalledWith(validEvent);
    });

    it('should update task status for completion events', async () => {
      const completionEvent = {
        id: 'event-789',
        patchId: 'task-123-op-0',
        eventType: 'PATCH_PROCESSING_COMPLETED',
        status: 'success',
        createdAt: new Date().toISOString(),
        metadata: { operationsCompleted: 5 }
      };

      // Mock database responses for task update
      mockContext.db.executeTakeFirst = vi.fn().mockResolvedValue({ metadata: '{}' });
      mockContext.db.execute = vi.fn().mockResolvedValue(undefined);

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completionEvent)
      });

      expect(response.status).toBe(200);

      // Verify task status update was attempted
      expect(mockContext.db.updateTable).toHaveBeenCalledWith('tasks');
      expect(mockContext.db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          updatedAt: expect.any(String)
        })
      );
      expect(mockContext.db.where).toHaveBeenCalledWith('id', '=', 123);
    });

    it('should update task status for failure events', async () => {
      const failureEvent = {
        id: 'event-999',
        patchId: 'task-456-op-1',
        eventType: 'PATCH_PROCESSING_FAILED',
        status: 'error',
        createdAt: new Date().toISOString(),
        metadata: { error: 'Patch failed' }
      };

      mockContext.db.executeTakeFirst = vi.fn().mockResolvedValue({ metadata: '{}' });
      mockContext.db.execute = vi.fn().mockResolvedValue(undefined);

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failureEvent)
      });

      expect(response.status).toBe(200);

      expect(mockContext.db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
      expect(mockContext.db.where).toHaveBeenCalledWith('id', '=', 456);
    });

    it('should handle invalid patch event format', async () => {
      const invalidEvent = {
        invalidField: 'invalid'
        // Missing required fields
      };

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidEvent)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.status).toBe('error');
      expect(data.message).toBe('Invalid patch event format');
      expect(data.errors).toBeDefined();

      // Should not log or broadcast invalid events
      expect(mockContext.d1Logger.logEvent).not.toHaveBeenCalled();
      expect(mockContext.wsHub.broadcastPatchEvent).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON', async () => {
      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.status).toBe('error');
      expect(data.message).toBe('Invalid patch event format');
    });

    it('should handle database logging errors gracefully', async () => {
      const validEvent = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_PROCESSING_STARTED',
        status: 'in_progress',
        createdAt: new Date().toISOString()
      };

      mockContext.d1Logger.logEvent = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent)
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.status).toBe('error');
      expect(data.message).toBe('Failed to process patch event');

      // WebSocket broadcast should still be attempted
      expect(mockContext.wsHub.broadcastPatchEvent).toHaveBeenCalledWith(validEvent);
    });

    it('should handle WebSocket broadcast errors gracefully', async () => {
      const validEvent = {
        id: 'event-123',
        patchId: 'patch-456',
        eventType: 'PATCH_PROCESSING_STARTED',
        status: 'in_progress',
        createdAt: new Date().toISOString()
      };

      mockContext.wsHub.broadcastPatchEvent = vi.fn().mockRejectedValue(new Error('WebSocket error'));

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent)
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.status).toBe('error');

      // Database logging should still succeed
      expect(mockContext.d1Logger.logEvent).toHaveBeenCalledWith(validEvent);
    });

    it('should skip task status update for non-task patch IDs', async () => {
      const eventWithoutTaskId = {
        id: 'event-123',
        patchId: 'random-patch-456',
        eventType: 'PATCH_PROCESSING_COMPLETED',
        status: 'success',
        createdAt: new Date().toISOString()
      };

      const response = await app.request('/api/patches/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventWithoutTaskId)
      });

      expect(response.status).toBe(200);

      // Should not attempt task status update
      expect(mockContext.db.updateTable).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/patches/events/recent', () => {
    it('should return recent patch events with default parameters', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          patchId: 'patch-123',
          eventType: 'PATCH_PROCESSING_STARTED',
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ test: 'data' })
        },
        {
          id: 'event-2',
          patchId: 'patch-456',
          eventType: 'PATCH_PROCESSING_COMPLETED',
          status: 'success',
          createdAt: new Date().toISOString(),
          metadata: null
        }
      ];

      mockContext.db.execute = vi.fn().mockResolvedValue(mockEvents);

      const response = await app.request('/api/patches/events/recent');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(2);
      expect(data.events[0].id).toBe('event-1');
      expect(data.events[0].metadata).toEqual({ test: 'data' });
      expect(data.events[1].metadata).toBeNull();
      expect(data.count).toBe(2);

      expect(mockContext.db.selectFrom).toHaveBeenCalledWith('patchEvents');
      expect(mockContext.db.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockContext.db.limit).toHaveBeenCalledWith(50);
    });

    it('should apply event type filter', async () => {
      mockContext.db.execute = vi.fn().mockResolvedValue([]);

      const response = await app.request('/api/patches/events/recent?eventType=PATCH_PROCESSING_COMPLETED');

      expect(response.status).toBe(200);
      expect(mockContext.db.where).toHaveBeenCalledWith('eventType', '=', 'PATCH_PROCESSING_COMPLETED');
    });

    it('should apply patch ID filter', async () => {
      mockContext.db.execute = vi.fn().mockResolvedValue([]);

      const response = await app.request('/api/patches/events/recent?patchId=patch-123');

      expect(response.status).toBe(200);
      expect(mockContext.db.where).toHaveBeenCalledWith('patchId', '=', 'patch-123');
    });

    it('should respect limit parameter with maximum cap', async () => {
      mockContext.db.execute = vi.fn().mockResolvedValue([]);

      const response = await app.request('/api/patches/events/recent?limit=500');

      expect(response.status).toBe(200);
      expect(mockContext.db.limit).toHaveBeenCalledWith(200); // Should be capped at 200
    });

    it('should handle database errors', async () => {
      mockContext.db.execute = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.request('/api/patches/events/recent');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.status).toBe('error');
      expect(data.message).toBe('Failed to fetch recent events');
    });
  });

  describe('GET /api/patches/events/stats', () => {
    it('should return event statistics for default timeframe', async () => {
      // Mock event type stats
      mockContext.db.execute = vi.fn()
        .mockResolvedValueOnce([
          { eventType: 'PATCH_PROCESSING_STARTED', count: 10 },
          { eventType: 'PATCH_PROCESSING_COMPLETED', count: 8 },
          { eventType: 'PATCH_PROCESSING_FAILED', count: 2 }
        ])
        .mockResolvedValueOnce([
          { status: 'success', count: 8 },
          { status: 'error', count: 2 },
          { status: 'in_progress', count: 2 }
        ])
        .mockResolvedValueOnce({ total: 12 });

      const response = await app.request('/api/patches/events/stats');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.timeframe).toBe('24h');
      expect(data.totalEvents).toBe(12);
      expect(data.eventTypeBreakdown).toEqual({
        PATCH_PROCESSING_STARTED: 10,
        PATCH_PROCESSING_COMPLETED: 8,
        PATCH_PROCESSING_FAILED: 2
      });
      expect(data.statusBreakdown).toEqual({
        success: 8,
        error: 2,
        in_progress: 2
      });
      expect(data.generatedAt).toBeDefined();
    });

    it('should support different timeframes', async () => {
      mockContext.db.execute = vi.fn()
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue({ total: 0 });

      const response = await app.request('/api/patches/events/stats?timeframe=1h');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.timeframe).toBe('1h');
    });

    it('should handle invalid timeframes gracefully', async () => {
      mockContext.db.execute = vi.fn()
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue({ total: 0 });

      const response = await app.request('/api/patches/events/stats?timeframe=invalid');

      expect(response.status).toBe(200);
      // Should default to 24h for invalid timeframe
      const data = await response.json();
      expect(data.timeframe).toBe('24h');
    });

    it('should handle database errors in stats endpoint', async () => {
      mockContext.db.execute = vi.fn().mockRejectedValue(new Error('Stats query failed'));

      const response = await app.request('/api/patches/events/stats');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.status).toBe('error');
      expect(data.message).toBe('Failed to fetch event statistics');
    });
  });

  describe('Task Status Updates', () => {
    it('should update task status for completion events', async () => {
      const mockDb = mockContext.db;
      const patchEvent = {
        id: 'event-123',
        patchId: 'task-456-op-0',
        eventType: 'PATCH_PROCESSING_COMPLETED' as const,
        status: 'success' as const,
        createdAt: new Date().toISOString(),
        metadata: {}
      };

      // Mock database responses
      mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ metadata: '{}' });
      mockDb.execute = vi.fn().mockResolvedValue(undefined);

      // Import and call the private function for testing
      const { updateTaskStatus } = await import('../../../../orchestrator/worker/api/routes/patchEvents');
      await (updateTaskStatus as any)(mockDb, patchEvent);

      expect(mockDb.updateTable).toHaveBeenCalledWith('tasks');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          updatedAt: expect.any(String)
        })
      );
      expect(mockDb.where).toHaveBeenCalledWith('id', '=', 456);
    });

    it('should update task status for failure events', async () => {
      const mockDb = mockContext.db;
      const patchEvent = {
        id: 'event-456',
        patchId: 'task-789-op-1',
        eventType: 'PATCH_PROCESSING_FAILED' as const,
        status: 'error' as const,
        createdAt: new Date().toISOString(),
        metadata: { error: 'Patch failed' }
      };

      mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ metadata: '{}' });
      mockDb.execute = vi.fn().mockResolvedValue(undefined);

      const { updateTaskStatus } = await import('../../../../orchestrator/worker/api/routes/patchEvents');
      await (updateTaskStatus as any)(mockDb, patchEvent);

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
      expect(mockDb.where).toHaveBeenCalledWith('id', '=', 789);
    });

    it('should skip task updates for non-task patch IDs', async () => {
      const mockDb = mockContext.db;
      const patchEvent = {
        id: 'event-789',
        patchId: 'random-patch-123',
        eventType: 'PATCH_PROCESSING_COMPLETED' as const,
        status: 'success' as const,
        createdAt: new Date().toISOString(),
        metadata: {}
      };

      const { updateTaskStatus } = await import('../../../../orchestrator/worker/api/routes/patchEvents');
      await (updateTaskStatus as any)(mockDb, patchEvent);

      // Should not attempt database update
      expect(mockDb.updateTable).not.toHaveBeenCalled();
    });

    it('should handle task update errors gracefully', async () => {
      const mockDb = mockContext.db;
      const patchEvent = {
        id: 'event-123',
        patchId: 'task-456-op-0',
        eventType: 'PATCH_PROCESSING_COMPLETED' as const,
        status: 'success' as const,
        createdAt: new Date().toISOString(),
        metadata: {}
      };

      mockDb.execute = vi.fn().mockRejectedValue(new Error('Database update failed'));

      const { updateTaskStatus } = await import('../../../../orchestrator/worker/api/routes/patchEvents');

      // Should not throw - task updates are not critical
      await expect((updateTaskStatus as any)(mockDb, patchEvent)).resolves.not.toThrow();
    });
  });
});
