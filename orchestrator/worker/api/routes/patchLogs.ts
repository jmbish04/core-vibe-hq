/**
 * Patch Logs API Routes
 *
 * Provides endpoints for querying patch events with filtering, pagination,
 * and sorting capabilities.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../../types/appenv';
import { Kysely } from 'kysely';
import { Database } from '../../database/schema';

// Query parameters schema for patch logs
const GetPatchLogsQuerySchema = z.object({
  taskId: z.string().optional(),
  file: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
  eventType: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type GetPatchLogsQuery = z.infer<typeof GetPatchLogsQuerySchema>;

export function setupPatchLogsRoutes(app: Hono<AppEnv>): void {
  /**
   * GET /api/patches/logs
   *
   * Retrieves patch events with filtering, pagination, and sorting
   */
  app.get('/api/patches/logs', async (c) => {
    try {
      const queryParams = GetPatchLogsQuerySchema.parse(c.req.query());
      const db: Kysely<Database> = c.env.DB_OPS;

      // Build the base query
      let query = db
        .selectFrom('patchEvents')
        .selectAll();

      // Apply filters
      if (queryParams.taskId) {
        query = query.where('patchId', '=', queryParams.taskId);
      }

      if (queryParams.eventType) {
        query = query.where('eventType', '=', queryParams.eventType);
      }

      if (queryParams.status) {
        query = query.where('status', '=', queryParams.status);
      }

      if (queryParams.file) {
        // Search in metadata for file information
        query = query.where('metadata', 'like', `%${queryParams.file}%`);
      }

      if (queryParams.search) {
        // Search across multiple fields
        const searchTerm = `%${queryParams.search}%`;
        query = query.where((eb) =>
          eb.or([
            eb('patchId', 'like', searchTerm),
            eb('eventType', 'like', searchTerm),
            eb('status', 'like', searchTerm),
            eb('metadata', 'like', searchTerm),
          ]),
        );
      }

      // Apply date range filters
      if (queryParams.startDate) {
        query = query.where('createdAt', '>=', queryParams.startDate);
      }

      if (queryParams.endDate) {
        query = query.where('createdAt', '<=', queryParams.endDate);
      }

      // Get total count for pagination
      const countQuery = query.clone()
        .clearSelect()
        .clearOrderBy()
        .select(eb => eb.fn.count('id').as('count'));

      // Apply sorting and pagination
      query = query
        .orderBy('createdAt', queryParams.order)
        .limit(queryParams.limit)
        .offset(queryParams.offset);

      // Execute queries
      const [events, countResult] = await Promise.all([
        query.execute(),
        countQuery.executeTakeFirst(),
      ]);

      const total = Number(countResult?.count || 0);

      // Format response
      const formattedEvents = events.map(event => ({
        id: event.id,
        patchId: event.patchId,
        eventType: event.eventType,
        status: event.status,
        createdAt: event.createdAt,
        metadata: event.metadata ? JSON.parse(event.metadata) : null,
        // Add computed fields for easier consumption
        timestamp: new Date(event.createdAt).getTime(),
        isSuccess: event.status === 'success',
        isError: event.status === 'error',
      }));

      return c.json({
        events: formattedEvents,
        pagination: {
          total,
          limit: queryParams.limit,
          offset: queryParams.offset,
          hasMore: total > queryParams.offset + queryParams.limit,
          currentPage: Math.floor(queryParams.offset / queryParams.limit) + 1,
          totalPages: Math.ceil(total / queryParams.limit),
        },
        filters: {
          applied: {
            taskId: queryParams.taskId,
            file: queryParams.file,
            search: queryParams.search,
            eventType: queryParams.eventType,
            status: queryParams.status,
            startDate: queryParams.startDate,
            endDate: queryParams.endDate,
          },
        },
      });

    } catch (error) {
      console.error('Error fetching patch logs:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Invalid query parameters',
          details: error.errors,
        }, 400);
      }

      return c.json({
        error: 'Failed to fetch patch logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/logs/summary
   *
   * Returns a summary of patch events with counts by type and status
   */
  app.get('/api/patches/logs/summary', async (c) => {
    try {
      const db: Kysely<Database> = c.env.DB_OPS;
      const hours = parseInt(c.req.query('hours') || '24');
      const startDate = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

      // Get event counts by type
      const eventTypeCounts = await db
        .selectFrom('patchEvents')
        .select([
          'eventType',
          eb => eb.fn.count('id').as('count'),
        ])
        .where('createdAt', '>=', startDate)
        .groupBy('eventType')
        .execute();

      // Get status distribution
      const statusCounts = await db
        .selectFrom('patchEvents')
        .select([
          'status',
          eb => eb.fn.count('id').as('count'),
        ])
        .where('createdAt', '>=', startDate)
        .groupBy('status')
        .execute();

      // Get total events
      const totalResult = await db
        .selectFrom('patchEvents')
        .select(eb => eb.fn.count('id').as('total'))
        .where('createdAt', '>=', startDate)
        .executeTakeFirst();

      const total = Number(totalResult?.total || 0);

      // Calculate success rate
      const successCount = statusCounts.find(s => s.status === 'success');
      const errorCount = statusCounts.find(s => s.status === 'error');
      const successRate = total > 0 ? (Number(successCount?.count || 0) / total) * 100 : 0;

      return c.json({
        timeframe: `${hours}h`,
        total,
        successRate: Math.round(successRate * 100) / 100,
        eventTypes: eventTypeCounts.reduce((acc, item) => {
          acc[item.eventType] = Number(item.count);
          return acc;
        }, {} as Record<string, number>),
        statuses: statusCounts.reduce((acc, item) => {
          acc[item.status] = Number(item.count);
          return acc;
        }, {} as Record<string, number>),
        generatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error fetching patch logs summary:', error);
      return c.json({
        error: 'Failed to fetch patch logs summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/logs/:patchId
   *
   * Returns all events for a specific patch ID
   */
  app.get('/api/patches/logs/:patchId', async (c) => {
    try {
      const patchId = c.req.param('patchId');
      const db: Kysely<Database> = c.env.DB_OPS;

      const events = await db
        .selectFrom('patchEvents')
        .selectAll()
        .where('patchId', '=', patchId)
        .orderBy('createdAt', 'asc')
        .execute();

      if (events.length === 0) {
        return c.json({
          error: 'No events found for patch',
          patchId,
        }, 404);
      }

      // Group events by type for easier analysis
      const eventsByType = events.reduce((acc, event) => {
        if (!acc[event.eventType]) {
          acc[event.eventType] = [];
        }
        acc[event.eventType].push({
          id: event.id,
          status: event.status,
          createdAt: event.createdAt,
          metadata: event.metadata ? JSON.parse(event.metadata) : null,
          timestamp: new Date(event.createdAt).getTime(),
        });
        return acc;
      }, {} as Record<string, any[]>);

      // Calculate timeline statistics
      const firstEvent = events[0];
      const lastEvent = events[events.length - 1];
      const duration = new Date(lastEvent.createdAt).getTime() - new Date(firstEvent.createdAt).getTime();

      const successCount = events.filter(e => e.status === 'success').length;
      const errorCount = events.filter(e => e.status === 'error').length;
      const finalStatus = lastEvent.status;

      return c.json({
        patchId,
        totalEvents: events.length,
        duration,
        finalStatus,
        successRate: events.length > 0 ? (successCount / events.length) * 100 : 0,
        eventsByType,
        timeline: {
          started: firstEvent.createdAt,
          completed: lastEvent.createdAt,
          duration,
          successCount,
          errorCount,
        },
      });

    } catch (error) {
      console.error('Error fetching patch events:', error);
      return c.json({
        error: 'Failed to fetch patch events',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}
