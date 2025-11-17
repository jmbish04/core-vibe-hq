# Testing Playbook

## Overview

This playbook provides comprehensive testing strategies and backup plans for Vibecode release hardening. All tests must pass before production deployment.

## 1. Automated Testing Infrastructure

### Core Test Commands

```bash
# Run all tests (Vitest + Lint + TypeCheck)
npm run problems

# Individual test suites
npm run typecheck:all      # TypeScript compilation across all workers
npm run lint:all          # ESLint + Biome across all workers
npm run types:all         # Wrangler type generation

# Unit tests (orchestrator)
cd orchestrator && npm run test:unit

# Integration tests (orchestrator)
cd orchestrator && npm run test:integration

# E2E tests (frontend)
npm run test:e2e

# Smoke tests (comprehensive system validation)
npm run smoke:all              # Run all smoke test categories
npm run smoke:infrastructure   # Test database, RPC, environment
npm run smoke:health          # Test health check system
npm run smoke:api             # Test API endpoints
npm run smoke:workers         # Test worker communication
npm run smoke:ui              # Test UI components
npm run smoke:factories       # Test factory workers
npm run smoke:ai-providers    # Test AI provider system
npm run smoke:patches         # Test patch management
npm run smoke:automation      # Test scheduled automation
npm run smoke:errors          # Test error handling
npm run smoke:report          # Generate test results report
```

### Known Blockers

#### Rollup Plugin Binary Issue
**Status**: RESOLVED with automated fix script

**Symptoms**:
```
TypeError: Class extends value undefined is not a constructor or null
```

**Root Cause**: Platform-specific binary (`@rolldown/binding-linux-x64-gnu`) not compatible with current environment.

**Automated Fix**:
```bash
# Run automated fix script
cd orchestrator && npm run fix:deps
```

**Manual Fix** (if automated script fails):
```bash
cd orchestrator
rm -rf node_modules package-lock.json
npm install
```

**Prevention**: Fix script runs automatically in CI/CD before tests.

**See Also**: [Dependency Fixes](./dependency-fixes.md) for detailed documentation.

## 2. Test Execution Strategy

### Pre-Release Checklist

#### Phase 1: Environment Setup
- [ ] Run `npm run problems` - all must pass
- [ ] Verify orchestrator dependencies: `cd orchestrator && npm install`
- [ ] Check workspace integrity: `npm run lint:all`

#### Phase 2: Unit Testing
- [ ] **Critical**: AI Provider tests
  ```bash
  cd orchestrator && npm run test:unit -- --run tests/unit/services/ai-providers
  ```
- [ ] Ops Monitor tests
  ```bash
  cd orchestrator && npm run test:unit -- --run tests/unit/api/routes/opsIntegrations.test.ts
  ```
- [ ] Scheduled handler tests
  ```bash
  cd orchestrator && npm run test:unit -- --run tests/unit/scheduled.test.ts
  ```

#### Phase 3: Integration Testing
- [ ] Database RPC integration
  ```bash
  cd orchestrator && npm run test:integration -- --run services/opsMonitorService.test.ts
  ```

#### Phase 4: Smoke Testing (Stage Smoke Validation)
- [ ] **Critical**: Run comprehensive smoke test suite
  ```bash
  # Run all smoke tests (comprehensive system validation)
  npm run smoke:all

  # Or run individual categories:
  npm run smoke:infrastructure   # Database, RPC, environment
  npm run smoke:health          # Health check system
  npm run smoke:api             # API endpoints
  npm run smoke:workers         # Worker communication
  npm run smoke:ui              # UI components
  npm run smoke:factories       # Factory workers
  npm run smoke:ai-providers    # AI provider system
  npm run smoke:patches         # Patch management
  npm run smoke:automation      # Scheduled automation
  npm run smoke:errors          # Error handling
  ```
- [ ] Generate smoke test report
  ```bash
  npm run smoke:report
  ```
- [ ] Review smoke test results in `docs/testing/smoke-test-results.md`
- [ ] Address any failing smoke tests before proceeding to production
  ```
- [ ] PartyServer WebSocket connections
- [ ] AI Provider routing and execution

#### Phase 5: End-to-End Testing
- [ ] Frontend terminal component connection
- [ ] Ops monitor dashboard real-time updates
- [ ] AI provider task execution flow

## 3. Backup Plans & Recovery

### Test Result Snapshot Strategy

When tests fail due to environment issues:

#### 1. Snapshot Current State
```bash
# Create test results snapshot
mkdir -p test-snapshots/$(date +%Y%m%d_%H%M%S)
npm run problems 2>&1 | tee test-snapshots/$(date +%Y%m%d_%H%M%S)/problems.log
cd orchestrator && npm run test:unit 2>&1 | tee ../test-snapshots/$(date +%Y%m%d_%H%M%S)/unit-tests.log
```

#### 2. Environment Recovery
```bash
# Complete environment reset
cd orchestrator
rm -rf node_modules package-lock.json
npm install

