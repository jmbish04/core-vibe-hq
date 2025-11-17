#!/bin/bash

# Core Vibe HQ Dependency Fix Script
# Fixes recurring Rollup/Vite binary compatibility issues

set -e

echo "🔧 Core Vibe HQ Dependency Fix Script"
echo "====================================="
echo ""

# Determine repository root and orchestrator location
if [ -f "package.json" ] && [ -d "orchestrator" ]; then
    # We're in repository root
    REPO_ROOT="$(pwd)"
    ORCHESTRATOR_DIR="$REPO_ROOT/orchestrator"
elif [ -f "package.json" ] && [[ "$(basename "$(pwd)")" == "orchestrator" ]]; then
    # We're in orchestrator directory
    ORCHESTRATOR_DIR="$(pwd)"
    REPO_ROOT="$(dirname "$ORCHESTRATOR_DIR")"
else
    echo "❌ Error: Must be run from repository root or orchestrator directory"
    exit 1
fi

echo "📍 Repository root: $REPO_ROOT"
echo "📍 Orchestrator directory: $ORCHESTRATOR_DIR"
echo ""

# Fix orchestrator dependencies
echo "🔄 Fixing orchestrator dependencies..."
cd "$ORCHESTRATOR_DIR"

if [ -d "node_modules" ]; then
    echo "   Removing node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo "   Removing package-lock.json..."
    rm -f package-lock.json
fi

echo "   Reinstalling dependencies..."
npm install

echo "✅ Orchestrator dependencies fixed!"
cd "$REPO_ROOT"
echo ""

# Verify the fix
echo "🔍 Verifying fix..."
cd "$ORCHESTRATOR_DIR"
echo "   Testing unit tests..."
if npm run test:unit > /dev/null 2>&1; then
    echo "✅ Unit tests pass!"
else
    echo "⚠️  Unit tests still failing (this may be expected before other fixes)"
fi
cd "$REPO_ROOT"

echo ""
echo "🎉 Dependency fix complete!"
echo ""
echo "📖 Next steps:"
echo "   - Run 'npm run problems' to check for remaining issues"
echo "   - If tests still fail, check the testing playbook for additional fixes"
echo ""
echo "📚 See docs/development/dependency-fixes.md for more information"