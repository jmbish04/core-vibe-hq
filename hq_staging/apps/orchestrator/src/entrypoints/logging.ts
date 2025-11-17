/**
 * orchestrator/worker/entrypoints/logging.ts
 * (Kysely-enabled)
 * ------------------------------------------------------------
 * Provides a generic, fire-and-forget log sink for the ecosystem.
 * This allows any authenticated service (like an AI agent in a
 * factory repo or another worker) to send structured logs to the
 * central `operation_logs` table.
 *
 * Responsibilities:
 * - Expose a single `log` method for general-purpose logging.
 * - Accept a structured log payload (source, level, details, etc.).
 * - Write the payload directly to the `operation_logs` D1 table.
 * - Ensure the endpoint is robust and does not crash on bad input.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import { LogResponse } from './types'

export class Logging extends BaseWorkerEntrypoint<CoreEnv> {

  /**
   * A generic, fire-and-forget log sink for any external service.
   * This mirrors the functionality of the old '/api/ops/log' route.
   */
  async log(params: {
    source: string
    operation: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
    details?: object
    order_id?: string
    task_uuid?: string
  }): Promise<LogResponse> {
    const { source, operation, level, details, order_id, task_uuid } = params
    
    try {
      // Kysely query
      await this.db
        .insertInto('operation_logs')
        .values({
          source: source,
          order_id: order_id ?? null,
          task_uuid: task_uuid ?? null,
          operation: operation,
          level: level,
          details: JSON.stringify(details ?? {}),
        })
        .execute()
      
      return { ok: true }
    } catch (e: any) {
      console.error("Failed to write to operation_logs", e.message, JSON.stringify(params))
      return { ok: false, error: e.message }
    }
  }
}