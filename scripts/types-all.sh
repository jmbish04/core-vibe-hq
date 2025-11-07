#!/bin/bash
# Generate Wrangler types for all workers

set -e

echo "🔧 Generating Wrangler types for all workers..."

# Orchestrator
if [ -d "orchestrator" ]; then
  echo "Generating types for orchestrator..."
  cd orchestrator && wrangler types 2>/dev/null || echo "  ⚠️  Failed" && cd ..
fi

# Factories
for factory in apps/*-factory; do
  if [ -d "$factory" ] && [ -f "$factory/wrangler.jsonc" ]; then
    echo "Generating types for $(basename $factory)..."
    cd "$factory" && wrangler types 2>/dev/null || echo "  ⚠️  Failed" && cd ../..
  fi
done

# Ops Specialists
for specialist in apps/ops-specialists/*; do
  if [ -d "$specialist" ] && [ -f "$specialist/wrangler.jsonc" ]; then
    echo "Generating types for $(basename $specialist)..."
    cd "$specialist" && wrangler types 2>/dev/null || echo "  ⚠️  Failed" && cd ../../..
  fi
done

echo "✅ Type generation complete!"

