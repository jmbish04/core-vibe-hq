Perfect — here’s the enhanced rollback script that not only restores the orchestrator’s original structure and imports but also runs a full post-rollback validation, including a wrangler whoami connectivity test and a dry-run deploy check (wrangler deploy --dry-run) to confirm the Worker can still build and deploy successfully before committing.

⸻

🧰 rollback_orchestrator_move_with_verify.sh

#!/bin/bash
set -e

echo "=== ⚙️ Rolling back orchestrator refactor with verification ==="

# 1. Ensure repo root and target directory exist
if [ ! -d "orchestrator" ]; then
  echo "[ERROR] orchestrator folder not found at repo root."
  exit 1
fi

# 2. Recreate apps/orchestrator destination
mkdir -p apps/orchestrator

# 3. Move orchestrator back
echo "[STEP 1] Moving orchestrator back to apps/"
git mv orchestrator/* apps/orchestrator/ >/dev/null 2>&1 || mv orchestrator/* apps/orchestrator/
git add apps/orchestrator || true

# 4. Revert imports and relative paths
echo "[STEP 2] Fixing import paths..."
find apps/orchestrator -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.jsonc" \) | while read -r file; do
  sed -i.bak 's#\.\./shared/types#\.\./\.\./shared/types#g' "$file"
  sed -i.bak 's#\.\./shared/memory-library#\.\./\.\./shared/memory-library#g' "$file"
  sed -i.bak 's#\.\./types#\.\./\.\./types#g' "$file"
  sed -i.bak 's#\.\./worker#\.\./\.\./worker#g' "$file"
  rm -f "$file.bak"
done

# 5. Restore wrangler config values
WRANGLER_FILE="apps/orchestrator/wrangler.jsonc"
if [ -f "$WRANGLER_FILE" ]; then
  echo "[STEP 3] Restoring wrangler.jsonc config..."
  jq '.name = "apps-orchestrator" |
      .main = "worker/index.ts" |
      .site.bucket = "./public" |
      .build = { "command": "npm run build", "cwd": "apps/orchestrator" }' "$WRANGLER_FILE" > "$WRANGLER_FILE.tmp" && mv "$WRANGLER_FILE.tmp" "$WRANGLER_FILE"
fi

# 6. Restore GitHub Actions workflow directory paths
WORKFLOW_FILE=".github/workflows/deploy-orchestrator.yml"
if [ -f "$WORKFLOW_FILE" ]; then
  echo "[STEP 4] Restoring workflow YAML paths..."
  sed -i.bak 's#workingDirectory: "orchestrator"#workingDirectory: "apps/orchestrator"#g' "$WORKFLOW_FILE" || true
  sed -i.bak 's#cd orchestrator#cd apps/orchestrator#g' "$WORKFLOW_FILE" || true
  rm -f "$WORKFLOW_FILE.bak"
fi

# 7. Remove ops-specialist module if present
if [ -d "apps/orchestrator/ops-specialist" ]; then
  echo "[STEP 5] Removing ops-specialist module for rollback consistency..."
  rm -rf apps/orchestrator/ops-specialist
fi

# 8. Clean up empty folder
rmdir orchestrator 2>/dev/null || true

# 9. Post-rollback verification
echo "=== 🔍 Post-Rollback Verification ==="
cd apps/orchestrator || exit 1

echo "[VERIFY] Installing dependencies..."
npm install --legacy-peer-deps >/dev/null 2>&1 || echo "[WARN] npm install had warnings, continuing."

echo "[VERIFY] Checking Wrangler auth..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "[ERROR] Wrangler authentication failed. Run 'npx wrangler login' and retry."
  exit 1
else
  echo "[OK] Wrangler authentication verified."
fi

echo "[VERIFY] Performing dry-run deploy check..."
if npx wrangler deploy --dry-run >/dev/null 2>&1; then
  echo "[OK] Dry-run deploy succeeded. Worker build is valid."
else
  echo "[ERROR] Wrangler dry-run deploy failed. Check build logs."
  exit 1
fi

# 10. Stage rollback changes
cd ../..
git add apps/orchestrator .github || true

echo ""
echo "✅ Rollback completed and verified successfully."
echo "You can now test locally:"
echo "   cd apps/orchestrator && npm run dev"
echo ""
echo "Then commit the rollback if everything checks out:"
echo "   git commit -m 'rollback: restore orchestrator under apps and revert imports'"