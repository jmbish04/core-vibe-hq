# PartyKit Production Readiness & Execution Plan

**Status**: Pre-Production  
**Last Updated**: 2025-11-08  
**Owner**: Engineering Lead  
**Agents**: Codex (backend/services), Cursor (large code edits)

---

## TLDR: Why This Plan Exists & What It Delivers

### Why We Spec'd This Out

**PartyKit Integration is Complete** ✅ - We've successfully integrated PartyServer/Partysocket packages from `third_party/partykit/` into Vibecode, enabling real-time terminal streaming and ops monitoring broadcasts. However, **production readiness requires**:

1. **Dependency & Tooling Fixes** - Rollup binary issues and TypeScript config problems are blocking all test execution
2. **Test Coverage** - Ops monitoring routes, cron handlers, and PartyServer integrations need comprehensive tests
3. **Polish & Integration** - Frontend PartySocket wiring, error handling, and human-in-the-loop support need completion
4. **AI Provider System** - Router exists but needs config storage, assignment orchestration, and telemetry

**Without this plan**, we risk shipping incomplete features, missing critical tests, and encountering production issues that could have been caught earlier.

### What This Plan Delivers

**🎯 Production-Ready Vibecode** with:

1. **Real-Time Terminal Streaming** - Complete PartyServer-based terminal proxy with automatic reconnection, error handling, and multi-client support
2. **Real-Time Ops Monitoring** - Live broadcast of ops scan results to dashboard clients via PartyServer, enabling instant visibility into system health
3. **Fully Tested Infrastructure** - Comprehensive unit/integration tests for all critical paths, ensuring reliability before production
4. **AI Provider System** - Complete provider selection, configuration, and assignment orchestration with telemetry
5. **Clean Codebase** - All lint errors resolved, TypeScript compilation passing, dependencies properly configured
6. **Human-in-the-Loop Support** - Task pause/resume, review prompts, and recovery procedures for production operations

**Timeline**: 2-3 weeks to production-ready state  
**Critical Path**: ~40-50 hours of focused development

---

## Executive Summary

Vibecode is **~85% complete** with foundational infrastructure in place. **PartyKit integration is complete** ✅, but three critical checkpoints remain before production deployment:

1. **Scheduled Automation & Integrations** (Checkpoint 2) - Ops monitoring polish, cron wiring, lint cleanup
2. **AI Provider Enablement** (Checkpoint 3) - Config storage, assignment orchestration, telemetry
3. **Extended Services** (Checkpoint 4) - Analytics routes, terminal integration, specialist cleanup

**Blockers**: Dependency/tooling issues preventing test execution, lint failures, missing test coverage.

**Estimated Timeline**: 2-3 weeks to production-ready state

---

## 1. IMMEDIATE ACTIONS (Pre-Implementation)

### 1.1 Dependency & Tooling Fixes

**Priority**: 🔴 **CRITICAL** - Must complete before any test work

#### Rollup Binary Reinstallation

**Issue**: Vitest fails due to missing rollup optional dependencies (`@rolldown/binding-linux-x64-gnu`)

**Fix**:
```bash
# From orchestrator directory
cd orchestrator
rm -rf node_modules package-lock.json
npm install --save-dev rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs
npm install

# Verify with:
npm run test:unit
```

**Verification Checklist**:
- [ ] `npm run test:unit` executes without rollup errors
- [ ] No `TypeError: Class extends value undefined` errors
- [ ] Vitest can import test files successfully

**File**: `orchestrator/package.json` (already has rollup deps, but may need reinstall)

#### TypeScript JSX Configuration Fix

**Issue**: Orchestrator frontend TSX files failing typecheck due to missing `--jsx` flag

**Fix**: Update `orchestrator/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",  // Add this line
    // ... existing options
  }
}
```

**Verification**:
```bash
cd orchestrator
npm run typecheck  # Should pass without JSX errors
```

