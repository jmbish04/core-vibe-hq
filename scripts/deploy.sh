#!/bin/bash
# Deploy worker(s)

set -e

WORKER="${1:-all}"

deploy_worker() {
  local path=$1
  local name=$2
  
  echo "🚀 Deploying $name..."
  cd "$path"
  
  if [ -f "package.json" ] && grep -q '"deploy"' package.json; then
    npm run deploy || (echo "  ❌ Deploy failed for $name" && cd ../.. && return 1)
  else
    wrangler deploy || (echo "  ❌ Deploy failed for $name" && cd ../.. && return 1)
  fi
  
  cd ../..
  echo "  ✅ $name deployed successfully"
}

if [ "$WORKER" = "all" ]; then
  echo "🚀 Deploying all workers..."
  
  # Orchestrator
  if [ -d "orchestrator" ]; then
    deploy_worker "orchestrator" "orchestrator"
  fi
  
  # Factories
  for factory in apps/*-factory; do
    if [ -d "$factory" ]; then
      deploy_worker "$factory" "$(basename $factory)"
    fi
  done
  
  # Ops Specialists
  for specialist in apps/ops-specialists/*; do
    if [ -d "$specialist" ] && [ -f "$specialist/wrangler.jsonc" ]; then
      deploy_worker "$specialist" "$(basename $specialist)"
    fi
  done
  
  echo "✅ All workers deployed!"
else
  # Deploy specific worker
  WORKER_PATH=""
  
  if [ "$WORKER" = "orchestrator" ]; then
    WORKER_PATH="orchestrator"
  elif [ -d "apps/$WORKER" ]; then
    WORKER_PATH="apps/$WORKER"
  elif [ -d "apps/ops-specialists/$WORKER" ]; then
    WORKER_PATH="apps/ops-specialists/$WORKER"
  else
    echo "❌ Worker '$WORKER' not found!"
    echo "Available workers:"
    echo "  - orchestrator"
    ls -d apps/*-factory 2>/dev/null | xargs -n1 basename | sed 's/^/  - /'
    ls -d apps/ops-specialists/* 2>/dev/null | xargs -n1 basename | sed 's/^/  - /'
    exit 1
  fi
  
  deploy_worker "$WORKER_PATH" "$WORKER"
fi

