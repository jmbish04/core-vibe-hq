/**
 * orchestrator/worker/services/remediation/githubRemediation.ts
 * ------------------------------------------------------------
 * Centralized integration layer between the orchestrator-worker
 * and the core-github-api service.
 *
 * Responsibilities:
 * - Repository tree scanning and fuzzy file search
 * - Placeholder remediation (insertion or patch PR)
 * - Issue creation when remediation fails
 * - Automatic D1 logging for every operation
 * ------------------------------------------------------------
 */

import type { Env } from '../../types'
import { createDatabaseService } from '../../database/database'
import { followups, operationLogs } from '../../database/ops/schema'

interface TreeEntry {
  path: string
  type: 'blob' | 'tree'
  url?: string
}

interface TreeResponse {
  entries: TreeEntry[]
}

interface UpsertResponse {
  commit: {
    sha: string
  }
}

interface PRResponse {
  html_url: string
}

export interface ErrorItem {
  order_id?: string
  factory?: string
  file_path: string
  placeholder?: string
  task_uuid?: string
  error_code: string
  message?: string
  context?: any
}

/**
 * Environment interface for GitHub remediation operations.
 * Extends Env to get DB binding, plus GitHub-specific environment variables.
 */
export interface GitHubRemediationEnv extends Pick<Env, 'DB_OPS'> {
  CORE_GITHUB_API: string
  GITHUB_API_KEY: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
}

export const githubRemediation = {
  /** 🔍 Find renamed/missing files using a fuzzy match across repo tree */
  async findRenamedFile(env: GitHubRemediationEnv, e: ErrorItem) {
    const resp = await fetch(`${env.CORE_GITHUB_API}/api/tools/files/tree`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        ref: 'main',
        recursive: true,
      }),
    })
    if (!resp.ok) throw new Error(`GitHub tree request failed: ${resp.status}`)
    const data = (await resp.json()) as TreeResponse

    const target = e.file_path.split('/').pop()?.toLowerCase() || ''
    const match = data.entries.find(
      (x) =>
        x.path.toLowerCase().includes(target) && x.type === 'blob',
    )

    await logOp(env, e, 'github.findRenamedFile', match ? 'info' : 'warn', {
      target,
      found: !!match,
    })

    return match ? { found: true, new_path: match.path, confidence: 0.8 } : null
  },

  /** 🩹 Attempt to reinsert a missing placeholder, commit & open PR */
  async fixMissingPlaceholder(env: GitHubRemediationEnv, e: ErrorItem) {
    const headers = {
      Authorization: `Bearer ${env.GITHUB_API_KEY}`,
      'Content-Type': 'application/json',
    }

    const treeResp = await fetch(
      `${env.CORE_GITHUB_API}/api/tools/files/tree`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          owner: env.GITHUB_OWNER,
          repo: env.GITHUB_REPO,
          ref: 'main',
          path: e.file_path,
        }),
      },
    )

    if (!treeResp.ok) throw new Error(`Tree fetch failed for ${e.file_path}`)
    const tree = (await treeResp.json()) as TreeResponse
    const file = tree.entries?.find((f) => f.path === e.file_path)
    if (!file) throw new Error(`File ${e.file_path} not found in repo`)
    if (!file.url) throw new Error(`File ${e.file_path} has no URL`)

    const raw = await fetch(file.url).then((r) => r.text())
    const placeholder = e.placeholder || 'PLACEHOLDER_NOT_SPECIFIED'
    const injected = raw.includes(placeholder)
      ? raw
      : `${raw}\n\n// ${placeholder}\n###${placeholder}###`

    const b64 = btoa(injected)

    const upsert = (await fetch(`${env.CORE_GITHUB_API}/api/tools/files/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path: e.file_path,
        content: b64,
        message: `Auto-fix: insert placeholder ${e.placeholder} (task ${e.task_uuid})`,
      }),
    }).then((r) => r.json())) as UpsertResponse

    const pr = (await fetch(`${env.CORE_GITHUB_API}/api/tools/prs/open`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        head: 'auto-fix-placeholder',
        base: 'main',
        title: `Auto-fix missing placeholder ${e.placeholder}`,
        body: `Automated remediation for ${e.file_path}\nTask ${e.task_uuid}`,
      }),
    }).then((r) => r.json())) as PRResponse

    const result = {
      patched: true,
      pr_url: pr.html_url,
      commit_sha: upsert.commit.sha,
    }

    await logOp(env, e, 'github.fixMissingPlaceholder', 'info', result)
    return result
  },

  /** 🚨 Create issue and D1 followup if remediation failed */
  async createIssue(env: GitHubRemediationEnv, e: ErrorItem, note: string) {
    const headers = {
      Authorization: `Bearer ${env.GITHUB_API_KEY}`,
      'Content-Type': 'application/json',
    }

    const resp = await fetch(`${env.CORE_GITHUB_API}/api/tools/issues/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        title: `Blocked: ${e.error_code} (${e.file_path})`,
        body: `${note}\n\nTask: ${e.task_uuid}\nOrder: ${e.order_id}`,
        labels: ['blocked', e.error_code],
      }),
    }).then((r) => r.json())

    const db = createDatabaseService(env as Env)
    await db.ops.insert(followups).values({
      orderId: e.order_id ?? null,
      taskUuid: e.task_uuid ?? null,
      type: 'blocked',
      impactLevel: 1,
      status: 'open',
      note,
      data: resp,
    })

    await logOp(env, e, 'github.createIssue', 'error', resp)
    return resp
  },
}

/** Internal helper for logging every GitHub remediation step */
async function logOp(
  env: GitHubRemediationEnv,
  e: ErrorItem,
  operation: string,
  level: string,
  details: any,
) {
  const db = createDatabaseService(env as Env)
  await db.ops.insert(operationLogs).values({
    source: 'github-remediation',
    orderId: e.order_id ?? null,
    taskUuid: e.task_uuid ?? null,
    operation,
    level,
    details: details ?? {},
  })
}