**Files to Check**:
- `orchestrator/tsconfig.app.json` - Add `"jsx": "react-jsx"`
- `orchestrator/tsconfig.worker.json` - Verify worker config doesn't conflict

#### Dependency Audit & Reinstall

**Action**:
```bash
# From project root
npm run install:all  # If script exists
# OR manually:
cd orchestrator && npm ci
cd apps/base && npm ci
cd apps/data-factory && npm ci
cd apps/services-factory && npm ci
cd apps/ui-factory && npm ci
```

**Verification**:
```bash
# Verify all workspaces have dependencies installed
cd orchestrator && npm list --depth=0
cd apps/base && npm list --depth=0
# etc.
```

**Checklist**:
- [ ] All workspace `node_modules` directories exist
- [ ] No missing peer dependency warnings
- [ ] `npm run problems` can execute (even if it fails)

### 1.2 Lint Baseline & Cleanup

**Priority**: 🟡 **HIGH** - Blocks deployment

#### Current Lint Issues

**Known Issues**:
- ESLint: `max-len` violations (lines > 120 chars)
- ESLint: `no-unused-vars` (unused imports/variables)
- Biome: Formatting inconsistencies
- Prettier: Some files not formatted

#### Cleanup Strategy

**Step 1: Auto-fix what's possible**
```bash
# From project root
npm run lint:all:fix  # If script exists
# OR manually:
cd orchestrator && npm run lint -- --fix
cd apps/base && npm run lint -- --fix
```

**Step 2: Manual fixes for remaining issues**

**For `max-len` violations**:
- Break long lines at logical points
- Extract complex expressions to variables
- Use template literals for long strings

**For `no-unused-vars`**:
- Remove unused imports
- Remove unused variables
- Comment out temporarily if needed for future use

**Step 3: Verify clean state**
```bash
npm run problems  # Should show 0 lint errors
```

**Checklist**:
- [ ] `npm run lint:all` passes with 0 errors
- [ ] `npm run lint:all` shows < 10 warnings (acceptable)
- [ ] All auto-fixable issues resolved

### 1.3 TypeScript Compilation Fixes

**Priority**: 🔴 **CRITICAL** - Blocks all deployment

#### Missing Module Imports

**Known Issues**:
- `shared/types/errors` - Module not found
- `@/lib/utils` - Path alias not resolving
- `@/utils/analytics` - Path alias not resolving

**Fix Strategy**:

1. **Check if modules exist**:
   ```bash
   find . -name "errors.ts" -o -name "errors.tsx"
   find . -name "utils.ts" -path "*/lib/*"
   find . -name "analytics.ts" -path "*/utils/*"
   ```

