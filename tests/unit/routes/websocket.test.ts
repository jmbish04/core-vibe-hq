/**
 * Unit tests for WebSocket Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupWebSocketRoutes, websocketAuthMiddleware } from '../../../orchestrator/worker/api/routes/websocket';
import { WebSocketHub } from '../../../orchestrator/worker/services/websocket/websocketHub';
import { Hono } from 'hono';

// Mock WebSocketPair
const mockWebSocketPair = () => {
  const client = {
    accept: vi.fn(),
    send: vi.fn(),
    close: vi.fn()
  };
  const server = {
    accept: vi.fn(),
    send: vi.fn(),
    close: vi.fn()
  };
  return { client, server };
};

// Set up global WebSocketPair mock
vi.stubGlobal('WebSocketPair', mockWebSocketPair);

describe('WebSocket Routes', () => {
  let mockWebSocketHub: WebSocketHub;
  let app: Hono<any>;

  beforeEach(() => {
    mockWebSocketHub = {
      registerConnection: vi.fn().mockReturnValue('test-connection-id'),
      broadcastPatchEvent: vi.fn(),
      getConnections: vi.fn().mockReturnValue([]),
      removeConnection: vi.fn()
    } as any;

    app = new Hono();
    setupWebSocketRoutes(app, mockWebSocketHub);
  });

  describe('setupWebSocketRoutes', () => {
    it('should handle GET /ws request and upgrade to WebSocket', async () => {
      const response = await app.request('/ws');

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
      expect(mockWebSocketHub.registerConnection).toHaveBeenCalled();
    });

    it('should send a confirmation message after connection is established', async () => {
      await app.request('/ws');

      const serverSocket = mockWebSocketHub.registerConnection.mock.calls[0][0];
      expect(serverSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('connection_established')
      );
      expect(serverSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('test-connection-id')
      );
    });

    it('should handle WebSocket upgrade errors', async () => {
      // Mock WebSocketPair to throw an error
      const originalWebSocketPair = global.WebSocketPair;
      global.WebSocketPair = vi.fn().mockImplementation(() => {
        throw new Error('WebSocket creation failed');
      });

      const response = await app.request('/ws');

      expect(response.status).toBe(500);

      // Restore original
      global.WebSocketPair = originalWebSocketPair;
    });
  });

  describe('websocketAuthMiddleware', () => {
    it('should set websocketHub in context and call next', async () => {
      const middleware = websocketAuthMiddleware(mockWebSocketHub);
      const mockContext = {
        set: vi.fn(),
        get: vi.fn()
      };
      const mockNext = vi.fn();

      await middleware(mockContext, mockNext);

      expect(mockContext.set).toHaveBeenCalledWith('websocketHub', mockWebSocketHub);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
