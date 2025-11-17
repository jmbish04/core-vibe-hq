/**
 * Core Analytics API Routes
 *
 * Unified router for comprehensive analytics including logs, stats, and trends.
 * Provides REST endpoints for querying patch events, aggregating metrics,
 * and analyzing trends across the VibeHQ system.
 */

import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';
import { PatchEvent } from '@shared/contracts';

/**
 * Query parameters for logs endpoint
 */
interface LogsQueryParams {
  limit?: string;
  offset?: string;
  eventType?: string;
  patchId?: string;
  status?: 'success' | 'failure';
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'eventType' | 'patchId';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Query parameters for stats endpoint
 */
interface StatsQueryParams {
  timeframe?: '1h' | '24h' | '7d' | '30d' | '90d';
  eventTypes?: string;
  patchIds?: string;
  groupBy?: 'eventType' | 'status' | 'hour' | 'day';
}

/**
 * Query parameters for trends endpoint
 */
interface TrendsQueryParams {
  metric: 'events' | 'success_rate' | 'avg_duration' | 'error_rate';
  timeframe?: '1h' | '24h' | '7d' | '30d' | '90d';
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  eventTypes?: string;
  patchIds?: string;
}

/**
 * Logs query response
 */
interface LogsResponse {
  events: PatchEvent[];
  total: number;
  limit: number;
  offset: number;
  query: LogsQueryParams;
}

/**
 * Stats aggregation response
 */
interface StatsResponse {
  timeframe: string;
  totalEvents: number;
  successRate: number;
  avgDuration: number;
  errorRate: number;
  breakdown: {
    eventType: Record<string, number>;
    status: Record<string, number>;
    hourly?: Record<string, number>;
    daily?: Record<string, number>;
  };
  topPatchIds: Array<{ patchId: string; count: number }>;
  query: StatsQueryParams;
}

/**
 * Trends analysis response
 */
interface TrendsResponse {
  metric: string;
  timeframe: string;
  interval: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
    change?: number;
    changePercent?: number;
  }>;
  summary: {
    total: number;
    average: number;
    min: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  };
  query: TrendsQueryParams;
}

/**
 * Setup core analytics routes
 */
