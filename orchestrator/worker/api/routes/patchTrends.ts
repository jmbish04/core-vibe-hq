/**
 * Patch Trends API Routes
 *
 * Provides endpoints for analyzing patch operation trends over time,
 * including success rates, performance metrics, and error patterns.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../../types/appenv';
import { Kysely } from 'kysely';
import { Database } from '../../database/schema';

// Query parameters schema for patch trends
const GetPatchTrendsQuerySchema = z.object({
  metric: z.enum(['events', 'success_rate', 'error_rate', 'performance', 'throughput']).describe('Metric to analyze trends for'),
  timeframe: z.string().optional().default('7d').describe('Timeframe for analysis (e.g., "1h", "24h", "7d", "30d")'),
  interval: z.string().optional().default('1h').describe('Interval for data points (e.g., "15m", "1h", "1d")'),
  eventTypes: z.string().optional().describe('Comma-separated list of event types to include'),
  patchIds: z.string().optional().describe('Comma-separated list of patch IDs to include'),
  compare: z.string().optional().describe('Compare with previous period (e.g., "previous")'),
});

type GetPatchTrendsQuery = z.infer<typeof GetPatchTrendsQuerySchema>;

export function setupPatchTrendsRoutes(app: Hono<AppEnv>): void {
  /**
   * GET /api/patches/trends
   *
   * Returns trend analysis for specified metrics over time
   */
  app.get('/api/patches/trends', async (c) => {
    try {
      const queryParams = GetPatchTrendsQuerySchema.parse(c.req.query());
      const db: Kysely<Database> = c.env.DB_OPS;

      const { metric, timeframe, interval, eventTypes, patchIds } = queryParams;

      // Parse timeframe
      const { startDate, intervalMs } = parseTimeframe(timeframe, interval);

      // Parse filters
      const eventTypeFilter = eventTypes ? eventTypes.split(',').map(t => t.trim()) : null;
      const patchIdFilter = patchIds ? patchIds.split(',').map(id => id.trim()) : null;

      let dataPoints: Array<{
        timestamp: string;
        value: number;
        label?: string;
      }> = [];

      switch (metric) {
        case 'events':
          dataPoints = await getEventsTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
          break;
        case 'success_rate':
          dataPoints = await getSuccessRateTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
          break;
        case 'error_rate':
          dataPoints = await getErrorRateTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
          break;
        case 'performance':
          dataPoints = await getPerformanceTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
          break;
        case 'throughput':
          dataPoints = await getThroughputTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
          break;
        default:
          return c.json({ error: 'Unsupported metric' }, 400);
      }

      // Calculate trend analysis
      const trend = analyzeTrend(dataPoints);

      // Generate comparison if requested
      let comparison = null;
      if (queryParams.compare === 'previous') {
        const prevStartDate = new Date(startDate.getTime() - (startDate.getTime() - parseTimeframe(timeframe, interval).startDate.getTime()));
        const prevDataPoints = await getMetricDataPoints(metric, db, prevStartDate, intervalMs, eventTypeFilter, patchIdFilter);
        comparison = {
          previous: analyzeTrend(prevDataPoints),
          change: calculateTrendChange(trend, analyzeTrend(prevDataPoints)),
        };
      }

      return c.json({
        metric,
        timeframe,
        interval,
        dataPoints,
        trend,
        comparison,
        filters: {
          eventTypes: eventTypeFilter,
          patchIds: patchIdFilter,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          totalDataPoints: dataPoints.length,
          timeRange: {
            start: startDate.toISOString(),
            end: new Date().toISOString(),
          },
        },
      });

    } catch (error) {
      console.error('Error fetching patch trends:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Invalid query parameters',
          details: error.errors,
        }, 400);
      }

      return c.json({
        error: 'Failed to fetch trend analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/trends/compare
   *
   * Compares trends between different time periods or configurations
   */
  app.get('/api/patches/trends/compare', async (c) => {
    try {
      const metric = c.req.query('metric') || 'events';
      const period1 = c.req.query('period1') || '24h';
      const period2 = c.req.query('period2') || '7d';
      const interval = c.req.query('interval') || '1h';

      if (!['events', 'success_rate', 'error_rate', 'performance', 'throughput'].includes(metric)) {
        return c.json({ error: 'Unsupported metric for comparison' }, 400);
      }

      const db: Kysely<Database> = c.env.DB_OPS;

      // Calculate time ranges
      const now = new Date();
      const period1Start = new Date(now.getTime() - parseDuration(period1));
      const period2Start = new Date(now.getTime() - parseDuration(period2));
      const intervalMs = parseInterval(interval);

      // Get data for both periods
      const data1 = await getMetricDataPoints(metric as any, db, period1Start, intervalMs);
      const data2 = await getMetricDataPoints(metric as any, db, period2Start, intervalMs);

      const analysis1 = analyzeTrend(data1);
      const analysis2 = analyzeTrend(data2);

      return c.json({
        comparison: {
          period1: {
            range: period1,
            start: period1Start.toISOString(),
            analysis: analysis1,
            dataPoints: data1.length,
          },
          period2: {
            range: period2,
            start: period2Start.toISOString(),
            analysis: analysis2,
            dataPoints: data2.length,
          },
          difference: calculateTrendChange(analysis1, analysis2),
        },
        metric,
        interval,
        generatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error comparing trends:', error);
      return c.json({
        error: 'Failed to compare trends',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/trends/anomalies
   *
   * Detects anomalies in patch operation trends
   */
  app.get('/api/patches/trends/anomalies', async (c) => {
    try {
      const metric = c.req.query('metric') || 'events';
      const timeframe = c.req.query('timeframe') || '7d';
      const threshold = parseFloat(c.req.query('threshold') || '2.0'); // Standard deviations

      const db: Kysely<Database> = c.env.DB_OPS;
      const { startDate, intervalMs } = parseTimeframe(timeframe, '1h');

      // Get data points
      const dataPoints = await getMetricDataPoints(metric as any, db, startDate, intervalMs);

      // Detect anomalies using statistical analysis
      const anomalies = detectAnomalies(dataPoints, threshold);

      return c.json({
        metric,
        timeframe,
        threshold,
        anomalies,
        summary: {
          totalDataPoints: dataPoints.length,
          anomalousDataPoints: anomalies.length,
          anomalyRate: dataPoints.length > 0 ? (anomalies.length / dataPoints.length) * 100 : 0,
        },
        generatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error detecting anomalies:', error);
      return c.json({
        error: 'Failed to detect anomalies',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}

/**
 * Helper function to get data points for a specific metric
 */
async function getMetricDataPoints(
  metric: 'events' | 'success_rate' | 'error_rate' | 'performance' | 'throughput',
  db: Kysely<Database>,
  startDate: Date,
  intervalMs: number,
  eventTypeFilter?: string[] | null,
  patchIdFilter?: string[] | null,
): Promise<Array<{ timestamp: string; value: number; label?: string }>> {
  switch (metric) {
    case 'events':
      return getEventsTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
    case 'success_rate':
      return getSuccessRateTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
    case 'error_rate':
      return getErrorRateTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
    case 'performance':
      return getPerformanceTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
    case 'throughput':
      return getThroughputTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);
    default:
      return [];
  }
}

/**
 * Get events count trend over time
 */
async function getEventsTrend(
  db: Kysely<Database>,
  startDate: Date,
  intervalMs: number,
  eventTypeFilter?: string[] | null,
  patchIdFilter?: string[] | null,
): Promise<Array<{ timestamp: string; value: number; label?: string }>> {
  const points: Array<{ timestamp: string; value: number; label?: string }> = [];
  const endDate = new Date();

  for (let time = startDate.getTime(); time <= endDate.getTime(); time += intervalMs) {
    const intervalStart = new Date(time);
    const intervalEnd = new Date(time + intervalMs);

    let query = db
      .selectFrom('patchEvents')
      .select(eb => eb.fn.count('id').as('count'))
      .where('createdAt', '>=', intervalStart.toISOString())
      .where('createdAt', '<', intervalEnd.toISOString());

    if (eventTypeFilter) {
      query = query.where('eventType', 'in', eventTypeFilter);
    }

    if (patchIdFilter) {
      query = query.where('patchId', 'in', patchIdFilter);
    }

    const result = await query.executeTakeFirst();
    const count = Number(result?.count || 0);

    points.push({
      timestamp: intervalStart.toISOString(),
      value: count,
    });
  }

  return points;
}

/**
 * Get success rate trend over time
 */
async function getSuccessRateTrend(
  db: Kysely<Database>,
  startDate: Date,
  intervalMs: number,
  eventTypeFilter?: string[] | null,
  patchIdFilter?: string[] | null,
): Promise<Array<{ timestamp: string; value: number; label?: string }>> {
  const points: Array<{ timestamp: string; value: number; label?: string }> = [];
  const endDate = new Date();

  for (let time = startDate.getTime(); time <= endDate.getTime(); time += intervalMs) {
    const intervalStart = new Date(time);
    const intervalEnd = new Date(time + intervalMs);

    let totalQuery = db
      .selectFrom('patchEvents')
      .select(eb => eb.fn.count('id').as('count'))
      .where('createdAt', '>=', intervalStart.toISOString())
      .where('createdAt', '<', intervalEnd.toISOString());

    let successQuery = db
      .selectFrom('patchEvents')
      .select(eb => eb.fn.count('id').as('count'))
      .where('createdAt', '>=', intervalStart.toISOString())
      .where('createdAt', '<', intervalEnd.toISOString())
      .where('status', '=', 'success');

    if (eventTypeFilter) {
      totalQuery = totalQuery.where('eventType', 'in', eventTypeFilter);
      successQuery = successQuery.where('eventType', 'in', eventTypeFilter);
    }

    if (patchIdFilter) {
      totalQuery = totalQuery.where('patchId', 'in', patchIdFilter);
      successQuery = successQuery.where('patchId', 'in', patchIdFilter);
    }

    const [totalResult, successResult] = await Promise.all([
      totalQuery.executeTakeFirst(),
      successQuery.executeTakeFirst(),
    ]);

    const total = Number(totalResult?.count || 0);
    const successful = Number(successResult?.count || 0);
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    points.push({
      timestamp: intervalStart.toISOString(),
      value: Math.round(successRate * 100) / 100, // Round to 2 decimal places
    });
  }

  return points;
}

/**
 * Get error rate trend over time
 */
async function getErrorRateTrend(
  db: Kysely<Database>,
  startDate: Date,
  intervalMs: number,
  eventTypeFilter?: string[] | null,
  patchIdFilter?: string[] | null,
): Promise<Array<{ timestamp: string; value: number; label?: string }>> {
  const successRatePoints = await getSuccessRateTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);

  return successRatePoints.map(point => ({
    timestamp: point.timestamp,
    value: 100 - point.value, // Error rate = 100 - success rate
  }));
}

/**
 * Get performance trend (average execution time) over time
 */
async function getPerformanceTrend(
  db: Kysely<Database>,
  startDate: Date,
  intervalMs: number,
  eventTypeFilter?: string[] | null,
  patchIdFilter?: string[] | null,
): Promise<Array<{ timestamp: string; value: number; label?: string }>> {
  const points: Array<{ timestamp: string; value: number; label?: string }> = [];
  const endDate = new Date();

  for (let time = startDate.getTime(); time <= endDate.getTime(); time += intervalMs) {
    const intervalStart = new Date(time);
    const intervalEnd = new Date(time + intervalMs);

    // Query for average execution time from metadata
    const queryStr = `
      SELECT AVG(
        CASE
          WHEN json_extract(metadata, '$.executionTime') IS NOT NULL
          THEN json_extract(metadata, '$.executionTime')
          ELSE NULL
        END
      ) as avgExecutionTime
      FROM patchEvents
      WHERE createdAt >= ? AND createdAt < ?
      AND json_extract(metadata, '$.executionTime') IS NOT NULL
      ${eventTypeFilter ? `AND eventType IN (${eventTypeFilter.map(() => '?').join(',')})` : ''}
      ${patchIdFilter ? `AND patchId IN (${patchIdFilter.map(() => '?').join(',')})` : ''}
    `;

    const params = [intervalStart.toISOString(), intervalEnd.toISOString()];
    if (eventTypeFilter) {
      params.push(...eventTypeFilter);
    }
    if (patchIdFilter) {
      params.push(...patchIdFilter);
    }

    const result = await db.executeQuery({ sql: queryStr, parameters: params });
    const avgExecutionTime = Number(result.rows[0]?.avgExecutionTime || 0);

    points.push({
      timestamp: intervalStart.toISOString(),
      value: Math.round(avgExecutionTime),
    });
  }

  return points;
}

/**
 * Get throughput trend (events per minute) over time
 */
async function getThroughputTrend(
  db: Kysely<Database>,
  startDate: Date,
  intervalMs: number,
  eventTypeFilter?: string[] | null,
  patchIdFilter?: string[] | null,
): Promise<Array<{ timestamp: string; value: number; label?: string }>> {
  const eventsPoints = await getEventsTrend(db, startDate, intervalMs, eventTypeFilter, patchIdFilter);

  // Convert to events per minute
  const minutesInInterval = intervalMs / (1000 * 60);

  return eventsPoints.map(point => ({
    timestamp: point.timestamp,
    value: Math.round((point.value / minutesInInterval) * 100) / 100, // Round to 2 decimal places
  }));
}

/**
 * Analyze trend data to identify patterns
 */
function analyzeTrend(dataPoints: Array<{ timestamp: string; value: number }>): {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  volatility: number;
  average: number;
  min: number;
  max: number;
  latest: number;
  changePercent: number;
} {
  if (dataPoints.length < 2) {
    return {
      direction: 'stable',
      slope: 0,
      volatility: 0,
      average: dataPoints[0]?.value || 0,
      min: dataPoints[0]?.value || 0,
      max: dataPoints[0]?.value || 0,
      latest: dataPoints[0]?.value || 0,
      changePercent: 0,
    };
  }

  const values = dataPoints.map(p => p.value);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const first = values[0];

  // Calculate slope (linear regression)
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((sum, val) => sum + val, 0);
  const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Calculate volatility (standard deviation)
  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
  const volatility = Math.sqrt(variance);

  // Determine direction
  let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  if (Math.abs(slope) < 0.1) {
    direction = 'stable';
  } else if (slope > 0) {
    direction = 'increasing';
  } else {
    direction = 'decreasing';
  }

  if (volatility > average * 0.5) {
    direction = 'volatile';
  }

  // Calculate percentage change
  const changePercent = first !== 0 ? ((latest - first) / first) * 100 : 0;

  return {
    direction,
    slope: Math.round(slope * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    average: Math.round(average * 100) / 100,
    min,
    max,
    latest,
    changePercent: Math.round(changePercent * 100) / 100,
  };
}

/**
 * Calculate the change between two trend analyses
 */
function calculateTrendChange(current: ReturnType<typeof analyzeTrend>, previous: ReturnType<typeof analyzeTrend>): {
  averageChange: number;
  slopeChange: number;
  volatilityChange: number;
  directionChanged: boolean;
} {
  return {
    averageChange: Math.round(((current.average - previous.average) / (previous.average || 1)) * 10000) / 100,
    slopeChange: Math.round((current.slope - previous.slope) * 100) / 100,
    volatilityChange: Math.round(((current.volatility - previous.volatility) / (previous.volatility || 1)) * 10000) / 100,
    directionChanged: current.direction !== previous.direction,
  };
}

/**
 * Detect anomalies in data points using statistical analysis
 */
function detectAnomalies(
  dataPoints: Array<{ timestamp: string; value: number }>,
  threshold: number = 2.0,
): Array<{ timestamp: string; value: number; zScore: number; isAnomaly: boolean }> {
  if (dataPoints.length < 3) {
    return [];
  }

  const values = dataPoints.map(p => p.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return dataPoints.map(point => {
    const zScore = stdDev !== 0 ? (point.value - mean) / stdDev : 0;
    const isAnomaly = Math.abs(zScore) > threshold;

    return {
      timestamp: point.timestamp,
      value: point.value,
      zScore: Math.round(zScore * 100) / 100,
      isAnomaly,
    };
  }).filter(point => point.isAnomaly);
}

/**
 * Parse timeframe string into start date and interval
 */
function parseTimeframe(timeframe: string, interval: string): { startDate: Date; intervalMs: number } {
  const now = new Date();
  let startDate: Date;

  // Parse timeframe
  if (timeframe.endsWith('h')) {
    const hours = parseInt(timeframe.slice(0, -1));
    startDate = new Date(now.getTime() - (hours * 60 * 60 * 1000));
  } else if (timeframe.endsWith('d')) {
    const days = parseInt(timeframe.slice(0, -1));
    startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  } else {
    // Default to 24 hours
    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  }

  const intervalMs = parseInterval(interval);

  return { startDate, intervalMs };
}

/**
 * Parse interval string into milliseconds
 */
function parseInterval(interval: string): number {
  if (interval.endsWith('m')) {
    return parseInt(interval.slice(0, -1)) * 60 * 1000; // minutes
  } else if (interval.endsWith('h')) {
    return parseInt(interval.slice(0, -1)) * 60 * 60 * 1000; // hours
  } else if (interval.endsWith('d')) {
    return parseInt(interval.slice(0, -1)) * 24 * 60 * 60 * 1000; // days
  } else {
    return 60 * 60 * 1000; // default to 1 hour
  }
}

/**
 * Parse duration string into milliseconds
 */
function parseDuration(duration: string): number {
  if (duration.endsWith('h')) {
    return parseInt(duration.slice(0, -1)) * 60 * 60 * 1000;
  } else if (duration.endsWith('d')) {
    return parseInt(duration.slice(0, -1)) * 24 * 60 * 60 * 1000;
  } else if (duration.endsWith('m')) {
    return parseInt(duration.slice(0, -1)) * 60 * 1000;
  } else {
    return 24 * 60 * 60 * 1000; // default to 24 hours
  }
}
