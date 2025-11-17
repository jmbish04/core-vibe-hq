#!/bin/bash
#
# ask-orchestrator.sh
# 
# Simple wrapper script for AI providers (e.g., codex-cli) to ask the orchestrator
# for clarification during code generation.
#
# Usage:
#   ./ask-orchestrator.sh --question "What should I implement for PLACEHOLDER_IMPORTS?" --order-id ORD-123
#

set -e

# Default values
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-https://vibehq-orchestrator.hacolby.workers.dev}"
QUESTION=""
ORDER_ID=""
MAX_RETRIES=3
RETRY_DELAY=2

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --question)
      QUESTION="$2"
      shift 2
      ;;
    --order-id)
      ORDER_ID="$2"
      shift 2
      ;;
    --orchestrator-url)
      ORCHESTRATOR_URL="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 --question \"<question>\" --order-id <order-id> [--orchestrator-url <url>]"
      echo ""
      echo "Options:"
      echo "  --question          Question to ask the orchestrator (required)"
      echo "  --order-id          Order ID for context (required)"
      echo "  --orchestrator-url  Orchestrator URL (default: $ORCHESTRATOR_URL)"
      echo "  --help, -h          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$QUESTION" ]]; then
  echo "Error: --question is required"
  exit 1
fi

if [[ -z "$ORDER_ID" ]]; then
  echo "Error: --order-id is required"
  exit 1
fi

# Determine provider name (default to codex-cli if not set)
PROVIDER_NAME="${AI_PROVIDER_NAME:-codex-cli}"

# Make API request to orchestrator
make_request() {
  local url="${ORCHESTRATOR_URL}/api/ai-provider/clarify"
  local payload=$(cat <<EOF
{
  "order_id": "${ORDER_ID}",
  "provider_name": "${PROVIDER_NAME}",
  "question": "${QUESTION}"
}
EOF
)

  curl -s -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --max-time 30 \
    --retry $MAX_RETRIES \
    --retry-delay $RETRY_DELAY \
    --retry-connrefused
}

# Execute request with retry logic
response=""
for attempt in $(seq 1 $MAX_RETRIES); do
  response=$(make_request) || true
  
  # Check if response is valid JSON
  if echo "$response" | jq . >/dev/null 2>&1; then
    break
  fi
  
  if [[ $attempt -lt $MAX_RETRIES ]]; then
    echo "Warning: Request failed (attempt $attempt/$MAX_RETRIES), retrying..." >&2
    sleep $RETRY_DELAY
  else
    echo "Error: Failed to get valid response from orchestrator after $MAX_RETRIES attempts" >&2
    exit 1
  fi
done

# Output response as JSON
echo "$response"

# Check if response indicates success
if echo "$response" | jq -e '.ok == true' >/dev/null 2>&1; then
  # Extract response text if available
  response_text=$(echo "$response" | jq -r '.response // .solution // empty' 2>/dev/null)
  if [[ -n "$response_text" ]]; then
    echo "$response_text"
  fi
  exit 0
else
  # Extract error message if available
  error_msg=$(echo "$response" | jq -r '.error // "Unknown error"' 2>/dev/null)
  echo "Error: $error_msg" >&2
  exit 1
fi

