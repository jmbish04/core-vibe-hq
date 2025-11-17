/**
 * WebSocket Hub Service
 *
 * Central hub for managing WebSocket connections and broadcasting patch events.
 * Handles connection lifecycle, authentication, and message routing for real-time
 * communication between orchestrator and connected clients.
 */

import { WebSocketMessage, WebSocketMessageSchema, PatchEvent } from '@shared/contracts';

export interface WebSocketConnection {
  id: string;
  websocket: WebSocket;
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface BroadcastOptions {
  excludeConnection?: string;
  targetUserId?: string;
  targetSessionId?: string;
  channels?: string[];
}

/**
 * WebSocketHub manages all WebSocket connections and handles broadcasting
 * of patch events and other real-time messages to connected clients.
 */
export class WebSocketHub {
  private connections = new Map<string, WebSocketConnection>();
  private channelSubscriptions = new Map<string, Set<string>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register a new WebSocket connection.
   *
   * @param websocket - The WebSocket instance
   * @param env - Environment context
   * @returns Connection ID
   */
  registerConnection(
    websocket: WebSocket,
    env?: { userId?: string; sessionId?: string; metadata?: Record<string, any> },
  ): string {
    const connectionId = crypto.randomUUID();
    const connection: WebSocketConnection = {
      id: connectionId,
      websocket,
      authenticated: false,
      userId: env?.userId,
      sessionId: env?.sessionId,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: env?.metadata,
    };

    this.connections.set(connectionId, connection);

    // Set up message handler
    websocket.addEventListener('message', (event) => {
      this.handleMessage(connectionId, event.data).catch(error => {
        console.error(`Error handling message from ${connectionId}:`, error);
        this.sendError(connectionId, 'Message processing failed', error.message);
      });
    });

    // Set up close handler
    websocket.addEventListener('close', () => {
      this.removeConnection(connectionId);
    });

    // Set up error handler
    websocket.addEventListener('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error);
      this.removeConnection(connectionId);
    });

    console.log(`WebSocket connection registered: ${connectionId}`);
    return connectionId;
  }

