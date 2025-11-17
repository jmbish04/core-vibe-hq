/**
 * WebSocket Message Types
 *
 * Type-safe message contracts for client-server communication over WS.
 */
import { z } from 'zod'
import { WebSocketMessageSchema } from './contracts'

export type Message = z.infer<typeof WebSocketMessageSchema>

export const isMessage = (value: unknown): value is Message => {
  const result = WebSocketMessageSchema.safeParse(value)
  return result.success
}

export const parseMessage = (value: unknown): Message => WebSocketMessageSchema.parse(value)