2. **Fix path aliases in `orchestrator/tsconfig.app.json`**:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"],
         "@/lib/*": ["./src/lib/*"],
         "@/utils/*": ["./src/utils/*"]
       }
     }
   }
   ```

3. **Create missing modules or update imports**:
   - If `shared/types/errors` doesn't exist, create it or update imports
   - If `@/lib/utils` doesn't exist, create it or use correct import path

**Verification**:
```bash
cd orchestrator
npm run typecheck  # Should show < 10 errors (down from 100+)
```

**Checklist**:
- [ ] All import paths resolve correctly
- [ ] TypeScript compilation shows < 10 errors
- [ ] All critical type errors fixed

---

## 2. CHECKPOINT 2: Scheduled Automation & Integrations

**Status**: ⏳ In Progress  
**Estimated Time**: 8-12 hours  
**Owner**: Codex (backend), Cursor (route updates)

### 2.1 Ops Monitoring Route Tests

**Priority**: 🟡 **HIGH** - Required for production

#### Unit Tests for `/api/ops/scan`

**Location**: `orchestrator/tests/unit/api/routes/opsIntegrations.test.ts`

**Test Cases**:
```typescript
describe('POST /api/ops/scan', () => {
  it('should return scan result for valid scope', async () => {
    // Happy path: Valid scan request returns scan result
  });

  it('should return 400 for invalid scope', async () => {
    // Invalid scope: Returns 400 with error message
  });

  it('should return 500 on service failure', async () => {
    // Service failure: Returns 500 with error
  });

  it('should broadcast scan result via PartyServer', async () => {
    // Verify broadcast is called with correct data
  });
});
```

**Implementation Steps**:
1. Create test file if it doesn't exist
2. Mock `OpsMonitorService.runScan`
3. Mock `OpsMonitorBroadcastServer` broadcast
4. Test all scenarios above
5. Verify broadcast callback is invoked

**Checklist**:
- [ ] Test file created
- [ ] All test cases pass
- [ ] Broadcast verification works
- [ ] Error handling tested

#### Integration Tests for Ops Monitoring

**Location**: `orchestrator/tests/integration/ops/opsMonitor.test.ts`

**Test Cases**:
```typescript
describe('Ops Monitor Integration', () => {
  it('should run full scan and store results', async () => {
    // End-to-end: Trigger scan, verify DB records, verify broadcast
  });

  it('should run incremental scan correctly', async () => {
    // Verify incremental scan logic
  });

  it('should handle scheduled cron execution', async () => {
    // Mock cron event, verify scan runs
  });
});
```

**Checklist**:
- [ ] Integration test file created
- [ ] Tests use real D1 database (local)
- [ ] All scenarios pass
- [ ] Broadcast verified end-to-end

### 2.2 Cron Handler Wiring

**Priority**: 🟡 **HIGH** - Required for scheduled automation

#### Fix Scheduled Handler Syntax Error

**Issue**: Incomplete `if` statement in scheduled handler

**Location**: `orchestrator/worker/index.ts` (around line 234)

**Current** (if exists):
```typescript
if  // INCOMPLETE
```

**Fix**:
```typescript
if (event.cron === '0 2 * * *') {
  // Daily full scan at 2 AM
  logger.info('Running daily full operations scan');
  await opsMonitor.runScan({ scope: 'full' });
} else if (event.cron === '0 */4 * * *') {
  // Incremental scans every 4 hours
  logger.info('Running incremental operations scan');
  await opsMonitor.runScan({ scope: 'incremental' });
}
```

**Verification**:
```bash
cd orchestrator
npm run test:unit -- scheduled.test.ts
```

**Checklist**:
- [ ] Syntax error fixed
- [ ] Cron handler tests pass
- [ ] Broadcast callback wired correctly

#### Wire ORCHESTRATOR_OPS_MONITOR Everywhere

**Current State**: `OpsMonitorOps` entrypoint exists, but not all routes use it

**Tasks**:
1. **Update routes to use RPC entrypoint**:
   - `orchestrator/worker/api/routes/opsRoutes.ts` - Use `env.ORCHESTRATOR_OPS_MONITOR.scan()`
   - Remove direct `OpsMonitorService` instantiation in routes

2. **Update scheduled handler**:
   - Use `OpsMonitorOps` entrypoint instead of direct service
   - Ensure broadcast callback is passed

3. **Verify service bindings**:
   - Check `@shared/base/wrangler.base.jsonc` has `ORCHESTRATOR_OPS_MONITOR` binding
   - Verify all apps/ workers can access it

**Checklist**:
- [ ] All routes use RPC entrypoint
- [ ] Scheduled handler uses RPC entrypoint
- [ ] Service bindings verified
- [ ] Tests updated to mock RPC calls

### 2.3 PartyServer Terminal Integration Polish

**Priority**: 🟡 **MEDIUM** - Nice to have, but terminal already works

#### Backend Enhancements

**Location**: `orchestrator/worker/durable-objects/terminal/TerminalServer.ts`

**Tasks**:
1. **Add error handling for container WebSocket failures**:
   ```typescript
   async connectToContainer() {
     try {
       // ... existing connection logic
     } catch (error) {
       // Broadcast error to all clients
       this.broadcast(JSON.stringify({
         type: 'error',
         message: 'Failed to connect to container',
         error: error.message
       }));
     }
   }
   ```

2. **Add reconnection logic**:
   - Detect container WebSocket disconnection
   - Attempt reconnection with exponential backoff
   - Notify clients of reconnection status

3. **Add authentication/authorization**:
   - Verify user has access to workerId
   - Check sandbox permissions

**Checklist**:
- [ ] Error handling added
- [ ] Reconnection logic implemented
- [ ] Authentication verified
- [ ] Unit tests added

#### Frontend Integration (Already Complete ✅)

**Status**: Frontend already uses PartySocket (see `apps/base/src/routes/chat/components/terminal.tsx`)

**Verification**:
- [x] Terminal component uses `PartySocket`
- [x] Connection status handling exists
- [x] Reconnection UI exists

**Optional Enhancements**:
- [ ] Add connection quality indicator
- [ ] Add terminal resize handling
- [ ] Add terminal history persistence

---

## 3. CHECKPOINT 3: AI Provider Enablement

**Status**: ⏳ Pending  
**Estimated Time**: 12-16 hours  
**Owner**: Codex (backend services)

### 3.1 AI Provider Router Completion

**Priority**: 🟡 **HIGH** - Required for AI provider selection

**Current State**: Router exists but needs completion

**Location**: `orchestrator/worker/services/ai-providers/router.ts`

**Tasks**:
1. **Complete provider selection logic**:
   - Implement scoring algorithm
   - Add fallback mechanisms
   - Add provider availability checks

2. **Add provider registry**:
   - Create `orchestrator/worker/services/ai-providers/registry.ts`
   - Register all available providers (Jules, CLI agents, etc.)
   - Wire to router

3. **Add unit tests**:
   - Test selection logic
   - Test fallback mechanisms
   - Test provider-specific rules

**Checklist**:
- [ ] Router logic complete
- [ ] Provider registry created
- [ ] Unit tests pass
- [ ] Integration tests pass

### 3.2 Config Storage Implementation

**Priority**: 🟡 **HIGH** - Required for provider configuration

**Tasks**:
1. **Database schema** (if not exists):
   - `ai_provider_configs` table
   - `ai_provider_assignments` table
   - `ai_provider_executions` table

2. **Config service**:
   - Create `orchestrator/worker/services/ai-providers/configService.ts`
   - CRUD operations for provider configs
   - Config validation

3. **RPC entrypoint**:
   - Add methods to `AIProviderOps` entrypoint
   - Expose config management via RPC

**Checklist**:
- [ ] Database tables created
- [ ] Config service implemented
- [ ] RPC entrypoint updated
- [ ] Tests added

### 3.3 Assignment Orchestration

**Priority**: 🟡 **MEDIUM** - Required for multi-provider support

**Tasks**:
1. **Assignment service**:
   - Create `orchestrator/worker/services/ai-providers/assignmentService.ts`
   - Handle provider assignment logic
   - Track assignment status

2. **Integration with router**:
   - Router calls assignment service
   - Assignment service tracks executions
   - Results stored in database

**Checklist**:
- [ ] Assignment service created
- [ ] Router integration complete
- [ ] Database tracking works
- [ ] Tests added

### 3.4 Telemetry & Monitoring

**Priority**: 🟢 **LOW** - Nice to have

**Tasks**:
1. **Add telemetry hooks**:
   - Track provider selection
   - Track execution times
   - Track success/failure rates

2. **Add monitoring dashboard**:
   - Provider performance metrics
   - Usage statistics
   - Cost tracking

**Checklist**:
- [ ] Telemetry hooks added
- [ ] Monitoring dashboard created
- [ ] Metrics exported

---

## 4. CHECKPOINT 4: Extended Services

**Status**: ⏳ Pending  
**Estimated Time**: 8-12 hours  
**Owner**: Codex (backend), Cursor (frontend)

### 4.1 Analytics Routes Completion

**Priority**: 🟡 **MEDIUM** - Required for analytics features

**Current State**: Some routes exist, but not all are complete

**Tasks**:
1. **Complete analytics trends route**:
   - Location: `orchestrator/worker/api/routes/patchTrends.ts`
   - Add trend analysis
   - Add anomaly detection
   - Add comparison between periods

2. **Complete container monitoring routes**:
   - Location: `orchestrator/worker/api/routes/containerMonitoringRoutes.ts`
   - Add health endpoints
   - Add log aggregation
   - Add metrics endpoints

3. **Add tests**:
   - Unit tests for routes
   - Integration tests with real data

**Checklist**:
- [ ] All analytics routes complete
- [ ] Routes registered in `index.ts`
- [ ] Tests added
- [ ] Documentation updated

### 4.2 Specialist/Factory TODO Cleanup

**Priority**: 🟢 **LOW** - Cleanup task

**Tasks**:
1. **Review all TODO comments**:
   - Search for `TODO`, `FIXME`, `XXX` comments
   - Categorize by priority
   - Create tickets for high-priority items

2. **Remove obsolete TODOs**:
   - Delete TODOs for completed features
   - Update TODOs with current status

3. **Document remaining TODOs**:
   - Add to project tracker
   - Link to relevant issues

**Checklist**:
- [ ] All TODOs reviewed
- [ ] High-priority TODOs tracked
- [ ] Obsolete TODOs removed

---

## 5. PARTYSERVER/PARTYSOCKET INTEGRATION STRATEGY

**Status**: ✅ Backend Complete, ⏳ Frontend Polish Needed  
**Owner**: Codex (backend), Cursor (frontend)

### 5.1 Backend Integration (Complete ✅)

**Current State**:
- ✅ `TerminalServer` Durable Object exists
- ✅ `OpsMonitorBroadcastServer` Durable Object exists
- ✅ Routes configured (`setupTerminalRoutes`, `setupOpsBroadcastRoutes`)
- ✅ Durable Objects registered in `wrangler.jsonc`

**Remaining Backend Tasks**:
- [ ] Add error handling (see 2.3)
- [ ] Add reconnection logic (see 2.3)
- [ ] Add authentication (see 2.3)

### 5.2 Frontend Integration Strategy

**Current State**: Terminal component already uses PartySocket ✅

**Remaining Frontend Tasks**:

#### Ops Monitor Dashboard Feed

**Location**: `apps/base/src/components/diagnostics/OpsMonitorPanel.tsx`

**Implementation**:
```typescript
import { usePartySocket } from 'partysocket/react';

