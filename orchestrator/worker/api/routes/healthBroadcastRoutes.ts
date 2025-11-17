/**
 * Health Broadcast Routes - PartyServer-based health check broadcast
 * 
 * Routes health check broadcast WebSocket connections through PartyServer Durable Objects.
 */

import { Hono } from 'hono';
import { partyserverMiddleware } from '../../../../third_party/partykit/packages/hono-party/src/index';
import type { AppEnv } from '../../types/appenv';

export function setupHealthBroadcastRoutes(app: Hono<AppEnv>): void {
  // Apply PartyServer middleware for health broadcast routes
  app.use(
    '/api/health/broadcast',
    partyserverMiddleware<AppEnv>({
      options: {
        prefix: 'parties',
      },
    })
  );

  // Health broadcast WebSocket endpoint
  app.get('/api/health/broadcast', async (c) => {
    // Get or create HealthCheckBroadcastServer instance
    const { getServerByName } = await import('../../../../third_party/partykit/packages/partyserver/src/index');
    const { HealthCheckBroadcastServer } = await import('../../durable-objects/health/HealthCheckBroadcastServer');
    
    const broadcastServer = await getServerByName(
      c.env.HEALTH_CHECK_BROADCAST as DurableObjectNamespace<HealthCheckBroadcastServer>,
      'main' // Single broadcast channel for all health checks
    );

    // Forward the request to the Durable Object
    return broadcastServer.fetch(c.req.raw);
  });
}

