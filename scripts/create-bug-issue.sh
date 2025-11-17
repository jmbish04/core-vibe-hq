#!/bin/bash

# Core Vibe HQ Bug Issue Creation Script
# Creates GitHub issues for bugs discovered during development

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

# Create bug issue
create_bug_issue() {
    local title="$1"
    local description="$2"
    local component="$3"
    local priority="${4:-medium}"
    local labels="${5:-bug}"

    local token=$(get_github_token)

    # Prepare issue data
    local issue_data=$(cat <<EOF
{
  "title": "[BUG] ${title}",
  "body": "## Bug Description\n${description}\n\n## Environment\n- **Component**: ${component}\n- **Priority**: ${priority}\n\n## Additional Context\n*Created automatically by bug tracking system*",
  "labels": ["${labels}"]
}
EOF
)

    echo -e "${BLUE}📝 Creating bug issue: ${title}${NC}"

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
        echo -e "${GREEN}✅ Bug issue created: #${issue_number}${NC}"
        echo -e "${BLUE}🔗 ${issue_url}${NC}"
        echo "$issue_url"
    else
        echo -e "${RED}❌ Failed to create issue${NC}" >&2
        echo "$response" >&2
        exit 1
    fi
}

# Interactive bug creation
interactive_create() {
    echo -e "${BLUE}🐛 Bug Issue Creation${NC}"
    echo "======================"

    read -p "Bug title: " title
    read -p "Component (e.g., health-system, ui-factory): " component
    read -p "Priority (high/medium/low): " priority
    priority=${priority:-medium}

    echo "Description (press Ctrl+D when done):"
    description=$(cat)

    create_bug_issue "$title" "$description" "$component" "$priority"
}

# Parse command line arguments
parse_args() {
    case "${1:-}" in
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
            create_bug_issue "$1" "$2" "$3" "$4" "$5"
            ;;
    esac
}

# Show help
show_help() {
    cat << EOF
Core Vibe HQ Bug Issue Creation Script

USAGE:
    $0 [OPTIONS] <title> <description> <component> [priority] [labels]

    $0 --interactive    Interactive mode

ARGUMENTS:
    title           Bug title
    description     Bug description
    component       Affected component (e.g., health-system, ui-factory)
    priority        Priority level (high/medium/low) [default: medium]
    labels          Comma-separated labels [default: bug]

OPTIONS:
    -i, --interactive    Interactive mode
    -h, --help           Show this help

ENVIRONMENT:
    GITHUB_TOKEN        GitHub personal access token
    GITHUB_REPO         Repository name [default: core-vibe-hq]

EXAMPLES:
    $0 "Health check timeout" "Health checks timeout after 30s" health-system high "bug,health-system"

    $0 --interactive
EOF
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
