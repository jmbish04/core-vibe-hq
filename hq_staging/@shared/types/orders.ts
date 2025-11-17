/**
 * @shared/types/orders.ts
 * 
 * Shared order validation types and schemas for factory order orchestration
 * 
 * Provides Zod schemas for validating orders and related types used across
 * the factory automation system.
 */

import { z } from 'zod'

/**
 * Placeholder payload structure
 * Maps placeholder IDs to their mini-prompts
 */
export const PlaceholderPayloadSchema = z.record(
  z.string(), // placeholder_id
  z.object({
    mini_prompt: z.string(),
    template_file_id: z.string().optional(),
    placeholder_pattern: z.string().optional(),
  })
)

export type PlaceholderPayload = z.infer<typeof PlaceholderPayloadSchema>

/**
 * Order metadata schema
 */
export const OrderMetadataSchema = z.object({
  project_id: z.string().optional(),
  ai_provider: z.string().optional(),
  template_name: z.string().optional(),
  overall_prompt: z.string().optional(),
  created_by: z.string().optional(),
  priority: z.string().optional(),
}).passthrough() // Allow additional fields

export type OrderMetadata = z.infer<typeof OrderMetadataSchema>

/**
 * Order schema - extends BaseFactoryAgent.Order with validation
 */
export const OrderSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().optional(),
  factory: z.string().min(1),
  template_name: z.string().optional(),
  overall_prompt: z.string().optional(),
  placeholder_payload: PlaceholderPayloadSchema.optional(),
  ai_provider: z.string().optional(),
  description: z.string().optional(),
  metadata: OrderMetadataSchema.optional(),
})

export type Order = z.infer<typeof OrderSchema>

/**
 * Validated order type (after Zod validation)
 */
export type ValidatedOrder = Order

/**
 * Order validation result
 */
export interface ValidationResult {
  ok: boolean
  order?: ValidatedOrder
  errors?: string[]
}

/**
 * Validate an order object
 * 
 * @param order - Unknown order object to validate
 * @returns ValidationResult with validated order or errors
 */
export function validateOrder(order: unknown): ValidationResult {
  try {
    const validated = OrderSchema.parse(order)
    return {
      ok: true,
      order: validated,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      }
    }
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    }
  }
}

/**
 * Validate placeholder payload
 */
export function validatePlaceholderPayload(payload: unknown): { ok: boolean; data?: PlaceholderPayload; errors?: string[] } {
  try {
    const validated = PlaceholderPayloadSchema.parse(payload)
    return {
      ok: true,
      data: validated,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      }
    }
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    }
  }
}

