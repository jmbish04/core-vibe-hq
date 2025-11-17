<!-- 7543ead6-f8bf-494d-9fc8-ef1c7c11b2ce 334ff3e2-be8a-41c4-a04c-54a62736f4b2 -->
# Production Readiness Execution Plan

## Phase 1: Immediate Actions (Blockers)

### 1.1 Fix Dependency & Tooling Issues

**Priority**: CRITICAL - Blocks all test work

**Tasks**:

1. **Fix Rollup Dependencies** (`orchestrator/package.json`)

- Install missing rollup optional dependencies: `rollup`, `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`
- Verify with: `cd orchestrator && npm run test:unit`
- **File**: `orchestrator/package.json`

2. **Fix TypeScript JSX Configuration** (`orchestrator/tsconfig.app.json`)

- Add `"jsx": "react-jsx"` to `compilerOptions`
- Fixes JSX errors preventing typecheck from passing
- **File**: `orchestrator/tsconfig.app.json`

3. **Reinstall All Dependencies**

- Run `npm run install:all` from project root
- Verify all workspaces have dependencies installed
- **Script**: `scripts/install-all.sh`

### 1.2 Fix Critical Syntax Error

**Priority**: CRITICAL - Prevents scheduled handler from working

**Task**: Fix incomplete `if` statement in scheduled handler

- **File**: `orchestrator/worker/index.ts` (line 234)
- **Current**: `if` (incomplete)
- **Fix**: `if (event.cron === '0 2 * * *') {`
- This prevents cron jobs from executing

### 1.3 Lint Cleanup Baseline

**Priority**: HIGH - Blocks deployment

**Tasks**:

1. Run auto-fix: `npm run lint:all:fix`
2. Manual fixes for remaining issues:

- Break long lines (max-len violations)
- Remove unused imports/variables
- Fix formatting inconsistencies

3. Verify clean state: `npm run problems` should show 0 errors

## Phase 2: Checkpoint 2 - Scheduled Automation & Integrations

### 2.1 Ops Monitoring Route Tests

**Priority**: HIGH - Required for production

**Tasks**:

1. **Unit Tests for `/api/ops/scan`** (`orchestrator/worker/tests/unit/api/routes/opsIntegrations.test.ts`)

- Happy path: Valid scan request returns scan result
- Invalid scope: Returns 400 with error message
- Service failure: Returns 500 with error
- Verify `OpsMonitorService.runScan()` called with correct params
- Verify broadcast callback invoked on success

2. **Integration Tests for OpsMonitorService** (`orchestrator/worker/tests/integration/services/opsMonitorService.test.ts`)

- Full scan: Verifies log ingestion + analysis + issue filing
- Incremental scan: Verifies only recent logs processed
- Broadcast integration: Verifies `OpsMonitorBroadcastServer` receives results
- Database persistence: Verifies scans/issues written to DB_OPS

### 2.2 ORCHESTRATOR_OPS_MONITOR Wiring

**Priority**: HIGH - Required for apps/ workers to access ops data

**Tasks**:

1. **Audit All Ops Database Access**

- Search codebase for direct `DB_OPS` usage in apps/ workers
- Files to check: `apps/base/worker/**/*.ts`, `apps/factories/**/worker/**/*.ts`, `apps/specialists/**/*.ts`
- Replace with `ORCHESTRATOR_OPS_MONITOR` service binding calls

2. **Update Base Worker Database Service** (`apps/base/worker/database/database.ts`)

- Add `opsMonitorClient` property with type definition
- Methods: `scan`, `getRecentScans`, `getOpenIssues`, `resolveIssue`

3. **Wire in Factory Workers**

- Update factory workers to use `ORCHESTRATOR_OPS_MONITOR`
- Remove any direct D1 access attempts
- Add error handling for service binding failures

### 2.3 Cron Monitoring Completion

**Priority**: MEDIUM - Completes scheduled automation

**Tasks**:

1. **Add Metrics & Logging** (`orchestrator/worker/index.ts`)

- Log scan start/completion times
- Track scan duration
- Log number of issues found/filed
- Emit metrics to Workers Analytics Engine

2. **Vitest Harness for Scheduled Handler** (`orchestrator/worker/tests/unit/scheduled.test.ts`)

- Daily cron (`0 2 * * *`) invokes `runScan({ scope: 'full' })`
- Incremental cron (`0 */4 * * *`) invokes `runScan({ scope: 'incremental' })`
- Broadcast callback invoked on scan completion
- Error handling: Failed scans don't crash handler
- Database cleanup: Connections properly closed

3. **Documentation**

- Document dual cron cadence (daily full + 4-hour incremental)
- Add runbook for monitoring cron execution
- Document how to manually trigger scans via API

## Success Criteria

- [ ] All dependencies installed and tests can run
- [ ] TypeScript compilation passes (`npm run typecheck:all`)
- [ ] Zero lint errors (`npm run lint:all`)
- [ ] Scheduled handler syntax error fixed
- [ ] Ops monitoring routes have 80%+ test coverage
- [ ] All apps/ workers use `ORCHESTRATOR_OPS_MONITOR` instead of direct DB access
- [ ] Cron monitoring has metrics and logging
- [ ] Documentation updated

## Files to Modify

**Critical Fixes**:

- `orchestrator/package.json` - Add rollup dependencies
- `orchestrator/tsconfig.app.json` - Add JSX config
- `orchestrator/worker/index.ts` - Fix scheduled handler syntax

**Test Files**:

- `orchestrator/worker/tests/unit/api/routes/opsIntegrations.test.ts` - New
- `orchestrator/worker/tests/integration/services/opsMonitorService.test.ts` - New
- `orchestrator/worker/tests/unit/scheduled.test.ts` - New

**Service Updates**:

- `apps/base/worker/database/database.ts` - Add opsMonitorClient
- `apps/factories/**/worker/**/*.ts` - Replace DB_OPS with service binding

**Documentation**:

- `docs/development/PRODUCTION_READINESS_PLAN.md` - Reference document
- `docs/development/` - Add cron monitoring runbook

## Execution Order

1. **Day 1**: Fix dependencies and syntax errors (Phase 1.1-1.2)
2. **Day 2**: Lint cleanup (Phase 1.3)
3. **Day 3-4**: Ops route tests (Phase 2.1)
4. **Day 5**: ORCHESTRATOR_OPS_MONITOR wiring (Phase 2.2)
5. **Day 6**: Cron monitoring completion (Phase 2.3)