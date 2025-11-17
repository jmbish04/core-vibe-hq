#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../.. && pwd)"
CONFIG_FILE="$ROOT_DIR/.taskmaster/config.json"
ENV_FILE="$ROOT_DIR/.taskmaster/.env"

echo "[smoke] Starting Codex/Task Master smoke test..."

if ! command -v node >/dev/null 2>&1; then
  echo "[smoke:error] Node is not installed or not on PATH." >&2
  exit 2
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[smoke:error] Missing $CONFIG_FILE" >&2
  exit 3
fi

echo "[smoke] Validating .taskmaster/config.json..."
node <<'NODE'
const fs = require('fs');
const path = require('path');
const cfgPath = path.resolve('.taskmaster/config.json');
const errors = [];
const warn = [];

function has(obj, pathStr){
  return pathStr.split('.').reduce((o,k)=>o && o[k]!=null ? o[k] : undefined, obj) !== undefined;
}

const APPROVAL = new Set(['untrusted','on-failure','on-request','never']);
const SANDBOX = new Set(['read-only','workspace-write','danger-full-access']);

let cfg;
try { cfg = JSON.parse(fs.readFileSync(cfgPath,'utf8')); }
catch (e) { console.error('[smoke:error] Failed to parse config.json:', e.message); process.exit(10); }

if (!has(cfg,'codexCli')) errors.push('Missing codexCli section');
else {
  const cc = cfg.codexCli;
  if (!APPROVAL.has(cc.approvalMode)) errors.push(`Invalid approvalMode: ${cc.approvalMode}`);
  if (!SANDBOX.has(cc.sandboxMode)) errors.push(`Invalid sandboxMode: ${cc.sandboxMode}`);
  if (typeof cc.provider !== 'string' || !cc.provider) warn.push('codexCli.provider is empty');
  if (typeof cc.model !== 'string' || !cc.model) warn.push('codexCli.model is empty');
}

if (errors.length){
  console.error('[smoke:fail] config.json validation errors:');
  for (const e of errors) console.error(' -', e);
  process.exit(11);
}

if (warn.length){
  console.log('[smoke:warn] configuration warnings:');
  for (const w of warn) console.log(' -', w);
}

console.log('[smoke:ok] config.json looks valid.');
NODE

if [ ! -f "$ENV_FILE" ]; then
  echo "[smoke:warn] Missing $ENV_FILE (only required if running remote providers)"
else
  echo "[smoke] Checking API keys in .taskmaster/.env..."
  if grep -q "pplx-your-key-here" "$ENV_FILE"; then
    echo "[smoke:warn] PERPLEXITY_API_KEY appears to be a placeholder."
  fi
fi

echo "[smoke] Checking CLI presence..."
node -v || true
npm -v || true
if command -v codex >/dev/null 2>&1; then
  codex --version || true
else
  echo "[smoke:warn] codex not found on PATH"
fi
if command -v mcp-inspector >/dev/null 2>&1; then
  echo "[smoke:ok] mcp-inspector found: $(command -v mcp-inspector)"
else
  echo "[smoke:warn] mcp-inspector (Node) not found on PATH"
  echo "[smoke] Tip: run 'npx @modelcontextprotocol/inspector' to launch the UI (optional)"
fi
if command -v task-master-ai >/dev/null 2>&1; then
  task-master-ai --version || true
else
  echo "[smoke:warn] task-master-ai not found on PATH"
fi

echo "[smoke] Validating tasks file presence..."
if [ -f "$ROOT_DIR/.taskmaster/tasks/tasks.json" ]; then
  echo "[smoke:ok] Found .taskmaster/tasks/tasks.json"
else
  echo "[smoke:warn] .taskmaster/tasks/tasks.json not found"
fi

echo "[smoke] Done."
