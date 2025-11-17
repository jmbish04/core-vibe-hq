/**
 * Specialist Queue Manager
 *
 * Manages automated specialist invocations through a queue system.
 * Handles trigger detection, queue processing, and specialist execution.
 */

import { eq, and, or, gte, lt } from 'drizzle-orm';
import { DatabaseService } from '../database/database';
import type { NewSpecialistQueue, SpecialistQueue, NewSpecialistTrigger, SpecialistTrigger } from '../database/ops/schema';
import type { StructuredLogger } from '../../types';

export interface QueueTriggerEvent {
  specialistType: string;
  triggerEvent: string;
  payload: Record<string, any>;
  triggeredBy: string;
  orderId?: string;
  taskUuid?: string;
  priority?: number;
}

export interface QueueProcessingResult {
  success: boolean;
  queueId?: number;
  error?: string;
}

export class SpecialistQueueManager {
  constructor(
    private db: DatabaseService,
    private logger: StructuredLogger
  ) {}

  /**
   * Initialize default specialist triggers
   */
  async initializeTriggers(): Promise<void> {
    const defaultTriggers: Omit<NewSpecialistTrigger, 'id'>[] = [
      // DocString Architect triggers
      {
        specialistType: 'docstring-architect',
        triggerEvent: 'code-generation-complete',
        triggerSource: 'factory-agent',
        condition: JSON.stringify({ minLinesGenerated: 50 }),
        isActive: 1,
      },

      // Lint Surgeon triggers
      {
        specialistType: 'lint-surgeon',
        triggerEvent: 'lint-errors-detected',
        triggerSource: 'lint-runner',
        condition: JSON.stringify({ minErrors: 3 }),
        isActive: 1,
      },

      // Dependency Auditor triggers
      {
        specialistType: 'dependency-auditor',
        triggerEvent: 'dependency-changed',
        triggerSource: 'dependency-scanner',
        condition: JSON.stringify({ majorVersionChange: true }),
        isActive: 1,
      },
    ];

    for (const trigger of defaultTriggers) {
      try {
        await this.db.ops.insert(this.db.opsSchema.specialistTriggers).values(trigger).onConflictDoNothing();
        this.logger.info('Initialized specialist trigger', {
          specialistType: trigger.specialistType,
          triggerEvent: trigger.triggerEvent,
          triggerSource: trigger.triggerSource,
        });
      } catch (error) {
        this.logger.warn('Failed to initialize trigger', {
          trigger,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Trigger a specialist invocation
   */
  async triggerSpecialist(event: QueueTriggerEvent): Promise<QueueProcessingResult> {
    try {
      // Check if trigger is active
      const activeTriggers = await this.db.ops
        .select()
        .from(this.db.opsSchema.specialistTriggers)
        .where(
          and(
            eq(this.db.opsSchema.specialistTriggers.specialistType, event.specialistType),
            eq(this.db.opsSchema.specialistTriggers.triggerEvent, event.triggerEvent),
            eq(this.db.opsSchema.specialistTriggers.isActive, 1)
          )
        );

      if (activeTriggers.length === 0) {
        return {
          success: false,
          error: `No active trigger found for ${event.specialistType}:${event.triggerEvent}`,
        };
      }

      // Check if similar queue item already exists (avoid duplicates)
      const existingQueue = await this.db.ops
        .select()
        .from(this.db.opsSchema.specialistQueues)
        .where(
          and(
            eq(this.db.opsSchema.specialistQueues.specialistType, event.specialistType),
            eq(this.db.opsSchema.specialistQueues.triggerEvent, event.triggerEvent),
            or(
              eq(this.db.opsSchema.specialistQueues.status, 'pending'),
              eq(this.db.opsSchema.specialistQueues.status, 'processing')
            ),
            event.orderId ? eq(this.db.opsSchema.specialistQueues.orderId, event.orderId) : undefined,
            event.taskUuid ? eq(this.db.opsSchema.specialistQueues.taskUuid, event.taskUuid) : undefined
          )
        )
        .limit(1);

      if (existingQueue.length > 0) {
        return {
          success: false,
          error: `Similar queue item already exists (ID: ${existingQueue[0].id})`,
        };
      }

      // Create queue item
      const queueItem: NewSpecialistQueue = {
        specialistType: event.specialistType,
        triggerEvent: event.triggerEvent,
        status: 'pending',
        priority: event.priority || 0,
        payload: JSON.stringify(event.payload),
        triggeredBy: event.triggeredBy,
        orderId: event.orderId,
        taskUuid: event.taskUuid,
      };

      const result = await this.db.ops
        .insert(this.db.opsSchema.specialistQueues)
        .values(queueItem)
        .returning({ id: this.db.opsSchema.specialistQueues.id });

      this.logger.info('Specialist queue item created', {
        queueId: result[0].id,
        specialistType: event.specialistType,
        triggerEvent: event.triggerEvent,
        triggeredBy: event.triggeredBy,
      });

      return {
        success: true,
        queueId: result[0].id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to trigger specialist', {
        event,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get pending queue items for processing
   */
  async getPendingQueueItems(limit: number = 10): Promise<SpecialistQueue[]> {
    return this.db.ops
      .select()
      .from(this.db.opsSchema.specialistQueues)
      .where(eq(this.db.opsSchema.specialistQueues.status, 'pending'))
      .orderBy(this.db.opsSchema.specialistQueues.priority, this.db.opsSchema.specialistQueues.createdAt)
      .limit(limit);
  }

  /**
   * Mark queue item as processing
   */
  async markAsProcessing(queueId: number): Promise<boolean> {
    try {
      const result = await this.db.ops
        .update(this.db.opsSchema.specialistQueues)
        .set({
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(this.db.opsSchema.specialistQueues.id, queueId),
            eq(this.db.opsSchema.specialistQueues.status, 'pending')
          )
        );

      return result > 0;
    } catch (error) {
      this.logger.error('Failed to mark queue item as processing', {
        queueId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Complete queue item with result
   */
  async completeQueueItem(queueId: number, result: Record<string, any>, error?: string): Promise<boolean> {
    try {
      const status = error ? 'failed' : 'completed';
      const updateData: Partial<SpecialistQueue> = {
        status,
        result: result ? JSON.stringify(result) : undefined,
        error,
        updatedAt: new Date(),
        processedAt: new Date(),
      };

      const dbResult = await this.db.ops
        .update(this.db.opsSchema.specialistQueues)
        .set(updateData)
        .where(eq(this.db.opsSchema.specialistQueues.id, queueId));

      this.logger.info('Queue item completed', {
        queueId,
        status,
        hasResult: !!result,
        hasError: !!error,
      });

      return dbResult > 0;
    } catch (updateError) {
      this.logger.error('Failed to complete queue item', {
        queueId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
      return false;
    }
  }

  /**
   * Retry failed queue item
   */
  async retryQueueItem(queueId: number): Promise<boolean> {
    try {
      const queueItem = await this.db.ops
        .select()
        .from(this.db.opsSchema.specialistQueues)
        .where(eq(this.db.opsSchema.specialistQueues.id, queueId))
        .limit(1);

      if (queueItem.length === 0) {
        return false;
      }

      const item = queueItem[0];
      if (item.retryCount >= item.maxRetries) {
        // Mark as permanently failed
        await this.db.ops
          .update(this.db.opsSchema.specialistQueues)
          .set({
            status: 'failed',
            error: `Max retries exceeded (${item.maxRetries})`,
            updatedAt: new Date(),
          })
          .where(eq(this.db.opsSchema.specialistQueues.id, queueId));

        return false;
      }

      // Increment retry count and reset status
      await this.db.ops
        .update(this.db.opsSchema.specialistQueues)
        .set({
          status: 'pending',
          retryCount: item.retryCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(this.db.opsSchema.specialistQueues.id, queueId));

      return true;
    } catch (error) {
      this.logger.error('Failed to retry queue item', {
        queueId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const stats = await this.db.ops
      .select({
        status: this.db.opsSchema.specialistQueues.status,
        count: this.db.ops.count(),
      })
      .from(this.db.opsSchema.specialistQueues)
      .groupBy(this.db.opsSchema.specialistQueues.status);

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const stat of stats) {
      result[stat.status as keyof typeof result] = stat.count as number;
      result.total += stat.count as number;
    }

    return result;
  }

  /**
   * Clean up old completed/failed queue items
   */
  async cleanupOldItems(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.db.ops
        .delete(this.db.opsSchema.specialistQueues)
        .where(
          and(
            or(
              eq(this.db.opsSchema.specialistQueues.status, 'completed'),
              eq(this.db.opsSchema.specialistQueues.status, 'failed')
            ),
            lt(this.db.opsSchema.specialistQueues.createdAt, cutoffDate)
          )
        );

      this.logger.info('Cleaned up old queue items', {
        deletedCount: result,
        olderThanDays,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to cleanup old queue items', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}
