/**
 * orchestrator/worker/entrypoints/factory.ts
 * ------------------------------------------------------------
 * Serves as the intake point for factory-initiated communication.
 * Its primary role is to accept batched error reports (e.g.,
 * FILE_NOT_FOUND, PLACEHOLDER_NOT_FOUND) from factory scripts
 * and orchestrate the auto-remediation process.
 *
 * Responsibilities:
 * - Ingest batches of `FactoryErrorItem` objects via RPC/API.
 * - Log all incoming errors to the `error_events` D1 table.
 * - Log the error report event to `operation_logs`.
 * - Attempt auto-remediation by coordinating with other services (like `github`).
 * - Create `followups` records for blocked or failed remediations.
 * - Initialize new factory directories with shared templates and configuration.
 * ------------------------------------------------------------
 * (Kysely-enabled)
 */

import type { CoreEnv } from '@shared/types/env'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import { GitHubClient } from '../clients/githubClient'
import { initFactory } from '../services/factory/factory-init'
import { RemediationReportResponse, InitializeFactoryResponse } from './types'
import type { Order, OrderFulfillmentResult } from '@shared/base/agents/BaseFactoryAgent'

type FactoryErrorItem = {
  order_id: string
  factory: string
  file_path: string
  placeholder?: string
  task_uuid?: string
  error_code: 'FILE_NOT_FOUND' | 'PLACEHOLDER_NOT_FOUND' | 'INJECT_FAILED' | 'UNKNOWN'
  message: string
  context?: any
}

export class Factory extends BaseWorkerEntrypoint<CoreEnv> {

  async reportAndRemediateErrors(params: { errors: FactoryErrorItem[] }): Promise<RemediationReportResponse> {
    const { errors } = params
    
    // Kysely transaction
    await this.db.transaction().execute(async (trx) => {
      // 1. Log all errors
      if (errors.length > 0) {
        const errorEventsToInsert = errors.map(e => ({
          order_id: e.order_id ?? null,
          task_uuid: e.task_uuid ?? null,
          factory: e.factory,
          file_path: e.file_path,
          placeholder: e.placeholder ?? null,
          error_code: e.error_code,
          message: e.message,
          context: JSON.stringify(e.context ?? {}),
        }))

        const opLogsToInsert = errors.map(e => ({
          source: 'factory.rpc',
          order_id: e.order_id ?? null,
          task_uuid: e.task_uuid ?? null,
          operation: 'error_report',
          level: 'error',
          details: JSON.stringify(e),
        }))

        await trx.insertInto('error_events').values(errorEventsToInsert).execute()
        await trx.insertInto('operation_logs').values(opLogsToInsert).execute()
      }
    })

    // 2. Attempt remediation (logic remains, but uses Kysely helper)
    const remediationResults = []
    for (const e of errors) {
      let result = { task_uuid: e.task_uuid, ok: false, action: 'none', note: '' }
      try {
        if (e.error_code === 'FILE_NOT_FOUND') {
          // This is where we'd call the GitHubClient
          // This logic would be more complex, using methods from github
          await this.logRemediation(e, 'blocked', `Remediation for FILE_NOT_FOUND not yet implemented in RPC.`)
          result = { task_uuid: e.task_uuid, ok: false, action: 'blocked', note: 'Not implemented' }

        } else if (e.error_code === 'PLACEHOLDER_NOT_FOUND') {
          await this.logRemediation(e, 'blocked', `Remediation for PLACEHOLDER_NOT_FOUND not yet implemented in RPC.`)
          result = { task_uuid: e.task_uuid, ok: false, action: 'blocked', note: 'Not implemented' }
        }
      } catch (err: any) {
        await this.logRemediation(e, 'blocked', `Remediation failed: ${err.message}`)
        result = { task_uuid: e.task_uuid, ok: false, action: 'error', note: err.message }
      }
      remediationResults.push(result)
    }

    return { ok: true, remediation: remediationResults }
  }

  private async logRemediation(e: FactoryErrorItem, type: string, note: string): Promise<void> {
    // Kysely query
    await this.db
      .insertInto('followups')
      .values({
        order_id: e.order_id,
        task_uuid: e.task_uuid,
        type: type,
        impact_level: 1,
        status: 'open',
        note: note,
        data: JSON.stringify(e),
      })
      .execute()
  }

