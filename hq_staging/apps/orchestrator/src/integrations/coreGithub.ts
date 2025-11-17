/**
 * Core GitHub API Proxy Wrapper
 * 
 * Provides a clean interface to the core-github-api service binding
 */

export interface CoreGithubEnv {
  CORE_GITHUB_API: Fetcher
  GITHUB_API_KEY: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
}

async function call(env: CoreGithubEnv, path: string, init?: RequestInit) {
  const url = `https://core-github-api.hacolby.workers.dev${path}`
  const headers = new Headers(init?.headers || {})
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${env.GITHUB_API_KEY}`)
  headers.set('X-GitHub-Owner', env.GITHUB_OWNER)
  headers.set('X-GitHub-Repo', env.GITHUB_REPO)
  return env.CORE_GITHUB_API.fetch(new Request(url, { ...init, headers }))
}

export const coreGithub = {
  async tree(env: CoreGithubEnv, opts: { ref?: string, path?: string, recursive?: boolean }) {
    const body = JSON.stringify({
      owner: env.GITHUB_OWNER, 
      repo: env.GITHUB_REPO,
      ref: opts.ref ?? 'main', 
      path: opts.path ?? '', 
      recursive: !!opts.recursive
    })
    const r = await call(env, `/api/tools/files/tree`, { method: 'POST', body })
    if (!r.ok) throw new Error(`tree failed: ${r.status} ${await r.text()}`)
    return r.json() as Promise<{ entries: Array<{ path: string, type: string }>, listing: string, truncated: boolean }>
  },

  async upsert(env: CoreGithubEnv, p: { path: string, content: string, message: string, sha?: string }) {
    const body = JSON.stringify({ owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, ...p })
    const r = await call(env, `/api/tools/files/upsert`, { method: 'POST', body })
    if (!r.ok) throw new Error(`upsert failed: ${r.status} ${await r.text()}`)
    return r.json()
  },

  async content(env: CoreGithubEnv, path: string, ref = 'main'): Promise<{ contentB64: string; sha: string; text: string }> {
    const r = await call(env, `/api/octokit/rest/repos/get-content`, {
      method: 'POST',
      body: JSON.stringify({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path,
        ref
      })
    })
    if (!r.ok) throw new Error(`content failed: ${r.status} ${await r.text()}`)
    const json: any = await r.json()
    const contentB64 = json.content
    const sha = json.sha
    // Decode base64 content
    const text = contentB64 ? atob(contentB64.replace(/\s/g, '')) : ''
    return { contentB64, sha, text }
  }
}

