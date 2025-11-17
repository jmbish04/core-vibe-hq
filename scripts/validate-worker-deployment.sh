#!/bin/bash
# Worker Deployment Validation Script
# Validates that a worker is properly deployed and integrated

set -e

WORKER_NAME="$1"

if [ -z "$WORKER_NAME" ]; then
    echo "❌ Error: Worker name required"
    echo "Usage: $0 <worker-name>"
    echo "Example: $0 agent-factory"
    exit 1
fi

echo "🔍 Validating deployment of worker: $WORKER_NAME"
echo "=============================================="

# Check if we're in the repository root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from repository root"
    exit 1
fi

# Function to check environment variable
check_env_var() {
    local var_name="$1"
    local var_value="${!var_name}"

    if [ -z "$var_value" ]; then
        echo "❌ Environment variable $var_name is not set"
        return 1
    else
        echo "✅ $var_name = $var_value"
        return 0
    fi
}

# 1. Environment Variables Check
echo ""
echo "📋 Step 1: Environment Variables"
echo "--------------------------------"

# Check basic worker variables
check_env_var "WORKER_NAME"
check_env_var "WORKER_TYPE"

# Check if worker is in HEALTH_WORKER_TARGETS
if [ -z "$HEALTH_WORKER_TARGETS" ]; then
    echo "❌ HEALTH_WORKER_TARGETS environment variable is not set"
else
    # Try to parse JSON and check if worker exists
    if command -v jq >/dev/null 2>&1; then
        if echo "$HEALTH_WORKER_TARGETS" | jq -e ".\"$WORKER_NAME\"" >/dev/null 2>&1; then
            WORKER_TARGET=$(echo "$HEALTH_WORKER_TARGETS" | jq -r ".\"$WORKER_NAME\"")
            echo "✅ Worker '$WORKER_NAME' found in HEALTH_WORKER_TARGETS: $WORKER_TARGET"
        else
            echo "❌ Worker '$WORKER_NAME' not found in HEALTH_WORKER_TARGETS"
        fi
    else
        echo "⚠️  jq not available - skipping HEALTH_WORKER_TARGETS validation"
        echo "   Manual check required: $HEALTH_WORKER_TARGETS"
    fi
fi

# 2. Health Endpoints Check
echo ""
echo "🌐 Step 2: Health Endpoints"
echo "---------------------------"

# Check if orchestrator is running locally (assume localhost:8787 for local dev)
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:8787}"

echo "Checking orchestrator at: $ORCHESTRATOR_URL"

# Check /api/health/workers endpoint
echo "Checking /api/health/workers..."
if curl -s "$ORCHESTRATOR_URL/api/health/workers" >/dev/null 2>&1; then
    WORKERS_RESPONSE=$(curl -s "$ORCHESTRATOR_URL/api/health/workers" 2>/dev/null)
    if echo "$WORKERS_RESPONSE" | grep -q "\"ok\":true"; then
        if echo "$WORKERS_RESPONSE" | grep -q "\"name\":\"$WORKER_NAME\""; then
            echo "✅ Worker '$WORKER_NAME' found in /api/health/workers"
        else
            echo "❌ Worker '$WORKER_NAME' not found in /api/health/workers response"
            echo "   Response: $WORKERS_RESPONSE"
        fi
    else
        echo "❌ /api/health/workers returned error response"
        echo "   Response: $WORKERS_RESPONSE"
    fi
else
    echo "❌ Cannot reach /api/health/workers endpoint"
    echo "   Orchestrator may not be running at $ORCHESTRATOR_URL"
fi

# 3. Worker Direct Health Check
echo ""
echo "🔍 Step 3: Worker Direct Health Check"
echo "-------------------------------------"

# Try to determine worker URL from HEALTH_WORKER_TARGETS
WORKER_URL=""
if [ -n "$HEALTH_WORKER_TARGETS" ] && command -v jq >/dev/null 2>&1; then
    WORKER_TARGET=$(echo "$HEALTH_WORKER_TARGETS" | jq -r ".\"$WORKER_NAME\"" 2>/dev/null)
    if [ -n "$WORKER_TARGET" ] && [ "$WORKER_TARGET" != "null" ]; then
        WORKER_URL="$WORKER_TARGET"
    fi
fi