export function setupCoreAnalyticsRoutes(app: Hono<AppEnv>): void {
  /**
     * GET /api/analytics/logs
     *
     * Query patch event logs with advanced filtering and pagination.
     *
     * Query parameters:
     * - limit: number (default: 50, max: 200)
     * - offset: number (default: 0)
     * - eventType: string (PATCH_APPLIED, PATCH_FAILED, etc.)
     * - patchId: string (specific patch ID)
     * - status: 'success' | 'failure'
     * - startDate: ISO date string
     * - endDate: ISO date string
     * - sortBy: 'createdAt' | 'eventType' | 'patchId' (default: createdAt)
     * - sortOrder: 'asc' | 'desc' (default: desc)
     */
  app.get('/api/analytics/logs', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const query: LogsQueryParams = {
        limit: c.req.query('limit') || '50',
        offset: c.req.query('offset') || '0',
        eventType: c.req.query('eventType'),
        patchId: c.req.query('patchId'),
        status: c.req.query('status') as 'success' | 'failure',
        startDate: c.req.query('startDate'),
        endDate: c.req.query('endDate'),
        sortBy: (c.req.query('sortBy') as 'createdAt' | 'eventType' | 'patchId') || 'createdAt',
        sortOrder: (c.req.query('sortOrder') as 'asc' | 'desc') || 'desc',
      };

      const limit = Math.min(parseInt(query.limit!), 200);
      const offset = Math.max(parseInt(query.offset!), 0);

      // Build database query
      let dbQuery = c.env.DB_OPS
        .selectFrom('patchEvents')
        .selectAll();

      // Apply filters
      if (query.eventType) {
        dbQuery = dbQuery.where('eventType', '=', query.eventType);
      }
      if (query.patchId) {
        dbQuery = dbQuery.where('patchId', '=', query.patchId);
      }
      if (query.status) {
        dbQuery = dbQuery.where('status', '=', query.status);
      }
      if (query.startDate) {
        dbQuery = dbQuery.where('createdAt', '>=', new Date(query.startDate));
      }
      if (query.endDate) {
        dbQuery = dbQuery.where('createdAt', '<=', new Date(query.endDate));
      }

      // Apply sorting
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      dbQuery = dbQuery.orderBy(query.sortBy!, sortOrder as any);

      // Apply pagination
      dbQuery = dbQuery.limit(limit).offset(offset);

      // Get total count for pagination
      const totalQuery = c.env.DB_OPS
        .selectFrom('patchEvents')
        .select((eb) => eb.fn.count('id').as('count'));

      // Apply same filters to count query
      if (query.eventType) {
        totalQuery.where('eventType', '=', query.eventType);
      }
      if (query.patchId) {
        totalQuery.where('patchId', '=', query.patchId);
      }
      if (query.status) {
        totalQuery.where('status', '=', query.status);
      }
      if (query.startDate) {
        totalQuery.where('createdAt', '>=', new Date(query.startDate));
      }
      if (query.endDate) {
        totalQuery.where('createdAt', '<=', new Date(query.endDate));
      }

      const [events, totalResult] = await Promise.all([
        dbQuery.execute(),
        totalQuery.executeTakeFirst(),
      ]);

      const response: LogsResponse = {
        events: events.map(event => ({
          id: event.id,
          patchId: event.patchId,
          eventType: event.eventType,
          status: event.status,
          createdAt: event.createdAt,
          metadata: event.metadata,
        })),
        total: Number(totalResult?.count || 0),
        limit,
        offset,
        query,
      };

      return c.json(response);
    } catch (error) {
      console.error('Failed to query analytics logs:', error);
      return c.json({ error: 'Failed to query logs' }, 500);
    }
  });

  /**
     * GET /api/analytics/stats
     *
     * Get aggregated statistics for patch events.
     *
     * Query parameters:
     * - timeframe: '1h' | '24h' | '7d' | '30d' | '90d' (default: 24h)
     * - eventTypes: comma-separated list of event types
     * - patchIds: comma-separated list of patch IDs
     * - groupBy: 'eventType' | 'status' | 'hour' | 'day' (default: eventType)
     */
  app.get('/api/analytics/stats', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const query: StatsQueryParams = {
        timeframe: (c.req.query('timeframe') as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
        eventTypes: c.req.query('eventTypes'),
        patchIds: c.req.query('patchIds'),
        groupBy: (c.req.query('groupBy') as 'eventType' | 'status' | 'hour' | 'day') || 'eventType',
      };

      // Calculate date range
      const now = new Date();
      const startDate = new Date(now);

      switch (query.timeframe) {
        case '1h':
          startDate.setHours(now.getHours() - 1);
          break;
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      // Build base query
      let baseQuery = c.env.DB_OPS
        .selectFrom('patchEvents')
        .where('createdAt', '>=', startDate);

      // Apply filters
      if (query.eventTypes) {
        const eventTypes = query.eventTypes.split(',');
        baseQuery = baseQuery.where('eventType', 'in', eventTypes);
      }
      if (query.patchIds) {
        const patchIds = query.patchIds.split(',');
        baseQuery = baseQuery.where('patchId', 'in', patchIds);
      }

      // Get total events and basic stats
      const statsQuery = baseQuery
        .select([
          (eb) => eb.fn.count('id').as('total'),
          (eb) => eb.fn.count(eb.case().when('status', '=', 'success').then(1).end()).as('successful'),
          (eb) => eb.fn.avg(eb.case().when('metadata->duration').isNotNull().then('metadata->duration').end()).as('avgDuration'),
        ])
        .executeTakeFirst();

      // Get breakdown by groupBy
      let breakdownQuery;
      switch (query.groupBy) {
        case 'eventType':
          breakdownQuery = baseQuery
            .select(['eventType', (eb) => eb.fn.count('id').as('count')])
            .groupBy('eventType')
            .execute();
          break;
        case 'status':
          breakdownQuery = baseQuery
            .select(['status', (eb) => eb.fn.count('id').as('count')])
            .groupBy('status')
            .execute();
          break;
        case 'hour':
          breakdownQuery = baseQuery
            .select([
              (eb) => eb.fn.dateTrunc('hour', 'createdAt').as('hour'),
              (eb) => eb.fn.count('id').as('count'),
            ])
            .groupBy((eb) => eb.fn.dateTrunc('hour', 'createdAt'))
            .orderBy('hour')
            .execute();
          break;
        case 'day':
          breakdownQuery = baseQuery
            .select([
              (eb) => eb.fn.dateTrunc('day', 'createdAt').as('day'),
              (eb) => eb.fn.count('id').as('count'),
            ])
            .groupBy((eb) => eb.fn.dateTrunc('day', 'createdAt'))
            .orderBy('day')
            .execute();
          break;
      }

      // Get top patch IDs
      const topPatchesQuery = baseQuery
        .select(['patchId', (eb) => eb.fn.count('id').as('count')])
        .groupBy('patchId')
        .orderBy('count', 'desc')
        .limit(10)
        .execute();

      const [stats, breakdown, topPatches] = await Promise.all([
        statsQuery,
        breakdownQuery,
        topPatchesQuery,
      ]);

      const totalEvents = Number(stats?.total || 0);
      const successfulEvents = Number(stats?.successful || 0);
      const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;
      const avgDuration = Number(stats?.avgDuration || 0);

      // Build breakdown object
      const breakdownObj: any = { eventType: {}, status: {} };
      for (const item of breakdown) {
        if (query.groupBy === 'eventType') {
          breakdownObj.eventType[item.eventType] = Number(item.count);
        } else if (query.groupBy === 'status') {
          breakdownObj.status[item.status] = Number(item.count);
        } else if (query.groupBy === 'hour') {
          breakdownObj.hourly = breakdownObj.hourly || {};
          breakdownObj.hourly[item.hour] = Number(item.count);
        } else if (query.groupBy === 'day') {
          breakdownObj.daily = breakdownObj.daily || {};
          breakdownObj.daily[item.day] = Number(item.count);
        }
      }

      const response: StatsResponse = {
        timeframe: query.timeframe!,
        totalEvents,
        successRate: Math.round(successRate * 100) / 100,
        avgDuration: Math.round(avgDuration * 100) / 100,
        errorRate: Math.round((100 - successRate) * 100) / 100,
        breakdown: breakdownObj,
        topPatchIds: topPatches.map(p => ({
          patchId: p.patchId,
          count: Number(p.count),
        })),
        query,
      };

      return c.json(response);
    } catch (error) {
      console.error('Failed to get analytics stats:', error);
      return c.json({ error: 'Failed to get stats' }, 500);
    }
  });

  /**
     * GET /api/analytics/trends
     *
     * Analyze trends for specific metrics over time.
     *
     * Query parameters:
     * - metric: 'events' | 'success_rate' | 'avg_duration' | 'error_rate' (required)
     * - timeframe: '1h' | '24h' | '7d' | '30d' | '90d' (default: 24h)
     * - interval: '1m' | '5m' | '15m' | '1h' | '1d' (default: 1h)
     * - eventTypes: comma-separated list of event types
     * - patchIds: comma-separated list of patch IDs
     */
  app.get('/api/analytics/trends', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const metric = c.req.query('metric') as 'events' | 'success_rate' | 'avg_duration' | 'error_rate';
      if (!metric) {
        return c.json({ error: 'Metric parameter is required' }, 400);
      }

      const query: TrendsQueryParams = {
        metric,
        timeframe: (c.req.query('timeframe') as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
        interval: (c.req.query('interval') as '1m' | '5m' | '15m' | '1h' | '1d') || '1h',
        eventTypes: c.req.query('eventTypes'),
        patchIds: c.req.query('patchIds'),
      };

      // Calculate date range and interval
      const now = new Date();
      const startDate = new Date(now);

      switch (query.timeframe) {
        case '1h':
          startDate.setHours(now.getHours() - 1);
          break;
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      let intervalMinutes: number;
      switch (query.interval) {
        case '1m':
          intervalMinutes = 1;
          break;
        case '5m':
          intervalMinutes = 5;
          break;
        case '15m':
          intervalMinutes = 15;
          break;
        case '1h':
          intervalMinutes = 60;
          break;
        case '1d':
          intervalMinutes = 1440;
          break;
      }

      // Build base query
      let baseQuery = c.env.DB_OPS
        .selectFrom('patchEvents')
        .where('createdAt', '>=', startDate);

      // Apply filters
      if (query.eventTypes) {
        const eventTypes = query.eventTypes.split(',');
        baseQuery = baseQuery.where('eventType', 'in', eventTypes);
      }
      if (query.patchIds) {
        const patchIds = query.patchIds.split(',');
        baseQuery = baseQuery.where('patchId', 'in', patchIds);
      }

      // Generate time series data points
      const dataPoints: Array<{
                timestamp: string;
                value: number;
                change?: number;
                changePercent?: number;
            }> = [];

      const timeRangeMs = now.getTime() - startDate.getTime();
      const intervalMs = intervalMinutes * 60 * 1000;
      const numPoints = Math.floor(timeRangeMs / intervalMs);

      for (let i = 0; i <= numPoints; i++) {
        const pointStart = new Date(startDate.getTime() + (i * intervalMs));
        const pointEnd = new Date(pointStart.getTime() + intervalMs);

        let value: number;

        switch (metric) {
          case 'events':
            const countResult = await baseQuery
              .where('createdAt', '>=', pointStart)
              .where('createdAt', '<', pointEnd)
              .select((eb) => eb.fn.count('id').as('count'))
              .executeTakeFirst();
            value = Number(countResult?.count || 0);
            break;

          case 'success_rate':
            const successResult = await baseQuery
              .where('createdAt', '>=', pointStart)
              .where('createdAt', '<', pointEnd)
              .select([
                (eb) => eb.fn.count('id').as('total'),
                (eb) => eb.fn.count(eb.case().when('status', '=', 'success').then(1).end()).as('successful'),
              ])
              .executeTakeFirst();
            const total = Number(successResult?.total || 0);
            const successful = Number(successResult?.successful || 0);
            value = total > 0 ? (successful / total) * 100 : 0;
            break;

          case 'avg_duration':
            const durationResult = await baseQuery
              .where('createdAt', '>=', pointStart)
              .where('createdAt', '<', pointEnd)
              .select((eb) => eb.fn.avg('metadata->duration').as('avg'))
              .executeTakeFirst();
            value = Number(durationResult?.avg || 0);
            break;

          case 'error_rate':
            const errorResult = await baseQuery
              .where('createdAt', '>=', pointStart)
              .where('createdAt', '<', pointEnd)
              .select([
                (eb) => eb.fn.count('id').as('total'),
                (eb) => eb.fn.count(eb.case().when('status', '=', 'failure').then(1).end()).as('errors'),
              ])
              .executeTakeFirst();
            const totalEvents = Number(errorResult?.total || 0);
            const errors = Number(errorResult?.errors || 0);
            value = totalEvents > 0 ? (errors / totalEvents) * 100 : 0;
            break;
        }

        // Calculate change from previous point
        let change: number | undefined;
        let changePercent: number | undefined;
        if (dataPoints.length > 0) {
          const prevValue = dataPoints[dataPoints.length - 1].value;
          change = value - prevValue;
          changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;
        }

        dataPoints.push({
          timestamp: pointStart.toISOString(),
          value: Math.round(value * 100) / 100, // Round to 2 decimal places
          change: change !== undefined ? Math.round(change * 100) / 100 : undefined,
          changePercent: changePercent !== undefined ? Math.round(changePercent * 100) / 100 : undefined,
        });
      }

      // Calculate summary
      const values = dataPoints.map(p => p.value);
      const total = values.reduce((sum, val) => sum + val, 0);
      const average = values.length > 0 ? total / values.length : 0;
      const min = values.length > 0 ? Math.min(...values) : 0;
      const max = values.length > 0 ? Math.max(...values) : 0;

      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (dataPoints.length >= 2) {
        const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
        const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

        const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

        const threshold = average * 0.05; // 5% threshold
        if (secondAvg - firstAvg > threshold) {
          trend = 'increasing';
        } else if (firstAvg - secondAvg > threshold) {
          trend = 'decreasing';
        }
      }

      const overallChange = dataPoints.length >= 2
        ? dataPoints[dataPoints.length - 1].value - dataPoints[0].value
        : 0;
      const overallChangePercent = dataPoints[0]?.value !== 0
        ? (overallChange / dataPoints[0].value) * 100
        : 0;

      const response: TrendsResponse = {
        metric: query.metric,
        timeframe: query.timeframe!,
        interval: query.interval!,
        dataPoints,
        summary: {
          total: Math.round(total * 100) / 100,
          average: Math.round(average * 100) / 100,
          min: Math.round(min * 100) / 100,
          max: Math.round(max * 100) / 100,
          trend,
          changePercent: Math.round(overallChangePercent * 100) / 100,
        },
        query,
      };

      return c.json(response);
    } catch (error) {
      console.error('Failed to analyze trends:', error);
      return c.json({ error: 'Failed to analyze trends' }, 500);
    }
  });
}
