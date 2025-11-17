/**
 * TerminalServer - PartyServer-based Durable Object for terminal streaming
 * 
 * Proxies container stdout/stderr to connected clients via WebSocket.
 * Uses PartyServer for connection management and broadcasting.
 */

import { Server } from 'partykit/partyserver';
import type { Connection, ConnectionContext } from 'partykit/partyserver';
import { getSandbox } from '@cloudflare/sandbox';
import { switchPort } from '@cloudflare/containers';

export interface TerminalServerEnv {
  Sandbox: DurableObjectNamespace<any>;
}

export interface TerminalServerProps {
  workerId: string;
  sandboxId: string;
}

/**
 * TerminalServer manages WebSocket connections for terminal streaming
 * from containers to clients.
 */
export class TerminalServer extends Server<TerminalServerEnv, TerminalServerProps> {
  private containerWs: WebSocket | null = null;
  private workerId: string | null = null;
  private sandboxId: string | null = null;

  async onStart(props?: TerminalServerProps): Promise<void> {
    if (props) {
      this.workerId = props.workerId;
      this.sandboxId = props.sandboxId;
    }
  }

  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    // Send welcome message
    connection.send(JSON.stringify({
      type: 'connected',
      message: 'Terminal connection established',
      workerId: this.workerId,
    }));

    // If we don't have a container connection yet, establish it
    if (!this.containerWs && this.sandboxId) {
      await this.connectToContainer();
    }
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer): Promise<void> {
    // Forward client input to container
    if (this.containerWs && this.containerWs.readyState === WebSocket.READY_STATE_OPEN) {
      try {
        if (typeof message === 'string') {
          this.containerWs.send(message);
        } else {
          this.containerWs.send(message);
        }
      } catch (error) {
        console.error('Error forwarding message to container:', error);
        connection.send(JSON.stringify({
          type: 'error',
          message: 'Failed to forward message to container',
        }));
      }
    }
  }

  async onClose(connection: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Clean up container connection if no clients remain
    const connections = Array.from(this.getConnections());
    if (connections.length === 0 && this.containerWs) {
      this.containerWs.close();
      this.containerWs = null;
    }
  }

  async onError(connection: Connection, error: unknown): Promise<void> {
    console.error('TerminalServer connection error:', error);
    connection.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }

  /**
   * Connect to container terminal WebSocket
   */
  private async connectToContainer(): Promise<void> {
    if (!this.sandboxId || !this.env.Sandbox) {
      console.error('Missing sandboxId or Sandbox binding');
      return;
    }

    try {
      const sandbox = getSandbox(this.env.Sandbox, this.sandboxId);
      
      // Create WebSocket upgrade request to container terminal endpoint
      const url = 'http://localhost:3000/ws/terminal';
      const request = new Request(url, {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Key': crypto.randomUUID(),
          'Sec-WebSocket-Version': '13',
        },
      });

      // Use switchPort to route to port 3000
      const switchedRequest = switchPort(request, 3000);
      const response = await sandbox.fetch(switchedRequest);

      if (!response.webSocket) {
        throw new Error('Container did not accept WebSocket upgrade');
      }

      this.containerWs = response.webSocket;
      this.containerWs.accept();

      // Forward container output to all connected clients
      this.containerWs.addEventListener('message', (event) => {
        this.broadcast(event.data);
      });

      this.containerWs.addEventListener('close', () => {
        this.containerWs = null;
        // Notify all clients
        this.broadcast(JSON.stringify({
          type: 'container-disconnected',
          message: 'Container terminal connection closed',
        }));
      });

      this.containerWs.addEventListener('error', (error) => {
        console.error('Container WebSocket error:', error);
        this.containerWs = null;
        this.broadcast(JSON.stringify({
          type: 'error',
          message: 'Container terminal connection error',
        }));
      });

      // Notify all clients that container is connected
      this.broadcast(JSON.stringify({
        type: 'container-connected',
        message: 'Container terminal connection established',
      }));
    } catch (error) {
      console.error('Failed to connect to container terminal:', error);
      this.broadcast(JSON.stringify({
        type: 'error',
        message: `Failed to connect to container: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }
}

