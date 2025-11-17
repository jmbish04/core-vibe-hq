/**
 * Factory Management API Routes
 * 
 * Provides HTTP endpoints for factory management:
 * - GET /api/factories - List all factories
 * - POST /api/factories/sync - Sync factories from GitHub
 * - POST /api/factories - Create a new factory
 */

import { Hono } from 'hono'
import { Kysely, D1Dialect } from 'kysely'
import type { DB } from '../../db/schema'
import { listFactories, syncFactoriesFromGitHub, createFactory } from '../../services/factory/factory-repo'

type Ctx = {
  Bindings: {
    DB_OPS: D1Database
    CORE_GITHUB_API: Fetcher
    GITHUB_API_KEY: string
    GITHUB_OWNER: string
    GITHUB_REPO: string
  }
}

export const factoryRoutes = new Hono<Ctx>()

function dbFrom(c: any): Kysely<DB> {
  return new Kysely<DB>({ dialect: new D1Dialect({ database: c.env.DB_OPS }) })
}

/**
 * GET /api/factories
 * List all factories from D1
 */
factoryRoutes.get('/', async (c) => {
  try {
    const db = dbFrom(c)
    const rows = await listFactories(db)
    return c.json({ ok: true, factories: rows })
  } catch (error: any) {
    console.error('Failed to list factories:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/factories/sync
 * Sync factories from GitHub repository
 */
factoryRoutes.post('/sync', async (c) => {
  try {
    const db = dbFrom(c)
    const env = {
      CORE_GITHUB_API: c.env.CORE_GITHUB_API,
      GITHUB_API_KEY: c.env.GITHUB_API_KEY,
      GITHUB_OWNER: c.env.GITHUB_OWNER,
      GITHUB_REPO: c.env.GITHUB_REPO
    }
    const names = await syncFactoriesFromGitHub(db, env)
    return c.json({ ok: true, discovered: names })
  } catch (error: any) {
    console.error('Failed to sync factories:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/factories
 * Create a new factory
 */
factoryRoutes.post('/', async (c) => {
  try {
    const { name, provider = 'codex' } = await c.req.json()
    
    if (!name || typeof name !== 'string') {
      return c.json({ ok: false, error: 'name required' }, 400)
    }

    // Validate factory name format
    if (!/^[a-z0-9-]+$/.test(name)) {
      return c.json({ 
        ok: false, 
        error: 'Factory name must be lowercase alphanumeric with hyphens only' 
      }, 400)
    }

    const db = dbFrom(c)
    const env = {
      CORE_GITHUB_API: c.env.CORE_GITHUB_API,
      GITHUB_API_KEY: c.env.GITHUB_API_KEY,
      GITHUB_OWNER: c.env.GITHUB_OWNER,
      GITHUB_REPO: c.env.GITHUB_REPO
    }
    const res = await createFactory(db, env, name, provider)
    return c.json(res)
  } catch (error: any) {
    console.error('Failed to create factory:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})
