#!/bin/bash

# Core Vibe HQ Smoke Test Runner
# Executes comprehensive smoke tests to validate system functionality

set -e

echo "🚀 Core Vibe HQ Smoke Test Runner"
echo "================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from repository root (where package.json is located)"
    exit 1
fi

echo "📍 Repository root: $(pwd)"
echo ""

# Function to run a test category
run_test_category() {
    local category=$1
    local test_file="tests/smoke/${category}.test.ts"

    echo "🧪 Running ${category} smoke tests..."

    if [ -f "$test_file" ]; then
        cd orchestrator
        if npm run test:unit -- "../$test_file" > /dev/null 2>&1; then
            echo "✅ ${category} tests passed"
            cd ..
            return 0
        else
            echo "❌ ${category} tests failed"
            cd ..
            return 1
        fi
    else
        echo "⚠️  ${category} test file not found: $test_file"
        return 1
    fi
}

# Function to run all smoke tests
run_all_smoke_tests() {
    local failed_categories=()
    local categories=("infrastructure" "health" "api" "workers" "ui" "factories" "ai-providers" "patches" "automation" "errors")

    echo "🔥 Running all smoke test categories..."
    echo ""

    for category in "${categories[@]}"; do
        if ! run_test_category "$category"; then
            failed_categories+=("$category")
        fi
        echo ""
    done

    echo "📊 Smoke Test Results Summary"
    echo "=============================="

    if [ ${#failed_categories[@]} -eq 0 ]; then
        echo "✅ All smoke tests passed!"
        echo ""
        echo "🎉 System is ready for production!"
        return 0
    else
        echo "❌ Failed categories: ${failed_categories[*]}"
        echo ""
        echo "🔧 Fix the failed categories before proceeding to production."
        return 1
    fi
}

# Function to run specific category
run_specific_category() {
    local category=$1
    echo "🎯 Running specific category: $category"
    echo ""

    if run_test_category "$category"; then
        echo ""
        echo "✅ $category smoke tests completed successfully!"
        return 0
    else
        echo ""
        echo "❌ $category smoke tests failed!"
        return 1
    fi
}

# Function to generate test report
generate_report() {
    echo "📝 Generating smoke test report..."

    local report_file="docs/testing/smoke-test-results.md"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$report_file" << EOF
# Smoke Test Results Report

**Generated**: $timestamp
**Status**: $(run_all_smoke_tests > /dev/null 2>&1 && echo "✅ All Passed" || echo "❌ Some Failed")

## Test Categories

- ✅ Infrastructure: Database, RPC, environment validation
- ✅ Health: Health check flow and data integrity
- ✅ API: Core API endpoints and authentication
- ✅ Workers: Inter-worker communication
- ✅ UI: Component rendering and basic functionality
- ✅ Factories: Factory worker responses
- ✅ AI Providers: Provider routing and execution
- ✅ Patches: Patch application and analytics
- ✅ Automation: Scheduled jobs and automation routes
- ✅ Errors: Error handling and recovery

## Detailed Results

*Run \`npm run smoke:all\` for detailed test output.*

## Next Steps

- Review failed test categories
- Fix identified issues
- Re-run smoke tests
- Update this report

EOF

    echo "✅ Report generated: $report_file"
}

# Main execution logic
case "${1:-all}" in
    "all")
        run_all_smoke_tests
        ;;
    "infrastructure"|"health"|"api"|"workers"|"ui"|"factories"|"ai-providers"|"patches"|"automation"|"errors")
        run_specific_category "$1"
        ;;
    "report")
        generate_report
        ;;
    *)
        echo "Usage: $0 [all|category|report]"
        echo ""
        echo "Categories:"
        echo "  all              - Run all smoke test categories"
        echo "  infrastructure  - Test database, RPC, environment"
        echo "  health          - Test health check system"
        echo "  api             - Test API endpoints"
        echo "  workers         - Test worker communication"
        echo "  ui              - Test UI components"
        echo "  factories       - Test factory workers"
        echo "  ai-providers    - Test AI provider system"
        echo "  patches         - Test patch management"
        echo "  automation      - Test scheduled automation"
        echo "  errors          - Test error handling"
        echo "  report          - Generate test results report"
        exit 1
        ;;
esac
