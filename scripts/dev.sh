#!/bin/bash
# Start development server for worker(s)

WORKER="${1}"

if [ -z "$WORKER" ]; then
  echo "❌ Please specify a worker to start"
  echo ""
  echo "Usage: npm run dev <worker-name>"
  echo ""
  echo "Available workers:"
  echo "  - orchestrator"
  ls -d apps/*-factory 2>/dev/null | xargs -n1 basename | sed 's/^/  - /'
  ls -d apps/ops-specialists/* 2>/dev/null | xargs -n1 basename | sed 's/^/  - /'
  exit 1
fi

dev_worker() {
  local path=$1
  local name=$2
  
  echo "🔧 Starting dev server for $name..."
  cd "$path"
  
  if [ -f "package.json" ] && grep -q '"dev"' package.json; then
    npm run dev
  else
    wrangler dev
  fi
}

WORKER_PATH=""

if [ "$WORKER" = "orchestrator" ]; then
  WORKER_PATH="orchestrator"
elif [ -d "apps/$WORKER" ]; then
  WORKER_PATH="apps/$WORKER"
elif [ -d "apps/ops-specialists/$WORKER" ]; then
  WORKER_PATH="apps/ops-specialists/$WORKER"
else
  echo "❌ Worker '$WORKER' not found!"
  exit 1
fi

dev_worker "$WORKER_PATH" "$WORKER"

