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

export const PatchOperationSchema = z.object({
  op: PatchOpTypeSchema,
  path: z.string().min(1, 'path is required'),
  from: z.string().optional(),
  value: z.unknown().optional(),
})
export type PatchOperation = z.infer<typeof PatchOperationSchema>

export const PatchBatchSchema = z.object({
  patchId: z.string().min(1),
  operations: z.array(PatchOperationSchema).min(1, 'at least one operation required'),
  metadata: z.record(z.any()).optional(),
})
export type PatchBatch = z.infer<typeof PatchBatchSchema>

export const PatchEventSchema = z.object({
  id: z.string().min(1),
  patchId: z.string().min(1),
  eventType: z.string().min(1),
  status: z.string().min(1),
  createdAt: z.coerce.date(),
  metadata: z.record(z.any()).optional(),
})
export type PatchEvent = z.infer<typeof PatchEventSchema>

// WebSocket messages shared structure
export const WebSocketMessageBase = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
})

export const AuthPayloadSchema = z.object({ token: z.string().min(1) })
export const SubscriptionPayloadSchema = z.object({
  channel: z.string().min(1),
  filters: z.record(z.any()).optional(),
})
export const DataPayloadSchema = z.object({ data: z.unknown() })

export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  WebSocketMessageBase.extend({ type: z.literal('auth'), payload: AuthPayloadSchema }),
  WebSocketMessageBase.extend({ type: z.literal('subscribe'), payload: SubscriptionPayloadSchema }),
  WebSocketMessageBase.extend({ type: z.literal('unsubscribe'), payload: SubscriptionPayloadSchema }),
  WebSocketMessageBase.extend({ type: z.literal('data'), payload: DataPayloadSchema }),
  WebSocketMessageBase.extend({ type: z.literal('event'), payload: PatchEventSchema }),
])
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>

export const Contracts = {
  PatchOperationSchema,
  PatchBatchSchema,
  PatchEventSchema,
  WebSocketMessageSchema,
}

export default Contracts