  /**
   * Remove a WebSocket connection.
   */
  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from all subscriptions
    for (const channel of connection.subscriptions) {
      const subscribers = this.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.channelSubscriptions.delete(channel);
        }
      }
    }

    this.connections.delete(connectionId);
    console.log(`WebSocket connection removed: ${connectionId}`);
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private async handleMessage(connectionId: string, data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      const validatedMessage = WebSocketMessageSchema.parse(message);

      const connection = this.connections.get(connectionId);
      if (!connection) {
        return;
      }

      connection.lastActivity = new Date();

      switch (validatedMessage.type) {
        case 'auth':
          await this.handleAuth(connectionId, validatedMessage.payload);
          break;

        case 'subscribe':
          this.handleSubscribe(connectionId, validatedMessage.payload);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, validatedMessage.payload);
          break;

        case 'data':
          await this.handleDataMessage(connectionId, validatedMessage.payload);
          break;

        default:
          this.sendError(connectionId, 'Unknown message type', validatedMessage.type);
      }
    } catch (error) {
      console.error(`Invalid message from ${connectionId}:`, error);
      this.sendError(connectionId, 'Invalid message format', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle authentication messages.
   */
  private async handleAuth(connectionId: string, payload: { token: string }): Promise<void> {
    // TODO: Implement proper token validation
    // For now, just accept any token
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.authenticated = true;
      this.sendMessage(connectionId, {
        id: crypto.randomUUID(),
        type: 'data',
        payload: { data: { status: 'authenticated', connectionId } },
      });
    }
  }

  /**
   * Handle subscription messages.
   */
  private handleSubscribe(connectionId: string, payload: { channel: string; filters?: Record<string, any> }): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return Promise.resolve();
    }

    const { channel, filters } = payload;

    // Add to connection subscriptions
    connection.subscriptions.add(channel);

    // Add to channel subscriptions
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(connectionId);

    // Send confirmation
    this.sendMessage(connectionId, {
      id: crypto.randomUUID(),
      type: 'data',
      payload: {
        data: {
          status: 'subscribed',
          channel,
          filters,
        },
      },
    });

    console.log(`Connection ${connectionId} subscribed to channel: ${channel}`);
    return Promise.resolve();
  }

  /**
   * Handle unsubscription messages.
   */
  private handleUnsubscribe(connectionId: string, payload: { channel: string; filters?: Record<string, any> }): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return Promise.resolve();
    }

    const { channel } = payload;

    // Remove from connection subscriptions
    connection.subscriptions.delete(channel);

    // Remove from channel subscriptions
    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    // Send confirmation
    this.sendMessage(connectionId, {
      id: crypto.randomUUID(),
      type: 'data',
      payload: {
        data: {
          status: 'unsubscribed',
          channel,
        },
      },
    });

    console.log(`Connection ${connectionId} unsubscribed from channel: ${channel}`);
    return Promise.resolve();
  }

  /**
   * Handle data messages (for future extensibility).
   */
  private async handleDataMessage(connectionId: string, payload: { data: any }): Promise<void> {
    // For now, just echo back with acknowledgment
    this.sendMessage(connectionId, {
      id: crypto.randomUUID(),
      type: 'data',
      payload: {
        data: {
          acknowledged: true,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Broadcast a patch event to all subscribed connections.
   */
  broadcastPatchEvent(patchEvent: PatchEvent, options: BroadcastOptions = {}): void {
    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: 'event',
      payload: patchEvent,
    };

    this.broadcast(message, {
      ...options,
      channels: ['patch-events', `patch-${patchEvent.patchId}`],
    });
  }

  /**
   * Broadcast a message to connections based on criteria.
   */
  broadcast(message: WebSocketMessage, options: BroadcastOptions = {}): void {
    const {
      excludeConnection,
      targetUserId,
      targetSessionId,
      channels = [],
    } = options;

    let targetConnections = Array.from(this.connections.keys());

    // Filter by user ID
    if (targetUserId) {
      targetConnections = targetConnections.filter(id => {
        const conn = this.connections.get(id);
        return conn?.userId === targetUserId;
      });
    }

    // Filter by session ID
    if (targetSessionId) {
      targetConnections = targetConnections.filter(id => {
        const conn = this.connections.get(id);
        return conn?.sessionId === targetSessionId;
      });
    }

    // Filter by channels (if specified)
    if (channels.length > 0) {
      targetConnections = targetConnections.filter(id => {
        const conn = this.connections.get(id);
        return channels.some(channel => conn?.subscriptions.has(channel));
      });
    }

    // Exclude specific connection
    if (excludeConnection) {
      targetConnections = targetConnections.filter(id => id !== excludeConnection);
    }

    // Send to all matching connections
    for (const connectionId of targetConnections) {
      this.sendMessage(connectionId, message);
    }

    console.log(`Broadcasted message to ${targetConnections.length} connections`);
  }

  /**
   * Send a message to a specific connection.
   */
  sendMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`Attempted to send message to non-existent connection: ${connectionId}`);
      return;
    }

    try {
      const serializedMessage = JSON.stringify(message);
      connection.websocket.send(serializedMessage);
    } catch (error) {
      console.error(`Failed to send message to ${connectionId}:`, error);
      // Connection might be broken, remove it
      this.removeConnection(connectionId);
    }
  }

  /**
   * Send an error message to a connection.
   */
  private sendError(connectionId: string, error: string, details?: string): void {
    this.sendMessage(connectionId, {
      id: crypto.randomUUID(),
      type: 'data',
      payload: {
        data: {
          error,
          details,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Get connection statistics.
   */
  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    activeSubscriptions: number;
    channels: string[];
    } {
    const authenticatedConnections = Array.from(this.connections.values())
      .filter(conn => conn.authenticated).length;

    const activeSubscriptions = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.subscriptions.size, 0);

    return {
      totalConnections: this.connections.size,
      authenticatedConnections,
      activeSubscriptions,
      channels: Array.from(this.channelSubscriptions.keys()),
    };
  }

  /**
   * Start heartbeat monitoring to clean up stale connections.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [connectionId, connection] of this.connections) {
        if (now - connection.lastActivity.getTime() > staleThreshold) {
          console.log(`Removing stale connection: ${connectionId}`);
          this.removeConnection(connectionId);
        }
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.websocket.close(1000, 'Server shutdown');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }

    this.connections.clear();
    this.channelSubscriptions.clear();
  }
}
