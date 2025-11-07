/**
 * Patch Event Constants
 *
 * Centralized event type strings used across workers and orchestrator.
 */
export const PATCH_APPLIED = 'PATCH_APPLIED'
export const PATCH_REJECTED = 'PATCH_REJECTED'
export const PATCH_RECEIVED = 'PATCH_RECEIVED'
export const PATCH_VALIDATED = 'PATCH_VALIDATED'
export const PATCH_DELIVERED = 'PATCH_DELIVERED'
export const PATCH_FAILED_DELIVERY = 'PATCH_FAILED_DELIVERY'

export const PatchEvents = {
  PATCH_APPLIED,
  PATCH_REJECTED,
  PATCH_RECEIVED,
  PATCH_VALIDATED,
  PATCH_DELIVERED,
  PATCH_FAILED_DELIVERY,
} as const

export type PatchEventType = keyof typeof PatchEvents

export default PatchEvents

