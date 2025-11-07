#!/bin/bash
# Update Wrangler version across all workers

set -e

echo "📦 Updating Wrangler across all workers..."

# Install globally
echo "Installing Wrangler globally..."
npm install -g wrangler@latest

# Update orchestrator
if [ -d "orchestrator" ] && [ -f "orchestrator/package.json" ]; then
  echo "Updating Wrangler in orchestrator..."
  cd orchestrator && npm install wrangler@latest && cd ..
fi

# Update all factories
for factory in apps/*-factory; do
  if [ -d "$factory" ] && [ -f "$factory/package.json" ]; then
    echo "Updating Wrangler in $(basename $factory)..."
    cd "$factory" && npm install wrangler@latest && cd ../..
  fi
done

# Update all specialists
for specialist in apps/ops-specialists/*; do
  if [ -d "$specialist" ] && [ -f "$specialist/package.json" ]; then
    echo "Updating Wrangler in $(basename $specialist)..."
    cd "$specialist" && npm install wrangler@latest && cd ../../..
  fi
done

echo "✅ Wrangler updated everywhere!"

