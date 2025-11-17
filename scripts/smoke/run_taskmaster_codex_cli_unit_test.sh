#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../.. && pwd)"
PKG_DIR="$ROOT_DIR/STAGING/claude-task-master"
TEST_REL="tests/unit/ai-providers/codex-cli.test.js"

echo "[taskmaster-test] Repo: $PKG_DIR"

if [ ! -d "$PKG_DIR" ]; then
  echo "[taskmaster-test:error] Missing $PKG_DIR" >&2
  exit 1
fi

cd "$PKG_DIR"

if [ ! -f "$TEST_REL" ]; then
  echo "[taskmaster-test:error] Missing test file $TEST_REL" >&2
  exit 2
fi

# Ensure jest is installed locally in the copied Task Master package
if [ ! -x "node_modules/.bin/jest" ]; then
  echo "[taskmaster-test] jest not found in STAGING/claude-task-master."
  echo "[taskmaster-test] Install dev deps in that folder, then rerun:"
  echo "  cd STAGING/claude-task-master && npm i"
  echo "  node --experimental-vm-modules ./node_modules/.bin/jest $TEST_REL"
  exit 3
fi

echo "[taskmaster-test] Running: jest $TEST_REL (ESM with --experimental-vm-modules)"
NODE_ENV=test node --experimental-vm-modules ./node_modules/.bin/jest "$TEST_REL"

