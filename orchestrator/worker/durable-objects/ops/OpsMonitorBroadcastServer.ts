/**
 * OpsMonitorBroadcastServer - PartyServer-based Durable Object for ops scan broadcasts
 * 
 * Broadcasts ops scan results to connected clients in real-time.
 */

import { Server } from 'partykit/partyserver';
import type { Connection, ConnectionContext } from 'partykit/partyserver';
import type { OpsScanResult } from '../../services/ops/opsMonitorService';

export interface OpsMonitorBroadcastEnv {
  // No specific bindings needed
}

/**
 * OpsMonitorBroadcastServer manages WebSocket connections for ops scan broadcasts
 */
export class OpsMonitorBroadcastServer extends Server<OpsMonitorBroadcastEnv> {
  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    // Send welcome message
    connection.send(JSON.stringify({
      type: 'connected',
      message: 'Ops monitor broadcast connection established',
      timestamp: new Date().toISOString(),
    }));
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer): Promise<void> {
    // Handle client messages if needed (e.g., subscription filters)
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
      
      if (data.type === 'subscribe') {
        // Client can subscribe to specific scan types
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
   * Broadcast scan results to all connected clients
   */
  broadcastScanResult(scanResult: OpsScanResult): void {
    const message = JSON.stringify({
      type: 'scan-result',
      data: scanResult,
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Broadcast scan start notification
   */
  broadcastScanStart(scanId: string, scope: string): void {
    const message = JSON.stringify({
      type: 'scan-start',
      data: {
        scanId,
        scope,
      },
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Broadcast scan progress update
   */
  broadcastScanProgress(scanId: string, progress: { processed: number; total: number }): void {
    const message = JSON.stringify({
      type: 'scan-progress',
      data: {
        scanId,
        progress,
      },
      timestamp: new Date().toISOString(),
    });

    this.broadcast(message);
  }

  /**
   * Handle HTTP requests for broadcasting scan results
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      try {
        const scanResult = await request.json() as OpsScanResult;
        this.broadcastScanResult(scanResult);
        return Response.json({ success: true });
      } catch (error) {
        console.error('Error broadcasting scan result:', error);
        return Response.json(
          { error: 'Failed to broadcast scan result' },
          { status: 500 }
        );
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
}

