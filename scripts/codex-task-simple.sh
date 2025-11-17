#!/bin/bash

# =========================
# Simple Codex Task Launcher
# =========================
# Quick helper to get task details and launch codex
#
# Usage:
#   ./scripts/codex-task-simple.sh [task-id]

set -e

PROJECT_ROOT="/Volumes/Projects/workers/core-vibe-hq"
cd "$PROJECT_ROOT"

TASK_ID=${1:-next}

if [ "$TASK_ID" = "next" ]; then
    TASK_ID=$(npx task-master-ai next --json 2>/dev/null | jq -r '.data.nextTask.id // empty')
    if [ -z "$TASK_ID" ]; then
        echo "❌ No next task available"
        exit 1
    fi
    echo "✅ Next task: $TASK_ID"
fi

echo "📋 Fetching task $TASK_ID..."
npx task-master-ai set-status --id="$TASK_ID" --status=in-progress 2>/dev/null || true

TASK_JSON=$(npx task-master-ai show "$TASK_ID" --json 2>/dev/null)

if [ "$TASK_JSON" = "{}" ]; then
    echo "❌ Task $TASK_ID not found"
    exit 1
fi

TITLE=$(echo "$TASK_JSON" | jq -r '.title // "Unknown"')
DESC=$(echo "$TASK_JSON" | jq -r '.description // ""')
DETAILS=$(echo "$TASK_JSON" | jq -r '.details // ""')
TEST=$(echo "$TASK_JSON" | jq -r '.testStrategy // ""')

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Task #$TASK_ID: $TITLE"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Build prompt
PROMPT="You are working on Task #$TASK_ID: $TITLE in the core-vibe-hq project.

**Task Description:**
$DESC

**Implementation Details:**
$DETAILS

**Test Strategy:**
$TEST

**Current Location:** $PROJECT_ROOT

**Key Requirements:**
1. Read the existing codebase to understand patterns and conventions
2. Implement the task according to the details provided
3. Follow the project's TypeScript and coding standards
4. Ensure all code is properly typed (no \`as any\` or type shortcuts)
5. Update task status when complete: \`npx task-master-ai set-status --id=$TASK_ID --status=done\`

**Important Constraints:**
- Only orchestrator has direct D1 database access
- Apps workers must use orchestrator service bindings for database operations
- Use Drizzle ORM for all database queries (never raw SQL)
- Migrations only go in orchestrator/migrations/
- All new workers MUST have deploy workflows in .github/workflows/
- Run \`npm run problems\` before marking task complete

Start by reading the relevant files in the codebase to understand the current structure, then implement the task following the existing patterns."

# Save to temp file
TMP_FILE=$(mktemp)
echo "$PROMPT" > "$TMP_FILE"

echo "📝 Prompt ready. Launching Codex..."
echo ""
cd "$PROJECT_ROOT"
codex < "$TMP_FILE" || {
    echo ""
    echo "❌ Codex failed. Prompt saved to: $TMP_FILE"
    echo "💡 You can manually run: codex < \"$TMP_FILE\""
    exit 1
}

rm "$TMP_FILE"
echo "✅ Codex agent completed for task $TASK_ID"

