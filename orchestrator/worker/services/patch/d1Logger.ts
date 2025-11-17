/**
 * D1 Logger Service
 *
 * Logs patch events to the D1 database for audit trails and monitoring.
 * Provides structured logging with proper error handling and performance.
 */

import { PatchEventSchema, type PatchEvent } from '@shared/contracts';
import { Kysely } from 'kysely';
import { Database } from '../database/schema';

export interface LogQuery {
  patchId?: string;
  eventType?: string;
  status?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * D1Logger handles patch event logging to the database.
 * Provides both logging and querying capabilities for patch operations.
 */
export class D1Logger {
  private db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.db = db;
  }

  /**
   * Logs a patch event to the D1 database.
   *
   * @param event - The patch event to log
   * @returns The ID of the logged event
   */
  async logPatchEvent(event: PatchEvent): Promise<number> {
    try {
      // Validate event against schema
      const validatedEvent = PatchEventSchema.parse(event);

      // Insert into database
      const result = await this.db
        .insertInto('patchEvents')
        .values({
          patchId: validatedEvent.patchId,
          eventType: validatedEvent.eventType,
          status: validatedEvent.status,
          createdAt: validatedEvent.createdAt,
          metadata: validatedEvent.metadata ? JSON.stringify(validatedEvent.metadata) : null,
        })
        .executeTakeFirst();

      return Number(result.insertId);
    } catch (error) {
      console.error('Failed to log patch event:', error);
      throw new Error(`Patch event logging failed: ${error}`);
    }
  }

  /**
   * Retrieves patch events for a specific patch ID.
   *
   * @param patchId - The ID of the patch to retrieve events for
   * @param options - Query options
   * @returns Array of patch events in chronological order
   */
  async getEventsForPatch(patchId: string, options: { limit?: number; offset?: number } = {}): Promise<PatchEvent[]> {
    try {
      const { limit = 50, offset = 0 } = options;

      const events = await this.db
        .selectFrom('patchEvents')
        .where('patchId', '=', patchId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .selectAll()
        .execute();

      // Convert database records to PatchEvent format
      return events.map(event => ({
        id: event.id.toString(),
        patchId: event.patchId,
        eventType: event.eventType,
        status: event.status,
        createdAt: event.createdAt,
        metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
      }));
    } catch (error) {
      console.error(`Failed to retrieve events for patch ${patchId}:`, error);
      throw new Error(`Event retrieval failed: ${error}`);
    }
  }

  /**
   * Queries patch events with filtering and pagination.
   *
   * @param query - Query parameters
   * @returns Array of matching patch events
   */
  async queryEvents(query: LogQuery): Promise<PatchEvent[]> {
    try {
      let dbQuery = this.db.selectFrom('patchEvents');

      // Apply filters
      if (query.patchId) {
        dbQuery = dbQuery.where('patchId', '=', query.patchId);
      }

      if (query.eventType) {
        dbQuery = dbQuery.where('eventType', '=', query.eventType);
      }

      if (query.status) {
        dbQuery = dbQuery.where('status', '=', query.status);
      }

      if (query.startDate) {
        dbQuery = dbQuery.where('createdAt', '>=', query.startDate);
      }

      if (query.endDate) {
        dbQuery = dbQuery.where('createdAt', '<=', query.endDate);
      }

      // Apply ordering, pagination
      const events = await dbQuery
        .orderBy('createdAt', 'desc')
        .limit(query.limit || 50)
        .offset(query.offset || 0)
        .selectAll()
        .execute();

      // Convert to PatchEvent format
      return events.map(event => ({
        id: event.id.toString(),
        patchId: event.patchId,
        eventType: event.eventType,
        status: event.status,
        createdAt: event.createdAt,
        metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
      }));
    } catch (error) {
      console.error('Failed to query patch events:', error);
      throw new Error(`Event query failed: ${error}`);
    }
  }

  /**
   * Gets event statistics for monitoring and analytics.
   *
   * @param timeRange - Time range in hours (default: 24)
   * @returns Statistics about patch events
   */
  async getEventStats(timeRange: number = 24): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByStatus: Record<string, number>;
    recentFailures: number;
  }> {
    try {
      const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);

      // Get total events in time range
      const totalResult = await this.db
        .selectFrom('patchEvents')
        .where('createdAt', '>=', startDate)
        .select(eb => eb.fn.count('id').as('count'))
        .executeTakeFirst();

      const totalEvents = Number(totalResult?.count || 0);

      // Get events by type
      const typeStats = await this.db
        .selectFrom('patchEvents')
        .where('createdAt', '>=', startDate)
        .select(['eventType'])
        .select(eb => eb.fn.count('id').as('count'))
        .groupBy('eventType')
        .execute();

      const eventsByType: Record<string, number> = {};
      typeStats.forEach(stat => {
        eventsByType[stat.eventType] = Number(stat.count);
      });

      // Get events by status
      const statusStats = await this.db
        .selectFrom('patchEvents')
        .where('createdAt', '>=', startDate)
        .select(['status'])
        .select(eb => eb.fn.count('id').as('count'))
        .groupBy('status')
        .execute();

      const eventsByStatus: Record<string, number> = {};
      statusStats.forEach(stat => {
        eventsByStatus[stat.status] = Number(stat.count);
      });

      // Get recent failures
      const failureResult = await this.db
        .selectFrom('patchEvents')
        .where('createdAt', '>=', startDate)
        .where('status', '=', 'failure')
        .select(eb => eb.fn.count('id').as('count'))
        .executeTakeFirst();

      const recentFailures = Number(failureResult?.count || 0);

      return {
        totalEvents,
        eventsByType,
        eventsByStatus,
        recentFailures,
      };
    } catch (error) {
      console.error('Failed to get event statistics:', error);
      throw new Error(`Statistics retrieval failed: ${error}`);
    }
  }

  /**
   * Cleans up old patch events to prevent database bloat.
   *
   * @param olderThanDays - Remove events older than this many days
   * @returns Number of events deleted
   */
  async cleanupOldEvents(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await this.db
        .deleteFrom('patchEvents')
        .where('createdAt', '<', cutoffDate)
        .executeTakeFirst();

      const deletedCount = Number(result?.numDeletedRows || 0);

      console.log(`Cleaned up ${deletedCount} old patch events older than ${olderThanDays} days`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old events:', error);
      throw new Error(`Event cleanup failed: ${error}`);
    }
  }

  /**
   * Validates a patch event before logging.
   */
  validateEvent(event: unknown): asserts event is PatchEvent {
    PatchEventSchema.parse(event);
  }
}
