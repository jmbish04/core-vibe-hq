#!/bin/bash

# Core Vibe HQ Smoke Test Failure Issue Creation Script
# Creates GitHub issues for smoke test failures

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

# Create smoke test failure issue
create_smoke_failure_issue() {
    local test_name="$1"
    local test_category="$2"
    local error_message="$3"
    local stack_trace="${4:-}"
    local test_output="${5:-}"

    local token=$(get_github_token)

    # Prepare issue data
    local issue_data=$(cat <<ISSUE_EOF
{
  "title": "[SMOKE FAIL] ${test_name}",
  "body": "## Smoke Test Failure\n\n### Test Details\n- **Test Name**: ${test_name}\n- **Test Category**: ${test_category}\n\n### Error Details\n**Error Message:**\n\`\`\`\n${error_message}\n\`\`\`\n\n**Stack Trace:**\n\`\`\`\n${stack_trace}\n\`\`\`\n\n**Test Output:**\n\`\`\`\n${test_output}\n\`\`\`\n\n### Environment\n- **Component**: ${test_category}\n- **Test Environment**: staging\n\n### Impact Assessment\n- [x] Blocks deployment\n- [x] Affects core functionality\n\n*Created automatically by smoke test system*",
  "labels": ["smoke-test", "bug", "${test_category}"]
}
ISSUE_EOF
)

    echo -e "${BLUE}🚨 Creating smoke test failure issue: ${test_name}${NC}"

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
        echo -e "${GREEN}✅ Smoke test failure issue created: #${issue_number}${NC}"
        echo -e "${BLUE}🔗 ${issue_url}${NC}"
        echo "$issue_url"
    else
        echo -e "${RED}❌ Failed to create issue${NC}" >&2
        echo "$response" >&2
        exit 1
    fi
}

# Parse smoke test output and create issues
parse_smoke_output() {
    local output_file="$1"
    
    if [ ! -f "$output_file" ]; then
        echo -e "${RED}❌ Smoke test output file not found: ${output_file}${NC}" >&2
        exit 1
    fi

    echo -e "${BLUE}🔍 Parsing smoke test output: ${output_file}${NC}"

    # Parse failures from JSON output
    # This is a simplified parser - adjust based on actual test output format
    local failures=$(cat "$output_file" | jq -r '.testResults[]? | select(.status == "failed") | .assertionResults[]? | select(.status == "failed") | {test: .ancestorTitles + [.title], error: .failureMessages[0]}' 2>/dev/null || echo "")

    if [ -z "$failures" ]; then
        echo -e "${YELLOW}⚠️  No failures found in output${NC}"
        return
    fi

    echo "$failures" | jq -c '.' | while read -r failure; do
        local test_name=$(echo "$failure" | jq -r '.test | join(" > ")')
        local error_message=$(echo "$failure" | jq -r '.error')
        
        # Extract category from test name
        local category="unknown"
        if [[ "$test_name" == *"infrastructure"* ]]; then category="infrastructure"
        elif [[ "$test_name" == *"health"* ]]; then category="health-system"
        elif [[ "$test_name" == *"api"* ]]; then category="api"
        elif [[ "$test_name" == *"worker"* ]]; then category="workers"
        elif [[ "$test_name" == *"ui"* ]]; then category="ui"
        elif [[ "$test_name" == *"factory"* ]]; then category="factories"
        elif [[ "$test_name" == *"ai-provider"* ]]; then category="ai-providers"
        elif [[ "$test_name" == *"patch"* ]]; then category="patches"
        elif [[ "$test_name" == *"automation"* ]]; then category="automation"
        elif [[ "$test_name" == *"error"* ]]; then category="errors"
        fi

        create_smoke_failure_issue "$test_name" "$category" "$error_message"
    done
}

# Interactive smoke failure creation
interactive_create() {
    echo -e "${BLUE}🚨 Smoke Test Failure Issue Creation${NC}"
    echo "==================================="

    read -p "Test name: " test_name
    read -p "Test category (infrastructure/health/api/workers/ui/factories/ai-providers/patches/automation/errors): " test_category
    echo "Error message (press Ctrl+D when done):"
    error_message=$(cat)

    create_smoke_failure_issue "$test_name" "$test_category" "$error_message"
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
            parse_smoke_output "$2"
            ;;
        --interactive|-i)
            interactive_create
            ;;
        --help|-h)
            show_help
            ;;
        *)
            if [ $# -lt 3 ]; then
                echo -e "${RED}❌ Insufficient arguments${NC}" >&2
                show_help
                exit 1
            fi
            create_smoke_failure_issue "$1" "$2" "$3" "$4" "$5"
            ;;
    esac
}

# Show help
show_help() {
    cat << HELP_EOF
Core Vibe HQ Smoke Test Failure Issue Creation Script

USAGE:
    $0 [OPTIONS] <test_name> <category> <error_message> [stack_trace] [test_output]

    $0 --parse <output_file>     Parse test output file and create issues for all failures
    $0 --interactive             Interactive mode

ARGUMENTS:
    test_name       Name of the failing test
    category        Test category (infrastructure/health/api/workers/ui/factories/ai-providers/patches/automation/errors)
    error_message   Error message from test failure
    stack_trace     Optional stack trace
    test_output     Optional full test output

OPTIONS:
    -p, --parse         Parse test output file
    -i, --interactive   Interactive mode
    -h, --help          Show this help

ENVIRONMENT:
    GITHUB_TOKEN        GitHub personal access token
    GITHUB_REPO         Repository name [default: core-vibe-hq]

EXAMPLES:
    $0 "health.test.ts" health-system "Connection timeout" "stack trace here" "full output"

    $0 --parse results/smoke-test-results.json

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
