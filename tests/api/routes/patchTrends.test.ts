import { setupPatchTrendsRoutes } from '../../../../orchestrator/worker/api/routes/patchTrends';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Patch Trends Routes', () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono();

    // Create mock database
    const mockDb = {
      executeQuery: vi.fn(),
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      fn: {
        count: vi.fn().mockReturnValue('count')
      }
    };

    // Mock environment
    const mockEnv = {
      DB_OPS: mockDb
    };

    setupPatchTrendsRoutes(app);
  });

  describe('GET /api/patches/trends', () => {
    it('should return events trend analysis', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock database to return some events
      mockDb.execute.mockResolvedValue([
        { count: 5 },
        { count: 3 },
        { count: 8 }
      ]);

      const response = await app.request('/api/patches/trends?metric=events&timeframe=1h&interval=15m');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.metric).toBe('events');
      expect(data.timeframe).toBe('1h');
      expect(data.interval).toBe('15m');
      expect(data.dataPoints).toBeDefined();
      expect(data.trend).toBeDefined();
      expect(data.metadata).toBeDefined();
    });

    it('should return success rate trend analysis', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock total and success counts
      mockDb.executeTakeFirst
        .mockResolvedValueOnce({ count: 10 }) // total
        .mockResolvedValueOnce({ count: 8 }); // success

      const response = await app.request('/api/patches/trends?metric=success_rate');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.metric).toBe('success_rate');
      expect(data.dataPoints).toBeDefined();
      expect(data.trend.average).toBeDefined();
    });

    it('should apply event type filters', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.execute.mockResolvedValue([{ count: 5 }]);

      const response = await app.request('/api/patches/trends?metric=events&eventTypes=PATCH_PROCESSING_STARTED,PATCH_PROCESSING_COMPLETED');

      expect(response.status).toBe(200);
      expect(mockDb.where).toHaveBeenCalledWith('eventType', 'in', ['PATCH_PROCESSING_STARTED', 'PATCH_PROCESSING_COMPLETED']);
    });

    it('should apply patch ID filters', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.execute.mockResolvedValue([{ count: 3 }]);

      const response = await app.request('/api/patches/trends?metric=events&patchIds=patch-1,patch-2');

      expect(response.status).toBe(200);
      expect(mockDb.where).toHaveBeenCalledWith('patchId', 'in', ['patch-1', 'patch-2']);
    });

    it('should include trend comparison when requested', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.execute.mockResolvedValue([{ count: 10 }]);

      const response = await app.request('/api/patches/trends?metric=events&compare=previous');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.comparison).toBeDefined();
      expect(data.comparison.previous).toBeDefined();
      expect(data.comparison.change).toBeDefined();
    });

    it('should handle performance metric', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock performance query result
      mockDb.executeQuery.mockResolvedValue({
        rows: [{
          avgExecutionTime: 1500,
          minExecutionTime: 500,
          maxExecutionTime: 3000,
          totalEvents: 10
        }]
      });

      const response = await app.request('/api/patches/trends?metric=performance');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.metric).toBe('performance');
      expect(data.dataPoints).toBeDefined();
    });

    it('should handle throughput metric', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.execute.mockResolvedValue([{ count: 12 }]); // 12 events per hour = 0.2 events per minute

      const response = await app.request('/api/patches/trends?metric=throughput&interval=1h');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.metric).toBe('throughput');
      // Should convert hourly events to events per minute
      expect(data.dataPoints[0].value).toBe(0.2);
    });

    it('should reject unsupported metrics', async () => {
      const response = await app.request('/api/patches/trends?metric=unsupported');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Unsupported metric');
    });

    it('should validate query parameters', async () => {
      const response = await app.request('/api/patches/trends?metric=invalid_metric');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
    });
  });

  describe('GET /api/patches/trends/compare', () => {
    it('should compare trends between two periods', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock data for both periods
      mockDb.execute.mockResolvedValue([{ count: 10 }, { count: 15 }]);

      const response = await app.request('/api/patches/trends/compare?metric=events&period1=24h&period2=7d');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.comparison.period1.range).toBe('24h');
      expect(data.comparison.period2.range).toBe('7d');
      expect(data.comparison.difference).toBeDefined();
      expect(data.metric).toBe('events');
    });

    it('should reject unsupported metrics for comparison', async () => {
      const response = await app.request('/api/patches/trends/compare?metric=unsupported');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Unsupported metric for comparison');
    });
  });

  describe('GET /api/patches/trends/anomalies', () => {
    it('should detect anomalies in trend data', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock data with clear anomalies (values far from mean)
      mockDb.execute.mockResolvedValue([
        { count: 10 }, // normal
        { count: 12 }, // normal
        { count: 50 }, // anomaly (high)
        { count: 11 }, // normal
        { count: 2 }   // anomaly (low)
      ]);

      const response = await app.request('/api/patches/trends/anomalies?metric=events&threshold=2.0');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.metric).toBe('events');
      expect(data.anomalies).toBeDefined();
      expect(data.anomalies.length).toBeGreaterThan(0);
      expect(data.summary.anomalousDataPoints).toBe(data.anomalies.length);
      expect(data.summary.anomalyRate).toBeDefined();
    });

    it('should handle no anomalies in data', async () => {
      const mockDb = app.env?.DB_OPS;

      // Mock data with no anomalies (all similar values)
      mockDb.execute.mockResolvedValue([
        { count: 10 },
        { count: 11 },
        { count: 10 },
        { count: 12 },
        { count: 11 }
      ]);

      const response = await app.request('/api/patches/trends/anomalies?metric=events');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.anomalies).toHaveLength(0);
      expect(data.summary.anomalyRate).toBe(0);
    });

    it('should handle insufficient data for anomaly detection', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.execute.mockResolvedValue([{ count: 10 }]); // Only one data point

      const response = await app.request('/api/patches/trends/anomalies?metric=events');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.anomalies).toHaveLength(0);
    });
  });

  describe('Trend Analysis', () => {
    it('should analyze increasing trend', () => {
      const dataPoints = [
        { timestamp: '2024-01-01T00:00:00Z', value: 10 },
        { timestamp: '2024-01-01T01:00:00Z', value: 15 },
        { timestamp: '2024-01-01T02:00:00Z', value: 20 }
      ];

      // Import the analyzeTrend function for testing
      const { analyzeTrend } = require('../../../../orchestrator/worker/api/routes/patchTrends');
      const analysis = analyzeTrend(dataPoints);

      expect(analysis.direction).toBe('increasing');
      expect(analysis.slope).toBeGreaterThan(0);
      expect(analysis.average).toBe(15);
      expect(analysis.changePercent).toBeGreaterThan(0);
    });

    it('should analyze stable trend', () => {
      const dataPoints = [
        { timestamp: '2024-01-01T00:00:00Z', value: 10 },
        { timestamp: '2024-01-01T01:00:00Z', value: 11 },
        { timestamp: '2024-01-01T02:00:00Z', value: 10 }
      ];

      const { analyzeTrend } = require('../../../../orchestrator/worker/api/routes/patchTrends');
      const analysis = analyzeTrend(dataPoints);

      expect(analysis.direction).toBe('stable');
      expect(Math.abs(analysis.slope)).toBeLessThan(0.1);
      expect(analysis.average).toBeCloseTo(10.33, 1);
    });

    it('should analyze volatile trend', () => {
      const dataPoints = [
        { timestamp: '2024-01-01T00:00:00Z', value: 10 },
        { timestamp: '2024-01-01T01:00:00Z', value: 50 },
        { timestamp: '2024-01-01T02:00:00Z', value: 5 }
      ];

      const { analyzeTrend } = require('../../../../orchestrator/worker/api/routes/patchTrends');
      const analysis = analyzeTrend(dataPoints);

      expect(analysis.direction).toBe('volatile');
      expect(analysis.volatility).toBeGreaterThan(analysis.average * 0.5);
    });

    it('should handle empty data points', () => {
      const { analyzeTrend } = require('../../../../orchestrator/worker/api/routes/patchTrends');
      const analysis = analyzeTrend([]);

      expect(analysis.direction).toBe('stable');
      expect(analysis.average).toBe(0);
      expect(analysis.slope).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockDb = app.env?.DB_OPS;
      mockDb.execute.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await app.request('/api/patches/trends?metric=events');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch trend analysis');
    });

    it('should handle invalid query parameters', async () => {
      const response = await app.request('/api/patches/trends?metric=events&timeframe=invalid');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
    });
  });
});
