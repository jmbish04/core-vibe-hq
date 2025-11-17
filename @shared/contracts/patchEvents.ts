/**
 * Patch Event Constants
 *
 * Centralized event type strings used across workers and orchestrator.
 * These constants ensure consistent event naming and type safety.
 */

// Lifecycle Events
export const PATCH_RECEIVED = 'PATCH_RECEIVED'
export const PATCH_VALIDATED = 'PATCH_VALIDATED'
export const PATCH_APPLIED = 'PATCH_APPLIED'
export const PATCH_REJECTED = 'PATCH_REJECTED'

// Delivery Events
export const PATCH_DELIVERED = 'PATCH_DELIVERED'
export const PATCH_FAILED_DELIVERY = 'PATCH_FAILED_DELIVERY'

// Processing Events
export const PATCH_PROCESSING_STARTED = 'PATCH_PROCESSING_STARTED'
export const PATCH_PROCESSING_COMPLETED = 'PATCH_PROCESSING_COMPLETED'
export const PATCH_PROCESSING_FAILED = 'PATCH_PROCESSING_FAILED'

// Validation Events
export const PATCH_VALIDATION_STARTED = 'PATCH_VALIDATION_STARTED'
export const PATCH_VALIDATION_PASSED = 'PATCH_VALIDATION_PASSED'
export const PATCH_VALIDATION_FAILED = 'PATCH_VALIDATION_FAILED'

// Rollback Events
export const PATCH_ROLLBACK_INITIATED = 'PATCH_ROLLBACK_INITIATED'
export const PATCH_ROLLBACK_COMPLETED = 'PATCH_ROLLBACK_COMPLETED'
export const PATCH_ROLLBACK_FAILED = 'PATCH_ROLLBACK_FAILED'

/**
 * Complete set of patch event types.
 * Use these constants instead of hardcoded strings for type safety.
 *
 * @example
 * ```typescript
 * import { PatchEvents } from '@shared/contracts';
 *
 * // Correct usage
 * const event = {
 *   eventType: PatchEvents.PATCH_APPLIED,
 *   status: 'success'
 * };
 *
 * // Avoid hardcoded strings
 * // const badEvent = { eventType: 'PATCH_APPLIED' }; // ❌
 * ```
 */
export const PatchEvents = {
  // Lifecycle Events
  PATCH_RECEIVED,
  PATCH_VALIDATED,
  PATCH_APPLIED,
  PATCH_REJECTED,

  // Delivery Events
  PATCH_DELIVERED,
  PATCH_FAILED_DELIVERY,

  // Processing Events
  PATCH_PROCESSING_STARTED,
  PATCH_PROCESSING_COMPLETED,
  PATCH_PROCESSING_FAILED,

  // Validation Events
  PATCH_VALIDATION_STARTED,
  PATCH_VALIDATION_PASSED,
  PATCH_VALIDATION_FAILED,

  // Rollback Events
  PATCH_ROLLBACK_INITIATED,
  PATCH_ROLLBACK_COMPLETED,
  PATCH_ROLLBACK_FAILED,
} as const

export type PatchEventType = keyof typeof PatchEvents

export default PatchEvents

