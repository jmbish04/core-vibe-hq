import { DurableObject } from 'cloudflare:workers';
import { WebSocketHandler } from './websocketHandler';

export interface HealthWebSocketEnv {
  HEALTH_WEBSOCKET: DurableObject<HealthWebSocketEnv>;
  DB: D1Database;
  AI: any;
}

export class HealthWebSocket extends DurableObject<HealthWebSocketEnv> {
  private handler: WebSocketHandler;

  constructor(ctx: DurableObjectState, env: HealthWebSocketEnv) {
    super(ctx, env);
    this.handler = new WebSocketHandler();
  }

  async fetch(request: Request): Promise<Response> {
    return this.handler.handleRequest(request, this.ctx);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string);
      await this.handler.handleMessage(ws, data, this.broadcast.bind(this));
    } catch (error) {
      console.error('Health WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.handler.handleClose(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('Health WebSocket error:', error);
    this.handler.handleError(ws, error);
  }

  // Broadcast methods for health updates
  async broadcastHealthUpdate(update: any): Promise<void> {
    const message = JSON.stringify({
      type: 'health_update',
      data: update,
      timestamp: Date.now()
    });

    this.handler.broadcast(message);
  }

  async broadcastTestResult(runId: string, testResult: any): Promise<void> {
    const message = JSON.stringify({
      type: 'test_result',
      runId,
      data: testResult,
      timestamp: Date.now()
    });

    this.handler.broadcast(message);
  }

  async broadcastRunStatus(runId: string, status: any): Promise<void> {
    const message = JSON.stringify({
      type: 'run_status',
      runId,
      data: status,
      timestamp: Date.now()
    });

    this.handler.broadcast(message);
  }

  // Private broadcast helper
  private broadcast(message: string): void {
    this.handler.broadcast(message);
  }
}

// WebSocket message handler
class WebSocketHandler {
  private connections = new Map<WebSocket, ConnectionInfo>();
  private subscribers = new Map<string, Set<WebSocket>>();

  handleRequest(request: Request, ctx: DurableObjectState): Response {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    ctx.acceptWebSocket(server);

    // Initialize connection
    const connectionInfo: ConnectionInfo = {
      id: this.generateId(),
      subscribedChannels: new Set(['health']), // Default subscription
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.connections.set(server, connectionInfo);

    // Subscribe to default channel
    this.subscribeToChannel(server, 'health');

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      connectionId: connectionInfo.id,
      timestamp: Date.now(),
      message: 'Connected to Health WebSocket'
    }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleMessage(ws: WebSocket, data: any, broadcast: (message: string) => void): Promise<void> {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.lastActivity = Date.now();

    try {
      switch (data.type) {
        case 'subscribe':
          if (data.channels && Array.isArray(data.channels)) {
            data.channels.forEach((channel: string) => {
              this.subscribeToChannel(ws, channel);
            });
          }
          ws.send(JSON.stringify({
            type: 'subscribed',
            channels: data.channels,
            timestamp: Date.now()
          }));
          break;

        case 'unsubscribe':
          if (data.channels && Array.isArray(data.channels)) {
            data.channels.forEach((channel: string) => {
              this.unsubscribeFromChannel(ws, channel);
            });
          }
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            channels: data.channels,
            timestamp: Date.now()
          }));
          break;

        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;

        case 'get_status':
          // Send current status (would need to fetch from database)
          ws.send(JSON.stringify({
            type: 'status_response',
            status: 'connected',
            uptime: Date.now() - connection.connectedAt,
            timestamp: Date.now()
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`,
            timestamp: Date.now()
          }));
      }
    } catch (error) {
      console.error('WebSocket message handling error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message',
        timestamp: Date.now()
      }));
    }
  }

  handleClose(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    if (connection) {
      // Unsubscribe from all channels
      connection.subscribedChannels.forEach(channel => {
        this.unsubscribeFromChannel(ws, channel);
      });

      this.connections.delete(ws);
      console.log(`WebSocket connection closed: ${connection.id}`);
    }
  }

  handleError(ws: WebSocket, error: unknown): void {
    console.error('WebSocket error:', error);
    // Connection will be cleaned up by handleClose
  }

  broadcast(message: string): void {
    try {
      const data = JSON.parse(message);
      const targetChannel = this.getTargetChannel(data);

      if (targetChannel) {
        // Broadcast to specific channel subscribers
        const subscribers = this.subscribers.get(targetChannel);
        if (subscribers) {
          subscribers.forEach(ws => {
            try {
              ws.send(message);
            } catch (error) {
              console.error('Failed to send message to subscriber:', error);
              // Remove dead connections
              this.handleClose(ws);
            }
          });
        }
      } else {
        // Broadcast to all connections
        this.connections.forEach((_, ws) => {
          try {
            ws.send(message);
          } catch (error) {
            console.error('Failed to broadcast to connection:', error);
            this.handleClose(ws);
          }
        });
      }
    } catch (error) {
      console.error('Broadcast error:', error);
    }
  }

  private subscribeToChannel(ws: WebSocket, channel: string): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)!.add(ws);

    const connection = this.connections.get(ws);
    if (connection) {
      connection.subscribedChannels.add(channel);
    }

    console.log(`WebSocket subscribed to channel: ${channel}`);
  }

  private unsubscribeFromChannel(ws: WebSocket, channel: string): void {
    const subscribers = this.subscribers.get(channel);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscribers.delete(channel);
      }
    }

    const connection = this.connections.get(ws);
    if (connection) {
      connection.subscribedChannels.delete(channel);
    }

    console.log(`WebSocket unsubscribed from channel: ${channel}`);
  }

  private getTargetChannel(data: any): string | null {
    // Determine target channel based on message type
    switch (data.type) {
      case 'health_update':
      case 'test_result':
      case 'run_status':
        return 'health';
      case 'ai_update':
        return 'ai';
      case 'performance_update':
        return 'performance';
      default:
        return null; // Broadcast to all
    }
  }

  private generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Health monitoring methods
  getConnectionStats(): ConnectionStats {
    return {
      totalConnections: this.connections.size,
      channelSubscriptions: Array.from(this.subscribers.entries()).map(([channel, subs]) => ({
        channel,
        subscriberCount: subs.size
      })),
      uptime: Date.now() - Math.min(...Array.from(this.connections.values()).map(c => c.connectedAt))
    };
  }

  // Clean up inactive connections
  cleanupInactiveConnections(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toRemove: WebSocket[] = [];

    this.connections.forEach((connection, ws) => {
      if (now - connection.lastActivity > maxAge) {
        toRemove.push(ws);
      }
    });

    toRemove.forEach(ws => {
      this.handleClose(ws);
    });

    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} inactive WebSocket connections`);
    }
  }
}

interface ConnectionInfo {
  id: string;
  subscribedChannels: Set<string>;
  connectedAt: number;
  lastActivity: number;
}

interface ConnectionStats {
  totalConnections: number;
  channelSubscriptions: Array<{
    channel: string;
    subscriberCount: number;
  }>;
  uptime: number;
}
