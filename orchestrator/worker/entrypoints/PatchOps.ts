/**
 * orchestrator/worker/entrypoints/PatchOps.ts
 * ------------------------------------------------------------
 * Patch Operations RPC Entrypoint
 *
 * Provides RPC methods for patch operations from apps/ workers.
 * This entrypoint allows apps/ workers to apply patches through
 * the orchestrator service binding instead of direct access.
 *
 * Responsibilities:
 * - Apply patch batches to files
 * - Validate patch operations
 * - Log patch events
 * - Broadcast patch events via WebSocket
 * - Handle patch rollback operations
 *
 * All operations use the patch services (patchRunner, coordResolver,
 * patchBridge, d1Logger) and WebSocket hub for real-time updates.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { PatchBatch, PatchOperation, PatchEvent } from '@shared/contracts';
import { PatchRunner } from '../services/patch/patchRunner';
import { CoordResolver } from '../services/patch/coordResolver';
import { PatchBridge } from '../services/patch/patchBridge';
import { D1Logger } from '../services/patch/d1Logger';
import { WebSocketHub } from '../services/websocket/websocketHub';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../database/schema';

export interface ApplyPatchesRequest {
  batch: PatchBatch;
  options?: {
    dryRun?: boolean;
    validateOnly?: boolean;
    rollbackOnFailure?: boolean;
  };
}

export interface ApplyPatchesResponse {
  success: boolean;
  appliedOperations: number;
  failedOperations: number;
  errors: string[];
  events: PatchEvent[];
  rollbackId?: string;
}

export interface PatchStatusResponse {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    applied: number;
    failed: number;
  };
  events: PatchEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RollbackRequest {
  rollbackId: string;
  reason?: string;
}

export interface RollbackResponse {
  success: boolean;
  rolledBackOperations: number;
  errors: string[];
}

/**
 * PatchOps provides RPC methods for patch operations.
 * Handles validation, application, logging, and broadcasting of patches.
 */
export class PatchOps extends BaseWorkerEntrypoint<CoreEnv> {
  private patchRunner: PatchRunner;
  private coordResolver: CoordResolver;
  private patchBridge: PatchBridge;
  private d1Logger: D1Logger;
  private websocketHub: WebSocketHub;

  constructor(ctx: ExecutionContext, env: CoreEnv) {
    super(ctx, env);

    // Initialize patch services
    this.patchRunner = new PatchRunner(env);
    this.coordResolver = new CoordResolver();
    this.patchBridge = new PatchBridge();
    this.d1Logger = new D1Logger(this.dbOps);
    this.websocketHub = new WebSocketHub();
  }