function OpsMonitorPanel() {
  const socket = usePartySocket({
    party: 'ops-monitor-broadcast',
    room: 'main',
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'scan-result') {
        // Update UI with scan results
      } else if (data.type === 'scan-progress') {
        // Update progress indicator
      }
    },
  });

  // ... rest of component
}
```

**Checklist**:
- [ ] `usePartySocket` hook integrated
- [ ] Scan results displayed in real-time
- [ ] Progress indicators work
- [ ] Connection status shown

#### Terminal Component Enhancements

**Current**: Basic PartySocket integration exists

**Enhancements**:
- [ ] Add connection quality indicator
- [ ] Add terminal resize handling
- [ ] Add terminal history persistence
- [ ] Add human-in-the-loop pause indicators

### 5.3 Human-in-the-Loop (HIL) Support

**Priority**: 🟡 **MEDIUM** - Required for task pauses

**Implementation**:

1. **Backend**: Add HIL message types to PartyServer:
   ```typescript
   // In TerminalServer or OpsMonitorBroadcastServer
   broadcastHILState(taskId: string, state: 'paused' | 'review' | 'resumed') {
     this.broadcast(JSON.stringify({
       type: 'hil-state',
       taskId,
       state,
       timestamp: Date.now()
     }));
   }
   ```

2. **Frontend**: Handle HIL messages:
   ```typescript
   socket.addEventListener('message', (event) => {
     const data = JSON.parse(event.data);
     if (data.type === 'hil-state') {
       if (data.state === 'paused') {
         // Freeze terminal, show pause indicator
       } else if (data.state === 'review') {
         // Show review prompt
       }
     }
   });
   ```

**Checklist**:
- [ ] HIL message types defined
- [ ] Backend broadcasts HIL state
- [ ] Frontend handles HIL messages
- [ ] UI indicators added

---

## 6. TESTING STRATEGY

**Priority**: 🔴 **CRITICAL** - Must pass before production

### 6.1 Test Execution Order

**Pre-requisites**:
1. ✅ Dependency fixes complete (Section 1.1)
2. ✅ Lint cleanup complete (Section 1.2)
3. ✅ TypeScript fixes complete (Section 1.3)

**Execution Order**:
```bash
# 1. Unit tests (fastest, catch basic issues)
cd orchestrator && npm run test:unit

