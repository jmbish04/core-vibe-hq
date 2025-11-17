import { setupPatchStatsRoutes } from '../../../../orchestrator/worker/api/routes/patchStats';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Patch Stats Routes', () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono();

    // Create mock database
    const mockDb = {
      executeQuery: vi.fn()
    };

    // Mock environment
    const mockEnv = {
      DB_OPS: mockDb
    };

    setupPatchStatsRoutes(app);
  });

  describe('GET /api/patches/stats', () => {
    it('should return comprehensive patch statistics', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock total events query
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{ total: 100 }]
      });

      // Mock success/failure breakdown
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [
          { status: 'success', count: 80 },
          { status: 'error', count: 20 }
        ]
      });

      // Mock events by type
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [
          { eventType: 'PATCH_PROCESSING_COMPLETED', count: 60 },
          { eventType: 'PATCH_PROCESSING_STARTED', count: 40 }
        ]
      });

      // Mock top patches
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [
          { patchId: 'patch-1', eventCount: 15 },
          { patchId: 'patch-2', eventCount: 12 }
        ]
      });

      // Mock daily stats
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', total: 50, successful: 40, failed: 10 }
        ]
      });

      const response = await app.request('/api/patches/stats');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.summary.totalEvents).toBe(100);
      expect(data.summary.successfulEvents).toBe(80);
      expect(data.summary.failedEvents).toBe(20);
      expect(data.summary.successRate).toBe(80);
      expect(data.breakdown.byEventType.PATCH_PROCESSING_COMPLETED).toBe(60);
      expect(data.breakdown.topPatches).toHaveLength(2);
      expect(data.breakdown.dailyStats).toHaveLength(1);
    });

    it('should apply date range filters', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock all queries to return empty results
      mockDb.executeQuery.mockResolvedValue({ rows: [] });

      const response = await app.request('/api/patches/stats?from=2024-01-01&to=2024-01-31');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.summary.dateRange.from).toBe('2024-01-01');
      expect(data.summary.dateRange.to).toBe('2024-01-31');
    });

    it('should exclude error details when includeErrors=false', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock basic queries
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ total: 10 }] });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });

      const response = await app.request('/api/patches/stats?includeErrors=false');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.errors).toBeNull();
    });

    it('should include error details when includeErrors=true', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock basic queries
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ total: 10 }] });
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{ status: 'error', count: 2 }]
      });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });
      mockDb.executeQuery.mockResolvedValueOnce({ rows: [] });

      // Mock error details query
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{
          eventType: 'PATCH_PROCESSING_FAILED',
          status: 'error',
          metadata: JSON.stringify({ error: 'Network timeout' }),
          count: 2
        }]
      });

      const response = await app.request('/api/patches/stats?includeErrors=true');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0].error).toBe('Network timeout');
    });

    it('should handle empty results gracefully', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock all queries to return empty results
      mockDb.executeQuery.mockResolvedValue({ rows: [] });

      const response = await app.request('/api/patches/stats');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.summary.totalEvents).toBe(0);
      expect(data.summary.successRate).toBe(0);
      expect(data.breakdown.topPatches).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await app.request('/api/patches/stats');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch patch statistics');
    });

    it('should validate query parameters', async () => {
      const response = await app.request('/api/patches/stats?groupBy=invalid');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
    });
  });

  describe('GET /api/patches/stats/performance', () => {
    it('should return performance metrics', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock performance query
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{
          eventType: 'PATCH_PROCESSING_COMPLETED',
          avgExecutionTime: 1500,
          minExecutionTime: 500,
          maxExecutionTime: 3000,
          totalEvents: 10
        }]
      });

      // Mock throughput query
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [
          { hour: '2024-01-01 10:00', eventsPerHour: 5 },
          { hour: '2024-01-01 11:00', eventsPerHour: 8 }
        ]
      });

      const response = await app.request('/api/patches/stats/performance');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.timeframe).toBe('7 days');
      expect(data.overall.avgExecutionTime).toBe(1500);
      expect(data.byEventType).toHaveLength(1);
      expect(data.throughput.hourly).toHaveLength(2);
      expect(data.throughput.peakHour.eventsPerHour).toBe(8);
    });

    it('should support custom timeframe', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockResolvedValue({ rows: [] });

      const response = await app.request('/api/patches/stats/performance?days=30');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.timeframe).toBe('30 days');
    });

    it('should handle no performance data', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockResolvedValue({ rows: [] });

      const response = await app.request('/api/patches/stats/performance');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.overall.avgExecutionTime).toBe(0);
      expect(data.byEventType).toHaveLength(0);
      expect(data.throughput.hourly).toHaveLength(0);
    });
  });

  describe('GET /api/patches/stats/errors', () => {
    it('should return error analysis', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock error patterns
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{
          eventType: 'PATCH_PROCESSING_FAILED',
          error: 'Connection timeout',
          count: 5,
          lastOccurred: '2024-01-01T10:00:00Z'
        }]
      });

      // Mock recent errors
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{
          id: 'event-1',
          patchId: 'patch-123',
          eventType: 'PATCH_PROCESSING_FAILED',
          createdAt: '2024-01-01T10:00:00Z',
          error: 'Connection timeout'
        }]
      });

      // Mock error trends
      mockDb.executeQuery.mockResolvedValueOnce({
        rows: [{
          date: '2024-01-01',
          total: 10,
          errors: 2
        }]
      });

      const response = await app.request('/api/patches/stats/errors');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.summary.totalErrorPatterns).toBe(1);
      expect(data.summary.mostCommonError).toBe('Connection timeout');
      expect(data.patterns).toHaveLength(1);
      expect(data.recent).toHaveLength(1);
      expect(data.trends).toHaveLength(1);
      expect(data.trends[0].errorRate).toBe(20);
    });

    it('should respect limit parameter', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockResolvedValue({ rows: [] });

      const response = await app.request('/api/patches/stats/errors?limit=25');

      expect(response.status).toBe(200);
      // Verify the limit parameter was passed to the query
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: [25]
        })
      );
    });

    it('should handle no errors gracefully', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockResolvedValue({ rows: [] });

      const response = await app.request('/api/patches/stats/errors');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.summary.totalErrorPatterns).toBe(0);
      expect(data.summary.mostCommonError).toBeNull();
      expect(data.patterns).toHaveLength(0);
    });

    it('should handle database errors in error stats', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockRejectedValueOnce(new Error('Query failed'));

      const response = await app.request('/api/patches/stats/errors');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch error statistics');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid query parameters', async () => {
      const response = await app.request('/api/patches/stats?from=invalid-date');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should handle unexpected errors gracefully', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.executeQuery.mockRejectedValueOnce('Unexpected error');

      const response = await app.request('/api/patches/stats');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch patch statistics');
      expect(data.message).toBe('Unexpected error');
    });
  });
});
