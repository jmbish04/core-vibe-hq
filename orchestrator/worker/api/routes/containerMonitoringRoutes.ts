/**
 * Container Monitoring API Routes
 *
 * Provides HTTP endpoints for container monitoring operations:
 * - POST /api/monitoring/errors - Store container error
 * - GET /api/monitoring/errors - Get container errors
 * - POST /api/monitoring/logs - Store container log(s)
 * - GET /api/monitoring/logs - Get container logs
 * - POST /api/monitoring/processes - Create/update container process
 * - GET /api/monitoring/processes/:instanceId - Get container process
 * - GET /api/monitoring/processes - List container processes
 */

import { Hono } from 'hono';
import type { Env } from '../../types';
import { ContainerMonitoringOps } from '../../entrypoints/ContainerMonitoringOps';

const app = new Hono<{ Bindings: Env }>();

// Create ContainerMonitoringOps instance helper
function getContainerMonitoringOps(env: Env, ctx: ExecutionContext): ContainerMonitoringOps {
  return new ContainerMonitoringOps(ctx, env);
}

/**
 * POST /api/monitoring/errors
 * Store a container error
 */
app.post('/errors', async (c) => {
  try {
    const body = await c.req.json();
    const { workerName, containerName, instanceId, processId, errorHash, timestamp, level, message, rawOutput } = body;

    if (!workerName || !instanceId || !processId || !errorHash || !timestamp || level === undefined || !message || !rawOutput) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const ops = getContainerMonitoringOps(c.env, c.executionCtx);
    const result = await ops.storeError({
      workerName,
      containerName,
      instanceId,
      processId,
      errorHash,
      timestamp,
      level,
      message,
      rawOutput,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Store error failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /api/monitoring/errors
 * Get container errors with optional filters
 */
app.get('/errors', async (c) => {
  try {
    const workerName = c.req.query('workerName');
    const containerName = c.req.query('containerName');
    const instanceId = c.req.query('instanceId');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

    const ops = getContainerMonitoringOps(c.env, c.executionCtx);
    const result = await ops.getErrors({
      workerName,
      containerName,
      instanceId,
      limit,
      offset,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Get errors failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /api/monitoring/logs
 * Store container log(s) - supports single log or batch
 */
app.post('/logs', async (c) => {
  try {
    const body = await c.req.json();

    // Check if it's a batch operation (has 'logs' array) or single log
    if (body.logs && Array.isArray(body.logs)) {
      // Batch operation
      const { workerName, containerName, instanceId, processId, logs } = body;

      if (!workerName || !instanceId || !processId || !logs || !Array.isArray(logs)) {
        return c.json({ error: 'Missing required fields for batch log storage' }, 400);
      }

      const ops = getContainerMonitoringOps(c.env, c.executionCtx);
      const result = await ops.storeLogs({
        workerName,
        containerName,
        instanceId,
        processId,
        logs,
      });

      return c.json({ success: true, data: result });
    } else {
      // Single log operation
      const { workerName, containerName, instanceId, processId, sequence, timestamp, level, message, stream, source, metadata } = body;

      if (!workerName || !instanceId || !processId || sequence === undefined || !timestamp || !level || !message || !stream) {
        return c.json({ error: 'Missing required fields for log storage' }, 400);
      }

      const ops = getContainerMonitoringOps(c.env, c.executionCtx);
      const result = await ops.storeLog({
        workerName,
        containerName,
        instanceId,
        processId,
        sequence,
        timestamp,
        level,
        message,
        stream,
        source,
        metadata,
      });

      return c.json({ success: true, data: result });
    }
  } catch (error: any) {
    console.error('Store log(s) failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /api/monitoring/logs
 * Get container logs with optional filters
 */
app.get('/logs', async (c) => {
  try {
    const workerName = c.req.query('workerName');
    const containerName = c.req.query('containerName');
    const instanceId = c.req.query('instanceId');
    const since = c.req.query('since');
    const until = c.req.query('until');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;
    const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined;

    const ops = getContainerMonitoringOps(c.env, c.executionCtx);
    const result = await ops.getLogs({
      workerName,
      containerName,
      instanceId,
      since,
      until,
      limit,
      offset,
      sortOrder,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Get logs failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /api/monitoring/processes
 * Create or update a container process
 */
app.post('/processes', async (c) => {
  try {
    const body = await c.req.json();
    const { workerName, containerName, instanceId, processId, command, args, cwd, status, restartCount, startTime, endTime, exitCode, lastError, env } = body;

    if (!workerName || !instanceId || !command || !cwd || !status) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const ops = getContainerMonitoringOps(c.env, c.executionCtx);
    const result = await ops.upsertProcess({
      workerName,
      containerName,
      instanceId,
      processId,
      command,
      args,
      cwd,
      status,
      restartCount,
      startTime,
      endTime,
      exitCode,
      lastError,
      env,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Upsert process failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /api/monitoring/processes/:instanceId
 * Get container process by instance ID
 */
app.get('/processes/:instanceId', async (c) => {
  try {
    const instanceId = c.req.param('instanceId');

    if (!instanceId) {
      return c.json({ error: 'Instance ID is required' }, 400);
    }

    const ops = getContainerMonitoringOps(c.env, c.executionCtx);
    const result = await ops.getProcess({ instanceId });

    if (!result) {
      return c.json({ error: 'Process not found' }, 404);
    }

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Get process failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /api/monitoring/processes
 * List container processes with optional filters
 */
app.get('/processes', async (c) => {
  try {
    const workerName = c.req.query('workerName');
    const containerName = c.req.query('containerName');
    const status = c.req.query('status');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

    const ops = getContainerMonitoringOps(c.env, c.executionCtx);
    const result = await ops.getProcesses({
      workerName,
      containerName,
      status,
      limit,
      offset,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Get processes failed:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

export { app as containerMonitoringRoutes };

