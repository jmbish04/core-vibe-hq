#!/bin/bash
# Type check all workers

set -e

FAILED=0

echo "🔍 Type checking all workers..."

# Orchestrator
if [ -d "orchestrator" ]; then
  echo "Type checking orchestrator..."
  cd orchestrator
  if [ -f "package.json" ] && grep -q '"typecheck"' package.json; then
    npm run typecheck || FAILED=1
  else
    tsc --noEmit || FAILED=1
  fi
  cd ..
fi

# Factories
for factory in apps/*-factory; do
  if [ -d "$factory" ] && [ -f "$factory/tsconfig.json" ]; then
    echo "Type checking $(basename $factory)..."
    cd "$factory" && tsc --noEmit || FAILED=1 && cd ../..
  fi
done

# Ops Specialists
for specialist in apps/ops-specialists/*; do
  if [ -d "$specialist" ] && [ -f "$specialist/tsconfig.json" ]; then
    echo "Type checking $(basename $specialist)..."
    cd "$specialist" && tsc --noEmit || FAILED=1 && cd ../../..
  fi
done

if [ $FAILED -eq 1 ]; then
  echo "❌ Type checking failed!"
  exit 1
fi

echo "✅ All type checks passed!"