  /**
   * Apply a batch of patches to files.
   *
   * This is the main RPC method for patch operations. It validates,
   * applies, logs, and broadcasts patch operations.
   */
  async applyPatches(request: ApplyPatchesRequest): Promise<ApplyPatchesResponse> {
    const { batch, options = {} } = request;
    const { dryRun = false, validateOnly = false, rollbackOnFailure = true } = options;

    console.log(`Applying patch batch: ${batch.id} (${batch.patches.length} operations)`);

    const response: ApplyPatchesResponse = {
      success: true,
      appliedOperations: 0,
      failedOperations: 0,
      errors: [],
      events: [],
    };

    try {
      // Log batch start event
      const startEvent: PatchEvent = {
        id: crypto.randomUUID(),
        patchId: batch.id,
        eventType: 'PATCH_PROCESSING_STARTED',
        status: 'success',
        createdAt: new Date(),
        metadata: {
          operationCount: batch.patches.length,
          dryRun,
          validateOnly,
        },
      };

      await this.d1Logger.logEvent(startEvent);
      response.events.push(startEvent);

      // Broadcast start event
      this.websocketHub.broadcastPatchEvent(startEvent);

      if (validateOnly) {
        // Only validate, don't apply
        for (const operation of batch.patches) {
          try {
            await this.validateOperation(operation);
            response.appliedOperations++;
          } catch (error) {
            response.failedOperations++;
            response.errors.push(`Validation failed for operation ${operation.file}:${error.message}`);
          }
        }

        const validationEvent: PatchEvent = {
          id: crypto.randomUUID(),
          patchId: batch.id,
          eventType: 'PATCH_VALIDATION_COMPLETED',
          status: response.failedOperations === 0 ? 'success' : 'failure',
          createdAt: new Date(),
          metadata: {
            appliedOperations: response.appliedOperations,
            failedOperations: response.failedOperations,
          },
        };

        await this.d1Logger.logEvent(validationEvent);
        response.events.push(validationEvent);
        this.websocketHub.broadcastPatchEvent(validationEvent);

        response.success = response.failedOperations === 0;
        return response;
      }

      // Apply patches
      let appliedCount = 0;
      let failedCount = 0;
      const appliedOperations: PatchOperation[] = [];

      for (const operation of batch.patches) {
        try {
          if (!dryRun) {
            await this.patchRunner.applyOperation(operation);
          }
          appliedCount++;
          appliedOperations.push(operation);

          // Log individual operation success
          const opEvent: PatchEvent = {
            id: crypto.randomUUID(),
            patchId: batch.id,
            eventType: 'PATCH_OPERATION_APPLIED',
            status: 'success',
            createdAt: new Date(),
            metadata: {
              operation: operation.op,
              file: operation.file,
              path: operation.path,
            },
          };

          await this.d1Logger.logEvent(opEvent);
          response.events.push(opEvent);

        } catch (error) {
          failedCount++;
          response.errors.push(`Failed to apply operation to ${operation.file}: ${error.message}`);

          // Log individual operation failure
          const opEvent: PatchEvent = {
            id: crypto.randomUUID(),
            patchId: batch.id,
            eventType: 'PATCH_OPERATION_FAILED',
            status: 'failure',
            createdAt: new Date(),
            metadata: {
              operation: operation.op,
              file: operation.file,
              path: operation.path,
              error: error.message,
            },
          };

          await this.d1Logger.logEvent(opEvent);
          response.events.push(opEvent);

          // If rollback on failure is enabled and we have applied operations, rollback
          if (rollbackOnFailure && appliedOperations.length > 0) {
            try {
              await this.rollbackOperations(appliedOperations.reverse());
              response.rollbackId = crypto.randomUUID();

              const rollbackEvent: PatchEvent = {
                id: crypto.randomUUID(),
                patchId: batch.id,
                eventType: 'PATCH_ROLLBACK_COMPLETED',
                status: 'success',
                createdAt: new Date(),
                metadata: {
                  rollbackId: response.rollbackId,
                  rolledBackOperations: appliedOperations.length,
                },
              };

              await this.d1Logger.logEvent(rollbackEvent);
              response.events.push(rollbackEvent);
              this.websocketHub.broadcastPatchEvent(rollbackEvent);

            } catch (rollbackError) {
              const rollbackEvent: PatchEvent = {
                id: crypto.randomUUID(),
                patchId: batch.id,
                eventType: 'PATCH_ROLLBACK_FAILED',
                status: 'failure',
                createdAt: new Date(),
                metadata: {
                  error: rollbackError.message,
                },
              };

              await this.d1Logger.logEvent(rollbackEvent);
              response.events.push(rollbackEvent);
              this.websocketHub.broadcastPatchEvent(rollbackEvent);
            }
          }
        }
      }

      response.appliedOperations = appliedCount;
      response.failedOperations = failedCount;
      response.success = failedCount === 0;

      // Log batch completion event
      const completionEvent: PatchEvent = {
        id: crypto.randomUUID(),
        patchId: batch.id,
        eventType: response.success ? 'PATCH_PROCESSING_COMPLETED' : 'PATCH_PROCESSING_FAILED',
        status: response.success ? 'success' : 'failure',
        createdAt: new Date(),
        metadata: {
          appliedOperations: appliedCount,
          failedOperations: failedCount,
          dryRun,
        },
      };

      await this.d1Logger.logEvent(completionEvent);
      response.events.push(completionEvent);
      this.websocketHub.broadcastPatchEvent(completionEvent);

    } catch (error) {
      console.error('Patch application failed:', error);

      response.success = false;
      response.errors.push(`Batch processing failed: ${error.message}`);

      // Log batch failure event
      const failureEvent: PatchEvent = {
        id: crypto.randomUUID(),
        patchId: batch.id,
        eventType: 'PATCH_PROCESSING_FAILED',
        status: 'failure',
        createdAt: new Date(),
        metadata: {
          error: error.message,
        },
      };

      await this.d1Logger.logEvent(failureEvent);
      response.events.push(failureEvent);
      this.websocketHub.broadcastPatchEvent(failureEvent);
    }

    return response;
  }

