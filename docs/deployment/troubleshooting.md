# Worker Deployment Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues during worker deployment and health check integration.

## Common Issues & Solutions

### 1. Environment Variables Not Set

**Symptoms:**
- Worker fails to start with environment variable errors
- Health checks show missing WORKER_NAME or WORKER_TYPE

**Solutions:**
```bash
# Check current environment variables
echo "WORKER_NAME: $WORKER_NAME"
echo "WORKER_TYPE: $WORKER_TYPE"
echo "HEALTH_WORKER_TARGETS: $HEALTH_WORKER_TARGETS"

# Set missing variables (example for agent-factory)
export WORKER_NAME="agent-factory"
export WORKER_TYPE="factory"
export HEALTH_WORKER_TARGETS='{"agent-factory":"https://agent-factory.example.workers.dev"}'
```

**Prevention:** Always verify environment variables before deployment.

### 2. HEALTH_WORKER_TARGETS Configuration

**Symptoms:**
- Worker not appearing in `/api/health/workers`
- Health checks skip the worker

**Solutions:**
```json
// Correct format for HEALTH_WORKER_TARGETS
{
  "agent-factory": "https://agent-factory.example.workers.dev",
  "data-factory": "DATA_FACTORY_BINDING"
}
```

**Common Mistakes:**
- ❌ Missing quotes around keys: `{agent-factory: "..."}`
- ❌ Invalid JSON syntax
- ❌ Wrong URL format (missing https://)

**Verification:**
```bash
# Check if worker is registered
curl https://orchestrator.example.com/api/health/workers | jq .
```

### 3. Health Endpoints Not Responding

**Symptoms:**
- `/health-check/status` returns 404 or connection errors
- Worker appears offline in Mission Control

**Solutions:**
1. **Check worker deployment:**
   ```bash
   wrangler tail --format=pretty
   ```

2. **Verify route handlers:**
   - Ensure `HealthCheckHandler` is properly instantiated
   - Check that routes are registered in worker entry point

3. **Test direct access:**
   ```bash
   curl https://worker.example.com/health-check/status
   ```

### 4. Database Connectivity Issues

**Symptoms:**
- Health checks fail with database errors
- Worker health status shows database connectivity: false

**Solutions:**
1. **Verify D1 bindings:**
   ```toml
   # wrangler.toml
   [[d1_databases]]
   binding = "DB_HEALTH"
   database_name = "vibehq-health-logs"
   ```

2. **Check database permissions:**
   - Ensure worker has access to DB_HEALTH
   - Verify database exists and is not paused

3. **Test database connection:**
   ```bash
   wrangler d1 execute vibehq-health-logs --command="SELECT 1;"
   ```

### 5. Health Check Timeouts

**Symptoms:**
- Health checks take longer than expected
- Worker status shows "timeout" results
- Integration tests fail with timeout errors

**Solutions:**
1. **Increase timeout in health check request:**
   ```json
   {
     "timeout_minutes": 10,
     "worker_filters": ["worker-name"]
   }
   ```

2. **Check worker performance:**
   - Review worker logs for slow operations
   - Optimize database queries
   - Check for memory leaks

3. **Network issues:**
   - Verify worker URL is accessible
   - Check for firewall or CORS issues
   - Confirm service bindings are working

### 6. CSRF Validation Failures

**Symptoms:**
- API requests return 403 Forbidden
- "CSRF validation failed" in logs

**Solutions:**
1. **Health endpoints should be excluded from CSRF:**
   ```typescript
   // In orchestrator/worker/app.ts
   if (pathname.startsWith('/health-check')) {
     return next();
   }
   ```

2. **Check CSRF token handling:**
   - Ensure GET requests establish CSRF tokens
   - Verify token is sent with state-changing requests

### 7. WebSocket Connection Issues

**Symptoms:**
- Real-time updates not working in Mission Control
- PartyServer connections failing

**Solutions:**
1. **Verify PartyServer setup:**
   - Check PartyServer Durable Object is deployed
   - Ensure correct room names and namespaces

2. **Check WebSocket permissions:**
   - Verify worker has WebSocket binding
   - Check for protocol mismatches (ws vs wss)

### 8. Mission Control UI Issues

**Symptoms:**
- Worker not appearing in UI
- Health data not updating
- JavaScript errors in browser console

**Solutions:**
1. **Check API integration:**
   ```typescript
   // Verify Mission Control is calling correct endpoints
   const healthData = await fetch('/api/health');
   ```

2. **Verify component props:**
   - Check that worker data is passed correctly
   - Ensure component state updates properly

3. **Browser console errors:**
   - Check for CORS issues
   - Verify API responses are valid JSON
   - Check for TypeScript compilation errors

## Diagnostic Commands

### Health Check Validation

```bash
# Test all health endpoints
curl https://worker.example.com/health-check/status
curl https://worker.example.com/health-check/quick

# Test orchestrator integration
curl https://orchestrator.example.com/api/health/workers
curl https://orchestrator.example.com/api/health/workers/worker-name/latest
```

### Environment Validation

```bash
# Check all required variables
env | grep -E "(WORKER_|HEALTH_)" | sort

# Validate JSON syntax
echo "$HEALTH_WORKER_TARGETS" | jq .
```

### Database Validation

```bash
# List available databases
wrangler d1 list

# Check table existence
wrangler d1 execute vibehq-health-logs --command="SHOW TABLES;"

# Verify data
wrangler d1 execute vibehq-health-logs --command="SELECT COUNT(*) FROM health_checks;"
```

### Deployment Validation

```bash
# Check deployment status
wrangler deployments list

# View recent logs
wrangler tail --format=pretty --since=1h
```

## Automated Diagnosis

Run the automated validation script:

```bash
./scripts/validate-worker-deployment.sh worker-name
```

This script performs comprehensive checks and provides specific guidance for any issues found.

## Emergency Rollback

If deployment causes system instability:

1. **Stop health checks:**
   ```bash
   # Remove worker from HEALTH_WORKER_TARGETS
   unset HEALTH_WORKER_TARGETS["worker-name"]
   ```

2. **Undeploy worker:**
   ```bash
   wrangler delete worker-name
   ```

3. **Clean database:**
   ```sql
   DELETE FROM worker_health_checks WHERE worker_name = 'worker-name';
   ```

4. **Restart orchestrator:**
   ```bash
   wrangler deploy orchestrator
   ```

## Prevention Best Practices

### Pre-Deployment Checklist

- [ ] Run `npm run problems` before deployment
- [ ] Test in staging environment first
- [ ] Verify all environment variables
- [ ] Run automated validation script
- [ ] Check database migrations are applied
- [ ] Test health endpoints manually

### Monitoring Setup

- [ ] Enable observability in wrangler.jsonc
- [ ] Set up log aggregation
- [ ] Configure health check alerts
- [ ] Monitor error rates and latency

### Documentation Updates

- [ ] Update HEALTH_WORKER_TARGETS in configuration
- [ ] Add worker-specific troubleshooting notes
- [ ] Update deployment checklists
- [ ] Document any custom configurations

## Getting Help

If issues persist:

1. Check the [Health Check System Documentation](../monitoring/health-check-system.md)
2. Review the [Deployment Checklist](worker-deployment-checklist.md)
3. Run the automated validation script for detailed diagnostics
4. Check worker and orchestrator logs for error details
5. Verify all dependencies and environment variables

## Related Documentation

- [Worker Deployment Checklist](worker-deployment-checklist.md)
- [Health Check System](../monitoring/health-check-system.md)
- [Testing Playbook](../development/testing-playbook.md)
- [API Documentation](../api/health-api.md)
