/**
 * Coordinate Resolver API Routes
 * 
 * Provides HTTP endpoints for resolving file coordinates (anchors/markers)
 * for surgical patching operations.
 */

import { Hono } from 'hono'
import { coreGithub, CoreGithubEnv } from '../../integrations/coreGithub'
import { resolveCoords, type ResolveRequest } from '../../utils/coordResolver'
import { Kysely, D1Dialect } from 'kysely'
import type { DB } from '../../db/schema'

type Ctx = {
  Bindings: {
    DB_OPS: D1Database
    CORE_GITHUB_API: Fetcher
    GITHUB_API_KEY: string
    GITHUB_OWNER: string
    GITHUB_REPO: string
  }
}

export const coordsApi = new Hono<Ctx>()

/**
 * POST /api/coords/resolve
 * Resolve coordinates for a file anchor or block marker
 */
coordsApi.post('/resolve', async (c) => {
  try {
    const body = await c.req.json<{
      path: string
      ref?: string
      mode: ResolveRequest['mode']
      anchor?: string
      beginId?: string
      endId?: string
      includeMarkers?: boolean
    }>()

    if (!body?.path || !body?.mode) {
      return c.json({ ok: false, error: 'path and mode required' }, 400)
    }

    const env: CoreGithubEnv = {
      CORE_GITHUB_API: c.env.CORE_GITHUB_API,
      GITHUB_API_KEY: c.env.GITHUB_API_KEY,
      GITHUB_OWNER: c.env.GITHUB_OWNER,
      GITHUB_REPO: c.env.GITHUB_REPO
    }

    const { text } = await coreGithub.content(env, body.path, body.ref ?? 'main')
    const res = resolveCoords({
      text,
      mode: body.mode,
      anchor: body.anchor,
      beginId: body.beginId,
      endId: body.endId,
      includeMarkers: body.includeMarkers
    })

    // Log operation
    const db = new Kysely<DB>({ dialect: new D1Dialect({ database: c.env.DB_OPS }) })
    await db.insertInto('operation_logs').values({
      source: 'orchestrator',
      operation: 'coords.resolve',
      level: res.ok ? 'info' : 'warn',
      details: JSON.stringify({
        path: body.path,
        mode: body.mode,
        anchor: body.anchor,
        beginId: body.beginId,
        endId: body.endId,
        result: res
      })
    }).executeTakeFirst()

    return c.json(res)
  } catch (e: any) {
    console.error('Failed to resolve coordinates:', e)
    return c.json({ ok: false, error: String(e?.message ?? e) }, 500)
  }
})




