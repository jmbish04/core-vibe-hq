/**
 * HealthCheckBroadcastServer - PartyServer-based Durable Object for health check broadcasts
 * 
 * Broadcasts health check results and updates to connected clients in real-time.
 */

import { Server } from 'partykit/partyserver';
import type { Connection, ConnectionContext } from 'partykit/partyserver';
import type { HealthCheckStatusResponse } from '../../entrypoints/types';

export interface HealthCheckBroadcastEnv {
  // No specific bindings needed
}

/**
 * HealthCheckBroadcastServer manages WebSocket connections for health check broadcasts
 */
export class HealthCheckBroadcastServer extends Server<HealthCheckBroadcastEnv> {
  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    // Send welcome message
    connection.send(JSON.stringify({
      type: 'connected',
      message: 'Health check broadcast connection established',
      timestamp: new Date().toISOString(),
    }));
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer): Promise<void> {
    // Handle client messages if needed (e.g., subscription filters)
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
      
      if (data.type === 'subscribe') {
        // Client can subscribe to specific worker types or health check UUIDs
        connection.send(JSON.stringify({
          type: 'subscribed',
          filters: data.filters || {},
        }));
      }
    } catch (error) {
      console.error('Error handling client message:', error);
    }
  }

  /**
   * Broadcast health check status update to all connected clients
   */
  broadcastHealthCheckStatus(status: HealthCheckStatusResponse): void {
    const message = JSON.stringify({
      type: 'health-check-status',
      data: status,
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Broadcast health check start notification
   */
  broadcastHealthCheckStart(healthCheckUuid: string, triggerType: string, triggerSource: string): void {
    const message = JSON.stringify({
      type: 'health-check-start',
      data: {
        health_check_uuid: healthCheckUuid,
        trigger_type: triggerType,
        trigger_source: triggerSource,
      },
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Broadcast worker health check result
   */
  broadcastWorkerResult(workerName: string, result: {
    worker_check_uuid: string;
    status: string;
    overall_status: string | null;
    health_score: number | null;
    error_message: string | null;
  }): void {
    const message = JSON.stringify({
      type: 'worker-result',
      data: {
        worker_name: workerName,
        ...result,
      },
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Broadcast health check completion
   */
  broadcastHealthCheckComplete(healthCheckUuid: string, status: HealthCheckStatusResponse): void {
    const message = JSON.stringify({
      type: 'health-check-complete',
      data: {
        health_check_uuid: healthCheckUuid,
        status,
      },
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Handle HTTP requests for broadcasting health check updates
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      try {
        const body = await request.json();
        
        if (body.type === 'status') {
          this.broadcastHealthCheckStatus(body.data as HealthCheckStatusResponse);
        } else if (body.type === 'start') {
          this.broadcastHealthCheckStart(
            body.data.health_check_uuid,
            body.data.trigger_type,
            body.data.trigger_source
          );
        } else if (body.type === 'worker-result') {
          this.broadcastWorkerResult(body.data.worker_name, body.data);
        } else if (body.type === 'complete') {
          this.broadcastHealthCheckComplete(body.data.health_check_uuid, body.data.status);
        }
        
        return Response.json({ success: true });
      } catch (error) {
        console.error('Error broadcasting health check update:', error);
        return Response.json(
          { error: 'Failed to broadcast health check update' },
          { status: 500 }
        );
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
}

