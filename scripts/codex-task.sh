#!/bin/bash

# =========================
# Codex Task Worker Script
# =========================
# This script spawns a Codex agent to work on a specific task from task-master
#
# Usage:
#   ./scripts/codex-task.sh                    # Show interactive menu
#   ./scripts/codex-task.sh next               # Get next available task
#   ./scripts/codex-task.sh 5                  # Work on task 5 specifically
#   ./scripts/codex-task.sh 5,6,7             # Work on multiple tasks in parallel
#
# Interactive Menu Options:
#   1) Work on next available task
#   2) List all pending tasks
#   3) List all in-progress tasks
#   4) Work on specific task by ID
#   5) Work on multiple tasks (comma-separated IDs)
#   6) View task details
#   7) Show task status summary
#   8) Exit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="/Volumes/Projects/workers/core-vibe-hq"
cd "$PROJECT_ROOT"

# Task master CLI path
TASK_MASTER="npx task-master-ai"

# Function to get task details
get_task_details() {
    local task_id=$1
    $TASK_MASTER show "$task_id" --json 2>/dev/null || echo "{}"
}

# Function to get next available task
get_next_task() {
    $TASK_MASTER next --json 2>/dev/null | jq -r '.data.nextTask.id // empty'
}

# Function to build codex prompt from task
build_codex_prompt() {
    local task_id=$1
    local task_json=$(get_task_details "$task_id")
    
    if [ "$task_json" = "{}" ]; then
        echo "Error: Could not fetch task $task_id"
        return 1
    fi
    
    local title=$(echo "$task_json" | jq -r '.title // "Unknown Task"')
    local description=$(echo "$task_json" | jq -r '.description // ""')
    local details=$(echo "$task_json" | jq -r '.details // ""')
    local test_strategy=$(echo "$task_json" | jq -r '.testStrategy // ""')
    local dependencies=$(echo "$task_json" | jq -r '.dependencies // [] | @csv' | tr -d '"')
    
    cat <<EOF
You are working on Task #$task_id: $title in the core-vibe-hq project.

**Task Description:**
$description

**Implementation Details:**
$details

**Test Strategy:**
$test_strategy

**Dependencies:**
${dependencies:-None}

**Current Location:** $PROJECT_ROOT

**Key Requirements:**
1. Read the existing codebase to understand patterns and conventions
2. Implement the task according to the details provided
3. Follow the project's TypeScript and coding standards
4. Ensure all code is properly typed (no \`as any\` or type shortcuts)
5. Update task status when complete: \`npx task-master-ai set-status --id=$task_id --status=done\`
6. If you encounter issues, update the task: \`npx task-master-ai update-subtask --id=$task_id --prompt="[your findings]"\`

**Important Constraints:**
- Only orchestrator has direct D1 database access
- Apps workers must use orchestrator service bindings for database operations
- Use Drizzle ORM for all database queries (never raw SQL)
- Migrations only go in orchestrator/migrations/
- All new workers MUST have deploy workflows in .github/workflows/
- Run \`npm run problems\` before marking task complete

**Before starting:**
1. Review the task details thoroughly
2. Check existing code patterns in similar files
3. Understand dependencies and prerequisites
4. Plan your implementation approach

**After completion:**
1. Run \`npm run problems\` to check for TypeScript/lint errors
2. Fix ALL errors before marking complete
3. Update task status to 'done'
4. Commit your changes with a descriptive message

Start by reading the relevant files in the codebase to understand the current structure, then implement the task following the existing patterns.
EOF
}

# Function to spawn codex agent for a task
spawn_codex_agent() {
    local task_id=$1
    
    echo -e "${BLUE}📋 Fetching task $task_id details...${NC}"
    
    # Get task details and check if it exists
    local task_json=$(get_task_details "$task_id")
    if [ "$task_json" = "{}" ]; then
        echo -e "${RED}❌ Error: Task $task_id not found${NC}"
        return 1
    fi
    
    local status=$(echo "$task_json" | jq -r '.status // "unknown"')
    local title=$(echo "$task_json" | jq -r '.title // "Unknown"')
    
    echo -e "${GREEN}✅ Task $task_id: $title (Status: $status)${NC}"
    
    # Set task to in-progress
    echo -e "${YELLOW}🔄 Setting task $task_id to in-progress...${NC}"
    $TASK_MASTER set-status --id="$task_id" --status=in-progress 2>/dev/null || true
    
    # Build the prompt
    local prompt=$(build_codex_prompt "$task_id")
    
    # Save prompt to temporary file
    local prompt_file=$(mktemp)
    echo "$prompt" > "$prompt_file"
    
    echo -e "${BLUE}🚀 Spawning Codex agent for task $task_id...${NC}"
    echo -e "${YELLOW}📍 Working directory: $PROJECT_ROOT${NC}"
    echo ""
    
    # Display instructions and prompt
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}📋 Task $task_id Prompt Ready${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}💡 To start Codex on this task, run one of the following:${NC}"
    echo ""
    echo -e "${GREEN}Option 1: Direct prompt (recommended)${NC}"
    echo -e "  cd \"$PROJECT_ROOT\""
    echo -e "  codex \"$(cat "$prompt_file" | head -c 300)...\""
    echo ""
    echo -e "${GREEN}Option 2: Using prompt file${NC}"
    echo -e "  cd \"$PROJECT_ROOT\""
    echo -e "  codex < \"$prompt_file\""
    echo ""
    echo -e "${GREEN}Option 3: Copy prompt manually${NC}"
    echo -e "  Prompt saved to: ${BLUE}$prompt_file${NC}"
    echo -e "  Review it, then run: ${GREEN}codex \"[paste prompt here]\"${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Ask if user wants to launch codex now
    echo -e "${YELLOW}Would you like to launch Codex now? (y/n)${NC}"
    read -t 5 -r response || response="n"
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🚀 Launching Codex agent...${NC}"
        cd "$PROJECT_ROOT"
        
        # Try to launch codex with the prompt
        if command -v codex &> /dev/null; then
            cat "$prompt_file" | codex || {
                echo -e "${YELLOW}⚠️  Codex execution failed. You can manually run it using the commands above.${NC}"
                echo -e "${YELLOW}💡 Prompt file saved at: $prompt_file${NC}"
                echo ""
                echo -e "${BLUE}Press Enter to continue (prompt file will be kept)...${NC}"
                read
                return 0
            }
        else
            echo -e "${RED}❌ Codex CLI not found in PATH${NC}"
            echo -e "${YELLOW}💡 Prompt file saved at: $prompt_file${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}💡 Prompt file saved at: $prompt_file${NC}"
        echo -e "${YELLOW}💡 Run Codex manually using the commands above when ready.${NC}"
        # Don't delete the prompt file if user wants to review it
        return 0
    fi
    
    echo -e "${GREEN}✅ Codex agent completed for task $task_id${NC}"
}

# Function to spawn multiple agents in parallel
spawn_parallel_agents() {
    local task_ids=$1
    local pid_list=()
    
    echo -e "${BLUE}🚀 Spawning parallel Codex agents for tasks: $task_ids${NC}"
    
    IFS=',' read -ra TASK_ARRAY <<< "$task_ids"
    for task_id in "${TASK_ARRAY[@]}"; do
        spawn_codex_agent "$task_id" &
        pid_list+=($!)
    done
    
    echo -e "${YELLOW}⏳ Waiting for all agents to complete...${NC}"
    
    # Wait for all background processes
    local failed=0
    for pid in "${pid_list[@]}"; do
        if ! wait "$pid"; then
            failed=$((failed + 1))
        fi
    done
    
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✅ All Codex agents completed successfully${NC}"
    else
        echo -e "${RED}❌ $failed agent(s) failed${NC}"
        return 1
    fi
}

# Function to show interactive menu
show_menu() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}🎯 Codex Task Manager - Interactive Menu${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Select an option:${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} Work on next available task"
    echo -e "  ${GREEN}2)${NC} List all pending tasks"
    echo -e "  ${GREEN}3)${NC} List all in-progress tasks"
    echo -e "  ${GREEN}4)${NC} Work on specific task by ID"
    echo -e "  ${GREEN}5)${NC} Work on multiple tasks (comma-separated IDs)"
    echo -e "  ${GREEN}6)${NC} View task details"
    echo -e "  ${GREEN}7)${NC} Show task status summary"
    echo -e "  ${GREEN}8)${NC} Exit"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to list tasks by status
list_tasks() {
    local status=$1
    local status_label=$2
    
    echo -e "${BLUE}📋 $status_label Tasks:${NC}"
    echo ""
    
    local tasks_json=$($TASK_MASTER list --status="$status" --json 2>/dev/null)
    
    if [ -z "$tasks_json" ] || [ "$tasks_json" = "{}" ]; then
        echo -e "${YELLOW}   No $status_label tasks found${NC}"
        echo ""
        return
    fi
    
    # Parse and display tasks
    echo "$tasks_json" | jq -r '.data.tasks[]? | "  \(.id). \(.title) (Priority: \(.priority // "medium"))"' 2>/dev/null || {
        echo -e "${YELLOW}   Unable to parse tasks${NC}"
    }
    echo ""
}

# Function to show task status summary
show_status_summary() {
    echo -e "${BLUE}📊 Task Status Summary:${NC}"
    echo ""
    
    local all_tasks=$($TASK_MASTER list --json 2>/dev/null)
    
    if [ -z "$all_tasks" ] || [ "$all_tasks" = "{}" ]; then
        echo -e "${YELLOW}   No tasks found${NC}"
        echo ""
        return
    fi
    
    # Count by status
    local pending=$(echo "$all_tasks" | jq -r '[.data.tasks[]? | select(.status == "pending")] | length' 2>/dev/null || echo "0")
    local in_progress=$(echo "$all_tasks" | jq -r '[.data.tasks[]? | select(.status == "in-progress")] | length' 2>/dev/null || echo "0")
    local done=$(echo "$all_tasks" | jq -r '[.data.tasks[]? | select(.status == "done")] | length' 2>/dev/null || echo "0")
    local total=$(echo "$all_tasks" | jq -r '.data.tasks | length' 2>/dev/null || echo "0")
    
    echo -e "  ${YELLOW}Pending:${NC}      $pending"
    echo -e "  ${BLUE}In Progress:${NC}   $in_progress"
    echo -e "  ${GREEN}Done:${NC}          $done"
    echo -e "  ${NC}Total:${NC}          $total"
    echo ""
}

# Function to handle menu selection
handle_menu_choice() {
    local choice=$1
    
    case "$choice" in
        1)
            echo -e "${BLUE}🔍 Finding next available task...${NC}"
            local next_task=$(get_next_task)
            if [ -z "$next_task" ]; then
                echo -e "${RED}❌ No next task available${NC}"
                echo ""
                read -p "Press Enter to continue..."
                return 1
            fi
            echo -e "${GREEN}✅ Next task: $next_task${NC}"
            spawn_codex_agent "$next_task"
            ;;
        2)
            list_tasks "pending" "Pending"
            read -p "Press Enter to continue..."
            ;;
        3)
            list_tasks "in-progress" "In-Progress"
            read -p "Press Enter to continue..."
            ;;
        4)
            echo ""
            list_tasks "pending" "Pending"
            list_tasks "in-progress" "In-Progress"
            echo -e "${YELLOW}Enter task ID to work on:${NC}"
            read -r task_id
            if [ -n "$task_id" ]; then
                spawn_codex_agent "$task_id"
            else
                echo -e "${RED}❌ No task ID provided${NC}"
                read -p "Press Enter to continue..."
            fi
            ;;
        5)
            echo ""
            list_tasks "pending" "Pending"
            echo -e "${YELLOW}Enter comma-separated task IDs (e.g., 1,2,3):${NC}"
            read -r task_ids
            if [ -n "$task_ids" ]; then
                spawn_parallel_agents "$task_ids"
            else
                echo -e "${RED}❌ No task IDs provided${NC}"
                read -p "Press Enter to continue..."
            fi
            ;;
        6)
            echo ""
            echo -e "${YELLOW}Enter task ID to view:${NC}"
            read -r task_id
            if [ -n "$task_id" ]; then
                echo ""
                $TASK_MASTER show "$task_id" 2>/dev/null || {
                    echo -e "${RED}❌ Task $task_id not found${NC}"
                }
            else
                echo -e "${RED}❌ No task ID provided${NC}"
            fi
            echo ""
            read -p "Press Enter to continue..."
            ;;
        7)
            echo ""
            show_status_summary
            read -p "Press Enter to continue..."
            ;;
        8)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid option. Please choose 1-8.${NC}"
            read -p "Press Enter to continue..."
            ;;
    esac
}

# Main execution
main() {
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ Error: jq is required but not installed${NC}"
        echo "Install with: brew install jq"
        exit 1
    fi
    
    # Check if codex is installed (only warn, don't exit - user might want to see menu)
    if ! command -v codex &> /dev/null; then
        echo -e "${YELLOW}⚠️  Warning: codex CLI not found in PATH${NC}"
        echo -e "${YELLOW}   You'll need to install it to use Codex agents${NC}"
        echo ""
    fi
    
    # If arguments provided, use quick command mode
    if [ $# -gt 0 ]; then
        local arg=$1
        
        case "$arg" in
            next)
                echo -e "${BLUE}🔍 Finding next available task...${NC}"
                local next_task=$(get_next_task)
                if [ -z "$next_task" ]; then
                    echo -e "${RED}❌ No next task available${NC}"
                    exit 1
                fi
                echo -e "${GREEN}✅ Next task: $next_task${NC}"
                spawn_codex_agent "$next_task"
                ;;
            *)
                # Check if it's a comma-separated list
                if [[ "$arg" =~ , ]]; then
                    spawn_parallel_agents "$arg"
                else
                    # Single task ID
                    spawn_codex_agent "$arg"
                fi
                ;;
        esac
    else
        # No arguments - show interactive menu
        while true; do
            show_menu
            echo -e "${YELLOW}Enter your choice (1-8):${NC} "
            read -r choice
            handle_menu_choice "$choice"
        done
    fi
}

# Run main function
main "$@"

