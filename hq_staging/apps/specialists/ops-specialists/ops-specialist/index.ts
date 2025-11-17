/**
 * Ops Specialist — Orchestrator wrapper for specialist Workers
 * - Conflict resolution via conflict-specialist Worker
 * - Delivery report generation via delivery-report-specialist Worker
 * - Follow-up issue creation and final QA
 *
 * This module delegates to the specialist Workers instead of duplicating logic.
 */

import { githubRemediation } from '../../../../orchestrator/worker/services/remediation/githubRemediation'
import { createDatabaseService } from '../../../../orchestrator/worker/database/database'
import { followups, operationLogs } from '../../../../orchestrator/worker/database/schema'
import { asc, eq } from 'drizzle-orm'
import type { Env } from '../../../../orchestrator/worker/types'

export const OpsSpecialist = {
  /** 
   * Resolve conflicts via conflict-specialist Worker
   * Falls back to creating GitHub issue if specialist Worker is not available
   */
  async resolveConflict(
    env: Env, 
    repo: string, 
    branch: string, 
    conflictFiles: string[],
    prNumber?: number,
    baseBranch?: string,
    headBranch?: string
  ) {
    // If service binding is available, delegate to conflict-specialist Worker
    if (env.CONFLICT_SPECIALIST && prNumber && baseBranch && headBranch) {
      try {
        const response = await env.CONFLICT_SPECIALIST.fetch('https://placeholder/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'conflict-resolution',
            repo,
            base_branch: baseBranch,
            head_branch: headBranch,
            pr_number: prNumber,
            github_token: env.GITHUB_API_KEY,
          }),
        })
        
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.warn('Conflict specialist Worker unavailable, falling back to issue creation:', error)
      }
    }

    // Fallback: Create GitHub issue if specialist Worker unavailable
    const note = `Conflict detected in ${repo}:${branch} → ${conflictFiles.join(', ')}`
    await githubRemediation.createIssue(
      env,
      {
        error_code: 'merge_conflict',
        file_path: conflictFiles[0] ?? 'unknown',
        message: note,
      },
      'Ops Specialist auto-detected conflict and opened an issue.'
    )
  },

  /** 
   * Generate delivery report via delivery-report-specialist Worker or fallback to D1 query
   */
  async generateDeliveryReport(
    env: Env, 
    orderId: string,
    projectId?: string,
    originalOrderSpec?: string
  ) {
    // If service binding is available and we have full context, delegate to specialist Worker
    if (env.DELIVERY_REPORT_SPECIALIST && projectId && originalOrderSpec) {
      try {
        const response = await env.DELIVERY_REPORT_SPECIALIST.fetch('https://placeholder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'delivery-report',
            project_id: projectId,
            original_order_spec: originalOrderSpec,
          }),
        })
        
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.warn('Delivery report specialist Worker unavailable, falling back to basic report:', error)
      }
    }

    // Fallback: Generate basic report from D1 logs
    const db = createDatabaseService(env)
    
    const followupsList = await db.db
      .select()
      .from(followups)
      .where(eq(followups.orderId, orderId))
      .orderBy(asc(followups.impactLevel))

    const operationsList = await db.db
      .select()
      .from(operationLogs)
      .where(eq(operationLogs.orderId, orderId))

    return {
      order_id: orderId,
      summary: {
        issues: followupsList.length,
        ops_count: operationsList.length,
        last_updated: new Date().toISOString(),
      },
      followups: followupsList,
      operations: operationsList,
    }
  },

  /** Final QA routine invoked at the end of each delivery cycle */
  async finalQA(env: Env, orderId: string) {
    const report = await OpsSpecialist.generateDeliveryReport(env, orderId) as {
      order_id: string
      summary: { issues: number; ops_count: number; last_updated: string }
      followups: Array<{ type: string; note?: string }>
      operations: unknown[]
    }
    const blocked = report.followups.filter((f) => f.type === 'blocked')

    if (blocked.length > 0) {
      await githubRemediation.createIssue(
        env,
        {
          order_id: orderId,
          file_path: blocked[0].note ?? 'unknown',
          error_code: 'final_qa_blocked',
          message: `${blocked.length} unresolved blockers.`,
        },
        'Final QA failed — unresolved followups remain.'
      )
    }

    return {
      report,
      status: blocked.length ? 'failed' : 'passed',
    }
  },
}

