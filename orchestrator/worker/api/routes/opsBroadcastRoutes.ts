/**
 * Ops Broadcast Routes - PartyServer-based ops scan broadcast
 * 
 * Routes ops monitor broadcast WebSocket connections through PartyServer Durable Objects.
 */

import { Hono } from 'hono';
import { partyserverMiddleware } from '../../../../third_party/partykit/packages/hono-party/src/index';
import type { AppEnv } from '../../types/appenv';

export function setupOpsBroadcastRoutes(app: Hono<AppEnv>): void {
  // Apply PartyServer middleware for ops broadcast routes
  app.use(
    '/api/ops/broadcast',
    partyserverMiddleware<AppEnv>({
      options: {
        prefix: 'parties',
      },
    })
  );

  // Ops broadcast WebSocket endpoint
  app.get('/api/ops/broadcast', async (c) => {
    // Get or create OpsMonitorBroadcastServer instance
    const { getServerByName } = await import('../../../../third_party/partykit/packages/partyserver/src/index');
    const { OpsMonitorBroadcastServer } = await import('../../durable-objects/ops/OpsMonitorBroadcastServer');
    
    const broadcastServer = await getServerByName(
      c.env.OPS_MONITOR_BROADCAST as DurableObjectNamespace<OpsMonitorBroadcastServer>,
      'main' // Single broadcast channel for all ops scans
    );

    // Forward the request to the Durable Object
    return broadcastServer.fetch(c.req.raw);
  });
}

