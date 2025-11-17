/**
 * Shared Contracts Module - Schemas and Types
 *
 * Purpose:
 * - Provide canonical Zod schemas and TypeScript types for patch operations,
 *   patch batches, patch events, and WebSocket messages shared across services.
 * - Centralize validation and typing to keep orchestrator and workers in sync.
 *
 * Usage:
 * - Import from `@shared/contracts` to ensure consistent types and validation.
 * - All schemas expose `.parse` and `.safeParse` for runtime validation.
 */
import { z } from 'zod'

// Patch Operation types as per JSON Patch-like semantics
export const PatchOpTypeSchema = z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test'])
export type PatchOpType = z.infer<typeof PatchOpTypeSchema>

/**
 * Schema for individual patch operations following JSON Patch semantics.
 *
 * @example
 * ```typescript
 * // Add operation
 * { op: 'add', path: '/users/123', value: { name: 'John' } }
 *
 * // Remove operation
 * { op: 'remove', path: '/users/123' }
 *
 * // Replace operation
 * { op: 'replace', path: '/users/123/name', value: 'Jane' }
 *
 * // Move operation
 * { op: 'move', path: '/users/123/name', from: '/users/456/name' }
 *
 * // Copy operation
 * { op: 'copy', path: '/users/123/backup', from: '/users/123/name' }
 *
 * // Test operation
 * { op: 'test', path: '/users/123/name', value: 'John' }
 * ```
 */
export const PatchOperationSchema = z.object({
  op: PatchOpTypeSchema,
  path: z.string().min(1),
  from: z.string().optional(),
  value: z.unknown().optional(),
})
export type PatchOperation = z.infer<typeof PatchOperationSchema>

/**
 * Schema for grouping multiple patch operations into a single batch.
 * Batches allow atomic application of related changes and provide tracking.
 *
 * @example
 * ```typescript
 * {
 *   patchId: 'batch-123',
 *   operations: [
 *     { op: 'add', path: '/users/123', value: { name: 'John' } },
 *     { op: 'add', path: '/users/123/email', value: 'john@example.com' }
 *   ],
 *   metadata: {
 *     author: 'user-456',
 *     description: 'Add new user profile'
 *   }
 * }
 * ```
 */
export const PatchBatchSchema = z.object({
  patchId: z.string().min(1),
  operations: z.array(PatchOperationSchema).min(1),
  metadata: z.record(z.any()).optional(),
})
export type PatchBatch = z.infer<typeof PatchBatchSchema>

/**
 * Schema for events triggered by patch operations.
 * Events provide audit trails and real-time notifications for patch lifecycle.
 *
 * @example
 * ```typescript
 * {
 *   id: 'event-123',
 *   patchId: 'batch-456',
 *   eventType: 'PATCH_APPLIED',
 *   status: 'success',
 *   createdAt: new Date('2024-01-01T10:00:00Z'),
 *   metadata: {
 *     duration: 250, // ms
 *     affectedFiles: ['/src/user.ts']
 *   }
 * }
 * ```
 */
export const PatchEventSchema = z.object({
  id: z.string().min(1, 'id is required'),
  patchId: z.string().min(1, 'patchId is required'),
  eventType: z.string().min(1, 'eventType is required'),
  status: z.string().min(1, 'status is required'),
  createdAt: z.coerce.date(),
  metadata: z.record(z.any()).optional(),
})
export type PatchEvent = z.infer<typeof PatchEventSchema>

/**
 * Base schema for all WebSocket messages.
 * Provides common fields shared across all message types.
 */
export const WebSocketMessageBase = z.object({
  id: z.string().min(1, 'id is required'),
  type: z.string().min(1, 'type is required'),
})

/**
 * Payload schema for authentication messages.
 * Used to authenticate WebSocket connections.
 */
export const AuthPayloadSchema = z.object({
  token: z.string().min(1, 'authentication token is required')
})

/**
 * Payload schema for subscription messages.
 * Used to subscribe/unsubscribe from channels or events.
 */
export const SubscriptionPayloadSchema = z.object({
  channel: z.string().min(1, 'channel is required'),
  filters: z.record(z.any()).optional(),
})

/**
 * Payload schema for data messages.
 * Used to transmit arbitrary data through WebSocket connections.
 */
export const DataPayloadSchema = z.object({
  data: z.unknown()
})

/**
 * Complete WebSocket message schema using discriminated unions.
 * Ensures type safety for different message types based on the 'type' field.
 *
 * @example
 * ```typescript
 * // Authentication message
 * {
 *   id: 'msg-123',
 *   type: 'auth',
 *   payload: { token: 'jwt-token-here' }
 * }
 *
 * // Subscription message
 * {
 *   id: 'msg-456',
 *   type: 'subscribe',
 *   payload: { channel: 'patch-events', filters: { status: 'success' } }
 * }
 *
 * // Data message
 * {
 *   id: 'msg-789',
 *   type: 'data',
 *   payload: { data: { user: 'john', action: 'login' } }
 * }
 *
 * // Event message
 * {
 *   id: 'msg-999',
 *   type: 'event',
 *   payload: { id: 'evt-123', patchId: 'patch-456', eventType: 'PATCH_APPLIED', ... }
 * }
 * ```
 */
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  WebSocketMessageBase.extend({
    type: z.literal('auth'),
    payload: AuthPayloadSchema
  }),
  WebSocketMessageBase.extend({
    type: z.literal('subscribe'),
    payload: SubscriptionPayloadSchema
  }),
  WebSocketMessageBase.extend({
    type: z.literal('unsubscribe'),
    payload: SubscriptionPayloadSchema
  }),
  WebSocketMessageBase.extend({
    type: z.literal('data'),
    payload: DataPayloadSchema
  }),
  WebSocketMessageBase.extend({
    type: z.literal('event'),
    payload: PatchEventSchema
  }),
])
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>

export const Contracts = {
  PatchOperationSchema,
  PatchBatchSchema,
  PatchEventSchema,
  WebSocketMessageSchema,
}

export default Contracts

