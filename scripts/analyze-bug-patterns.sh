#!/bin/bash

# Bug Pattern Analysis Script
# Analyzes codebase for common bug patterns and generates improvement recommendations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/.taskmaster/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/bug-pattern-analysis_$TIMESTAMP.json"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "🔍 Analyzing bug patterns in codebase..."
echo "Output will be saved to: $REPORT_FILE"

# Initialize results object
RESULTS='{
  "analysis_timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "analysis_period": "last_30_days",
  "patterns": {}
}'

# Pattern 1: Type Safety Issues
echo "📊 Checking type safety patterns..."
TYPE_ERRORS=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" | xargs grep -l "as any\|@ts-ignore\|@ts-expect-error" | wc -l)
TYPE_LOCATIONS=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" -exec grep -l "as any\|@ts-ignore\|@ts-expect-error" {} \; | head -10)

RESULTS=$(echo "$RESULTS" | jq --arg count "$TYPE_ERRORS" --arg locations "$TYPE_LOCATIONS" '
  .patterns.type_safety = {
    "pattern": "Type Safety Violations",
    "severity": "HIGH",
    "occurrences": ($count | tonumber),
    "description": "Usage of 'as any', '@ts-ignore', or '@ts-expect-error'",
    "impact": "Type safety violations can lead to runtime errors and reduced developer productivity",
    "recommendations": [
      "Implement strict type checking in tsconfig.json",
      "Add type guard utilities for common patterns",
      "Create comprehensive type definitions for external libraries"
    ],
    "affected_files": ($locations | split("\n") | map(select(. != ""))),
    "priority": "P1"
  }
')

# Pattern 2: Error Handling Issues
echo "📊 Checking error handling patterns..."
ERROR_PATTERNS=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" | xargs grep -l "catch.*{" | wc -l)
UNHANDLED_PROMISES=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" | xargs grep -l "\.then(" | xargs grep -v "catch\|await" | wc -l)

RESULTS=$(echo "$RESULTS" | jq --arg patterns "$ERROR_PATTERNS" --arg unhandled "$UNHANDLED_PROMISES" '
  .patterns.error_handling = {
    "pattern": "Inconsistent Error Handling",
    "severity": "MEDIUM",
    "occurrences": ($patterns | tonumber),
    "description": "Inconsistent error handling patterns and potential unhandled promises",
    "impact": "Can lead to unhandled exceptions and poor user experience",
    "recommendations": [
      "Create standardized error types and classes",
      "Implement error boundary components",
      "Add structured error logging utilities"
    ],
    "unhandled_promises": ($unhandled | tonumber),
    "priority": "P1"
  }
')

# Pattern 3: Test Coverage Issues
echo "📊 Checking test coverage..."
if [ -d "$PROJECT_ROOT/coverage" ]; then
    # Extract coverage percentage from coverage reports if available
    COVERAGE_FILES=$(find "$PROJECT_ROOT/coverage" -name "*.json" | wc -l)
    TEST_FILES=$(find "$PROJECT_ROOT" -name "*.test.ts" -o -name "*.test.js" | wc -l)
    SOURCE_FILES=$(find "$PROJECT_ROOT/src" "$PROJECT_ROOT/orchestrator/src" "$PROJECT_ROOT/apps" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | wc -l)

    RESULTS=$(echo "$RESULTS" | jq --arg coverage_files "$COVERAGE_FILES" --arg test_files "$TEST_FILES" --arg source_files "$SOURCE_FILES" '
      .patterns.test_coverage = {
        "pattern": "Test Coverage Gaps",
        "severity": "MEDIUM",
        "description": "Insufficient test coverage for critical functionality",
        "coverage_reports": ($coverage_files | tonumber),
        "test_files": ($test_files | tonumber),
        "source_files": ($source_files | tonumber),
        "test_to_source_ratio": (($test_files | tonumber) / ($source_files | tonumber)),
        "recommendations": [
          "Implement comprehensive unit test coverage",
          "Add integration tests for critical paths",
          "Set up automated test coverage reporting"
        ],
        "priority": "P2"
      }
    ')
fi

# Pattern 4: Code Quality Issues
echo "📊 Checking code quality patterns..."
LINT_ERRORS=$(find "$PROJECT_ROOT" -name "*.log" -exec grep -l "error\|Error" {} \; | wc -l 2>/dev/null || echo "0")
DEAD_CODE=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" | xargs grep -l "// TODO\|// FIXME\|// XXX" | wc -l)

RESULTS=$(echo "$RESULTS" | jq --arg lint "$LINT_ERRORS" --arg dead "$DEAD_CODE" '
  .patterns.code_quality = {
    "pattern": "Code Quality Violations",
    "severity": "LOW",
    "lint_errors": ($lint | tonumber),
    "dead_code_markers": ($dead | tonumber),
    "description": "Linting errors and technical debt markers",
    "recommendations": [
      "Fix all linting errors",
      "Address TODO/FIXME comments",
      "Implement pre-commit quality checks"
    ],
    "priority": "P2"
  }
')

# Pattern 5: Performance Issues
echo "📊 Checking performance patterns..."
LARGE_FILES=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs wc -l | awk '$1 > 500 {print $2}' | wc -l)
SYNC_OPERATIONS=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" | xargs grep -l "fs\.\|readFileSync\|writeFileSync" | wc -l)

RESULTS=$(echo "$RESULTS" | jq --arg large "$LARGE_FILES" --arg sync "$SYNC_OPERATIONS" '
  .patterns.performance = {
    "pattern": "Performance Concerns",
    "severity": "MEDIUM",
    "large_files": ($large | tonumber),
    "sync_operations": ($sync | tonumber),
    "description": "Large files and synchronous operations that may impact performance",
    "recommendations": [
      "Break down large files into smaller modules",
      "Replace synchronous operations with async alternatives",
      "Implement performance monitoring and alerting"
    ],
    "priority": "P2"
  }
')

# Pattern 6: Security Issues
echo "📊 Checking security patterns..."
HARDCODED_SECRETS=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "password\|secret\|key.*=.*["'"'"']" | wc -l)
UNSAFE_EVAL=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "eval(\|Function(" | wc -l)

RESULTS=$(echo "$RESULTS" | jq --arg secrets "$HARDCODED_SECRETS" --arg unsafe "$UNSAFE_EVAL" '
  .patterns.security = {
    "pattern": "Security Vulnerabilities",
    "severity": "CRITICAL",
    "hardcoded_secrets": ($secrets | tonumber),
    "unsafe_operations": ($unsafe | tonumber),
    "description": "Potential security vulnerabilities in codebase",
    "recommendations": [
      "Remove hardcoded secrets and use environment variables",
      "Avoid unsafe eval() and Function() usage",
      "Implement security scanning in CI/CD pipeline"
    ],
    "priority": "P0"
  }
')

# Calculate summary statistics
TOTAL_PATTERNS=$(echo "$RESULTS" | jq '.patterns | length')
HIGH_SEVERITY=$(echo "$RESULTS" | jq '.patterns | map(select(.severity == "CRITICAL" or .severity == "HIGH")) | length')
TOTAL_OCCURRENCES=$(echo "$RESULTS" | jq '.patterns | map(.occurrences // 0) | add')

RESULTS=$(echo "$RESULTS" | jq --arg total "$TOTAL_PATTERNS" --arg high "$HIGH_SEVERITY" --arg occurrences "$TOTAL_OCCURRENCES" '
  .summary = {
    "total_patterns_analyzed": ($total | tonumber),
    "high_severity_patterns": ($high | tonumber),
    "total_occurrences": ($occurrences | tonumber),
    "recommendations_summary": [
      "Focus on high-severity patterns first",
      "Implement automated detection for critical issues",
      "Create improvement tasks for identified patterns"
    ]
  }
')

# Save results to file
echo "$RESULTS" | jq '.' > "$REPORT_FILE"

echo "✅ Bug pattern analysis complete!"
echo "📊 Summary:"
echo "   Total patterns analyzed: $TOTAL_PATTERNS"
echo "   High severity patterns: $HIGH_SEVERITY"
echo "   Total occurrences: $TOTAL_OCCURRENCES"
echo ""
echo "📄 Detailed report saved to: $REPORT_FILE"
echo ""
echo "🎯 Next Steps:"
echo "   1. Review high-severity patterns in the report"
echo "   2. Create improvement tasks for critical issues"
echo "   3. Schedule fixes for identified patterns"
echo "   4. Monitor progress in future analyses"

# Generate quick recommendations
echo ""
echo "🔧 Quick Recommendations:"
echo "$RESULTS" | jq -r '.patterns | to_entries[] | select(.value.priority == "P0" or .value.priority == "P1") | "   \(.value.priority): \(.value.pattern) - \(.value.description)"'

exit 0
