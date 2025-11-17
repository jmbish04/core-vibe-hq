/**
 * Unit tests for shared contracts module
 *
 * Tests all Zod schemas and type definitions to ensure validation works correctly
 * and provides appropriate error messages for invalid inputs.
 */

import { describe, it, expect } from 'vitest'
import {
  PatchOpTypeSchema,
  PatchOperationSchema,
  PatchBatchSchema,
  PatchEventSchema,
  WebSocketMessageSchema,
  AuthPayloadSchema,
  SubscriptionPayloadSchema,
  DataPayloadSchema,
  WebSocketMessageBase,
  type PatchOpType,
  type PatchOperation,
  type PatchBatch,
  type PatchEvent,
  type WebSocketMessage
} from '@shared/contracts'

describe('PatchOpTypeSchema', () => {
  it('should accept all valid patch operation types', () => {
    const validOps: PatchOpType[] = ['add', 'remove', 'replace', 'move', 'copy', 'test']

    validOps.forEach(op => {
      const result = PatchOpTypeSchema.safeParse(op)
      expect(result.success).toBe(true)
      expect(result.data).toBe(op)
    })
  })

  it('should reject invalid patch operation types', () => {
    const invalidOps = ['update', 'delete', 'insert', '', null, undefined]

    invalidOps.forEach(op => {
      const result = PatchOpTypeSchema.safeParse(op)
      expect(result.success).toBe(false)
    })
  })
})

describe('PatchOperationSchema', () => {
  it('should validate a complete add operation', () => {
    const operation: PatchOperation = {
      op: 'add',
      path: '/users/123',
      value: { name: 'John Doe', email: 'john@example.com' }
    }

    const result = PatchOperationSchema.safeParse(operation)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(operation)
  })

  it('should validate a remove operation', () => {
    const operation: PatchOperation = {
      op: 'remove',
      path: '/users/123'
    }

    const result = PatchOperationSchema.safeParse(operation)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(operation)
  })

  it('should validate a replace operation', () => {
    const operation: PatchOperation = {
      op: 'replace',
      path: '/users/123/name',
      value: 'Jane Doe'
    }

    const result = PatchOperationSchema.safeParse(operation)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(operation)
  })

  it('should validate a move operation with from field', () => {
    const operation: PatchOperation = {
      op: 'move',
      path: '/users/123/oldName',
      from: '/users/123/newName'
    }

    const result = PatchOperationSchema.safeParse(operation)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(operation)
  })

  it('should validate a copy operation', () => {
    const operation: PatchOperation = {
      op: 'copy',
      path: '/users/123/backup',
      from: '/users/123/name'
    }

    const result = PatchOperationSchema.safeParse(operation)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(operation)
  })

  it('should validate a test operation', () => {
    const operation: PatchOperation = {
      op: 'test',
      path: '/users/123/name',
      value: 'John Doe'
    }

    const result = PatchOperationSchema.safeParse(operation)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(operation)
  })

  it('should reject operation without path', () => {
    const invalidOperation = {
      op: 'add',
      value: 'test'
    }

    const result = PatchOperationSchema.safeParse(invalidOperation)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Required')
  })

  it('should reject operation with empty path', () => {
    const invalidOperation = {
      op: 'add',
      path: '',
      value: 'test'
    }

    const result = PatchOperationSchema.safeParse(invalidOperation)
    expect(result.success).toBe(false)
  })

  it('should reject operation with invalid op type', () => {
    const invalidOperation = {
      op: 'invalid',
      path: '/test',
      value: 'test'
    }

    const result = PatchOperationSchema.safeParse(invalidOperation)
    expect(result.success).toBe(false)
  })
})