# Verify platform binaries
ls -la node_modules/@rolldown/binding-*

# Re-run tests
npm run test:unit
```

#### 3. Validation Checklist
- [ ] `npm run problems` returns exit code 0
- [ ] All TypeScript errors resolved
- [ ] All linting errors resolved
- [ ] Wrangler types generate successfully
- [ ] Unit tests pass: `npm run test:unit`

### Alternative Testing Approaches

#### Manual Verification Scripts
When automated tests are blocked:

```bash
# Manual database RPC verification
node scripts/verify-db-rpc.js

# Manual AI provider verification
node scripts/test-ai-providers.js

# Manual PartyServer verification
node scripts/test-partyserver.js
```

#### Component Isolation Testing
Test individual components in isolation:

```bash
# Test terminal component without PartySocket
npm run test:unit -- --run terminal-component.unit.test.ts

# Test ops monitor without WebSocket
npm run test:unit -- --run ops-monitor.unit.test.ts
```

## 4. CI/CD Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Install orchestrator dependencies
        working-directory: orchestrator
        run: npm install

      - name: Run problems check
        run: npm run problems

      - name: Run unit tests
        working-directory: orchestrator
        run: npm run test:unit

      - name: Run integration tests
        working-directory: orchestrator
        run: npm run test:integration
```

### Deployment Gate Checks

**Pre-deployment verification**:
```bash
# Must pass before deployment
npm run problems
cd orchestrator && npm run test:unit -- --run critical-path
cd orchestrator && npm run test:integration
```

## 5. Issue Resolution Matrix

| Issue Type | Symptom | Immediate Fix | Prevention |
|------------|---------|---------------|------------|
| Rollup Binary | `Class extends value undefined` | `rm -rf node_modules && npm install` | Use `npm ci` in CI |
| TypeScript | Type errors | Fix types, don't use `any` | Run `npm run typecheck:all` |
| Linting | ESLint errors | Fix code style | Run `npm run lint:all` |
| Wrangler Types | Type generation fails | `npm run types:all` | Check wrangler config changes |
| Test Flakes | Intermittent failures | Increase timeouts, stabilize mocks | Run tests multiple times |

## 6. Monitoring & Alerts

### Test Health Dashboard

Track test reliability metrics:
- Test execution time trends
- Failure rates by component
- Environment-specific issues

### Alert Conditions

**Immediate Alerts**:
- `npm run problems` fails
- Critical path tests fail
- Rollup binary issues detected

**Warning Alerts**:
- Test execution time > 5 minutes
- Individual test failures > 5%
- New TypeScript errors introduced

## 7. Release Validation Checklist

### Pre-Release
- [ ] `npm run problems` ✅
- [ ] All unit tests pass ✅
- [ ] Integration tests pass ✅
- [ ] E2E tests pass ✅
- [ ] Manual verification completed ✅

### Post-Release
- [ ] Monitor error rates (Sentry)
- [ ] Check performance metrics
- [ ] Validate user flows
- [ ] Rollback plan ready if needed

## 8. Emergency Procedures

### If Tests Fail at Release Time

1. **Immediate**: Create test snapshot
   ```bash
   mkdir emergency-$(date +%s)
   npm run problems > emergency-$(date +%s)/problems.log
   ```

2. **Environment Reset**:
   ```bash
   cd orchestrator && rm -rf node_modules && npm install
   npm run problems
   ```

3. **Manual Verification**:
   - Check database RPC connections
   - Verify AI provider configurations
   - Test PartyServer WebSocket connections

4. **Rollback Plan**:
   - Previous deployment available
   - Feature flags can disable new components
   - Database migrations reversible

## 9. Future Improvements

### Automated Recovery
```bash
# scripts/auto-recover.sh
#!/bin/bash
if ! npm run problems; then
  echo "Problems detected, attempting recovery..."
  cd orchestrator
  rm -rf node_modules package-lock.json
  npm install
  if npm run problems; then
    echo "Recovery successful"
    exit 0
  else
    echo "Recovery failed"
    exit 1
  fi
fi
```

### Enhanced Monitoring
- Add test execution time tracking
- Implement flaky test detection
- Create test result history dashboard
