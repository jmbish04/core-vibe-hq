#!/bin/bash
echo "🔧 Adding missing Env type imports..."

# Function to add Env import to a file
add_env_import() {
  local file="$1"
  local import_path="$2"
  
  if [ -f "$file" ]; then
    # Check if import already exists
    if ! grep -q "import.*Env.*from" "$file"; then
      # Find the first import line and add our import after it
      local first_import_line=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
      if [ -n "$first_import_line" ]; then
        sed -i "${first_import_line}a import type { Env } from '$import_path';" "$file"
        echo "Added Env import to $file"
      fi
    fi
  fi
}

# Get all files with Env type errors
pnpm run typecheck 2>&1 | grep "error TS2304:" | grep "Env" | sed 's/:.*//' | sort | uniq | while read file; do
  # Determine the correct import path based on file location
  if [[ "$file" == apps/* ]]; then
    # Apps workers - import from base
    add_env_import "$file" '../../base/worker/types/env'
  elif [[ "$file" == orchestrator/* ]]; then
    # Orchestrator - import from local types
    add_env_import "$file" './types'
  elif [[ "$file" == @shared/* ]]; then
    # Shared code - import from shared types
    add_env_import "$file" '../types/env'
  fi
done

echo "✅ Env import fixes applied. Run typecheck again to verify."
