/**
 * orchestrator/worker/entrypoints/github.ts
 * ------------------------------------------------------------
 * Acts as a thin, secure wrapper around the `GitHubClient`.
 * It exposes core GitHub actions (like upserting files or
 * opening PRs) as RPC/API methods and ensures every action
 * is logged to the central `operation_logs` table.
 *
 * This module intentionally abstracts away repository details.
 * Downstream workers only provide file/PR-specific info,
 * while this module injects the `owner` and `repo` from the
 * orchestrator's environment variables.
 * (Kysely-enabled)
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env'
import { GitHubClient } from '../clients/githubClient'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import { UpsertFileResponse, OpenPRResponse } from './types'

export class GitHub extends BaseWorkerEntrypoint<CoreEnv> {
  // Database is initialized by the base class

  async upsertFile(params: {
    path: string
    content: string
    message: string
    sha?: string
    branch?: string
    order_id?: string
    task_uuid?: string
  }): Promise<UpsertFileResponse> {
    const gh = new GitHubClient(this.env)
    const ghParams = {
      ...params,
      owner: this.env.GITHUB_OWNER,
      repo: this.env.GITHUB_REPO,
    }
    const result = await gh.upsertFile(ghParams)

    // Kysely query
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'github.upsertFile',
        level: 'info',
        details: JSON.stringify({
          path: params.path,
          branch: params.branch,
          message: params.message,
        }),
        order_id: params.order_id ?? null,
        task_uuid: params.task_uuid ?? null,
      })
      .execute()

    return result
  }

  async openPR(params: {
    head: string
    base: string
    title: string
    body?: string
    order_id?: string
    task_uuid?: string
  }): Promise<OpenPRResponse> {
    const gh = new GitHubClient(this.env)
    const ghParams = {
      ...params,
      owner: this.env.GITHUB_OWNER,
      repo: this.env.GITHUB_REPO,
    }
    const result = await gh.openPR(ghParams)

    // Kysely query
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'github.openPR',
        level: 'info',
        details: JSON.stringify({
          head: params.head,
          base: params.base,
          title: params.title,
        }),
        order_id: params.order_id ?? null,
        task_uuid: params.task_uuid ?? null,
      })
      .execute()

    return result
  }
}