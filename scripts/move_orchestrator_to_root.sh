#!/bin/bash
set -e

echo "=== 🚀 Moving Orchestrator to top-level ==="

# 1. Verify starting point
if [ ! -d "apps/orchestrator" ]; then
  echo "[ERROR] apps/orchestrator not found. Run this from the core-vibe-hq repo root."
  exit 1
fi

# 2. Create destination
mkdir -p orchestrator

# 3. Preserve git history while moving
echo "[INFO] Moving orchestrator with git history..."
git mv apps/orchestrator/* orchestrator/ >/dev/null 2>&1 || mv apps/orchestrator/* orchestrator/
git add orchestrator || true

# 4. Clean up empty source folder
rmdir apps/orchestrator 2>/dev/null || true

# 5. Fix imports in TypeScript/TSX files
echo "[INFO] Rewriting import paths..."
find orchestrator -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.jsonc" \) | while read -r file; do
  # Adjust relative imports to shared and types directories
  sed -i.bak 's#\.\./\.\./shared/types#\.\./shared/types#g' "$file"
  sed -i.bak 's#\.\./\.\./shared/memory-library#\.\./shared/memory-library#g' "$file"
  sed -i.bak 's#\.\./\.\./types#\.\./types#g' "$file"
  sed -i.bak 's#\.\./\.\./worker#\.\./worker#g' "$file"
  rm -f "$file.bak"
done

# 6. Update wrangler paths
echo "[INFO] Updating Wrangler config..."
WRANGLER_FILE="orchestrator/wrangler.jsonc"
if [ -f "$WRANGLER_FILE" ]; then
  jq '.name = "orchestrator" |
      .main = "worker/index.ts" |
      .site.bucket = "./public" |
      .build = { "command": "npm run build", "cwd": "orchestrator" } |
      .triggers = { "crons": [] }' "$WRANGLER_FILE" > "$WRANGLER_FILE.tmp" && mv "$WRANGLER_FILE.tmp" "$WRANGLER_FILE"
  echo "[OK] Updated wrangler.jsonc"
fi

# 7. Update orchestrator GitHub Action workflow
WORKFLOW_FILE=".github/workflows/deploy-orchestrator.yml"
if [ -f "$WORKFLOW_FILE" ]; then
  echo "[INFO] Updating GitHub Actions workflow..."
  sed -i.bak 's#workingDirectory: "apps/orchestrator"#workingDirectory: "orchestrator"#g' "$WORKFLOW_FILE" || true
  sed -i.bak 's#cd apps/orchestrator#cd orchestrator#g' "$WORKFLOW_FILE" || true
  rm -f "$WORKFLOW_FILE.bak"
fi

# 8. Add ops-specialist module if missing
if [ ! -d "orchestrator/ops-specialist" ]; then
  mkdir -p orchestrator/ops-specialist
  cat > orchestrator/ops-specialist/index.ts <<'EOF'
/**
 * Ops Specialist — automated conflict resolution and delivery QA module.
 */
import { githubRemediation } from '../utils/githubRemediation'
import type { Env } from '../types'

export const OpsSpecialist = {
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
    return { report, status: blocked.length ? 'failed' : 'passed' }
  },
}
EOF
  echo "[OK] Created ops-specialist module."
fi

# 9. Commit changes
git add orchestrator .github || true
echo "[INFO] Commit and push manually when satisfied with changes."

echo "✅ Done. Orchestrator successfully elevated to top-level."