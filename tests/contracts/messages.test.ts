/**
 * Unit tests for WebSocket message utilities
 *
 * Tests the type guards and parsing utilities for WebSocket messages
 */

import { describe, it, expect } from 'vitest'
import {
  isMessage,
  parseMessage,
  type Message
} from '@shared/contracts'

describe('isMessage', () => {
  it('should return true for valid messages', () => {
    const validMessages = [
      {
        id: 'msg-123',
        type: 'auth',
        payload: { token: 'jwt-token' }
      },
      {
        id: 'msg-456',
        type: 'subscribe',
        payload: { channel: 'patch-events' }
      },
      {
        id: 'msg-789',
        type: 'data',
        payload: { data: { user: 'john' } }
      },
      {
        id: 'msg-999',
        type: 'event',
        payload: {
          id: 'event-123',
          patchId: 'batch-456',
          eventType: 'PATCH_APPLIED',
          status: 'success',
          createdAt: new Date()
        }
      }
    ]

    validMessages.forEach(message => {
      expect(isMessage(message)).toBe(true)
    })
  })

  it('should return false for invalid messages', () => {
    const invalidMessages = [
      null,
      undefined,
      {},
      { id: 'msg-123' }, // missing type
      { type: 'auth' }, // missing id
      { id: 'msg-123', type: 'invalid' }, // invalid type
      { id: 'msg-123', type: 'auth', payload: {} }, // invalid payload
      { id: 'msg-123', type: 'auth', payload: { token: '' } }, // empty token
      { id: '', type: 'auth', payload: { token: 'test' } }, // empty id
      'string message',
      123,
      []
    ]

    invalidMessages.forEach(message => {
      expect(isMessage(message)).toBe(false)
    })
  })

  it('should handle edge cases', () => {
    // Message with extra properties (should still be valid if base properties are correct)
    const messageWithExtras = {
      id: 'msg-123',
      type: 'data',
      payload: { data: 'test' },
      extraProp: 'ignored'
    }
    expect(isMessage(messageWithExtras)).toBe(true)

    // Message without optional filters
    const messageWithoutFilters = {
      id: 'msg-123',
      type: 'subscribe',
      payload: {
        channel: 'test'
      }
    }
    expect(isMessage(messageWithoutFilters)).toBe(true)
  })
})

describe('parseMessage', () => {
  it('should successfully parse valid messages', () => {
    const input = {
      id: 'msg-123',
      type: 'auth',
      payload: { token: 'jwt-token' }
    }

    const result = parseMessage(input)
    expect(result).toEqual(input)
    expect(result.id).toBe('msg-123')
    expect(result.type).toBe('auth')
    expect(result.payload.token).toBe('jwt-token')
  })

  it('should throw error for invalid messages', () => {
    const invalidInputs = [
      {},
      { id: 'msg-123' },
      { type: 'auth' },
      { id: 'msg-123', type: 'invalid' },
      { id: 'msg-123', type: 'auth', payload: {} }
    ]

    invalidInputs.forEach(input => {
      expect(() => parseMessage(input)).toThrow()
    })
  })

  it('should provide detailed error messages', () => {
    try {
      parseMessage({ id: 'msg-123', type: 'auth', payload: {} })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('Required')
    }
  })

  it('should handle discriminated union types correctly', () => {
    // Test that each message type is correctly typed
    const authMessage = parseMessage({
      id: 'msg-1',
      type: 'auth',
      payload: { token: 'test-token' }
    })
    expect(authMessage.type).toBe('auth')
    expect(authMessage.payload).toHaveProperty('token')

    const subscribeMessage = parseMessage({
      id: 'msg-2',
      type: 'subscribe',
      payload: { channel: 'test-channel' }
    })
    expect(subscribeMessage.type).toBe('subscribe')
    expect(subscribeMessage.payload).toHaveProperty('channel')

    const dataMessage = parseMessage({
      id: 'msg-3',
      type: 'data',
      payload: { data: { key: 'value' } }
    })
    expect(dataMessage.type).toBe('data')
    expect(dataMessage.payload).toHaveProperty('data')
  })
})

describe('Message Type Safety', () => {
  it('should provide type safety for message handling', () => {
    const handleMessage = (message: Message) => {
      switch (message.type) {
        case 'auth':
          return `Authenticating with token: ${message.payload.token}`
        case 'subscribe':
          return `Subscribing to channel: ${message.payload.channel}`
        case 'unsubscribe':
          return `Unsubscribing from channel: ${message.payload.channel}`
        case 'data':
          return `Received data: ${JSON.stringify(message.payload.data)}`
        case 'event':
          return `Received event: ${message.payload.eventType} for patch ${message.payload.patchId}`
        default:
          return 'Unknown message type'
      }
    }

    const messages: Message[] = [
      { id: '1', type: 'auth', payload: { token: 'abc' } },
      { id: '2', type: 'subscribe', payload: { channel: 'test' } },
      { id: '3', type: 'data', payload: { data: 'test' } }
    ]

    messages.forEach(message => {
      const result = handleMessage(message)
      expect(typeof result).toBe('string')
      expect(result).not.toBe('Unknown message type')
    })
  })

  it('should work with message filtering', () => {
    const messages: Message[] = [
      { id: '1', type: 'auth', payload: { token: 'abc' } },
      { id: '2', type: 'subscribe', payload: { channel: 'test' } },
      { id: '3', type: 'data', payload: { data: 'test' } },
      { id: '4', type: 'event', payload: {
        id: 'evt-1', patchId: 'patch-1', eventType: 'PATCH_APPLIED',
        status: 'success', createdAt: new Date()
      }}
    ]

    const authMessages = messages.filter(msg => msg.type === 'auth')
    expect(authMessages).toHaveLength(1)
    expect(authMessages[0].payload).toHaveProperty('token')

    const eventMessages = messages.filter(msg => msg.type === 'event')
    expect(eventMessages).toHaveLength(1)
    expect(eventMessages[0].payload).toHaveProperty('eventType')
  })
})
