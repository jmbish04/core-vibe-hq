#!/usr/bin/env bash
set -euo pipefail

# Copies Task Master tests from STAGING into root tests/ and surgically
# rewrites relative imports to reference the STAGING sources.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
SRC_DIR="$ROOT_DIR/STAGING/claude-task-master/tests"
DST_DIR="$ROOT_DIR/tests"

echo "[migrate-tests] Source: $SRC_DIR"
echo "[migrate-tests] Dest:   $DST_DIR"

if [ ! -d "$SRC_DIR" ]; then
  echo "[migrate-tests:error] Missing $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DST_DIR"

echo "[migrate-tests] Copying files..."
rsync -a --delete "$SRC_DIR/" "$DST_DIR/"

echo "[migrate-tests] Rewriting relative imports to STAGING paths..."
# For all JS test files copied under tests/, adjust '../../../src/' and '../../../scripts/'
# to point to STAGING/claude-task-master equivalents relative to tests/*.
find "$DST_DIR" -type f -name "*.js" | while read -r file; do
  # Use portable sed (BSD macOS) in-place edit
  # 1) Keep the specific triple-up rewrites (already copied earlier)
  sed -i '' \
    -e "s#\.{3}/src/#../../../STAGING/claude-task-master/src/#g" \
    -e "s#\.{3}/scripts/#../../../STAGING/claude-task-master/scripts/#g" \
    "$file"

  # 2) Convert any remaining relative '../.../src/' or '../.../scripts/' to an alias
  #    that we map via Jest: '@tmstaging/<path>'
  sed -E -i '' \
    -e "s#((\.\./)+)src/#@tmstaging/src/#g" \
    -e "s#((\.\./)+)scripts/#@tmstaging/scripts/#g" \
    "$file"
done

echo "[migrate-tests] Done. Try: npm run test:taskmaster"
