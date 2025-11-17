/**
 * Unit tests for Core Analytics Routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { setupCoreAnalyticsRoutes } from '../../../orchestrator/worker/api/routes/coreAnalyticsRoutes'

// Mock auth middleware
vi.mock('../../../orchestrator/worker/middleware/auth/routeAuth', () => ({
  AuthConfig: {
    authenticated: 'authenticated',
    ownerOnly: 'ownerOnly'
  },
  setAuthLevel: vi.fn(() => async (c: any, next: any) => {
    c.set('authLevel', 'authenticated');
    await next();
  }),
  enforceAuthRequirement: vi.fn(async (c: any) => {
    // Check for the special test auth header
    const hasTestAuth = c.req?.header?.('X-Test-Auth') ||
                       c.req?.raw?.headers?.get?.('X-Test-Auth');

    if (!hasTestAuth) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        message: 'No session found'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return null; // Auth successful
  })
}))

// Mock types
vi.mock('../../../orchestrator/worker/types/appenv', () => ({
  AppEnv: {}
}))

// Mock shared contracts
vi.mock('@shared/contracts', () => ({
  PatchEvent: {}
}))

// Mock the database
const mockDb = {
  selectFrom: vi.fn(() => mockDb),
  select: vi.fn(() => mockDb),
  selectAll: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  limit: vi.fn(() => mockDb),
  offset: vi.fn(() => mockDb),
  groupBy: vi.fn(() => mockDb),
  dateTrunc: vi.fn(() => mockDb),
  fn: {
    count: vi.fn(() => 'count'),
    avg: vi.fn(() => 'avg'),
    dateTrunc: vi.fn(() => mockDb),
    case: vi.fn(() => mockDb),
    when: vi.fn(() => mockDb),
    then: vi.fn(() => mockDb),
    end: vi.fn(() => 'end')
  },
  execute: vi.fn().mockResolvedValue([]),
  executeTakeFirst: vi.fn().mockResolvedValue(null)
}

// Mock environment
const mockEnv = {
  DB_OPS: mockDb
}

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
  }
})

describe('Core Analytics Routes', () => {
  let app: Hono<any>

  beforeEach(() => {
    app = new Hono()
    setupCoreAnalyticsRoutes(app)
    vi.clearAllMocks()
  })

  const createRequest = (method: string, path: string, options: RequestInit = {}) => {
    // Add a special header to indicate auth should succeed for tests that provide Authorization
    const enhancedOptions = { ...options };
    if (options.headers && 'Authorization' in options.headers) {
      enhancedOptions.headers = {
        ...options.headers,
        'X-Test-Auth': 'true'
      };
    }

    return app.request(path, {
      method,
      ...enhancedOptions
    }, mockEnv)
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/analytics/logs', () => {
    it('should return paginated logs with default parameters', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          patchId: 'patch-123',
          eventType: 'PATCH_APPLIED',
          status: 'success',
          createdAt: new Date(),
          metadata: { test: 'data' }
        }
      ]

      mockDb.execute.mockResolvedValueOnce(mockEvents)
      mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 1 })

      const res = await createRequest('GET', '/api/analytics/logs', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.events).toHaveLength(1)
      expect(data.total).toBe(1)
      expect(data.limit).toBe(50)
      expect(data.offset).toBe(0)
      expect(mockDb.selectFrom).toHaveBeenCalledWith('patchEvents')
    })

    it('should apply filters correctly', async () => {
      mockDb.execute.mockResolvedValueOnce([])
      mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 })

      const res = await createRequest('GET', '/api/analytics/logs?eventType=PATCH_APPLIED&patchId=patch-123&status=success', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      expect(mockDb.where).toHaveBeenCalledWith('eventType', '=', 'PATCH_APPLIED')
      expect(mockDb.where).toHaveBeenCalledWith('patchId', '=', 'patch-123')
      expect(mockDb.where).toHaveBeenCalledWith('status', '=', 'success')
    })

    it('should handle date range filtering', async () => {
      mockDb.execute.mockResolvedValueOnce([])
      mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 })

      const startDate = '2024-01-01T00:00:00Z'
      const endDate = '2024-01-02T00:00:00Z'

      const res = await createRequest('GET', `/api/analytics/logs?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      expect(mockDb.where).toHaveBeenCalledWith('createdAt', '>=', new Date(startDate))
      expect(mockDb.where).toHaveBeenCalledWith('createdAt', '<=', new Date(endDate))
    })

    it('should apply pagination correctly', async () => {
      mockDb.execute.mockResolvedValueOnce([])
      mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 })

      const res = await createRequest('GET', '/api/analytics/logs?limit=25&offset=50', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      expect(mockDb.limit).toHaveBeenCalledWith(25)
      expect(mockDb.offset).toHaveBeenCalledWith(50)
    })

    it('should enforce maximum limit', async () => {
      mockDb.execute.mockResolvedValueOnce([])
      mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 })

      const res = await createRequest('GET', '/api/analytics/logs?limit=500', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      expect(mockDb.limit).toHaveBeenCalledWith(200) // Should be capped at 200
    })

    it('should handle database errors', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('Database error'))

      const res = await createRequest('GET', '/api/analytics/logs', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to query logs')
    })
  })

  describe('GET /api/analytics/stats', () => {
    it('should return aggregated statistics', async () => {
      // Mock stats query
      mockDb.select.mockReturnValueOnce({
        executeTakeFirst: vi.fn().mockResolvedValue({
          total: 100,
          successful: 85,
          avgDuration: 150.5
        })
      })

      // Mock breakdown query
      mockDb.select.mockReturnValueOnce({
        groupBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([
          { eventType: 'PATCH_APPLIED', count: 50 },
          { eventType: 'PATCH_FAILED', count: 15 }
        ])
      })

      // Mock top patches query
      mockDb.select.mockReturnValueOnce({
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([
          { patchId: 'patch-1', count: 10 },
          { patchId: 'patch-2', count: 8 }
        ])
      })

      const res = await createRequest('GET', '/api/analytics/stats', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.totalEvents).toBe(100)
      expect(data.successRate).toBe(85)
      expect(data.breakdown.eventType).toEqual({
        'PATCH_APPLIED': 50,
        'PATCH_FAILED': 15
      })
      expect(data.topPatchIds).toEqual([
        { patchId: 'patch-1', count: 10 },
        { patchId: 'patch-2', count: 8 }
      ])
    })

    it('should handle different timeframes', async () => {
      mockDb.select.mockReturnValue({
        executeTakeFirst: vi.fn().mockResolvedValue({ total: 0, successful: 0, avgDuration: 0 }),
        groupBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis()
      })

      const res = await createRequest('GET', '/api/analytics/stats?timeframe=7d', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      // Should filter events from 7 days ago
    })

    it('should apply event type filters', async () => {
      mockDb.select.mockReturnValue({
        executeTakeFirst: vi.fn().mockResolvedValue({ total: 0, successful: 0, avgDuration: 0 }),
        groupBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis()
      })

      const res = await createRequest('GET', '/api/analytics/stats?eventTypes=PATCH_APPLIED,PATCH_FAILED', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      expect(mockDb.where).toHaveBeenCalledWith('eventType', 'in', ['PATCH_APPLIED', 'PATCH_FAILED'])
    })

    it('should handle different grouping options', async () => {
      mockDb.select.mockReturnValueOnce({
        executeTakeFirst: vi.fn().mockResolvedValue({ total: 0, successful: 0, avgDuration: 0 })
      })

      mockDb.select.mockReturnValueOnce({
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([
          { hour: '2024-01-01T10:00:00Z', count: 5 },
          { hour: '2024-01-01T11:00:00Z', count: 3 }
        ])
      })

      mockDb.select.mockReturnValueOnce({
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([])
      })

      const res = await createRequest('GET', '/api/analytics/stats?groupBy=hour', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.breakdown.hourly).toBeDefined()
    })
  })

  describe('GET /api/analytics/trends', () => {
    it('should require metric parameter', async () => {
      const res = await createRequest('GET', '/api/analytics/trends', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Metric parameter is required')
    })

    it('should analyze events metric over time', async () => {
      // Mock queries to return sample data
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 5 })
      })

      const res = await createRequest('GET', '/api/analytics/trends?metric=events&timeframe=1h&interval=15m', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.metric).toBe('events')
      expect(data.timeframe).toBe('1h')
      expect(data.interval).toBe('15m')
      expect(data.dataPoints).toBeDefined()
      expect(data.summary).toBeDefined()
    })

    it('should analyze success rate trends', async () => {
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ total: 10, successful: 8 })
      })

      const res = await createRequest('GET', '/api/analytics/trends?metric=success_rate', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.metric).toBe('success_rate')
    })

    it('should handle different intervals', async () => {
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 3 })
      })

      const res = await createRequest('GET', '/api/analytics/trends?metric=events&interval=1d', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.interval).toBe('1d')
    })

    it('should calculate trend direction', async () => {
      // Mock increasing trend
      let callCount = 0
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockImplementation(() => {
          callCount++
          // Return increasing counts
          return Promise.resolve({ count: callCount * 2 })
        })
      })

      const res = await createRequest('GET', '/api/analytics/trends?metric=events&timeframe=1h&interval=15m', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.summary.trend).toBeDefined()
    })

    it('should apply event type and patch ID filters', async () => {
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 1 })
      })

      const res = await createRequest('GET', '/api/analytics/trends?metric=events&eventTypes=PATCH_APPLIED&patchIds=patch-1,patch-2', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(200)
      expect(mockDb.where).toHaveBeenCalledWith('eventType', 'in', ['PATCH_APPLIED'])
      expect(mockDb.where).toHaveBeenCalledWith('patchId', 'in', ['patch-1', 'patch-2'])
    })

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error'))
      })

      const res = await createRequest('GET', '/api/analytics/trends?metric=events', {
        headers: { Authorization: 'Bearer test-token' }
      })

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to analyze trends')
    })
  })

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        '/api/analytics/logs',
        '/api/analytics/stats',
        '/api/analytics/trends?metric=events'
      ]

      for (const endpoint of endpoints) {
        const res = await createRequest('GET', endpoint)
        // Should return 401 or similar auth error
        expect([401, 403, 500]).toContain(res.status)
      }
    })
  })
})
