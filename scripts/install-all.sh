#!/bin/bash
# Install dependencies for all workers

set -e

echo "📦 Installing dependencies for all workers..."

# Root dependencies
echo "Installing root dependencies..."
bun install

# Orchestrator
if [ -d "orchestrator" ]; then
  echo "Installing orchestrator dependencies..."
  cd orchestrator && bun install && cd ..
fi

# Factories
for factory in apps/*-factory; do
  if [ -d "$factory" ] && [ -f "$factory/package.json" ]; then
    echo "Installing dependencies for $(basename $factory)..."
    (cd "$factory" && bun install 2>/dev/null || echo "  ⚠️  No package.json or bun not available")
  fi
done

# Ops Specialists
for specialist in apps/ops-specialists/*; do
  if [ -d "$specialist" ] && [ -f "$specialist/package.json" ]; then
    echo "Installing dependencies for $(basename $specialist)..."
    (cd "$specialist" && bun install)
  fi
done

echo "✅ All dependencies installed!"