if [ -n "$WORKER_URL" ]; then
    echo "Checking worker directly at: $WORKER_URL"

    # Check /health-check/status
    echo "Checking /health-check/status..."
    if curl -s "$WORKER_URL/health-check/status" >/dev/null 2>&1; then
        STATUS_RESPONSE=$(curl -s "$WORKER_URL/health-check/status" 2>/dev/null)
        if echo "$STATUS_RESPONSE" | grep -q "\"worker_name\":\"$WORKER_NAME\""; then
            echo "✅ Worker status endpoint responding correctly"
        else
            echo "⚠️  Worker status endpoint responding, but worker_name mismatch"
            echo "   Expected: $WORKER_NAME"
            echo "   Response: $STATUS_RESPONSE"
        fi
    else
        echo "❌ Cannot reach worker /health-check/status endpoint"
    fi

    # Check /health-check/quick
    echo "Checking /health-check/quick..."
    if curl -s "$WORKER_URL/health-check/quick" >/dev/null 2>&1; then
        QUICK_RESPONSE=$(curl -s "$WORKER_URL/health-check/quick" 2>/dev/null)
        if echo "$QUICK_RESPONSE" | grep -q "\"worker_name\":\"$WORKER_NAME\""; then
            echo "✅ Worker quick health check responding correctly"
        else
            echo "⚠️  Worker quick health check responding, but data mismatch"
            echo "   Response: $QUICK_RESPONSE"
        fi
    else
        echo "❌ Cannot reach worker /health-check/quick endpoint"
    fi
else
    echo "⚠️  Cannot determine worker URL - manual verification required"
    echo "   Check HEALTH_WORKER_TARGETS configuration"
fi

# 4. Integration Test
echo ""
echo "🔗 Step 4: Integration Test"
echo "---------------------------"

echo "Testing health check execution..."
# Try to trigger a health check
if curl -s -X POST "$ORCHESTRATOR_URL/api/health/checks" \
    -H "Content-Type: application/json" \
    -d "{\"worker_filters\":[\"$WORKER_NAME\"],\"timeout_minutes\":2}" >/dev/null 2>&1; then

    CHECK_RESPONSE=$(curl -s -X POST "$ORCHESTRATOR_URL/api/health/checks" \
        -H "Content-Type: application/json" \
        -d "{\"worker_filters\":[\"$WORKER_NAME\"],\"timeout_minutes\":2}" 2>/dev/null)

    if echo "$CHECK_RESPONSE" | grep -q "\"ok\":true"; then
        CHECK_UUID=$(echo "$CHECK_RESPONSE" | grep -o '"health_check_uuid":"[^"]*"' | cut -d'"' -f4 2>/dev/null)
        if [ -n "$CHECK_UUID" ]; then
            echo "✅ Health check initiated successfully (UUID: $CHECK_UUID)"

            # Wait a moment and check results
            echo "Waiting 10 seconds for health check to complete..."
            sleep 10

            if curl -s "$ORCHESTRATOR_URL/api/health/checks/$CHECK_UUID" >/dev/null 2>&1; then
                RESULT_RESPONSE=$(curl -s "$ORCHESTRATOR_URL/api/health/checks/$CHECK_UUID" 2>/dev/null)
                if echo "$RESULT_RESPONSE" | grep -q "\"ok\":true"; then
                    echo "✅ Health check completed and results retrieved"
                else
                    echo "⚠️  Health check completed but result retrieval failed"
                    echo "   Response: $RESULT_RESPONSE"
                fi
            else
                echo "⚠️  Health check may still be running or result retrieval failed"
            fi
        else
            echo "⚠️  Health check initiated but UUID not found in response"
            echo "   Response: $CHECK_RESPONSE"
        fi
    else
        echo "❌ Health check initiation failed"
        echo "   Response: $CHECK_RESPONSE"
    fi
else
    echo "❌ Cannot reach health check initiation endpoint"
fi

# 5. Database Check (if wrangler available)
echo ""
echo "💾 Step 5: Database Verification"
echo "---------------------------------"

if command -v wrangler >/dev/null 2>&1; then
    echo "Checking database connectivity..."

    # Try to check if tables exist (this is a basic check)
    if cd orchestrator && wrangler d1 list >/dev/null 2>&1; then
        echo "✅ Wrangler D1 connectivity confirmed"
        cd ..
    else
        echo "⚠️  Wrangler D1 connectivity check failed"
        cd ..
    fi
else
    echo "⚠️  Wrangler CLI not available - skipping database check"
fi

echo ""
echo "🎉 Validation complete!"
echo "======================="
echo ""
echo "📋 Summary:"
echo "   - Review any ⚠️ or ❌ items above"
echo "   - Fix issues and re-run validation"
echo "   - Once all checks pass, worker is ready for production"
echo ""
echo "📚 For detailed troubleshooting, see docs/deployment/troubleshooting.md"
