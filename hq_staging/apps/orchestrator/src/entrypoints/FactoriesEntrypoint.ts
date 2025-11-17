/**
 * Factories RPC Entrypoint
 * 
 * Provides RPC methods for factory management via service bindings
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import { Kysely, D1Dialect } from 'kysely'
import type { DB } from '../db/schema'
import { listFactories, createFactory } from '../services/factory/factory-repo'
import type { CoreEnv } from '@shared/types/env'

export class FactoriesEntrypoint extends WorkerEntrypoint<CoreEnv> {
  private db(): Kysely<DB> {
    return new Kysely<DB>({ dialect: new D1Dialect({ database: this.env.DB_OPS }) })
  }

  async list() {
    return listFactories(this.db())
  }

  async create(name: string, provider = 'codex') {
    return createFactory(this.db(), {
      CORE_GITHUB_API: this.env.CORE_GITHUB_API as Fetcher,
      GITHUB_API_KEY: this.env.GITHUB_API_KEY,
      GITHUB_OWNER: this.env.GITHUB_OWNER,
      GITHUB_REPO: this.env.GITHUB_REPO
    }, name, provider)
  }
}




