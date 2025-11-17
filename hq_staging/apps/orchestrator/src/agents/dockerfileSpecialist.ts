/**
 * Dockerfile Specialist Agent
 * 
 * Provides API endpoints for:
 * - Validating Dockerfiles
 * - Applying surgical patches via patchctl
 * - Managing container settings
 */

import { Hono } from 'hono'
import { Kysely, D1Dialect } from 'kysely'
import { coreGithub, CoreGithubEnv } from '../integrations/coreGithub'
import { exec } from '../utils/exec'
import type { DB } from '../db/schema'

type Ctx = {
  Bindings: {
    DB_OPS: D1Database
    CORE_GITHUB_API: Fetcher
    GITHUB_API_KEY: string
    GITHUB_OWNER: string
    GITHUB_REPO: string
  }
}

/**
 * Very small "MCP client" shim – the real MCP runs in your agent container.
 * Here we fake a query endpoint you can swap to your MCP gateway later.
 */
async function queryCloudflareDocs(q: string) {
  // Placeholder: return a minimal suggestion; swap with real MCP call.
  return {
    ok: true,
    citations: ['https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/'],
    guidance: [
      'Prefer service bindings + WorkerEntrypoint (RPC) over raw HTTP where possible.',
      'Avoid shell installs during request; bake tools into image.',
      'Use minimal base with Node 20.x, no global installs at runtime.',
    ]
  }
}

export const dockerfileAgentApi = new Hono<Ctx>()

/**
 * POST /api/dockerfile/validate
 * Validate a factory's Dockerfile and get guidance
 */
dockerfileAgentApi.post('/validate', async (c) => {
  try {
    const { factoryName, dockerfilePath } = await c.req.json<{ factoryName: string, dockerfilePath?: string }>()
    const dfPath = dockerfilePath ?? `apps/${factoryName}/Dockerfile`

    const guidance = await queryCloudflareDocs(`Best practices for Dockerfile + Cloudflare Workers containers`)

    // Fetch file from GitHub tree (lightweight presence check)
    const env: CoreGithubEnv = {
      CORE_GITHUB_API: c.env.CORE_GITHUB_API,
      GITHUB_API_KEY: c.env.GITHUB_API_KEY,
      GITHUB_OWNER: c.env.GITHUB_OWNER,
      GITHUB_REPO: c.env.GITHUB_REPO
    }
    
    let exists = false
    try {
      const tree = await coreGithub.tree(env, { path: `apps/${factoryName}`, recursive: true })
      exists = tree.entries.some(e => e.path === dfPath)
    } catch (error) {
      // If path doesn't exist, factory might not exist yet
      console.warn('Could not check Dockerfile existence:', error)
    }

    return c.json({
      ok: true,
      exists,
      dockerfilePath: dfPath,
      mcpGuidance: guidance
    })
  } catch (error: any) {
    console.error('Failed to validate Dockerfile:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/dockerfile/patch
 * Propose and apply a small change (surgically) to the Dockerfile.
 * Expects coordinates resolved by UI or coordResolver (start/end).
 */
dockerfileAgentApi.post('/patch', async (c) => {
  try {
    const { factoryName, dockerfilePath, start, end, block, taskId, reason } =
      await c.req.json<{ 
        factoryName: string
        dockerfilePath?: string
        start: number
        end: number
        block: string
        taskId?: string
        reason?: string
      }>()

    const dfPath = dockerfilePath ?? `apps/${factoryName}/Dockerfile`
    
    // Shell out to patchctl (local dev / container runtime); in prod you'll run this in the factory container.
    const run = await exec(
      `./patchctl replace-block --file ${dfPath} --start ${start} --end ${end} --open-space --task-id ${taskId ?? ''} --reason "${reason ?? 'dockerfile-tune'}"`,
      block
    )

    // Log to D1
    const db = new Kysely<DB>({ dialect: new D1Dialect({ database: c.env.DB_OPS }) })
    await db.insertInto('operation_logs').values({
      source: 'dockerfile-agent',
      operation: 'patch',
      level: run.ok ? 'info' : 'error',
      details: JSON.stringify({ factoryName, dfPath, start, end, run })
    }).executeTakeFirst()

    return c.json({ ok: run.ok, result: run })
  } catch (error: any) {
    console.error('Failed to patch Dockerfile:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/containers/settings
 * Save container settings JSON (edited by user via UI chat or form).
 */
dockerfileAgentApi.post('/settings', async (c) => {
  try {
    const { factoryName, dockerfilePath, json } =
      await c.req.json<{ factoryName: string, dockerfilePath?: string, json: any }>()

    const db = new Kysely<DB>({ dialect: new D1Dialect({ database: c.env.DB_OPS }) })
    
    await db
      .insertInto('container_settings')
      .values({
        factory_name: factoryName,
        dockerfile_path: dockerfilePath ?? `apps/${factoryName}/Dockerfile`,
        json: JSON.stringify(json)
      })
      .onConflict(oc => oc.column('factory_name').doUpdateSet({
        dockerfile_path: dockerfilePath ?? `apps/${factoryName}/Dockerfile`,
        json: JSON.stringify(json),
        updated_at: new Date().toISOString()
      }))
      .executeTakeFirst()

    await db.insertInto('operation_logs').values({
      source: 'dockerfile-agent',
      operation: 'settings.update',
      level: 'info',
      details: JSON.stringify({ factoryName })
    }).executeTakeFirst()

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('Failed to update container settings:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * GET /api/containers/settings
 * Get container settings for a factory
 */
dockerfileAgentApi.get('/settings', async (c) => {
  try {
    const factoryName = c.req.query('factoryName')
    
    if (!factoryName) {
      return c.json({ ok: false, error: 'factoryName query parameter required' }, 400)
    }

    const db = new Kysely<DB>({ dialect: new D1Dialect({ database: c.env.DB_OPS }) })
    const settings = await db
      .selectFrom('container_settings')
      .selectAll()
      .where('factory_name', '=', factoryName)
      .executeTakeFirst()

    if (!settings) {
      return c.json({ ok: true, settings: null })
    }

    return c.json({ 
      ok: true, 
      settings: {
        ...settings,
        json: JSON.parse(settings.json)
      }
    })
  } catch (error: any) {
    console.error('Failed to get container settings:', error)
    return c.json({ ok: false, error: error.message || 'Internal server error' }, 500)
  }
})

