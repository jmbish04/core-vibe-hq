#!/bin/bash
# Lint all workers

set -e

FAILED=0

echo "🧹 Linting all workers..."

# Orchestrator
if [ -d "orchestrator" ]; then
  echo "Linting orchestrator..."
  cd orchestrator
  if [ -f "package.json" ] && grep -q '"lint"' package.json; then
    npm run lint || FAILED=1
  else
    echo "  ⚠️  No lint script found"
  fi
  cd ..
fi

# Factories
for factory in apps/*-factory; do
  if [ -d "$factory" ] && [ -f "$factory/package.json" ]; then
    echo "Linting $(basename $factory)..."
    cd "$factory"
    if grep -q '"lint"' package.json; then
      npm run lint || FAILED=1
    else
      echo "  ⚠️  No lint script found"
    fi
    cd ../..
  fi
done

# Ops Specialists
for specialist in apps/ops-specialists/*; do
  if [ -d "$specialist" ] && [ -f "$specialist/package.json" ]; then
    echo "Linting $(basename $specialist)..."
    cd "$specialist"
    if grep -q '"lint"' package.json; then
      npm run lint || FAILED=1
    else
      echo "  ⚠️  No lint script found"
    fi
    cd ../../..
  fi
done

if [ $FAILED -eq 1 ]; then
  echo "❌ Linting failed!"
  exit 1
fi

echo "✅ All linting passed!"

