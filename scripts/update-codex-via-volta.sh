#!/usr/bin/env bash
set -euo pipefail

# Updates Node and key CLIs via Volta, then verifies versions.
# Safe to run multiple times. Requires Volta installed.

echo "[update-codex-via-volta] Starting..."

if ! command -v volta >/dev/null 2>&1; then
  echo "[update-codex-via-volta] Volta not found. Install from https://volta.sh/ and re-run." >&2
  exit 1
fi

echo "[update-codex-via-volta] Installing Node and core package managers..."
volta install node@lts npm@latest yarn@berry pnpm@latest >/dev/null

echo "[update-codex-via-volta] Installing CLIs (global via Volta)..."
# Codex CLI and related tooling
volta install codex-cli@latest >/dev/null || echo "[warn] Failed to install codex-cli (verify package name)"
volta install @modelcontextprotocol/inspector@latest >/dev/null || echo "[warn] Failed to install @modelcontextprotocol/inspector (optional)"
volta install task-master-ai@latest >/dev/null || echo "[warn] Failed to install task-master-ai"

# Optional: helpers you might use in this repo
volta install zx@latest >/dev/null || true

echo "[update-codex-via-volta] Versions:"
node -v || true
npm -v || true
codex --version || echo "[info] codex not on PATH yet" 
if command -v mcp-inspector >/dev/null 2>&1; then
  echo "mcp-inspector: $(command -v mcp-inspector)"
else 
  echo "[info] mcp-inspector not on PATH. You can also run: npx @modelcontextprotocol/inspector"
fi
task-master-ai --version || echo "[info] task-master-ai not on PATH yet"

echo "[update-codex-via-volta] Done."