  /**
   * Initialize a new factory directory structure with shared templates
   * Creates: factory directory, wrangler.jsonc, worker/index.ts, deploy workflow
   * Commits all files to GitHub via a new branch and optional PR
   * 
   * Delegates to the factory-init service for actual implementation
   */
  async initializeFactory(params: {
    factory_name: string
    factory_type?: 'agent' | 'data' | 'services' | 'ui' | 'ops'
    ai_provider?: string
    create_pr?: boolean
    branch?: string
    order_id?: string
    task_uuid?: string
  }): Promise<InitializeFactoryResponse> {
    const { 
      factory_name, 
      factory_type = 'agent', 
      ai_provider = 'codex',
      create_pr = false, 
      branch,
      order_id,
      task_uuid 
    } = params

    try {
      // Use the factory-init service
      const result = await initFactory({
        name: factory_name,
        factory_type,
        aiProvider: ai_provider,
        create_pr,
        branch,
        github: true,
        order_id,
        task_uuid,
      }, this.env)

      // Log operation
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'factory.initializeFactory',
          level: result.ok ? 'info' : 'error',
          details: JSON.stringify({
            factory_name,
            factory_type,
            ai_provider,
            files_created: result.files_created.length,
            branch: result.branch,
            pr_created: create_pr,
            pr_url: result.pr_url,
            error: result.error,
          }),
          order_id: order_id ?? null,
          task_uuid: task_uuid ?? null,
        })
        .execute()

      return {
        ok: result.ok,
        factory_name: result.factory_name,
        files_created: result.files_created,
        branch: result.branch,
        pr_url: result.pr_url,
        error: result.error,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Log error
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'factory.initializeFactory',
          level: 'error',
          details: JSON.stringify({
            factory_name,
            error: errorMessage,
          }),
          order_id: order_id ?? null,
          task_uuid: task_uuid ?? null,
        })
        .execute()

      return {
        ok: false,
        factory_name,
        files_created: [],
        error: errorMessage,
      }
    }
  }

  /**
   * Alias for initializeFactory - matches the user's requested API
   */
  async createFactory(name: string, provider: string, options?: {
    factory_type?: 'agent' | 'data' | 'services' | 'ui' | 'ops'
    create_pr?: boolean
    order_id?: string
    task_uuid?: string
  }): Promise<InitializeFactoryResponse> {
    return this.initializeFactory({
      factory_name: name,
      ai_provider: provider,
      factory_type: options?.factory_type,
      create_pr: options?.create_pr,
      order_id: options?.order_id,
      task_uuid: options?.task_uuid,
    })
  }

  /**
   * Fulfill an order by delegating to the appropriate factory agent
   * 
   * The orchestrator acts as a router, forwarding orders to factory agents
   * for planning and fulfillment. This method:
   * 1. Identifies the correct factory based on order.factory
   * 2. Gets the factory service binding
   * 3. Forwards the order to the factory's handleOrder endpoint
   * 
   * @deprecated Planning is now handled by BaseFactoryAgent.generateFileCreationPlan()
   * This method delegates order fulfillment to factory agents.
   */
  async fulfillOrder(params: { order: Order; factory?: string }): Promise<OrderFulfillmentResult> {
    const { order, factory } = params
    const factoryType = factory || order.factory

    try {
      // Log operation start
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'factory.fulfillOrder',
          level: 'info',
          details: JSON.stringify({
            order_id: order.id,
            factory: factoryType,
            status: 'started'
          }),
          order_id: order.id,
        })
        .execute()

      // Identify factory service binding
      let factoryService: any = null
      
      switch (factoryType) {
        case 'agent-factory':
          factoryService = this.env.AGENT_FACTORY
          break
        case 'ui-factory':
          factoryService = this.env.UI_FACTORY
          break
        case 'data-factory':
          factoryService = this.env.DATA_FACTORY
          break
        case 'services-factory':
          factoryService = this.env.SERVICES_FACTORY
          break
        default:
          throw new Error(`Unknown factory type: ${factoryType}`)
      }

      if (!factoryService) {
        throw new Error(`Service binding not available for factory: ${factoryType}`)
      }

      // Forward order to factory's handleOrder method
      // Note: The factory service binding should expose a FactoryOps entrypoint
      // with a handleOrder method that calls the Factory Agent
      const result = await factoryService.handleOrder({ order })

      // Log operation completion
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'factory.fulfillOrder',
          level: result.ok ? 'info' : 'error',
          details: JSON.stringify({
            order_id: order.id,
            factory: factoryType,
            status: result.ok ? 'completed' : 'failed',
            files_created: result.files_created?.length || 0,
            error: result.error
          }),
          order_id: order.id,
        })
        .execute()

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Log error
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'factory.fulfillOrder',
          level: 'error',
          details: JSON.stringify({
            order_id: order.id,
            factory: factoryType,
            error: errorMessage
          }),
          order_id: order.id,
        })
        .execute()

      return {
        ok: false,
        order_id: order.id,
        files_created: [],
        error: errorMessage
      }
    }
  }
}