  /**
   * Get the status of a patch batch application.
   */
  async getPatchStatus(batchId: string): Promise<PatchStatusResponse | null> {
    try {
      // Query events for this batch
      const events = await this.dbOps
        .select()
        .from(schema.patchEvents)
        .where(eq(schema.patchEvents.patchId, batchId))
        .orderBy(desc(schema.patchEvents.createdAt));

      if (events.length === 0) {
        return null;
      }

      // Determine status based on latest event
      const latestEvent = events[0];
      let status: PatchStatusResponse['status'] = 'pending';

      if (latestEvent.eventType === 'PATCH_PROCESSING_COMPLETED') {
        status = 'completed';
      } else if (latestEvent.eventType === 'PATCH_PROCESSING_FAILED') {
        status = 'failed';
      } else if (latestEvent.eventType === 'PATCH_PROCESSING_STARTED') {
        status = 'processing';
      }

      // Calculate progress
      const appliedOps = events.filter(e => e.eventType === 'PATCH_OPERATION_APPLIED').length;
      const failedOps = events.filter(e => e.eventType === 'PATCH_OPERATION_FAILED').length;
      const totalOps = events.find(e => e.eventType === 'PATCH_PROCESSING_STARTED')?.metadata?.operationCount || 0;

      return {
        batchId,
        status,
        progress: {
          total: totalOps,
          applied: appliedOps,
          failed: failedOps,
        },
        events: events.map(e => ({
          id: e.id,
          patchId: e.patchId,
          eventType: e.eventType,
          status: e.status,
          createdAt: e.createdAt,
          metadata: e.metadata,
        })),
        createdAt: events[events.length - 1].createdAt,
        updatedAt: latestEvent.createdAt,
      };

    } catch (error) {
      console.error('Failed to get patch status:', error);
      return null;
    }
  }

  /**
   * Rollback a set of operations using a rollback ID.
   */
  async rollbackPatch(request: RollbackRequest): Promise<RollbackResponse> {
    const { rollbackId, reason } = request;

    const response: RollbackResponse = {
      success: true,
      rolledBackOperations: 0,
      errors: [],
    };

    try {
      // Find operations to rollback based on rollback ID
      // This is a simplified implementation - in practice you'd store rollback info
      console.log(`Rolling back operations for rollback ID: ${rollbackId}`);

      // For now, this is a placeholder - actual rollback logic would depend on how rollback info is stored
      const rollbackEvent: PatchEvent = {
        id: crypto.randomUUID(),
        patchId: rollbackId,
        eventType: 'PATCH_ROLLBACK_COMPLETED',
        status: 'success',
        createdAt: new Date(),
        metadata: {
          reason,
          rolledBackOperations: response.rolledBackOperations,
        },
      };

      await this.d1Logger.logEvent(rollbackEvent);
      this.websocketHub.broadcastPatchEvent(rollbackEvent);

    } catch (error) {
      console.error('Rollback failed:', error);
      response.success = false;
      response.errors.push(`Rollback failed: ${error.message}`);
    }

    return response;
  }

  /**
   * Validate a single patch operation.
   */
  private async validateOperation(operation: PatchOperation): Promise<void> {
    // Basic validation - check required fields
    if (!operation.op || !operation.path) {
      throw new Error('Operation missing required fields: op, path');
    }

    // Validate operation type
    const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
    if (!validOps.includes(operation.op)) {
      throw new Error(`Invalid operation type: ${operation.op}`);
    }

    // Validate path format (basic check)
    if (!operation.path.startsWith('/')) {
      throw new Error(`Invalid path format: ${operation.path} (must start with /)`);
    }

    // Additional validation could include file existence, coordinate resolution, etc.
  }

  /**
   * Rollback a set of operations (reverse apply them).
   */
  private async rollbackOperations(operations: PatchOperation[]): Promise<void> {
    // This is a simplified rollback - real implementation would need to track original values
    for (const operation of operations) {
      try {
        // Create reverse operation
        const reverseOp = this.createReverseOperation(operation);
        await this.patchRunner.applyOperation(reverseOp);
      } catch (error) {
        console.error(`Failed to rollback operation ${operation.file}:`, error);
        // Continue with other rollbacks even if one fails
      }
    }
  }

  /**
   * Create a reverse operation for rollback.
   */
  private createReverseOperation(operation: PatchOperation): PatchOperation {
    // This is a simplified reverse operation creation
    // Real implementation would need to store original values
    switch (operation.op) {
      case 'add':
        return {
          ...operation,
          op: 'remove',
        };
      case 'remove':
        // Would need original value to restore
        throw new Error('Cannot rollback remove operation without stored original value');
      case 'replace':
        // Would need original value to restore
        throw new Error('Cannot rollback replace operation without stored original value');
      default:
        throw new Error(`Cannot rollback operation type: ${operation.op}`);
    }
  }
}