# 2. Integration tests (medium speed, catch integration issues)
cd orchestrator && npm run test:integration

# 3. Type checking (catch type errors)
npm run typecheck:all

# 4. Linting (catch code quality issues)
npm run lint:all

# 5. Wrangler types (catch binding errors)
npm run types:all

# 6. Full problem check
npm run problems
```

### 6.2 Test Coverage Requirements

**Minimum Coverage**:
- Unit tests: > 70% coverage
- Integration tests: All critical paths covered
- E2E tests: Core user flows covered

**Critical Test Areas**:
- [ ] Ops monitoring routes
- [ ] Scheduled handlers
- [ ] AI provider router
- [ ] Terminal streaming
- [ ] Ops broadcast

### 6.3 CI/CD Integration

**GitHub Actions**:
- [ ] Add test step to CI workflow
- [ ] Add coverage reporting
- [ ] Add test failure notifications

**Checklist**:
- [ ] CI runs all tests
- [ ] Coverage reports generated
- [ ] Test failures block deployment

---

## 7. RISKS & MITIGATION

### 7.1 High Risk Items

#### Risk 1: Rollup Binary Compatibility
**Impact**: Tests cannot run  
**Mitigation**: Reinstall dependencies (Section 1.1)  
**Status**: Known issue with fix available

#### Risk 2: TypeScript Compilation Errors
**Impact**: Cannot deploy  
**Mitigation**: Fix imports and JSX config (Section 1.3)  
**Status**: In progress

#### Risk 3: Missing Test Coverage
**Impact**: Production bugs  
**Mitigation**: Complete test suite (Section 6)  
**Status**: Pending

### 7.2 Medium Risk Items

#### Risk 4: PartyServer Integration Issues
**Impact**: Real-time features don't work  
**Mitigation**: Thorough testing, fallback to polling  
**Status**: Backend complete, frontend needs polish

#### Risk 5: AI Provider Router Complexity
**Impact**: Provider selection fails  
**Mitigation**: Comprehensive tests, fallback providers  
**Status**: Pending implementation

### 7.3 Low Risk Items

#### Risk 6: Lint Debt
**Impact**: Code quality issues  
**Mitigation**: Auto-fix and manual cleanup (Section 1.2)  
**Status**: Known, fixable

---

## 8. MISSING PIECES & DOCUMENTATION

### 8.1 Documentation Tasks

**Priority**: 🟡 **MEDIUM** - Required for production

**Tasks**:
1. **Production Deployment Guide**:
   - Environment variable setup
   - Secret configuration
   - Database migration steps
   - Deployment checklist

2. **API Documentation**:
   - OpenAPI/Swagger specs
   - Route documentation
   - RPC entrypoint documentation

3. **Architecture Documentation**:
   - PartyServer integration guide
   - AI provider selection guide
   - Testing guide

**Checklist**:
- [ ] Production deployment guide created
- [ ] API documentation complete
- [ ] Architecture docs updated

### 8.2 Deployment Checklist

**Pre-Deployment**:
- [ ] All tests pass (`npm run problems`)
- [ ] All secrets configured
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Monitoring configured

**Post-Deployment**:
- [ ] Health checks passing
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
- [ ] Support contacts listed

---

## 9. HUMAN-IN-THE-LOOP CONSIDERATIONS

### 9.1 Task Pause Scenarios

**When to Pause**:
- User explicitly pauses task
- Error requires human review
- AI provider selection needs confirmation
- Cost threshold exceeded

**Implementation**:
- Backend: Set task status to `paused` or `review`
- Broadcast HIL state via PartyServer
- Frontend: Show pause indicator, disable actions

### 9.2 Review Prompts

**When to Prompt**:
- High-cost operations
- Destructive actions
- Provider selection overrides
- Security-sensitive operations

**Implementation**:
- Backend: Return `requires_review` status
- Frontend: Show confirmation modal
- User: Approve or reject

### 9.3 Recovery Procedures

**After Pause**:
- User can resume from checkpoint
- State preserved in database
- Terminal state restored
- Progress indicators updated

---

## 10. EXECUTION CHECKLIST

### Phase 1: Immediate Actions (Week 1)
- [ ] Fix rollup dependencies (1.1)
- [ ] Fix TypeScript JSX config (1.1)
- [ ] Reinstall all dependencies (1.1)
- [ ] Fix lint issues (1.2)
- [ ] Fix TypeScript imports (1.3)
- [ ] Verify `npm run problems` passes

### Phase 2: Checkpoint 2 (Week 1-2)
- [ ] Complete ops monitoring route tests (2.1)
- [ ] Complete integration tests (2.1)
- [ ] Fix scheduled handler (2.2)
- [ ] Wire ORCHESTRATOR_OPS_MONITOR (2.2)
- [ ] Polish PartyServer terminal (2.3)

### Phase 3: Checkpoint 3 (Week 2)
- [ ] Complete AI provider router (3.1)
- [ ] Implement config storage (3.2)
- [ ] Implement assignment orchestration (3.3)
- [ ] Add telemetry (3.4)

### Phase 4: Checkpoint 4 (Week 2-3)
- [ ] Complete analytics routes (4.1)
- [ ] Cleanup specialist/factory TODOs (4.2)

### Phase 5: Final Polish (Week 3)
- [ ] Complete frontend PartyServer integration (5.2)
- [ ] Add HIL support (5.3)
- [ ] Complete test coverage (6)
- [ ] Create documentation (8.1)
- [ ] Final deployment checklist (8.2)

---

## 11. SUCCESS CRITERIA

**Production-Ready Definition**:
- ✅ All tests pass (`npm run problems` shows 0 errors)
- ✅ All critical checkpoints complete
- ✅ Documentation complete
- ✅ Deployment checklist verified
- ✅ Monitoring configured
- ✅ Rollback plan documented

**Go/No-Go Decision Points**:
- **Go**: All Phase 1-4 complete, tests pass, docs complete
- **No-Go**: Critical blockers remain, tests failing, missing docs

---

## 12. AGENT ASSIGNMENTS

### Codex (Backend/Services)
- Section 1.1: Dependency fixes
- Section 2: Ops monitoring, cron handlers
- Section 3: AI provider enablement
- Section 4.1: Analytics routes
- Section 5.1: PartyServer backend polish
- Section 6: Test implementation

### Cursor (Large Code Edits)
- Section 1.2: Lint cleanup (auto-fix + manual)
- Section 1.3: TypeScript import fixes
- Section 2.2: Route updates for RPC
- Section 4.2: TODO cleanup
- Section 5.2: Frontend PartyServer integration
- Section 8: Documentation

---

## APPENDIX: Quick Reference Commands

```bash
# Fix dependencies
cd orchestrator && rm -rf node_modules package-lock.json && npm install

# Run tests
cd orchestrator && npm run test:unit
cd orchestrator && npm run test:integration

# Check problems
npm run problems

# Lint fix
npm run lint:all:fix

# Type check
npm run typecheck:all
```

---

**Next Review**: After Phase 1 (Immediate Actions) complete