describe('PatchBatchSchema', () => {
  it('should validate a complete patch batch', () => {
    const batch: PatchBatch = {
      patchId: 'batch-123',
      operations: [
        {
          op: 'add',
          path: '/users/123',
          value: { name: 'John Doe' }
        },
        {
          op: 'add',
          path: '/users/123/email',
          value: 'john@example.com'
        }
      ],
      metadata: {
        author: 'user-456',
        description: 'Add new user'
      }
    }

    const result = PatchBatchSchema.safeParse(batch)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(batch)
  })

  it('should validate batch without metadata', () => {
    const batch: PatchBatch = {
      patchId: 'batch-123',
      operations: [
        {
          op: 'remove',
          path: '/users/123'
        }
      ]
    }

    const result = PatchBatchSchema.safeParse(batch)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(batch)
  })

  it('should reject batch without patchId', () => {
    const invalidBatch = {
      operations: [
        {
          op: 'add',
          path: '/test',
          value: 'value'
        }
      ]
    }

    const result = PatchBatchSchema.safeParse(invalidBatch)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Required')
  })

  it('should reject batch with empty operations array', () => {
    const invalidBatch = {
      patchId: 'batch-123',
      operations: []
    }

    const result = PatchBatchSchema.safeParse(invalidBatch)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Array must contain at least 1')
  })

  it('should reject batch with invalid operations', () => {
    const invalidBatch = {
      patchId: 'batch-123',
      operations: [
        {
          op: 'invalid',
          path: '/test'
        }
      ]
    }

    const result = PatchBatchSchema.safeParse(invalidBatch)
    expect(result.success).toBe(false)
  })
})

describe('PatchEventSchema', () => {
  it('should validate a complete patch event', () => {
    const event: PatchEvent = {
      id: 'event-123',
      patchId: 'batch-456',
      eventType: 'PATCH_APPLIED',
      status: 'success',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      metadata: {
        duration: 250,
        affectedFiles: ['/src/user.ts']
      }
    }

    const result = PatchEventSchema.safeParse(event)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(event)
  })

  it('should validate event without metadata', () => {
    const event: PatchEvent = {
      id: 'event-123',
      patchId: 'batch-456',
      eventType: 'PATCH_RECEIVED',
      status: 'pending',
      createdAt: new Date()
    }

    const result = PatchEventSchema.safeParse(event)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('event-123')
  })

  it('should coerce string dates to Date objects', () => {
    const event = {
      id: 'event-123',
      patchId: 'batch-456',
      eventType: 'PATCH_APPLIED',
      status: 'success',
      createdAt: '2024-01-01T10:00:00Z'
    }

    const result = PatchEventSchema.safeParse(event)
    expect(result.success).toBe(true)
    expect(result.data.createdAt).toBeInstanceOf(Date)
  })

  it('should reject event without required fields', () => {
    const invalidEvent = {
      eventType: 'PATCH_APPLIED',
      status: 'success'
    }

    const result = PatchEventSchema.safeParse(invalidEvent)
    expect(result.success).toBe(false)
    expect(result.error?.issues).toHaveLength(3) // missing id, patchId, createdAt
  })
})

describe('WebSocketMessageBase', () => {
  it('should validate complete base message', () => {
    const message = {
      id: 'msg-123',
      type: 'auth'
    }

    const result = WebSocketMessageBase.safeParse(message)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(message)
  })

  it('should reject message without id', () => {
    const invalidMessage = {
      type: 'auth'
    }

    const result = WebSocketMessageBase.safeParse(invalidMessage)
    expect(result.success).toBe(false)
  })

  it('should reject message without type', () => {
    const invalidMessage = {
      id: 'msg-123'
    }

    const result = WebSocketMessageBase.safeParse(invalidMessage)
    expect(result.success).toBe(false)
  })
})

describe('AuthPayloadSchema', () => {
  it('should validate auth payload with token', () => {
    const payload = {
      token: 'jwt-token-here'
    }

    const result = AuthPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
    expect(result.data.token).toBe('jwt-token-here')
  })

  it('should reject auth payload without token', () => {
    const invalidPayload = {}

    const result = AuthPayloadSchema.safeParse(invalidPayload)
    expect(result.success).toBe(false)
  })

  it('should reject auth payload with empty token', () => {
    const invalidPayload = {
      token: ''
    }

    const result = AuthPayloadSchema.safeParse(invalidPayload)
    expect(result.success).toBe(false)
  })
})

