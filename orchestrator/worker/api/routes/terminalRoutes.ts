/**
 * Terminal Routes - PartyServer-based terminal streaming
 *
 * Routes terminal WebSocket connections through PartyServer Durable Objects.
 */

import { Hono } from 'hono';
import { partyserverMiddleware } from 'partykit/hono-party';
import { getServerByName } from 'partykit/partyserver';
import type { AppEnv } from '../../types/appenv';
import { TerminalServer, type TerminalServerEnv } from '../../durable-objects/terminal/TerminalServer';
import { authMiddleware } from '../../middleware/auth';

export function setupTerminalRoutes(app: Hono<AppEnv>): void {
  // Apply PartyServer middleware for terminal routes
  app.use(
    '/api/workers/:workerId/terminal',
    partyserverMiddleware<AppEnv>({
      options: {
        prefix: 'parties',
        onBeforeConnect: async (req, lobby, env) => {
          // Extract workerId from URL
          const url = new URL(req.url);
          const workerId = url.pathname.split('/')[3]; // /api/workers/:workerId/terminal

          if (!workerId) {
            throw new Error('Invalid workerId in path');
          }

          // Authenticate user session
          try {
            await authMiddleware(req, env as any);
          } catch (authError) {
            console.error('Terminal authentication failed:', authError);
            throw new Error('Authentication required for terminal access');
          }

          // TODO: Add authorization checks (user owns/is assigned to this worker)
          // For now, authenticated users can access terminals

          return req;
        },
      },
    })
  );

  // Terminal WebSocket endpoint
  app.get('/api/workers/:workerId/terminal', async (c) => {
    const workerId = c.req.param('workerId');
    const sandboxId = c.req.query('sandboxId'); // Optional sandbox ID
    
    if (!workerId) {
      return c.json({ error: 'workerId is required' }, 400);
    }

    // Get or create TerminalServer instance for this worker
    const terminalServer = await getServerByName<TerminalServerEnv, TerminalServer>(
      c.env.TERMINAL_SERVER as DurableObjectNamespace<TerminalServer>,
      workerId,
      {
        props: {
          workerId,
          sandboxId: sandboxId || '',
        },
      }
    );

    // Forward the request to the Durable Object
    return terminalServer.fetch(c.req.raw);
  });
}

