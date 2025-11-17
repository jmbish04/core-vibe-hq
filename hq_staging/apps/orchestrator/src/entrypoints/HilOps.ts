/**
 * orchestrator/worker/entrypoints/HilOps.ts
 * ------------------------------------------------------------
 * Human-in-the-Loop (HIL) Management RPC Entrypoint
 * 
 * Provides RPC methods for managing HIL requests.
 * Exposed via service binding for frontend and downstream workers.
 * 
 * Responsibilities:
 * - List HIL requests (with filters)
 * - Get specific HIL request details
 * - Submit human response to HIL request
 * - Update HIL request status
 * ------------------------------------------------------------
 * (Kysely-enabled)
 */

import type { CoreEnv } from '@shared/types/env'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import { sql } from 'kysely'

export interface HilRequest {
  id: number
  order_id: string
  conversation_id: string
  question: string
  context: string | null
  status: string
  user_response: string | null
  resolved_at: number | null
  created_at: number
  updated_at: number
}

export interface GetHilRequestsParams {
  order_id?: string
  status?: string
  limit?: number
  offset?: number
}

export interface GetHilRequestsResponse {
  ok: boolean
  requests?: HilRequest[]
  total?: number
  error?: string
}

export interface GetHilRequestResponse {
  ok: boolean
  request?: HilRequest
  error?: string
}

export interface SubmitHilResponseParams {
  id: number
  user_response: string
}

export interface SubmitHilResponseResponse {
  ok: boolean
  request?: HilRequest
  error?: string
}

export interface UpdateHilStatusParams {
  id: number
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled'
}

export interface UpdateHilStatusResponse {
  ok: boolean
  request?: HilRequest
  error?: string
}

export class HilOps extends BaseWorkerEntrypoint<CoreEnv> {

  /**
   * Get HIL requests (with optional filters)
   */
  async getHilRequests(params: GetHilRequestsParams = {}): Promise<GetHilRequestsResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'get_hil_requests',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      let query = this.db
        .selectFrom('hil_requests')
        .selectAll()

      if (params.order_id) {
        query = query.where('order_id', '=', params.order_id)
      }

      if (params.status) {
        query = query.where('status', '=', params.status)
      }

      // Get total count
      const totalQuery = query.select(({ fn }) => [fn.count<number>('id').as('count')])
      const totalResult = await totalQuery.executeTakeFirst()
      const total = totalResult?.count || 0

      // Apply pagination
      if (params.limit) {
        query = query.limit(params.limit)
      }
      if (params.offset) {
        query = query.offset(params.offset)
      }

      // Order by created_at descending
      query = query.orderBy('created_at', 'desc')

      const requests = await query.execute()

      return {
        ok: true,
        requests: requests as HilRequest[],
        total,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'get_hil_requests',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Get specific HIL request by ID
   */
  async getHilRequest(params: { id: number }): Promise<GetHilRequestResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'get_hil_request',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      const request = await this.db
        .selectFrom('hil_requests')
        .selectAll()
        .where('id', '=', params.id)
        .executeTakeFirst()

      if (!request) {
        return { ok: false, error: `HIL request not found: ${params.id}` }
      }

      return {
        ok: true,
        request: request as HilRequest,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'get_hil_request',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Submit human response to HIL request
   */
  async submitHilResponse(params: SubmitHilResponseParams): Promise<SubmitHilResponseResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'submit_hil_response',
          level: 'info',
          details: JSON.stringify({ id: params.id }),
        })
        .execute()

      const updated = await this.db
        .updateTable('hil_requests')
        .set({
          user_response: params.user_response,
          status: 'resolved',
          resolved_at: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('id', '=', params.id)
        .returningAll()
        .executeTakeFirst()

      if (!updated) {
        return { ok: false, error: `HIL request not found: ${params.id}` }
      }

      // Update related AI provider conversation status
      await this.db
        .updateTable('ai_provider_conversations')
        .set({
          status: 'resolved',
          solution: params.user_response,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('conversation_id', '=', updated.conversation_id)
        .execute()

      return {
        ok: true,
        request: updated as HilRequest,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'submit_hil_response',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Update HIL request status
   */
  async updateHilStatus(params: UpdateHilStatusParams): Promise<UpdateHilStatusResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'update_hil_status',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      const updateData: any = {
        status: params.status,
        updated_at: sql`CURRENT_TIMESTAMP`,
      }

      if (params.status === 'resolved') {
        updateData.resolved_at = sql`CURRENT_TIMESTAMP`
      }

      const updated = await this.db
        .updateTable('hil_requests')
        .set(updateData)
        .where('id', '=', params.id)
        .returningAll()
        .executeTakeFirst()

      if (!updated) {
        return { ok: false, error: `HIL request not found: ${params.id}` }
      }

      return {
        ok: true,
        request: updated as HilRequest,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'hil_ops.rpc',
          operation: 'update_hil_status',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }
}

