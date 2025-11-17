#!/bin/bash

# Improvement Report Generator
# Compiles metrics from multiple sources and generates comprehensive improvement reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/.taskmaster/reports"
DOCS_DIR="$PROJECT_ROOT/docs/development"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create reports directory if it doesn't exist
mkdir -p "$REPORTS_DIR"

echo "📊 Generating comprehensive improvement report..."

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required for this script. Please install jq."
    exit 1
fi

# Initialize report structure
REPORT='{
  "report_timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "report_period": "monthly",
  "sections": {}
}'

# Section 1: Bug Pattern Analysis
echo "🔍 Analyzing recent bug patterns..."
BUG_PATTERN_FILE=$(find "$REPORTS_DIR" -name "bug-pattern-analysis_*.json" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

if [ -n "$BUG_PATTERN_FILE" ] && [ -f "$BUG_PATTERN_FILE" ]; then
    echo "   Found bug pattern analysis: $BUG_PATTERN_FILE"
    BUG_DATA=$(cat "$BUG_PATTERN_FILE")
    REPORT=$(echo "$REPORT" | jq --argjson data "$BUG_DATA" '.sections.bug_patterns = $data')
else
    echo "   No recent bug pattern analysis found. Run analyze-bug-patterns.sh first."
    REPORT=$(echo "$REPORT" | jq '.sections.bug_patterns = {
      "status": "missing",
      "message": "No recent bug pattern analysis available. Run analyze-bug-patterns.sh to generate."
    }')
fi

# Section 2: Test Metrics
echo "🧪 Gathering test metrics..."
if [ -d "$PROJECT_ROOT/coverage" ]; then
    # Try to extract coverage data from lcov or other formats
    LCOV_FILE=$(find "$PROJECT_ROOT/coverage" -name "lcov.info" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

    if [ -n "$LCOV_FILE" ] && [ -f "$LCOV_FILE" ]; then
        LINES_COVERED=$(grep -c "LF:" "$LCOV_FILE" 2>/dev/null || echo "0")
        LINES_HIT=$(grep -c "LH:" "$LCOV_FILE" 2>/dev/null || echo "0")

        COVERAGE_PERCENT="0"
        if [ "$LINES_COVERED" -gt 0 ]; then
            COVERAGE_PERCENT=$((LINES_HIT * 100 / LINES_COVERED))
        fi

        REPORT=$(echo "$REPORT" | jq --arg coverage "$COVERAGE_PERCENT" '.sections.test_metrics = {
          "test_coverage_percent": ($coverage | tonumber),
          "status": "available",
          "source": "lcov"
        }')
    else
        REPORT=$(echo "$REPORT" | jq '.sections.test_metrics = {
          "status": "partial",
          "message": "Coverage directory exists but no lcov file found"
        }')
    fi
else
    REPORT=$(echo "$REPORT" | jq '.sections.test_metrics = {
      "status": "missing",
      "message": "No coverage directory found. Run tests with coverage enabled."
    }')
fi

# Section 3: Code Quality Metrics
echo "🔧 Analyzing code quality..."
TOTAL_TS_FILES=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" | wc -l)
TOTAL_JS_FILES=$(find "$PROJECT_ROOT" -name "*.js" -o -name "*.jsx" | wc -l)
TOTAL_FILES=$((TOTAL_TS_FILES + TOTAL_JS_FILES))

# Count lines of code (rough estimate)
LINES_OF_CODE=$(find "$PROJECT_ROOT/src" "$PROJECT_ROOT/orchestrator/src" "$PROJECT_ROOT/apps" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")

REPORT=$(echo "$REPORT" | jq --arg ts_files "$TOTAL_TS_FILES" --arg js_files "$TOTAL_JS_FILES" --arg total_files "$TOTAL_FILES" --arg loc "$LINES_OF_CODE" '
  .sections.code_quality = {
    "typescript_files": ($ts_files | tonumber),
    "javascript_files": ($js_files | tonumber),
    "total_source_files": ($total_files | tonumber),
    "estimated_lines_of_code": ($loc | tonumber),
    "type_safety_ratio": ($ts_files | tonumber) / ($total_files | tonumber)
  }
')

# Section 4: Performance Metrics
echo "⚡ Gathering performance metrics..."
# Check for any performance logs or metrics
PERF_LOGS=$(find "$PROJECT_ROOT" -name "*perf*" -o -name "*performance*" -type f 2>/dev/null | wc -l)
METRICS_FILES=$(find "$PROJECT_ROOT" -name "*metrics*" -type f 2>/dev/null | wc -l)

REPORT=$(echo "$REPORT" | jq --arg perf_logs "$PERF_LOGS" --arg metrics "$METRICS_FILES" '
  .sections.performance = {
    "performance_logs_found": ($perf_logs | tonumber),
    "metrics_files_found": ($metrics | tonumber),
    "status": "basic_analysis",
    "recommendations": [
      "Implement structured performance monitoring",
      "Add API response time tracking",
      "Set up database query performance monitoring"
    ]
  }
')

# Section 5: Current Improvements Status
echo "📈 Analyzing current improvement status..."
if [ -f "$DOCS_DIR/improvement-backlog.md" ]; then
    # Extract improvement counts from the backlog
    P0_COUNT=$(grep -c "^### CI-[0-9]*:" "$DOCS_DIR/improvement-backlog.md" | head -10 | wc -l)
    COMPLETED_COUNT=$(grep -c "^### ✅ CI-COMPLETED-" "$DOCS_DIR/improvement-backlog.md")

    REPORT=$(echo "$REPORT" | jq --arg p0 "$P0_COUNT" --arg completed "$COMPLETED_COUNT" '
      .sections.improvement_status = {
        "backlog_file_exists": true,
        "critical_improvements": ($p0 | tonumber),
        "completed_improvements": ($completed | tonumber),
        "backlog_health": "good"
      }
    ')
else
    REPORT=$(echo "$REPORT" | jq '.sections.improvement_status = {
      "backlog_file_exists": false,
      "status": "missing",
      "recommendations": [
        "Create improvement backlog document",
        "Track improvement initiatives systematically"
      ]
    }')
fi

# Section 6: Recommendations
echo "💡 Generating recommendations..."
RECOMMENDATIONS=$(echo "$REPORT" | jq -r '
  [
    "Focus on high-severity patterns identified in bug analysis",
    "Improve test coverage to target 85%+",
    "Implement comprehensive type safety measures",
    "Set up automated performance monitoring",
    "Regular code quality reviews and improvements"
  ]
')

REPORT=$(echo "$REPORT" | jq --argjson recs "$RECOMMENDATIONS" '.recommendations = $recs')

# Section 7: Action Items
echo "✅ Generating action items..."
ACTION_ITEMS=$(echo '[
  {
    "id": "ACT-001",
    "title": "Address high-severity bug patterns",
    "priority": "HIGH",
    "effort": "2-4 weeks",
    "description": "Fix critical and high-severity issues identified in bug pattern analysis"
  },
  {
    "id": "ACT-002",
    "title": "Improve test coverage",
    "priority": "MEDIUM",
    "effort": "3-6 weeks",
    "description": "Increase test coverage to 85%+ across all critical paths"
  },
  {
    "id": "ACT-003",
    "title": "Enhance type safety",
    "priority": "HIGH",
    "effort": "2-3 weeks",
    "description": "Eliminate type assertions and improve type definitions"
  },
  {
    "id": "ACT-004",
    "title": "Implement performance monitoring",
    "priority": "MEDIUM",
    "effort": "2-4 weeks",
    "description": "Set up comprehensive performance tracking and alerting"
  }
]')

REPORT=$(echo "$REPORT" | jq --argjson actions "$ACTION_ITEMS" '.action_items = $actions')

# Save comprehensive report
REPORT_FILE="$REPORTS_DIR/improvement-report_$TIMESTAMP.json"
echo "$REPORT" | jq '.' > "$REPORT_FILE"

# Generate summary markdown report
SUMMARY_FILE="$REPORTS_DIR/improvement-summary_$TIMESTAMP.md"
cat > "$SUMMARY_FILE" << EOF
# Continuous Improvement Report
**Generated:** $(date)
**Period:** Monthly Analysis

## Executive Summary

This report provides a comprehensive analysis of code quality, bug patterns, and improvement opportunities across the codebase.

## Key Metrics

### Code Quality
- **TypeScript Files:** $(echo "$REPORT" | jq -r '.sections.code_quality.typescript_files')
- **JavaScript Files:** $(echo "$REPORT" | jq -r '.sections.code_quality.javascript_files')
- **Total Source Files:** $(echo "$REPORT" | jq -r '.sections.code_quality.total_source_files')
- **Estimated Lines of Code:** $(echo "$REPORT" | jq -r '.sections.code_quality.estimated_lines_of_code')

### Bug Patterns
$(if echo "$REPORT" | jq -e '.sections.bug_patterns.summary' > /dev/null; then
  echo "- **Patterns Analyzed:** $(echo "$REPORT" | jq -r '.sections.bug_patterns.summary.total_patterns_analyzed')"
  echo "- **High Severity:** $(echo "$REPORT" | jq -r '.sections.bug_patterns.summary.high_severity_patterns')"
  echo "- **Total Occurrences:** $(echo "$REPORT" | jq -r '.sections.bug_patterns.summary.total_occurrences')"
else
  echo "- **Status:** No recent bug pattern analysis available"
fi)

### Test Coverage
$(if echo "$REPORT" | jq -e '.sections.test_metrics.test_coverage_percent' > /dev/null; then
  echo "- **Coverage:** $(echo "$REPORT" | jq -r '.sections.test_metrics.test_coverage_percent')%"
else
  echo "- **Status:** Test coverage data not available"
fi)

## Critical Action Items

$(echo "$REPORT" | jq -r '.action_items[] | "- **\(.title)** (\(.priority)) - \(.effort)\n  \(.description)"')

## Recommendations

$(echo "$REPORT" | jq -r '.recommendations[] | "- \(.)\n"')

## Next Steps

1. Review high-severity bug patterns and create fix tasks
2. Implement automated detection for critical issues
3. Schedule improvements based on priority and effort
4. Monitor progress and update metrics monthly

## Files Generated

- **Detailed Report:** $REPORT_FILE
- **Summary:** $SUMMARY_FILE

---
*This report was automatically generated by the Continuous Improvement System.*
EOF

echo "✅ Comprehensive improvement report generated!"
echo "📊 Files created:"
echo "   📄 Detailed JSON: $REPORT_FILE"
echo "   📋 Summary Markdown: $SUMMARY_FILE"
echo ""
echo "🎯 Key Findings:"
echo "   📈 Code Quality: $(echo "$REPORT" | jq -r '.sections.code_quality.total_source_files') source files analyzed"
echo "   🐛 Bug Patterns: $(echo "$REPORT" | jq -r '.sections.bug_patterns.summary.total_patterns_analyzed // "N/A"') patterns identified"
echo "   ✅ Action Items: $(echo "$REPORT" | jq -r '.action_items | length') prioritized tasks"
echo ""
echo "🔗 Related Documentation:"
echo "   📚 Improvement Backlog: docs/development/improvement-backlog.md"
echo "   🛠️  Continuous Improvement Guide: docs/development/continuous-improvement.md"

exit 0
