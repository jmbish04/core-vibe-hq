
🧭 move_orchestrator_to_root_refactor.md

You are Cursor.

You are working inside the repository:



Your task is to refactor the repo structure to elevate the orchestrator to a top-level worker and introduce a new “Ops Specialist” submodule that handles conflict resolution, delivery reports, and final QA within the orchestration pipeline.

⸻

🧩 Current Context
	•	The repo currently has apps/orchestrator alongside apps/agent-factory, apps/data-factory, etc.
	•	Each factory is a standalone Cloudflare Worker + optional container.
	•	Orchestrator currently acts as a Worker under apps/orchestrator, but it should be the primary coordinator of all other workers.

⸻

🧱 Refactor Goals

1. Move the orchestrator up one level
	•	Move folder: apps/orchestrator → orchestrator/
	•	Fix all relative imports across:
	•	wrangler.jsonc paths
	•	package.json script paths
	•	Internal imports like ../../shared/types → ../shared/types
	•	Ensure orchestrator/wrangler.jsonc deploys as orchestrator.hacolby.workers.dev

2. Update top-level structure to:

core-vibe-hq/
├── orchestrator/          # Main Worker orchestrating all factories
│   ├── worker/            # Hono API, D1 routes, Queues
│   ├── utils/             # githubRemediation.ts, queue, order/task helpers
│   ├── ops-specialist/    # New module for ops automation (see below)
│   ├── migrations/
│   ├── types/
│   └── wrangler.jsonc
├── apps/
│   ├── agent-factory/
│   ├── data-factory/
│   ├── services-factory/
│   └── ui-factory/
└── shared/
    ├── types/
    └── memory-library/


⸻

🧑‍💼 Ops Specialist

Create a new folder under orchestrator/ops-specialist/ with:

File 1: index.ts

/**
 * Ops Specialist — Automated operational role handling:
 * - Conflict resolution (merge/branch collisions)
 * - Delivery report generation
 * - Follow-up issue creation and final QA
 *
 * Integrated as an orchestrator submodule. Called by queue worker or API route.
 */

import { githubRemediation } from '../utils/githubRemediation'
import type { Env } from '../types'

export const OpsSpecialist = {
  /** Attempt to clear merge conflicts via core-github-api and create a PR */
  async resolveConflict(env: Env, repo: string, branch: string, conflictFiles: string[]) {
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

  /** Generate final delivery report from D1 logs and followups */
  async generateDeliveryReport(env: Env, orderId: string) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM followups WHERE order_id = ? ORDER BY impact_level ASC`
    ).bind(orderId).all()

    const { results: ops } = await env.DB.prepare(
      `SELECT * FROM operation_logs WHERE order_id = ?`
    ).bind(orderId).all()

    return {
      order_id: orderId,
      summary: {
        issues: results.length,
        ops_count: ops.length,
        last_updated: new Date().toISOString(),
      },
      followups: results,
      operations: ops,
    }
  },

  /** Final QA routine invoked at the end of each delivery cycle */
  async finalQA(env: Env, orderId: string) {
    const report = await OpsSpecialist.generateDeliveryReport(env, orderId)
    const blocked = report.followups.filter((f: any) => f.type === 'blocked')

    if (blocked.length > 0) {
      await githubRemediation.createIssue(
        env,
        {
          order_id: orderId,
          file_path: blocked[0].file_path ?? 'unknown',
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

File 2: wrangler.queue.ts (optional if Queues enabled)
Queue worker for async conflict and delivery handling.

import { OpsSpecialist } from './index'
import type { Env } from '../types'

export default {
  async queue(batch: MessageBatch<unknown>, env: Env) {
    for (const msg of batch.messages) {
      const data = JSON.parse(msg.body as string)
      if (data.type === 'resolve_conflict') {
        await OpsSpecialist.resolveConflict(env, data.repo, data.branch, data.files)
      } else if (data.type === 'final_qa') {
        await OpsSpecialist.finalQA(env, data.order_id)
      }
    }
  },
}


⸻

⚙️ Additional Tasks
	•	Update all imports referencing ../../orchestrator → ../orchestrator
	•	Add ops-specialist to orchestrator wrangler.jsonc bindings (if Queues enabled)
	•	Update GitHub Actions for orchestrator: workingDirectory: "orchestrator"
	•	Run npm install inside orchestrator/ after move

⸻

✅ Validation checklist
	•	wrangler deploy at orchestrator root deploys successfully
	•	npm run dev still runs locally from orchestrator
	•	All factories still build and deploy independently
	•	/ops/report/:orderId endpoint in orchestrator returns delivery report
	•	D1 shows logged operations + followups for each order
	•	CI/CD workflow picks up orchestrator at new root location

⸻

Deliverables:
	1.	Moved orchestrator folder to top level (core-vibe-hq/orchestrator)
	2.	Updated all imports, configs, and workflows
	3.	Added ops-specialist module with resolveConflict, generateDeliveryReport, and finalQA methods
	4.	Confirmed wrangler config deploys as a standalone orchestrator worker

⸻

See move_orchestrator_to_root.sh -- bash script that executes the folder move, rewrites imports, and preserves .git history automatically? (It’ll rename apps/orchestrator → orchestrator and fix import paths + workflow YAML.)

Please review the bash to give yourself context and make sure the bash looks correct, perform a dry run (add dryrun capabilities), and once confirmed ok, run the bash script and monitor closely

🧩 What this script does
	•	Moves apps/orchestrator to orchestrator/
	•	Preserves git history
	•	Fixes import paths
	•	Updates Wrangler and CI workflow references
	•	Adds the new ops-specialist module
	•	Leaves everything ready for commit (git add but not commit)

⸻

💡 Usage

chmod +x move_orchestrator_to_root.sh
./move_orchestrator_to_root.sh

Then validate:

cd orchestrator
npm install
npm run dev
wrangler deploy

# Rollback script
rollback_orchestrator_move_with_verify,sh

⸻

🧩 What It Does
	1.	Moves orchestrator/ back under apps/ while preserving history.
	2.	Reverts import paths, wrangler configuration, and CI paths.
	3.	Removes the ops-specialist module (optional).
	4.	Runs:
	•	npm install (quietly, with warnings allowed)
	•	npx wrangler whoami (auth check)
	•	npx wrangler deploy --dry-run (verifies Cloudflare Worker builds)
	5.	Stops on any critical error to prevent committing a broken rollback.

⸻

🧮 Usage

chmod +x rollback_orchestrator_move_with_verify.sh
./rollback_orchestrator_move_with_verify.sh

Expected output:

✅ Rollback completed and verified successfully.


⸻
