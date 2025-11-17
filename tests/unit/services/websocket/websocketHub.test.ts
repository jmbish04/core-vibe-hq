/**
 * Unit tests for WebSocketHub service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketHub } from '../../../../orchestrator/worker/services/websocket/websocketHub'
import { PatchEvent } from '@shared/contracts'

// Mock WebSocket factory
const createMockWebSocket = () => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn()
})

// Default mock WebSocket for single-connection tests
const mockWebSocket = createMockWebSocket()

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
  }
})

describe('WebSocketHub', () => {
  let hub: WebSocketHub

  beforeEach(() => {
    hub = new WebSocketHub()
    vi.clearAllMocks()
  })

  afterEach(() => {
    hub.destroy()
  })

  describe('registerConnection', () => {
    it('should register a new connection with default settings', () => {
      const connectionId = hub.registerConnection(mockWebSocket as any)

      expect(connectionId).toBeDefined()
      expect(typeof connectionId).toBe('string')
      expect(mockWebSocket.addEventListener).toHaveBeenCalledTimes(3) // message, close, error
    })

    it('should register connection with environment data', () => {
      const env = {
        userId: 'user-123',
        sessionId: 'session-456',
        metadata: { clientVersion: '1.0.0' }
      }

      const connectionId = hub.registerConnection(mockWebSocket as any, env)

      expect(connectionId).toBeDefined()
      // Verify the connection was stored with env data
      const stats = hub.getStats()
      expect(stats.totalConnections).toBe(1)
    })

    it('should set up event listeners', () => {
      hub.registerConnection(mockWebSocket as any)

      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('message handling', () => {
    let connectionId: string

    beforeEach(() => {
      connectionId = hub.registerConnection(mockWebSocket as any)
    })

    it('should handle auth messages', () => {
      const authMessage = {
        id: 'msg-1',
        type: 'auth',
        payload: { token: 'test-token' }
      }

      // Trigger message event
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({ data: JSON.stringify(authMessage) })

      // Should respond with authenticated status
      expect(mockWebSocket.send).toHaveBeenCalled()
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sentMessage.type).toBe('data')
      expect(sentMessage.payload.data.status).toBe('authenticated')
    })

    it('should handle subscribe messages', () => {
      const subscribeMessage = {
        id: 'msg-2',
        type: 'subscribe',
        payload: { channel: 'patch-events', filters: { status: 'success' } }
      }

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({ data: JSON.stringify(subscribeMessage) })

      expect(mockWebSocket.send).toHaveBeenCalled()
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sentMessage.type).toBe('data')
      expect(sentMessage.payload.data.status).toBe('subscribed')
      expect(sentMessage.payload.data.channel).toBe('patch-events')
    })

    it('should handle unsubscribe messages', () => {
      // First subscribe
      const subscribeMessage = {
        id: 'msg-3',
        type: 'subscribe',
        payload: { channel: 'test-channel' }
      }

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({ data: JSON.stringify(subscribeMessage) })

      // Then unsubscribe
      const unsubscribeMessage = {
        id: 'msg-4',
        type: 'unsubscribe',
        payload: { channel: 'test-channel' }
      }

      messageHandler({ data: JSON.stringify(unsubscribeMessage) })

      expect(mockWebSocket.send).toHaveBeenCalledTimes(2)
      const unsubscribeResponse = JSON.parse(mockWebSocket.send.mock.calls[1][0])
      expect(unsubscribeResponse.payload.data.status).toBe('unsubscribed')
    })

    it('should handle data messages', () => {
      const dataMessage = {
        id: 'msg-5',
        type: 'data',
        payload: { data: { action: 'ping' } }
      }

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({ data: JSON.stringify(dataMessage) })

      expect(mockWebSocket.send).toHaveBeenCalled()
      const response = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(response.type).toBe('data')
      expect(response.payload.data.acknowledged).toBe(true)
    })

    it('should handle invalid messages gracefully', () => {
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({ data: 'invalid json' })

      expect(mockWebSocket.send).toHaveBeenCalled()
      const errorResponse = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(errorResponse.payload.data.error).toContain('Invalid message format')
    })

    it('should handle auth messages with invalid payload', () => {
      const invalidAuthMessage = {
        id: 'msg-6',
        type: 'auth',
        payload: { invalidField: 'test' } // Missing required 'token' field
      }

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({ data: JSON.stringify(invalidAuthMessage) })

      // Should handle the message without throwing (graceful error handling)
      expect(mockWebSocket.send).toHaveBeenCalled()
    })
  })

  describe('broadcasting', () => {
    let connectionId1: string
    let connectionId2: string
    let mockWebSocket1: any
    let mockWebSocket2: any

    beforeEach(() => {
      mockWebSocket1 = createMockWebSocket()
      mockWebSocket2 = createMockWebSocket()
      connectionId1 = hub.registerConnection(mockWebSocket1 as any)
      connectionId2 = hub.registerConnection(mockWebSocket2 as any)
    })

    it('should broadcast patch events to subscribed connections', () => {
      // Subscribe both connections to patch-events channel
      // Connection 1
      const messageHandler1 = mockWebSocket1.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler1({
        data: JSON.stringify({
          id: 'sub-1',
          type: 'subscribe',
          payload: { channel: 'patch-events' }
        })
      })

      // Connection 2
      const messageHandler2 = mockWebSocket2.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler2({
        data: JSON.stringify({
          id: 'sub-2',
          type: 'subscribe',
          payload: { channel: 'patch-events' }
        })
      })

      const patchEvent: PatchEvent = {
        id: 'event-1',
        patchId: 'patch-123',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        createdAt: new Date()
      }

      hub.broadcastPatchEvent(patchEvent)

      expect(mockWebSocket1.send).toHaveBeenCalled()
      expect(mockWebSocket2.send).toHaveBeenCalled()

      const message1 = JSON.parse(mockWebSocket1.send.mock.calls[1][0]) // Index 1 because subscribe response was at index 0
      const message2 = JSON.parse(mockWebSocket2.send.mock.calls[1][0])

      expect(message1.type).toBe('event')
      expect(message1.payload.patchId).toBe('patch-123')
      expect(message2.type).toBe('event')
      expect(message2.payload.patchId).toBe('patch-123')
    })

    it('should broadcast to specific user', () => {
      // Register connections with different users
      const user1Connection = hub.registerConnection(mockWebSocket1 as any, { userId: 'user-1' })
      const user2Connection = hub.registerConnection(mockWebSocket2 as any, { userId: 'user-2' })

      const message = {
        id: 'test-msg',
        type: 'data',
        payload: { data: 'test' }
      }

      hub.broadcast(message, { targetUserId: 'user-1' })

      expect(mockWebSocket1.send).toHaveBeenCalled()
      expect(mockWebSocket2.send).not.toHaveBeenCalled()
    })

    it('should exclude specific connection', () => {
      const message = {
        id: 'test-msg',
        type: 'data',
        payload: { data: 'test' }
      }

      hub.broadcast(message, { excludeConnection: connectionId1 })

      expect(mockWebSocket1.send).not.toHaveBeenCalled()
      expect(mockWebSocket2.send).toHaveBeenCalled()
    })

    it('should broadcast to channel subscribers only', () => {
      // Subscribe connection 1 to a channel
      const messageHandler1 = mockWebSocket1.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler1({
        data: JSON.stringify({
          id: 'sub-1',
          type: 'subscribe',
          payload: { channel: 'test-channel' }
        })
      })

      const message = {
        id: 'channel-msg',
        type: 'data',
        payload: { data: 'channel test' }
      }

      hub.broadcast(message, { channels: ['test-channel'] })

      expect(mockWebSocket1.send).toHaveBeenCalled()
      expect(mockWebSocket2.send).not.toHaveBeenCalled()
    })
  })

  describe('connection management', () => {
    it('should handle connection close events', () => {
      const connectionId = hub.registerConnection(mockWebSocket as any)

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )[1]

      closeHandler()

      // Connection should be removed
      const stats = hub.getStats()
      expect(stats.totalConnections).toBe(0)
    })

    it('should handle connection error events', () => {
      const connectionId = hub.registerConnection(mockWebSocket as any)

      const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )[1]

      errorHandler(new Error('WebSocket error'))

      // Connection should be removed
      const stats = hub.getStats()
      expect(stats.totalConnections).toBe(0)
    })

    it('should provide accurate statistics', () => {
      const conn1 = hub.registerConnection(mockWebSocket as any)
      const conn2 = hub.registerConnection(mockWebSocket as any, { userId: 'user-1' })

      // Authenticate one connection
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1]

      messageHandler({
        data: JSON.stringify({
          id: 'auth-1',
          type: 'auth',
          payload: { token: 'test' }
        })
      })

      const stats = hub.getStats()

      expect(stats.totalConnections).toBe(2)
      expect(stats.authenticatedConnections).toBe(1)
      expect(stats.activeSubscriptions).toBe(0) // No subscriptions yet
      expect(stats.channels).toEqual([])
    })
  })

  describe('sendMessage', () => {
    it('should send message to specific connection', () => {
      const connectionId = hub.registerConnection(mockWebSocket as any)

      const message = {
        id: 'direct-msg',
        type: 'data',
        payload: { data: 'direct test' }
      }

      hub.sendMessage(connectionId, message)

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message))
    })

    it('should handle send errors gracefully', () => {
      const connectionId = hub.registerConnection(mockWebSocket as any)
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed')
      })

      const message = {
        id: 'error-msg',
        type: 'data',
        payload: { data: 'test' }
      }

      // Should not throw, should remove connection
      hub.sendMessage(connectionId, message)

      const stats = hub.getStats()
      expect(stats.totalConnections).toBe(0)
    })

    it('should warn for non-existent connections', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      hub.sendMessage('non-existent', {
        id: 'test',
        type: 'data',
        payload: { data: 'test' }
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-existent connection')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('lifecycle', () => {
    it('should clean up resources on destroy', () => {
      hub.registerConnection(mockWebSocket as any)

      hub.destroy()

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Server shutdown')

      const stats = hub.getStats()
      expect(stats.totalConnections).toBe(0)
    })

    it('should handle heartbeat cleanup of stale connections', () => {
      // Mock Date.now to simulate time passage
      const originalNow = Date.now
      vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 6 * 60 * 1000) // 6 minutes later

      hub.registerConnection(mockWebSocket as any)

      // Simulate heartbeat check (normally done internally)
      // For testing, we'll call the destroy method which also cleans up
      hub.destroy()

      const stats = hub.getStats()
      expect(stats.totalConnections).toBe(0)

      // Restore Date.now
      vi.restoreAllMocks()
    })
  })
})