describe('SubscriptionPayloadSchema', () => {
  it('should validate subscription payload with channel', () => {
    const payload = {
      channel: 'patch-events'
    }

    const result = SubscriptionPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
    expect(result.data.channel).toBe('patch-events')
  })

  it('should validate subscription payload with filters', () => {
    const payload = {
      channel: 'patch-events',
      filters: {
        status: 'success',
        priority: 'high'
      }
    }

    const result = SubscriptionPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
    expect(result.data.filters).toEqual({
      status: 'success',
      priority: 'high'
    })
  })

  it('should reject subscription payload without channel', () => {
    const invalidPayload = {
      filters: { status: 'success' }
    }

    const result = SubscriptionPayloadSchema.safeParse(invalidPayload)
    expect(result.success).toBe(false)
  })
})

describe('DataPayloadSchema', () => {
  it('should validate data payload with any data', () => {
    const payloads = [
      { data: 'string data' },
      { data: { user: 'john', action: 'login' } },
      { data: [1, 2, 3] },
      { data: null },
      { data: undefined }
    ]

    payloads.forEach(payload => {
      const result = DataPayloadSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })
  })
})

describe('WebSocketMessageSchema', () => {
  it('should validate auth message', () => {
    const message: WebSocketMessage = {
      id: 'msg-123',
      type: 'auth',
      payload: { token: 'jwt-token' }
    }

    const result = WebSocketMessageSchema.safeParse(message)
    expect(result.success).toBe(true)
    expect(result.data.type).toBe('auth')
    expect(result.data.payload.token).toBe('jwt-token')
  })

  it('should validate subscribe message', () => {
    const message: WebSocketMessage = {
      id: 'msg-456',
      type: 'subscribe',
      payload: {
        channel: 'patch-events',
        filters: { status: 'success' }
      }
    }

    const result = WebSocketMessageSchema.safeParse(message)
    expect(result.success).toBe(true)
    expect(result.data.type).toBe('subscribe')
    expect(result.data.payload.channel).toBe('patch-events')
  })

  it('should validate unsubscribe message', () => {
    const message: WebSocketMessage = {
      id: 'msg-789',
      type: 'unsubscribe',
      payload: { channel: 'patch-events' }
    }

    const result = WebSocketMessageSchema.safeParse(message)
    expect(result.success).toBe(true)
    expect(result.data.type).toBe('unsubscribe')
  })

  it('should validate data message', () => {
    const message: WebSocketMessage = {
      id: 'msg-999',
      type: 'data',
      payload: { data: { user: 'john', action: 'login' } }
    }

    const result = WebSocketMessageSchema.safeParse(message)
    expect(result.success).toBe(true)
    expect(result.data.type).toBe('data')
  })

  it('should validate event message', () => {
    const message: WebSocketMessage = {
      id: 'msg-000',
      type: 'event',
      payload: {
        id: 'event-123',
        patchId: 'batch-456',
        eventType: 'PATCH_APPLIED',
        status: 'success',
        createdAt: new Date()
      }
    }

    const result = WebSocketMessageSchema.safeParse(message)
    expect(result.success).toBe(true)
    expect(result.data.type).toBe('event')
    expect(result.data.payload.eventType).toBe('PATCH_APPLIED')
  })

  it('should reject message with invalid type', () => {
    const invalidMessage = {
      id: 'msg-123',
      type: 'invalid',
      payload: { data: 'test' }
    }

    const result = WebSocketMessageSchema.safeParse(invalidMessage)
    expect(result.success).toBe(false)
  })

  it('should reject message with mismatched payload', () => {
    const invalidMessage = {
      id: 'msg-123',
      type: 'auth',
      payload: { channel: 'test' } // auth expects token, not channel
    }

    const result = WebSocketMessageSchema.safeParse(invalidMessage)
    expect(result.success).toBe(false)
  })
})
