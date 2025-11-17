# Worker Deployment & Testing Checklist

## Overview

This checklist ensures that new workers are properly deployed, configured, and integrated into the Core Vibe HQ health monitoring system. All steps must be completed before a worker is considered production-ready.

## Pre-Flight Checks

### 1. Dependencies & Environment Setup

- [ ] **Root Dependencies**: Run `npm install` in repository root
- [ ] **Orchestrator Dependencies**: Run `cd orchestrator && npm install`
- [ ] **Fix Dependencies**: If tests fail, run `cd orchestrator && npm run fix:deps`
- [ ] **Environment Variables**: Set required variables in `.env` or deployment environment:
  - `WORKER_NAME`: Unique worker identifier (e.g., "agent-factory")
  - `WORKER_TYPE`: Worker category (e.g., "factory", "specialist")
  - `HEALTH_WORKER_TARGETS`: JSON object mapping worker names to URLs or bindings

### 2. Database Preparation

- [ ] **Health Schema**: Verify health tables exist in DB_HEALTH database:
  - `health_checks`
  - `worker_health_checks`
  - `health_check_schedules`
  - `test_profiles`
  - `test_results`
  - `ai_logs`
  - `health_summaries`
- [ ] **Migrations**: Run latest migrations: `cd orchestrator && npm run db:migrate:local`
- [ ] **Schema Validation**: Confirm Kysely types match Drizzle schemas

### 3. Worker Configuration

- [ ] **Wrangler Config**: Verify `wrangler.jsonc` includes:
  - Correct `name` matching WORKER_NAME
  - Required bindings (DB_OPS, DB_PROJECTS, DB_CHATS, DB_HEALTH)
  - Service bindings to orchestrator
  - Health check environment variables
- [ ] **Environment Variables**: Confirm all required env vars are set
- [ ] **Health Worker Targets**: Add worker to orchestrator's HEALTH_WORKER_TARGETS

## Deployment Steps

### 4. Initial Deployment

- [ ] **Deploy to Staging**: `npm run deploy:staging` (if staging environment exists)
- [ ] **Verify Deployment**: Check Cloudflare dashboard for successful deployment
- [ ] **Environment Validation**: Confirm environment variables are set correctly
- [ ] **Service Bindings**: Verify service bindings are active

### 5. Health Check Integration

- [ ] **Worker Registration**: Confirm worker appears in `/api/health/workers` endpoint
- [ ] **Health Check Status**: Test `/health-check/status` returns worker info
- [ ] **Quick Health Check**: Test `/health-check/quick` returns connectivity status
- [ ] **Orchestrator Connectivity**: Verify worker can communicate with orchestrator

## Testing Procedures

### 6. Worker Self-Test

- [ ] **Health Status**: Hit `/health-check/status` and verify response:
  ```json
  {
    "worker_name": "agent-factory",
    "worker_type": "factory",
    "status": "healthy",
    "timestamp": "2025-11-10T...",
    "orchestrator_available": true
  }
  ```
- [ ] **Quick Health**: Hit `/health-check/quick` and verify response
- [ ] **No Errors**: Check worker logs for startup errors

### 7. Orchestrator Integration Test

- [ ] **Manual Health Check**: POST to `/api/health/checks` with worker in filters:
  ```json
  {
    "worker_filters": ["agent-factory"],
    "timeout_minutes": 5
  }
  ```
- [ ] **Check Results**: Verify worker appears in results via `/api/health/checks/:uuid`
- [ ] **Worker Results**: Check `/api/health/workers/agent-factory/latest`
- [ ] **Result Persistence**: Confirm results are stored in `worker_health_checks` table

### 8. Front-End Integration

- [ ] **Mission Control**: Load Mission Control UI and verify worker appears
- [ ] **Real-time Updates**: Trigger health check and verify UI updates
- [ ] **No UI Errors**: Check browser console for JavaScript errors
- [ ] **Responsive Design**: Test on different screen sizes

## Automated Validation

### 9. Validation Script Execution

Run the automated validation script:
```bash
./scripts/validate-worker-deployment.sh agent-factory
```

The script checks:
- [ ] Environment variables are set
- [ ] Worker is registered in HEALTH_WORKER_TARGETS
- [ ] Health endpoints respond correctly
- [ ] Database connectivity works
- [ ] Integration tests pass

### 10. Integration Tests

Run worker-specific integration tests:
```bash
cd orchestrator && npm run test:integration -- --run worker-spinup.test.ts
```

Tests verify:
- [ ] Worker registration process
- [ ] Health check execution flow
- [ ] Result submission and storage
- [ ] Error handling scenarios

## Post-Deployment Verification

### 11. Cron & Observability

- [ ] **Scheduled Checks**: Verify cron triggers work (if applicable)
- [ ] **Observability**: Confirm `observability.enabled = true` in wrangler config
- [ ] **Logging**: Check that health check events are logged
- [ ] **Metrics**: Verify health check metrics are collected

### 12. Documentation Update

- [ ] **Worker Inventory**: Add worker to `HEALTH_WORKER_TARGETS` documentation
- [ ] **Configuration**: Document any worker-specific configuration requirements
- [ ] **Known Issues**: Note any deployment issues or workarounds
- [ ] **Troubleshooting**: Update troubleshooting guide with worker-specific issues

## Success Criteria

### ✅ All Checks Pass

- [ ] Worker appears in `/api/health/workers` list
- [ ] Worker responds to health check requests
- [ ] Health check results are stored and retrievable
- [ ] Mission Control displays worker status
- [ ] No errors in worker or orchestrator logs
- [ ] Automated validation script passes
- [ ] Integration tests pass
- [ ] Documentation is updated

### 🚨 Failure Conditions

If any of these occur, deployment is blocked:

- ❌ Worker fails to start or crashes
- ❌ Health check requests timeout or fail
- ❌ Database connectivity issues
- ❌ Integration tests fail
- ❌ UI shows errors or missing data

## Rollback Procedures

### If Deployment Fails

1. **Stop Health Checks**: Remove worker from HEALTH_WORKER_TARGETS
2. **Revert Configuration**: Remove worker-specific config changes
3. **Undeploy Worker**: Use `wrangler delete` if needed
4. **Clean Database**: Remove any test data created during deployment
5. **Document Issue**: Add to troubleshooting guide for future deployments

## Automation Opportunities

### Future Improvements

- **Automated Deployment**: Create GitHub Actions workflow for worker deployment
- **Health Check Validation**: Automated checks in CI/CD pipeline
- **Configuration Management**: Centralized worker configuration system
- **Monitoring Dashboards**: Real-time deployment status monitoring

## Related Documentation

- [Testing Playbook](../development/testing-playbook.md)
- [Health Check System](../monitoring/health-check-system.md)
- [Troubleshooting Guide](troubleshooting.md)
- [API Documentation](../api/health-api.md)
