/**
 * Patch Stats API Routes
 *
 * Provides endpoints for aggregated patch statistics including daily counts,
 * success rates, operation distribution, and error summaries.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../../types/appenv';
import { Kysely } from 'kysely';
import { Database } from '../../database/schema';

// Query parameters schema for patch stats
const GetPatchStatsQuerySchema = z.object({
  from: z.string().optional().describe('Start date for filtering (YYYY-MM-DD or ISO format)'),
  to: z.string().optional().describe('End date for filtering (YYYY-MM-DD or ISO format)'),
  factory: z.string().optional().describe('Filter by specific factory'),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day').describe('Grouping mode for time series'),
  includeErrors: z.coerce.boolean().optional().default(true).describe('Include error details in response'),
});

type GetPatchStatsQuery = z.infer<typeof GetPatchStatsQuerySchema>;

export function setupPatchStatsRoutes(app: Hono<AppEnv>): void {
  /**
   * GET /api/patches/stats
   *
   * Returns aggregated statistics about patch operations
   */
  app.get('/api/patches/stats', async (c) => {
    try {
      const queryParams = GetPatchStatsQuerySchema.parse(c.req.query());
      const db: Kysely<Database> = c.env.DB_OPS;

      // Build date range filter
      let dateFilter = '';
      const params: any[] = [];

      if (queryParams.from || queryParams.to) {
        const conditions = [];
        if (queryParams.from) {
          conditions.push('createdAt >= ?');
          params.push(queryParams.from);
        }
        if (queryParams.to) {
          conditions.push('createdAt <= ?');
          params.push(queryParams.to);
        }
        dateFilter = `WHERE ${conditions.join(' AND ')}`;
      }

      // Get total patch events
      const totalEventsQuery = `SELECT COUNT(*) as total FROM patchEvents ${dateFilter}`;
      const totalResult = await db.executeQuery({ sql: totalEventsQuery, parameters: params });
      const totalEvents = Number(totalResult.rows[0]?.total || 0);

      // Get successful vs failed events
      const successQuery = `
        SELECT
          status,
          COUNT(*) as count
        FROM patchEvents
        ${dateFilter}
        GROUP BY status
      `;
      const successResult = await db.executeQuery({ sql: successQuery, parameters: params });
      const statusCounts = successResult.rows.reduce((acc, row: any) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {} as Record<string, number>);

      const successfulEvents = statusCounts.success || 0;
      const failedEvents = statusCounts.error || 0;

      // Get events by type
      const typeQuery = `
        SELECT
          eventType,
          COUNT(*) as count
        FROM patchEvents
        ${dateFilter}
        GROUP BY eventType
        ORDER BY count DESC
      `;
      const typeResult = await db.executeQuery({ sql: typeQuery, parameters: params });
      const eventsByType = typeResult.rows.reduce((acc, row: any) => {
        acc[row.eventType] = Number(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get top patches by event count
      const topPatchesQuery = `
        SELECT
          patchId,
          COUNT(*) as eventCount
        FROM patchEvents
        ${dateFilter}
        GROUP BY patchId
        ORDER BY eventCount DESC
        LIMIT 10
      `;
      const topPatchesResult = await db.executeQuery({ sql: topPatchesQuery, parameters: params });
      const topPatches = topPatchesResult.rows.map((row: any) => ({
        patchId: row.patchId,
        eventCount: Number(row.eventCount),
      }));

      // Get daily distribution (last 30 days by default)
      const dailyQuery = `
        SELECT
          DATE(createdAt) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed
        FROM patchEvents
        WHERE createdAt >= date('now', '-30 days')
        ${queryParams.from || queryParams.to ? `AND ${dateFilter.split('WHERE ')[1]}` : ''}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
        LIMIT 30
      `;
      const dailyResult = await db.executeQuery({
        sql: dailyQuery,
        parameters: queryParams.from || queryParams.to ? params : [],
      });
      const dailyStats = dailyResult.rows.map((row: any) => ({
        date: row.date,
        total: Number(row.total),
        successful: Number(row.successful || 0),
        failed: Number(row.failed || 0),
        successRate: Number(row.total) > 0 ? (Number(row.successful || 0) / Number(row.total)) * 100 : 0,
      }));

      // Get error details if requested
      let errorDetails = null;
      if (queryParams.includeErrors && failedEvents > 0) {
        const errorQuery = `
          SELECT
            eventType,
            status,
            metadata,
            COUNT(*) as count
          FROM patchEvents
          WHERE status = 'error'
          ${dateFilter}
          GROUP BY eventType, status, metadata
          ORDER BY count DESC
          LIMIT 20
        `;
        const errorResult = await db.executeQuery({ sql: errorQuery, parameters: params });
        errorDetails = errorResult.rows.map((row: any) => ({
          eventType: row.eventType,
          status: row.status,
          error: row.metadata ? JSON.parse(row.metadata).error : 'Unknown error',
          count: Number(row.count),
        }));
      }

      // Calculate overall metrics
      const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;
      const avgEventsPerPatch = topPatches.length > 0 ?
        topPatches.reduce((sum, p) => sum + p.eventCount, 0) / topPatches.length : 0;

      return c.json({
        summary: {
          totalEvents,
          successfulEvents,
          failedEvents,
          successRate: Math.round(successRate * 100) / 100,
          avgEventsPerPatch: Math.round(avgEventsPerPatch * 100) / 100,
          uniquePatches: topPatches.length,
          dateRange: {
            from: queryParams.from,
            to: queryParams.to,
          },
        },
        breakdown: {
          byEventType: eventsByType,
          byStatus: statusCounts,
          topPatches,
          dailyStats,
        },
        errors: queryParams.includeErrors ? errorDetails : null,
        metadata: {
          generatedAt: new Date().toISOString(),
          filters: {
            dateRange: queryParams.from || queryParams.to ? true : false,
            includeErrors: queryParams.includeErrors,
          },
        },
      });

    } catch (error) {
      console.error('Error fetching patch stats:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Invalid query parameters',
          details: error.errors,
        }, 400);
      }

      return c.json({
        error: 'Failed to fetch patch statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/stats/performance
   *
   * Returns performance metrics for patch operations
   */
  app.get('/api/patches/stats/performance', async (c) => {
    try {
      const db: Kysely<Database> = c.env.DB_OPS;
      const days = parseInt(c.req.query('days') || '7');

      // Get performance metrics from the last N days
      const perfQuery = `
        SELECT
          eventType,
          AVG(CASE
            WHEN json_extract(metadata, '$.executionTime') IS NOT NULL
            THEN json_extract(metadata, '$.executionTime')
            ELSE NULL
          END) as avgExecutionTime,
          MIN(CASE
            WHEN json_extract(metadata, '$.executionTime') IS NOT NULL
            THEN json_extract(metadata, '$.executionTime')
            ELSE NULL
          END) as minExecutionTime,
          MAX(CASE
            WHEN json_extract(metadata, '$.executionTime') IS NOT NULL
            THEN json_extract(metadata, '$.executionTime')
            ELSE NULL
          END) as maxExecutionTime,
          COUNT(*) as totalEvents
        FROM patchEvents
        WHERE createdAt >= date('now', '-${days} days')
          AND json_extract(metadata, '$.executionTime') IS NOT NULL
        GROUP BY eventType
        ORDER BY avgExecutionTime DESC
      `;

      const perfResult = await db.executeQuery({ sql: perfQuery, parameters: [] });
      const performanceMetrics = perfResult.rows.map((row: any) => ({
        eventType: row.eventType,
        avgExecutionTime: Number(row.avgExecutionTime || 0),
        minExecutionTime: Number(row.minExecutionTime || 0),
        maxExecutionTime: Number(row.maxExecutionTime || 0),
        totalEvents: Number(row.totalEvents),
      }));

      // Get throughput metrics (events per hour)
      const throughputQuery = `
        SELECT
          strftime('%Y-%m-%d %H', createdAt) as hour,
          COUNT(*) as eventsPerHour
        FROM patchEvents
        WHERE createdAt >= date('now', '-${days} days')
        GROUP BY strftime('%Y-%m-%d %H', createdAt)
        ORDER BY hour DESC
        LIMIT 168  -- Last 7 days * 24 hours
      `;

      const throughputResult = await db.executeQuery({ sql: throughputQuery, parameters: [] });
      const throughputMetrics = throughputResult.rows.map((row: any) => ({
        hour: row.hour,
        eventsPerHour: Number(row.eventsPerHour),
      }));

      // Calculate overall performance stats
      const totalExecutionTime = performanceMetrics.reduce((sum, metric) =>
        sum + (metric.avgExecutionTime * metric.totalEvents), 0,
      );
      const totalEvents = performanceMetrics.reduce((sum, metric) => sum + metric.totalEvents, 0);
      const avgExecutionTime = totalEvents > 0 ? totalExecutionTime / totalEvents : 0;

      return c.json({
        timeframe: `${days} days`,
        overall: {
          avgExecutionTime: Math.round(avgExecutionTime),
          totalEvents,
          totalExecutionTime: Math.round(totalExecutionTime),
        },
        byEventType: performanceMetrics,
        throughput: {
          hourly: throughputMetrics,
          peakHour: throughputMetrics.reduce((max, curr) =>
            curr.eventsPerHour > max.eventsPerHour ? curr : max,
          throughputMetrics[0] || { hour: 'N/A', eventsPerHour: 0 },
          ),
          avgHourlyThroughput: throughputMetrics.length > 0 ?
            throughputMetrics.reduce((sum, curr) => sum + curr.eventsPerHour, 0) / throughputMetrics.length : 0,
        },
        generatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error fetching performance stats:', error);
      return c.json({
        error: 'Failed to fetch performance statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/stats/errors
   *
   * Returns detailed error analysis for patch operations
   */
  app.get('/api/patches/stats/errors', async (c) => {
    try {
      const db: Kysely<Database> = c.env.DB_OPS;
      const limit = parseInt(c.req.query('limit') || '50');

      // Get error patterns
      const errorQuery = `
        SELECT
          eventType,
          json_extract(metadata, '$.error') as error,
          COUNT(*) as count,
          MAX(createdAt) as lastOccurred
        FROM patchEvents
        WHERE status = 'error'
          AND json_extract(metadata, '$.error') IS NOT NULL
        GROUP BY eventType, json_extract(metadata, '$.error')
        ORDER BY count DESC
        LIMIT ?
      `;

      const errorResult = await db.executeQuery({ sql: errorQuery, parameters: [limit] });
      const errorPatterns = errorResult.rows.map((row: any) => ({
        eventType: row.eventType,
        error: row.error,
        count: Number(row.count),
        lastOccurred: row.lastOccurred,
      }));

      // Get recent errors
      const recentErrorsQuery = `
        SELECT
          id,
          patchId,
          eventType,
          createdAt,
          json_extract(metadata, '$.error') as error
        FROM patchEvents
        WHERE status = 'error'
        ORDER BY createdAt DESC
        LIMIT 100
      `;

      const recentResult = await db.executeQuery({ sql: recentErrorsQuery, parameters: [] });
      const recentErrors = recentResult.rows.map((row: any) => ({
        id: row.id,
        patchId: row.patchId,
        eventType: row.eventType,
        createdAt: row.createdAt,
        error: row.error,
      }));

      // Calculate error rate trends (last 7 days)
      const trendQuery = `
        SELECT
          DATE(createdAt) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
        FROM patchEvents
        WHERE createdAt >= date('now', '-7 days')
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
      `;

      const trendResult = await db.executeQuery({ sql: trendQuery, parameters: [] });
      const errorTrends = trendResult.rows.map((row: any) => ({
        date: row.date,
        totalEvents: Number(row.total),
        errorCount: Number(row.errors),
        errorRate: Number(row.total) > 0 ? (Number(row.errors) / Number(row.total)) * 100 : 0,
      }));

      return c.json({
        summary: {
          totalErrorPatterns: errorPatterns.length,
          mostCommonError: errorPatterns[0]?.error || null,
          recentErrorCount: recentErrors.length,
        },
        patterns: errorPatterns,
        recent: recentErrors,
        trends: errorTrends,
        generatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error fetching error stats:', error);
      return c.json({
        error: 'Failed to fetch error statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}
