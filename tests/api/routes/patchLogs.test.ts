import { setupPatchLogsRoutes } from '../../../../orchestrator/worker/api/routes/patchLogs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Patch Logs Routes', () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono();

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
      mockQuery.clone = vi.fn().mockReturnThis();
      mockQuery.clearSelect = vi.fn().mockReturnThis();
      mockQuery.clearOrderBy = vi.fn().mockReturnThis();
      mockQuery.execute = vi.fn().mockResolvedValue([]);
      mockQuery.executeTakeFirst = vi.fn().mockResolvedValue(null);
      mockQuery.fn = {
        count: vi.fn().mockReturnValue('count')
      };
      return mockQuery;
    };

    const mockDb = createMockQuery();

    // Mock environment
    const mockEnv = {
      DB_OPS: mockDb
    };

    setupPatchLogsRoutes(app);
  });

  describe('GET /api/patches/logs', () => {
    it('should return paginated patch logs with default parameters', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          patchId: 'patch-123',
          eventType: 'PATCH_PROCESSING_STARTED',
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ operationCount: 5 })
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

      // Mock the database queries
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce(mockEvents);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 2 });
      }

      const response = await app.request('/api/patches/logs');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.events).toHaveLength(2);
      expect(data.events[0].id).toBe('event-1');
      expect(data.events[0].isSuccess).toBe(false);
      expect(data.events[1].isSuccess).toBe(true);
      expect(data.pagination.total).toBe(2);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
    });

    it('should apply task ID filter', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?taskId=patch-123');

      expect(response.status).toBe(200);
      expect(mockDb?.where).toHaveBeenCalledWith('patchId', '=', 'patch-123');
    });

    it('should apply event type filter', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?eventType=PATCH_PROCESSING_COMPLETED');

      expect(response.status).toBe(200);
      expect(mockDb?.where).toHaveBeenCalledWith('eventType', '=', 'PATCH_PROCESSING_COMPLETED');
    });

    it('should apply status filter', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?status=success');

      expect(response.status).toBe(200);
      expect(mockDb?.where).toHaveBeenCalledWith('status', '=', 'success');
    });

    it('should apply file search filter', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?file=component.ts');

      expect(response.status).toBe(200);
      expect(mockDb?.where).toHaveBeenCalledWith('metadata', 'like', '%component.ts%');
    });

    it('should apply search filter across multiple fields', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?search=processing');

      expect(response.status).toBe(200);
      // Verify the complex OR condition was applied
      expect(mockDb?.where).toHaveBeenCalled();
    });

    it('should apply date range filters', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-02T00:00:00Z';

      const response = await app.request(`/api/patches/logs?startDate=${startDate}&endDate=${endDate}`);

      expect(response.status).toBe(200);
      expect(mockDb?.where).toHaveBeenCalledWith('createdAt', '>=', startDate);
      expect(mockDb?.where).toHaveBeenCalledWith('createdAt', '<=', endDate);
    });

    it('should apply pagination correctly', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?limit=10&offset=20&order=asc');

      expect(response.status).toBe(200);
      expect(mockDb?.limit).toHaveBeenCalledWith(10);
      expect(mockDb?.offset).toHaveBeenCalledWith(20);
      expect(mockDb?.orderBy).toHaveBeenCalledWith('createdAt', 'asc');
    });

    it('should enforce maximum limit', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
        mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
      }

      const response = await app.request('/api/patches/logs?limit=500');

      expect(response.status).toBe(200);
      expect(mockDb?.limit).toHaveBeenCalledWith(100); // Should be capped at 100
    });

    it('should handle database errors gracefully', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockRejectedValueOnce(new Error('Database connection failed'));
      }

      const response = await app.request('/api/patches/logs');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch patch logs');
    });

    it('should handle invalid query parameters', async () => {
      const response = await app.request('/api/patches/logs?limit=invalid&offset=-1');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
      expect(data.details).toBeDefined();
    });
  });

  describe('GET /api/patches/logs/summary', () => {
    it('should return event summary with default 24h timeframe', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        // Mock event type counts
        mockDb.execute.mockResolvedValueOnce([
          { eventType: 'PATCH_PROCESSING_STARTED', count: 10 },
          { eventType: 'PATCH_PROCESSING_COMPLETED', count: 8 }
        ]);
        // Mock status counts
        mockDb.execute.mockResolvedValueOnce([
          { status: 'success', count: 8 },
          { status: 'error', count: 2 }
        ]);
        // Mock total count
        mockDb.executeTakeFirst.mockResolvedValueOnce({ total: 10 });
      }

      const response = await app.request('/api/patches/logs/summary');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.timeframe).toBe('24h');
      expect(data.total).toBe(10);
      expect(data.successRate).toBe(80);
      expect(data.eventTypes.PATCH_PROCESSING_STARTED).toBe(10);
      expect(data.statuses.success).toBe(8);
      expect(data.generatedAt).toBeDefined();
    });

    it('should support custom timeframe', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValue([]);
        mockDb.executeTakeFirst.mockResolvedValue({ total: 0 });
      }

      const response = await app.request('/api/patches/logs/summary?hours=1');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.timeframe).toBe('1h');
    });

    it('should handle empty results', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValue([]);
        mockDb.executeTakeFirst.mockResolvedValue({ total: 0 });
      }

      const response = await app.request('/api/patches/logs/summary');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(0);
      expect(data.successRate).toBe(0);
      expect(Object.keys(data.eventTypes)).toHaveLength(0);
    });
  });

  describe('GET /api/patches/logs/:patchId', () => {
    it('should return events for a specific patch ID', async () => {
      const patchId = 'patch-123';
      const mockEvents = [
        {
          id: 'event-1',
          patchId,
          eventType: 'PATCH_PROCESSING_STARTED',
          status: 'in_progress',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: JSON.stringify({ operationCount: 3 })
        },
        {
          id: 'event-2',
          patchId,
          eventType: 'PATCH_PROCESSING_COMPLETED',
          status: 'success',
          createdAt: '2024-01-01T00:01:00Z',
          metadata: null
        }
      ];

      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce(mockEvents);
      }

      const response = await app.request(`/api/patches/logs/${patchId}`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.patchId).toBe(patchId);
      expect(data.totalEvents).toBe(2);
      expect(data.finalStatus).toBe('success');
      expect(data.successRate).toBe(50); // 1 success out of 2 events
      expect(data.eventsByType.PATCH_PROCESSING_STARTED).toHaveLength(1);
      expect(data.eventsByType.PATCH_PROCESSING_COMPLETED).toHaveLength(1);
      expect(data.timeline.duration).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent patch ID', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockResolvedValueOnce([]);
      }

      const response = await app.request('/api/patches/logs/non-existent-patch');

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('No events found for patch');
    });

    it('should handle database errors', async () => {
      const mockDb = app.env?.DB_OPS;
      if (mockDb) {
        mockDb.execute.mockRejectedValueOnce(new Error('Database error'));
      }

      const response = await app.request('/api/patches/logs/patch-123');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch patch events');
    });
  });
});
