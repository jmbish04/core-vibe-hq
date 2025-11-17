/**
 * WebSocket Routes
 *
 * Handles WebSocket upgrade requests and connection management
 * through the WebSocketHub service.
 */

import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { WebSocketHub } from '../../services/websocket/websocketHub';

/**
 * WebSocket authentication middleware
 */
export function websocketAuthMiddleware(websocketHub: WebSocketHub) {
  return async (c: any, next: any) => {
    // For now, allow all connections - authentication can be added later
    c.set('websocketHub', websocketHub);
    await next();
  };
}

/**
 * Setup WebSocket routes
 */
export function setupWebSocketRoutes(app: Hono<AppEnv>, websocketHub: WebSocketHub): void {
  /**
   * GET /ws
   *
   * WebSocket upgrade endpoint
   * Handles the initial connection and upgrades HTTP to WebSocket protocol
   */
  app.get('/ws', async (c) => {
    try {
      // Create a new WebSocketPair
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Register the WebSocket connection with the hub
      const connectionId = websocketHub.registerConnection(server);

      // Send a confirmation message to the client
      server.send(JSON.stringify({
        type: 'connection_established',
        connectionId,
        message: 'WebSocket connection established successfully',
      }));

      // Return the client-side WebSocket as the response
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      return c.json({ error: 'WebSocket upgrade failed' }, 500);
    }
  });
}
