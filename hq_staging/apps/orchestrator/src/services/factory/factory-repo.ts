/**
 * Factory Repository Service
 * 
 * Manages factory CRUD operations with D1 and GitHub sync
 */

import { coreGithub, CoreGithubEnv } from '../../integrations/coreGithub'
import type { D1DB } from '../../db/schema'
import { initFactory } from './factory-init'

export async function syncFactoriesFromGitHub(db: D1DB, env: CoreGithubEnv) {
  const t = await coreGithub.tree(env, { path: 'apps', recursive: false })
  const dirs = new Set<string>()

  // Find all factory directories under apps/
  for (const e of t.entries) {
    if (e.type === 'tree' && e.path.startsWith('apps/')) {
      const parts = e.path.split('/')
      if (parts.length === 2 && parts[1] && parts[1].endsWith('-factory')) {
        dirs.add(parts[1])
      }
    }
  }

  // Sync to D1
  for (const name of dirs) {
    await db
      .insertInto('factories')
      .values({
        name,
        provider: 'unknown',
        repo_owner: env.GITHUB_OWNER,
        repo_name: env.GITHUB_REPO,
        path: `apps/${name}`,
        active: 1
      })
      .onConflict((oc) => oc.column('name').doUpdateSet({ 
        active: 1,
        updated_at: new Date().toISOString()
      }))
      .executeTakeFirst()
  }

  return Array.from(dirs)
}

export async function listFactories(db: D1DB) {
  return db.selectFrom('factories').selectAll().orderBy('name asc').execute()
}

export async function createFactory(db: D1DB, env: CoreGithubEnv, name: string, provider: string) {
  // Initialize factory via GitHub API
  await initFactory({ 
    name, 
    aiProvider: provider, 
    github: true,
    factory_type: 'agent' // Default, can be made configurable
  }, env as any)

  // Upsert to D1
  await db.insertInto('factories').values({
    name, 
    provider,
    repo_owner: env.GITHUB_OWNER,
    repo_name: env.GITHUB_REPO,
    path: `apps/${name}`,
    active: 1
  }).onConflict((oc) => oc.column('name').doUpdateSet({ 
    provider,
    updated_at: new Date().toISOString()
  })).executeTakeFirst()

  return { ok: true, name, provider }
}

