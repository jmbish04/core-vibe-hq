/**
 * Patch Events API Routes
 *
 * Handles incoming patch events from the patch_manager.py script.
 * Validates events, logs to D1, broadcasts via WebSocket, and updates task status.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { PatchEventSchema } from '@shared/contracts';
import { D1Logger } from '../../services/patch/d1Logger';
import { WebSocketHub } from '../../services/websocket/websocketHub';
import { Kysely } from 'kysely';
import { Database } from '../../database/schema';
import { AppEnv } from '../../types/appenv';

export interface PatchEventsRouteContext {
  db: Kysely<Database>;
  wsHub: WebSocketHub;
  d1Logger: D1Logger;
}

/**
 * Creates and configures the patch events router
 * This router handles incoming patch events from the patch_manager.py script
 */
export function setupPatchEventsRoutes(
  app: Hono<AppEnv>,
  context: PatchEventsRouteContext,
): void {
  const { db, wsHub, d1Logger } = context;

  /**
   * POST /api/patches/events
   * Receives patch events from patch_manager.py, validates them against PatchEventSchema,
   * logs them to D1, broadcasts via WebSocket, and updates task status if applicable
   */
  app.post('/api/patches/events', async (c) => {
    try {
      const requestBody = await c.req.json();

      // Validate the incoming patch event
      const patchEvent = PatchEventSchema.parse(requestBody);

      console.log(`Processing patch event: ${patchEvent.eventType} for patch ${patchEvent.patchId}`);

      // Log the event to D1
      await d1Logger.logEvent(patchEvent);

      // Broadcast the event via WebSocket
      await wsHub.broadcastPatchEvent(patchEvent);

      // Update task status if this is a completion event
      if (patchEvent.eventType === 'PATCH_PROCESSING_COMPLETED' ||
          patchEvent.eventType === 'PATCH_PROCESSING_FAILED') {
        await updateTaskStatus(db, patchEvent);
      }

      // Return success response
      return c.json({
        status: 'ok',
        message: 'Patch event processed successfully',
        eventId: patchEvent.id,
        eventType: patchEvent.eventType,
      });

    } catch (error) {
      console.error('Error processing patch event:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          status: 'error',
          message: 'Invalid patch event format',
          errors: error.errors,
        }, 400);
      }

      return c.json({
        status: 'error',
        message: 'Failed to process patch event',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/events/recent
   * Returns recent patch events for monitoring/debugging purposes
   */
  app.get('/api/patches/events/recent', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50');
      const eventType = c.req.query('eventType');
      const patchId = c.req.query('patchId');

      // Query recent patch events from D1
      let query = db
        .selectFrom('patchEvents')
        .selectAll()
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, 200)); // Cap at 200 for performance

      if (eventType) {
        query = query.where('eventType', '=', eventType);
      }

      if (patchId) {
        query = query.where('patchId', '=', patchId);
      }

      const events = await query.execute();

      return c.json({
        events: events.map(event => ({
          id: event.id,
          patchId: event.patchId,
          eventType: event.eventType,
          status: event.status,
          createdAt: event.createdAt,
          metadata: event.metadata ? JSON.parse(event.metadata) : null,
        })),
        count: events.length,
      });

    } catch (error) {
      console.error('Error fetching recent patch events:', error);
      return c.json({
        status: 'error',
        message: 'Failed to fetch recent events',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  /**
   * GET /api/patches/events/stats
   * Returns aggregated statistics about patch events
   */
  app.get('/api/patches/events/stats', async (c) => {
    try {
      const timeframe = c.req.query('timeframe') || '24h'; // Default to last 24 hours

      // Calculate time range
      const now = new Date();
      const startTime = new Date(now);

      switch (timeframe) {
        case '1h':
          startTime.setHours(now.getHours() - 1);
          break;
        case '24h':
          startTime.setHours(now.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(now.getDate() - 30);
          break;
        default:
          startTime.setHours(now.getHours() - 24); // Default to 24h
      }

      // Get event counts by type
      const eventStats = await db
        .selectFrom('patchEvents')
        .select([
          'eventType',
          eb => eb.fn.count('id').as('count'),
        ])
        .where('createdAt', '>=', startTime.toISOString())
        .groupBy('eventType')
        .execute();

      // Get status distribution
      const statusStats = await db
        .selectFrom('patchEvents')
        .select([
          'status',
          eb => eb.fn.count('id').as('count'),
        ])
        .where('createdAt', '>=', startTime.toISOString())
        .groupBy('status')
        .execute();

      // Get total events in timeframe
      const totalEvents = await db
        .selectFrom('patchEvents')
        .select(eb => eb.fn.count('id').as('total'))
        .where('createdAt', '>=', startTime.toISOString())
        .executeTakeFirst();

      return c.json({
        timeframe,
        totalEvents: Number(totalEvents?.total || 0),
        eventTypeBreakdown: eventStats.reduce((acc, stat) => {
          acc[stat.eventType] = Number(stat.count);
          return acc;
        }, {} as Record<string, number>),
        statusBreakdown: statusStats.reduce((acc, stat) => {
          acc[stat.status] = Number(stat.count);
          return acc;
        }, {} as Record<string, number>),
        generatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error fetching patch event stats:', error);
      return c.json({
        status: 'error',
        message: 'Failed to fetch event statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}

/**
 * Updates task status based on patch event
 */
async function updateTaskStatus(db: Kysely<Database>, patchEvent: z.infer<typeof PatchEventSchema>): Promise<void> {
  try {
    // Extract task ID from patch ID (assuming format like "task-123-op-0" or similar)
    const taskIdMatch = patchEvent.patchId.match(/^task-(\d+)/);
    if (!taskIdMatch) {
      console.log(`No task ID found in patch ID: ${patchEvent.patchId}`);
      return;
    }

    const taskId = parseInt(taskIdMatch[1]);
    const newStatus = patchEvent.eventType === 'PATCH_PROCESSING_COMPLETED' ? 'completed' : 'failed';

    // Update task status in database
    await db
      .updateTable('tasks')
      .set({
        status: newStatus,
        updatedAt: new Date().toISOString(),
        metadata: JSON.stringify({
          ...((await db
            .selectFrom('tasks')
            .select('metadata')
            .where('id', '=', taskId)
            .executeTakeFirst())?.metadata || {}),
          lastPatchEvent: {
            eventType: patchEvent.eventType,
            status: patchEvent.status,
            timestamp: new Date().toISOString(),
          },
        }),
      })
      .where('id', '=', taskId)
      .execute();

    console.log(`Updated task ${taskId} status to ${newStatus} based on patch event`);

  } catch (error) {
    console.error(`Failed to update task status for patch ${patchEvent.patchId}:`, error);
    // Don't throw - this is not critical for the main event processing
  }
}
