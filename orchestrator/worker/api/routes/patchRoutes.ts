/**
 * Patch Routes
 *
 * HTTP routes for patch operations. Provides REST endpoints for
 * applying patches, checking status, and managing patch operations.
 */

import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';
import { PatchBatchSchema } from '@shared/contracts';

/**
 * Setup patch routes
 */
export function setupPatchRoutes(app: Hono<AppEnv>): void {
  /**
     * POST /api/patches/apply
     *
     * Apply a batch of patches to files.
     *
     * Request body:
     * {
     *   "batch": PatchBatch,
     *   "options": {
     *     "dryRun": boolean,
     *     "validateOnly": boolean,
     *     "rollbackOnFailure": boolean
     *   }
     * }
     *
     * Response:
     * {
     *   "success": boolean,
     *   "appliedOperations": number,
     *   "failedOperations": number,
     *   "errors": string[],
     *   "events": PatchEvent[],
     *   "rollbackId": string
     * }
     */
  app.post('/api/patches/apply', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const body = await c.req.json();
      const { batch, options = {} } = body;

      // Validate request
      const validatedBatch = PatchBatchSchema.parse(batch);

      // Call PatchOps entrypoint
      const result = await c.env.ORCHESTRATOR_PATCH.applyPatches({
        batch: validatedBatch,
        options,
      });

      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      console.error('Patch application failed:', error);
      return c.json({
        success: false,
        appliedOperations: 0,
        failedOperations: 1,
        errors: [`Request validation failed: ${error.message}`],
        events: [],
      }, 400);
    }
  });

  /**
     * GET /api/patches/:batchId/status
     *
     * Get the status of a patch batch application.
     *
     * Response:
     * {
     *   "batchId": string,
     *   "status": "pending" | "processing" | "completed" | "failed",
     *   "progress": {
     *     "total": number,
     *     "applied": number,
     *     "failed": number
     *   },
     *   "events": PatchEvent[],
     *   "createdAt": Date,
     *   "updatedAt": Date
     * }
     */
  app.get('/api/patches/:batchId/status', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const batchId = c.req.param('batchId');

      if (!batchId) {
        return c.json({ error: 'Batch ID is required' }, 400);
      }

      const status = await c.env.ORCHESTRATOR_PATCH.getPatchStatus(batchId);

      if (!status) {
        return c.json({ error: 'Batch not found' }, 404);
      }

      return c.json(status);
    } catch (error) {
      console.error('Failed to get patch status:', error);
      return c.json({ error: 'Failed to get patch status' }, 500);
    }
  });

  /**
     * POST /api/patches/rollback
     *
     * Rollback a set of patch operations.
     *
     * Request body:
     * {
     *   "rollbackId": string,
     *   "reason": string
     * }
     *
     * Response:
     * {
     *   "success": boolean,
     *   "rolledBackOperations": number,
     *   "errors": string[]
     * }
     */
  app.post('/api/patches/rollback', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const body = await c.req.json();
      const { rollbackId, reason } = body;

      if (!rollbackId) {
        return c.json({ error: 'Rollback ID is required' }, 400);
      }

      const result = await c.env.ORCHESTRATOR_PATCH.rollbackPatch({
        rollbackId,
        reason,
      });

      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      console.error('Patch rollback failed:', error);
      return c.json({
        success: false,
        rolledBackOperations: 0,
        errors: [`Rollback failed: ${error.message}`],
      }, 400);
    }
  });

  /**
     * GET /api/patches/history
     *
     * Get patch operation history with optional filtering.
     *
     * Query parameters:
     * - limit: number (default: 50, max: 200)
     * - offset: number (default: 0)
     * - status: "success" | "failure"
     * - eventType: string
     * - patchId: string
     *
     * Response:
     * {
     *   "events": PatchEvent[],
     *   "total": number,
     *   "limit": number,
     *   "offset": number
     * }
     */
  app.get('/api/patches/history', setAuthLevel(AuthConfig.authenticated), async (c) => {
    try {
      const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
      const offset = parseInt(c.req.query('offset') || '0');
      const status = c.req.query('status');
      const eventType = c.req.query('eventType');
      const patchId = c.req.query('patchId');

      // This would typically call a method on PatchOps to get history
      // For now, return a placeholder response
      return c.json({
        events: [],
        total: 0,
        limit,
        offset,
        message: 'Patch history endpoint - implementation pending',
      });
    } catch (error) {
      console.error('Failed to get patch history:', error);
      return c.json({ error: 'Failed to get patch history' }, 500);
    }
  });
}
