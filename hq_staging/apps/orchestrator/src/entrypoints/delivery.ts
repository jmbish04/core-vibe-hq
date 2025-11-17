/**
 * orchestrator/worker/entrypoints/delivery.ts
 * (Kysely-enabled)
 * ------------------------------------------------------------
 * Provides methods for provisioning and "delivering" final
 * Cloudflare resources. This class acts as an abstraction over
 * deployment clients (e.g., a `ProvisionerClient`) to allow the
 * orchestrator to deploy new Workers or Pages projects.
 *
 * Responsibilities:
 * - Provide a `deployWorker` method for deploying new services.
 * - Provide a `deployPages` method for deploying new frontends.
 * - Log all deployment operations to `operation_logs`.
 * - Standardize the interface for all "delivery" actions.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env'
// This client is hypothetical, but follows your pattern
import { ProvisionerClient } from '@shared/clients/provisionerClient'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import { DeployWorkerResponse, DeployPagesResponse } from './types'

export class Delivery extends BaseWorkerEntrypoint<CoreEnv> {
  
  /**
   * Deploys a new Cloudflare Worker service from a factory output.
   */
  async deployWorker(params: {
    serviceName: string
    script: string // Assumes script content is passed
    bindings: { type: string, name: string, value: string }[]
    orderId?: string
  }): Promise<DeployWorkerResponse> {
    const provisioner = new ProvisionerClient(this.env)
    const result = await provisioner.deployWorker(params)

    // Kysely query
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'delivery.deployWorker',
        level: 'info',
        details: JSON.stringify({ service: params.serviceName }),
        order_id: params.orderId ?? null,
      })
      .execute()
    
    return result // e.g., { ok: true, worker_url: '...' }
  }

  /**
   * Deploys a Cloudflare Pages project from a factory output (e.g., commit hash).
   */
  async deployPages(params: {
    projectName: string
    commitHash: string
    orderId?: string
  }): Promise<DeployPagesResponse> {
    const provisioner = new ProvisionerClient(this.env)
    const result = await provisioner.deployPages(params)

    // Kysely query
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'delivery.deployPages',
        level: 'info',
        details: JSON.stringify({ project: params.projectName, commit: params.commitHash }),
        order_id: params.orderId ?? null,
      })
      .execute()
    
    return result // e.g., { ok: true, pages_url: '...' }
  }
}