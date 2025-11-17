#!/bin/bash

# Example usage of CLI tools outside Docker environment
# This script demonstrates how to use the CLI tools in any directory
# NOTE: All monitoring data is stored in orchestrator D1 - no local SQLite databases

echo "=== CLI Tools Configuration Example ==="
echo

# Set custom data directory for file logs (optional - only for SimpleLogManager)
export CLI_DATA_DIR="./monitoring-data"

# Orchestrator configuration (REQUIRED for database operations)
export ORCHESTRATOR_URL="http://localhost:8787"  # Or your orchestrator URL
export WORKER_NAME="my-worker"                    # Worker identifier
export CONTAINER_NAME="my-container"             # Optional container identifier

echo "Data directory (file logs): $CLI_DATA_DIR"
echo "Orchestrator URL: $ORCHESTRATOR_URL"
echo "Worker Name: $WORKER_NAME"
echo "Container Name: $CONTAINER_NAME"
echo "Note: All database operations route to orchestrator D1"
echo

# Example: Start monitoring a process
echo "=== Starting Process Monitor ==="
bun run cli-tools.ts process start --instance-id "my-app" --port 3000 -- npm run dev &
MONITOR_PID=$!

# Wait a bit for the process to start
sleep 2

# Example: Check process status
echo "=== Process Status ==="
bun run cli-tools.ts process status --instance-id "my-app"
echo

# Example: List recent errors
echo "=== Recent Errors ==="
bun run cli-tools.ts errors list --instance-id "my-app" --limit 10 --format table
echo

# Example: Get recent logs
echo "=== Recent Logs ==="
bun run cli-tools.ts logs get --instance-id "my-app" --format raw
echo

# Example: Get error statistics
echo "=== Error Statistics ==="
bun run cli-tools.ts errors stats --instance-id "my-app"
echo

# Example: Get log statistics
echo "=== Log Statistics ==="
bun run cli-tools.ts logs stats --instance-id "my-app"
echo

# Example: Get all logs and reset (useful for periodic log collection)
echo "=== All Logs (and reset) ==="
bun run cli-tools.ts logs get --instance-id "my-app" --format raw --reset > collected-logs.txt
echo "Logs saved to collected-logs.txt"
echo

# Cleanup: Stop the monitor
echo "=== Stopping Monitor ==="
bun run cli-tools.ts process stop --instance-id "my-app"

echo "=== Example Complete ==="