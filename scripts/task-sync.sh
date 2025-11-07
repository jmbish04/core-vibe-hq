#!/bin/bash

set -euo pipefail

PROJECT_ROOT="/Volumes/Projects/workers/core-vibe-hq"
TASK_FILE="$PROJECT_ROOT/.taskmaster/tasks/tasks.json"

usage() {
  cat <<'EOF'
Task status/assignee helper
 
Usage:
  task-sync.sh start <task-id> <assignee>
  task-sync.sh complete <task-id> <assignee>
  task-sync.sh assign <task-id> <assignee>
  task-sync.sh release <task-id>
  task-sync.sh info <task-id>

Commands:
  start     Set status to in-progress and assign to cursor/codex
  complete  Set status to done and assign (for audit trail)
  assign    Update assignee only, no status change
  release   Clear assignee and set status back to pending
  info      Show current status/assignee for a task

Examples:
  ./scripts/task-sync.sh start 3 codex
  ./scripts/task-sync.sh complete 2 cursor
  ./scripts/task-sync.sh release 3
  ./scripts/task-sync.sh --help
EOF
  exit 1
}

ensure_prereqs() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required. Install with 'brew install jq'" >&2
    exit 1
  fi
  if [ ! -f "$TASK_FILE" ]; then
    echo "error: tasks file not found at $TASK_FILE" >&2
    exit 1
  fi
}

update_assignee() {
  local task_id="$1"
  local assignee="$2"
  local tmp
  tmp=$(mktemp)

  if [[ "$task_id" == *.* ]]; then
    local parent_id="${task_id%%.*}"
    local sub_id="${task_id#*.}"
    jq \
      --arg parent "$parent_id" \
      --arg sub "$sub_id" \
      --arg assignee "$assignee" \
      '(.master.tasks) |= map(
        if (.id|tostring) == $parent then
          if (.subtasks? | length) > 0 then
            .subtasks |= map(
              if (.id|tostring) == $sub then
                if ($assignee == "") then del(.assignee) else .assignee = $assignee end
              else . end)
          else . end
        else . end)
      ' "$TASK_FILE" >"$tmp"
  else
    jq \
      --arg id "$task_id" \
      --arg assignee "$assignee" \
      '(.master.tasks) |= map(
        if (.id|tostring) == $id then
          if ($assignee == "") then del(.assignee) else .assignee = $assignee end
        else . end)
      ' "$TASK_FILE" >"$tmp"
  fi

  mv "$tmp" "$TASK_FILE"
}

update_status() {
  local task_id="$1"
  local status="$2"
  local tmp
  tmp=$(mktemp)

  if [[ "$status" == "" ]]; then
    rm -f "$tmp"
    return
  fi

  if [[ "$task_id" == *.* ]]; then
    local parent_id="${task_id%%.*}"
    local sub_id="${task_id#*.}"
    jq \
      --arg parent "$parent_id" \
      --arg sub "$sub_id" \
      --arg status "$status" \
      '(.master.tasks) |= map(
        if (.id|tostring) == $parent then
          if (.subtasks? | length) > 0 then
            .subtasks |= map(
              if (.id|tostring) == $sub then
                .status = $status
              else . end)
          else . end
        else . end)
      ' "$TASK_FILE" >"$tmp"
  else
    jq \
      --arg id "$task_id" \
      --arg status "$status" \
      '(.master.tasks) |= map(
        if (.id|tostring) == $id then
          .status = $status
        else . end)
      ' "$TASK_FILE" >"$tmp"
  fi

  mv "$tmp" "$TASK_FILE"
}

show_info() {
  local task_id="$1"
  local jq_filter

  if [[ "$task_id" == *.* ]]; then
    local parent_id="${task_id%%.*}"
    local sub_id="${task_id#*.}"
    jq_filter=".master.tasks[] | select((.id|tostring)==\"$parent_id\") | .subtasks[] | select((.id|tostring)==\"$sub_id\")"
  else
    jq_filter=".master.tasks[] | select((.id|tostring)==\"$task_id\")"
  fi

  jq "$jq_filter | {id, title, status, assignee}" "$TASK_FILE"
}

command=${1:-}
task_id=${2:-}
assignee=${3:-}

case "$command" in
  --help|-h|help)
    usage
    ;;
esac

if [[ -z "$command" ]]; then
  usage
fi

ensure_prereqs

case "$command" in
  start)
    [[ -n "$task_id" && -n "$assignee" ]] || usage
    update_assignee "$task_id" "$assignee"
    update_status "$task_id" "in-progress"
    echo "Task $task_id -> in-progress (assignee: $assignee)"
    ;;
  complete)
    [[ -n "$task_id" && -n "$assignee" ]] || usage
    update_assignee "$task_id" "$assignee"
    update_status "$task_id" "done"
    echo "Task $task_id -> done (assignee: $assignee)"
    ;;
  assign)
    [[ -n "$task_id" && -n "$assignee" ]] || usage
    update_assignee "$task_id" "$assignee"
    echo "Task $task_id assignee set to $assignee"
    ;;
  release)
    [[ -n "$task_id" ]] || usage
    update_assignee "$task_id" ""
    update_status "$task_id" "pending"
    echo "Task $task_id released (status pending, assignee cleared)"
    ;;
  info)
    [[ -n "$task_id" ]] || usage
    show_info "$task_id"
    ;;
  *)
    usage
    ;;
esac

