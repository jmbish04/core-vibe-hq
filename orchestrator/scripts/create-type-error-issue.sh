#!/bin/bash

# Core Vibe HQ TypeScript Error Issue Creation Script
# Creates GitHub issues for TypeScript compilation errors

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="${GITHUB_REPO:-core-vibe-hq}"
GITHUB_API_URL="https://api.github.com/repos/${GITHUB_REPO}/issues"

# Check dependencies
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq is required but not installed${NC}"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is required but not installed${NC}"
        exit 1
    fi
}

# Get GitHub token
get_github_token() {
    if [ -n "$GITHUB_TOKEN" ]; then
        echo "$GITHUB_TOKEN"
    elif [ -f ".github-token" ]; then
        cat ".github-token"
    else
        echo -e "${RED}❌ GitHub token not found. Set GITHUB_TOKEN environment variable or create .github-token file${NC}" >&2
        exit 1
    fi
}

# Create type error issue
create_type_error_issue() {
    local file="$1"
    local line="$2"
    local error_code="$3"
    local error_message="$4"
    local code_context="$5"

    local token=$(get_github_token)

    # Extract component from file path
    local component="unknown"
    if [[ "$file" == *"orchestrator"* ]]; then component="orchestrator"
    elif [[ "$file" == *"agent-factory"* ]]; then component="agent-factory"
    elif [[ "$file" == *"data-factory"* ]]; then component="data-factory"
    elif [[ "$file" == *"services-factory"* ]]; then component="services-factory"
    elif [[ "$file" == *"ui-factory"* ]]; then component="ui-factory"
    elif [[ "$file" == *"ops-specialists"* ]]; then component="ops-specialists"
    elif [[ "$file" == *"@shared"* ]]; then component="shared"
    fi

    # Prepare issue data
    local issue_data=$(cat <<ISSUE_EOF
{
  "title": "[TYPE ERROR] ${file}:${line} - ${error_code}",
  "body": "## TypeScript Error Report\n\n### Error Details\n**File:** \`${file}\`\n**Line:** ${line}\n**Error Code:** ${error_code}\n\n**Error Message:**\n\`\`\`\n${error_message}\n\`\`\`\n\n**Code Context:**\n\`\`\`typescript\n${code_context}\n\`\`\`\n\n### Environment\n- **Component**: ${component}\n\n### Impact Assessment\n- [x] Blocks compilation\n- [x] Affects type safety\n\n*Created automatically by type checking system*",
  "labels": ["type-error", "bug", "${component}"]
}
ISSUE_EOF
)

    echo -e "${BLUE}🔧 Creating type error issue: ${file}:${line}${NC}"

    # Create the issue
    local response=$(curl -s -X POST \
        -H "Authorization: token ${token}" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "$issue_data" \
        "$GITHUB_API_URL")

    # Check response
    if echo "$response" | jq -e '.number' > /dev/null 2>&1; then
        local issue_number=$(echo "$response" | jq -r '.number')
        local issue_url=$(echo "$response" | jq -r '.html_url')
        echo -e "${GREEN}✅ Type error issue created: #${issue_number}${NC}"
        echo -e "${BLUE}🔗 ${issue_url}${NC}"
        echo "$issue_url"
    else
        echo -e "${RED}❌ Failed to create issue${NC}" >&2
        echo "$response" >&2
        exit 1
    fi
}

# Parse TypeScript output and create issues
parse_tsc_output() {
    local output_file="$1"
    
    if [ ! -f "$output_file" ]; then
        echo -e "${RED}❌ TypeScript output file not found: ${output_file}${NC}" >&2
        exit 1
    fi

    echo -e "${BLUE}🔍 Parsing TypeScript output: ${output_file}${NC}"

    # Parse errors from tsc output
    # This is a simplified parser - adjust based on actual tsc output format
    while IFS= read -r line; do
        # Match pattern: file(line,column): error TS####: message
        if [[ "$line" =~ ^([^:]+)\(([0-9]+),([0-9]+)\):\ error\ (TS[0-9]+):\ (.+)$ ]]; then
            local file="${BASH_REMATCH[1]}"
            local line_num="${BASH_REMATCH[2]}"
            local error_code="${BASH_REMATCH[3]}"
            local error_message="${BASH_REMATCH[4]}"
            
            # Read a few lines of context around the error
            local context=""
            if [ -f "$file" ]; then
                local start_line=$((line_num - 2))
                local end_line=$((line_num + 2))
                context=$(sed -n "${start_line},${end_line}p" "$file" 2>/dev/null || echo "Could not read file")
            fi
            
            create_type_error_issue "$file" "$line_num" "$error_code" "$error_message" "$context"
        fi
    done < "$output_file"
}

# Interactive type error creation
interactive_create() {
    echo -e "${BLUE}🔧 TypeScript Error Issue Creation${NC}"
    echo "=================================="

    read -p "File path: " file
    read -p "Line number: " line
    read -p "Error code (e.g., TS2304): " error_code
    echo "Error message (press Ctrl+D when done):"
    error_message=$(cat)
    echo "Code context (optional, press Ctrl+D when done):"
    code_context=$(cat)

    create_type_error_issue "$file" "$line" "$error_code" "$error_message" "$code_context"
}

# Parse command line arguments
parse_args() {
    case "${1:-}" in
        --parse|-p)
            if [ $# -lt 2 ]; then
                echo -e "${RED}❌ Missing output file argument${NC}" >&2
                show_help
                exit 1
            fi
            parse_tsc_output "$2"
            ;;
        --interactive|-i)
            interactive_create
            ;;
        --help|-h)
            show_help
            ;;
        *)
            if [ $# -lt 4 ]; then
                echo -e "${RED}❌ Insufficient arguments${NC}" >&2
                show_help
                exit 1
            fi
            create_type_error_issue "$1" "$2" "$3" "$4" "$5"
            ;;
    esac
}

# Show help
show_help() {
    cat << HELP_EOF
Core Vibe HQ TypeScript Error Issue Creation Script

USAGE:
    $0 [OPTIONS] <file> <line> <error_code> <error_message> [code_context]

    $0 --parse <tsc_output_file>    Parse tsc output and create issues for all errors
    $0 --interactive                Interactive mode

ARGUMENTS:
    file            File path with the error
    line            Line number of the error
    error_code      TypeScript error code (e.g., TS2304)
    error_message   Error message from TypeScript
    code_context    Optional code context around the error

OPTIONS:
    -p, --parse         Parse TypeScript compiler output file
    -i, --interactive   Interactive mode
    -h, --help          Show this help

ENVIRONMENT:
    GITHUB_TOKEN        GitHub personal access token
    GITHUB_REPO         Repository name [default: core-vibe-hq]

EXAMPLES:
    $0 "worker/index.ts" 95 TS2304 "Cannot find name 'DISPATCHER'" "env.DISPATCHER"

    $0 --parse tsc-errors.log

    $0 --interactive
HELP_EOF
}

# Main execution
main() {
    check_dependencies

    if [ $# -eq 0 ]; then
        interactive_create
    else
        parse_args "$@"
    fi
}

main "$@"
