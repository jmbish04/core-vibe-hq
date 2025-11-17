# Dependency Fixes

This document outlines recurring dependency issues and their fixes in the Core Vibe HQ project.

## Rollup/Vite Binary Compatibility Issue

### Problem

Platform-specific binary compatibility issues with Rollup and Vite bundlers cause test execution to fail with errors related to native binaries.

### Symptoms

- `npm run test:unit` fails with binary-related errors
- `npm run problems` shows test failures
- Issue occurs intermittently after dependency updates

### Root Cause

The issue stems from platform-specific native binaries in Rollup/Vite dependencies that become incompatible after certain updates or on different systems.

### Solution

**Automated Fix Script:**

```bash
npm run fix:deps
```

This script will:
1. Remove `node_modules` and `package-lock.json` from orchestrator
2. Reinstall dependencies with `npm install`
3. Verify the fix by running unit tests

**Manual Fix (if script fails):**

```bash
cd orchestrator
rm -rf node_modules package-lock.json
npm install
```

### When to Run the Fix

Run `npm run fix:deps` when:
- Test suites fail with binary-related errors
- After major dependency updates
- Before running smoke tests if issues are detected
- As part of CI/CD pre-test steps

### Prevention

The fix script is integrated into the CI/CD pipeline to automatically resolve these issues before test execution.

### Verification

After running the fix:
1. Run `npm run problems` to ensure no issues remain
2. Execute `cd orchestrator && npm run test:unit` to verify tests pass
3. Check that smoke tests can run successfully

### Related Issues

- Blocks all test suite execution
- Prevents smoke test runs
- Causes CI/CD pipeline failures

### Files

- Fix script: `scripts/fix-dependencies.sh`
- Documentation: `docs/development/dependency-fixes.md`
- Integration: `package.json` (npm run fix:deps)