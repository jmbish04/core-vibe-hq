<!-- fd3caf7b-7c4a-45f0-8ab9-70dbc02693e5 7ed1ef0d-6bbd-4fe1-a8c7-abe71b0c9946 -->
# Complete Core Vibe HQ Implementation Plan

## Current State Analysis

- **Total Tasks**: 38 main tasks with numerous subtasks
- **Status**: Foundation (Tasks 1-7) and API/Migration epics (Tasks 36-38) are complete; Tasks 8-35 remain open
- **Completed**: Ten main tasks marked "done" with supporting subtasks closed
- **Critical Path**: Tasks 1-2 (foundational) → Tasks 3-7 (core services) → Tasks 8-38 (APIs and integrations)

## Ownership Overview

- **Codex**: Ops monitoring build-out (Tasks 12-14, 29), AI provider enablement (Tasks 18-21, 32-33)
- **Cursor**: Scheduled automation & integrations (Tasks 15-17, 30-31), Extended services & entrypoints (Tasks 8-11, 22-28, 34-35)
- **Collaborative Touchpoints**: Configuration updates and shared bindings (Tasks 26-27) will be coordinated as each owner’s work lands.

## Phase 1: Foundation Layer (Critical Path - Must Complete First)

### Task 1: Create Shared Contracts Module

**Status**: completed | **Priority**: high | **Dependencies**: none

**Implementation Steps**:

1. Create `@shared/contracts/` directory structure
2. Implement `contracts.ts` with Zod schemas:

- `PatchOperationSchema` - individual patch operations
- `PatchBatchSchema` - batch operations
- `PatchEventSchema` - patch events
- `WebSocketMessage` - WebSocket communication types

3. Create `patchEvents.ts` with event type constants
4. Create `messages.ts` with WebSocket message definitions
5. Add comprehensive JSDoc comments
6. Write unit tests for all schemas

**Files to Create**:

- `@shared/contracts/contracts.ts`
- `@shared/contracts/patchEvents.ts`
- `@shared/contracts/messages.ts`
- `@shared/contracts/index.ts`
- `tests/contracts/contracts.test.ts`

### Task 2: Database Schema Extensions

**Status**: completed | **Priority**: high | **Dependencies**: [1]

**Implementation Steps**:

1. Add Kysely table definitions to `orchestrator/worker/database/schema.ts`:

- `patchEvents` table
- `deliveryReports` table
- `aiProviderAssignments`, `aiProviderExecutions`, `aiProviderConfigs` tables
- `workerLogs`, `buildLogs`, `opsIssues`, `opsScans` tables

2. Create SQL migration files:

- `005_patch_events.sql`
- `006_delivery_reports.sql`
- `007_ai_provider_tables.sql`
- `025_ops_monitoring.sql`

3. Run `npm run db:generate` to generate migrations
4. Write integration tests for migrations

**Files to Modify**:

- `orchestrator/worker/database/schema.ts`

**Files to Create**:

- `orchestrator/migrations/005_patch_events.sql`
- `orchestrator/migrations/006_delivery_reports.sql`
- `orchestrator/migrations/007_ai_provider_tables.sql`
- `orchestrator/migrations/025_ops_monitoring.sql`

## Phase 2: Core Patch Management System

### Task 3: Patch Manager Python Script

**Status**: completed | **Priority**: high | **Dependencies**: [1, 2]

**Completed Deliverables**:

- Integration tests validating end-to-end patch flows
- Bash wrapper tests using the bats framework
- `.mission_control/tasks.json` schema validation baked into `patch_manager.py`
- Performance sweeps covering large patch batches

**Implementation Notes**:

- Integration tests live in `tests/integration/patch_manager/`
- Bash wrapper verification uses `tests/bash/patchctl.test.sh`
- Schema validation extends the mission control task definition handling

### Task 5: Patch Services Directory

**Status**: completed | **Priority**: high | **Dependencies**: [1, 2, 3]

**Implementation Steps**:

1. Create `orchestrator/worker/services/patch/` directory
2. Implement `patchRunner.ts` - patch execution logic
3. Implement `coordResolver.ts` - marker finding and resolution
4. Implement `patchBridge.ts` - factory output conversion
5. Implement `d1Logger.ts` - database logging
6. Create index file for exports
7. Write comprehensive unit and integration tests

**Files to Create**:

- `orchestrator/worker/services/patch/patchRunner.ts`
- `orchestrator/worker/services/patch/coordResolver.ts`
- `orchestrator/worker/services/patch/patchBridge.ts`
- `orchestrator/worker/services/patch/d1Logger.ts`
- `orchestrator/worker/services/patch/index.ts`
- `tests/services/patch/*.test.ts`

### Task 6: WebSocket Hub Implementation

**Status**: completed | **Priority**: high | **Dependencies**: [1, 5]

**Implementation Steps**:

1. Create `orchestrator/worker/services/websocket/websocketHub.ts`
2. Implement connection management with WebSocketPair API
3. Add broadcast functionality for patch events
4. Implement connection lifecycle management
5. Add error handling and cleanup
6. Write unit and integration tests

**Files to Create**:

- `orchestrator/worker/services/websocket/websocketHub.ts`
- `orchestrator/worker/services/websocket/index.ts`
- `tests/services/websocket/websocketHub.test.ts`

### Task 7: PatchOps Entrypoint

**Status**: completed | **Priority**: high | **Dependencies**: [1, 5, 6]

**Implementation Steps**:

1. Create `orchestrator/worker/entrypoints/patch.ts`
2. Implement `PatchOps` class extending `BaseWorkerEntrypoint`
3. Implement `applyPatches` RPC method
4. Add HTTP route `POST /api/patches/apply`
5. Update `@shared/base/wrangler.base.jsonc` with `ORCHESTRATOR_PATCH` binding
6. Write comprehensive tests

**Files to Create**:

- `orchestrator/worker/entrypoints/patch.ts`
- `tests/entrypoints/patch.test.ts`

**Files to Modify**:

- `@shared/base/wrangler.base.jsonc` (add service binding)
- `orchestrator/worker/entrypoints/index.ts`

## Phase 3: Factory Infrastructure

### Task 4: Factory Base Dockerfile

**Status**: completed | **Priority**: high | **Dependencies**: [3]

**Completed Deliverables**:

- Container monitoring scripts integrated into the base image
- Local SQLite dependencies removed from Dockerfile and storage layer
- Multi-API monitoring across REST, WebSocket, and RPC endpoints

**Implementation Notes**:

- Updates landed in `@shared/factory-templates/factory-base.Dockerfile` and `@shared/container/storage.ts`
- Image rebuild verified orchestrator integration and telemetry hooks

## Phase 4: API Implementations

### Task 36: Core Analytics API (Epic)

**Status**: completed | **Priority**: high | **Dependencies**: [1, 2, 8, 9]

**Implementation Steps**:

1. Create `orchestrator/worker/api/routes/analytics.ts`
2. Implement unified analytics router with:

- `GET /analytics/logs` - query patch events
- `GET /analytics/stats` - aggregated statistics
- `GET /analytics/trends` - trend analysis

3. Create analytics response types in `@shared/contracts/analytics.ts`
4. Register routes in `orchestrator/worker/api/routes/index.ts`
5. Write comprehensive tests

**Files to Create**:

- `orchestrator/worker/api/routes/analytics.ts`
- `@shared/contracts/analytics.ts`
- `tests/api/routes/analytics.test.ts`

**Files to Modify**:

- `orchestrator/worker/api/routes/index.ts`

### Task 37: Ops & Integrations API (Epic)

**Status**: completed | **Priority**: high | **Dependencies**: [1, 2, 6, 8, 15, 17]

**Implementation Steps**:

1. Create `orchestrator/worker/api/routes/ops-integrations.ts`
2. Implement unified router with:

- Delivery reports endpoints
- GitHub webhook handler
- Operations scan endpoints

3. Create `GitHubIntegrationService` in `orchestrator/worker/services/integrations/`
4. Extend `OpsMonitorService` with RPC methods
5. Update scheduled handler integration
6. Write comprehensive tests

**Files to Create**:

- `orchestrator/worker/api/routes/ops-integrations.ts`
- `orchestrator/worker/services/integrations/githubService.ts`
- `tests/api/routes/ops-integrations.test.ts`

**Files to Modify**:

- `orchestrator/worker/services/ops/opsMonitorService.ts`
- `orchestrator/worker/index.ts` (scheduled handler)

## Phase 5: Migration Automation

### Task 38: Migration Automation Script

**Status**: completed | **Priority**: high | **Dependencies**: [1, 3, 19, 21, 30]

**Implementation Steps**:

1. Create `migrate_staging.py` with `StagingMigrator` class
2. Implement manifest loading (JSON/YAML)
3. Implement deterministic file copying
4. Implement import path updates with regex
5. Integrate AI-driven D1-to-RPC refactoring
6. Add automated validation (TypeScript, linting)
7. Generate comprehensive migration reports
8. Create sample `migration_manifest.yaml`
9. Write comprehensive tests

**Files to Create**:

- `migrate_staging.py`
- `migration_manifest.yaml` (sample)
- `tests/migration/migrate_staging.test.py`

## Phase 6: Remaining Tasks (Tasks 8-35)

These tasks cover various services, entrypoints, and integrations. To keep momentum, drive them through the following checkpoints (with owners noted):

1. **Ops Monitoring Foundation (Tasks 12-14, 29)** *(Owner: Codex)* – finalize telemetry ingestion, D1 storage wiring, and alert surfaces required by the Ops API delivered in Task 37. Ship smoke tests and dashboards alongside the service work.

- *Status*: Delivery report REST/service complete; OpsMonitor service + RPC entrypoint + binding added; telemetry tests still pending.

2. **Scheduled Automation & Integrations (Tasks 15-17, 30-31)** *(Owner: Cursor)* – implement scheduled patch rollouts, ops scans, and external integration hooks so orchestrator workflows run without manual triggers. Confirm bindings in `@shared/base/wrangler.base.jsonc` and end-to-end schedule execution.

- *Subtasks*:
- Finalize `ORCHESTRATOR_OPS_MONITOR` RPC exposure: ensure entrypoint is registered, bindings propagate through shared/staging wrangler configs, and downstream workers use it instead of direct DB write access.
- Harden ops automation routes: add `/api/ops/scan` regression tests covering happy path, invalid scope, and failure handling; verify they hit `OpsMonitorService` directly.
- Polish cron + worker wiring: document the dual cron cadence, add metrics/log assertions, and backfill a Vitest harness around the scheduled handler to prove it invokes `runScan` with both scopes.
- Close out linting/setup tasks (30-31 pre-reqs) that block deployments: baseline ESLint/Prettier config, clean lint debt, wire CI/pre-commit, and ensure `npm run lint:all` passes.
- *Success Criteria*: All automation routes and scheduled handlers are test-covered, no direct DB access outside the service layer, and lint/format workflows pass cleanly in CI.

3. **AI Provider Enablement (Tasks 18-21, 32-33)** *(Owner: Codex)* – add provider config storage, assignment orchestration, and execution telemetry. Ensure contracts align with the shared schemas from Task 1 and database tables from Task 2.
4. **Extended Services & Entry Points (Tasks 8-11, 22-28, 34-35)** *(Owner: Cursor)* – finish the remaining service entrypoints, analytics enrichments, and supporting utilities. Address them in thin vertical slices so each deploys with tests and Wrangler bindings.

- *Subtasks*:
- Terminal observability: deliver the xterm.js pipeline (shared backend server, terminal proxy route, UI component, diagnostics integration) with smoke tests.
- Remaining analytics/ops APIs: wrap outstanding routes (e.g., analytics trends, container monitoring) with unit/integration tests and update route index exports.
- Factory/service hardening: audit lingering TODOs in factory templates and specialist workers, replacing placeholder comments with implemented logic or tracked follow-up tickets.
- *Success Criteria*: Each new surface ships with route/unit coverage, route registration is reflected in `index.ts`, and UI counterparts are wired into diagnostics panels without TypeScript or lint regressions.

Track each checkpoint as a mini-epic: open subtasks for the concrete routes, services, and tests involved so progress stays visible.

## Implementation Order Summary

1. **Week 1**: Tasks 1-2 (Foundation)
2. **Week 2**: Complete Task 3, start Tasks 5-7 (Core Patch System)
3. **Week 3**: Complete Tasks 5-7, Task 4 (Core Services + Factory)
4. **Week 4**: Tasks 36-37 (APIs)
5. **Week 5**: Task 38 (Migration) + remaining tasks 8-35

## Critical Success Factors

1. **Dependency Management**: Always complete dependencies before dependent tasks
2. **Testing**: Write tests alongside implementation, not after
3. **Type Safety**: Use proper TypeScript types, never `as any`
4. **Database Access**: Only orchestrator has D1 bindings; apps use RPC
5. **Problem Resolution**: Run `npm run problems` before marking tasks complete
6. **Service Bindings**: Update `@shared/base/wrangler.base.jsonc` for all new entrypoints

## Validation Checklist

Before marking any task complete:

- [ ] All TypeScript errors resolved (no `as any` or `@ts-ignore`)
- [ ] All linting errors resolved
- [ ] `npm run problems` passes
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing (where applicable)
- [ ] Service bindings configured correctly
- [ ] Documentation updated
- [ ] No regressions introduced

### To-dos

- [x] Complete Task 1: Create Shared Contracts Module with Zod schemas, event types, and WebSocket message definitions
- [x] Complete Task 2: Database Schema Extensions - Add all Kysely table definitions and SQL migrations
- [x] Complete Task 3: Finish remaining patch manager subtasks (integration tests, bash wrapper tests, schema validation)
- [x] Complete Task 4: Factory Base Dockerfile - remove SQLite, implement multi-API monitoring
- [x] Complete Task 5: Create Patch Services Directory with patchRunner, coordResolver, patchBridge, and d1Logger
- [x] Complete Task 6: WebSocket Hub Implementation with connection management and broadcasting
- [x] Complete Task 7: PatchOps Entrypoint with RPC methods and HTTP routes
- [x] Complete Task 36: Core Analytics API with unified router for logs, stats, and trends
- [x] Complete Task 37: Ops & Integrations API with delivery reports, GitHub webhooks, and operations scanning
- [x] Complete Task 38: Migration Automation Script with manifest-driven Python migration tool
- [x] Complete Task 15: Scheduled Cron Handler Implementation (cron triggers added, tests created)
- [x] Complete Task 16: AI Provider Router Implementation (provider selection logic, rules, manual overrides)
- [x] Complete Task 17: Secret Service Implementation (secure credential retrieval, container env injection)
- [x] Complete Task 18: CLI Agent Service Implementation (container execution, env injection, output parsing)
- [x] Complete Task 19: AIProviderOps Entrypoint Implementation (provider assignment, execution, status checking)
- [x] Complete Task 20: Patch Processor Service Implementation (validation, processing, logging, remediation)
- [x] Complete Task 22: Orchestrator Patch Events Endpoint Implementation (event processing, logging, broadcasting, task updates)
- [x] Complete Task 9: Patch Logs API Implementation (querying patch events with filtering, pagination, sorting)
- [x] Complete Task 10: Patch Stats API Implementation (aggregated statistics, performance metrics, error analysis)
- [x] Complete Task 11: Patch Trends API Implementation (trend analysis, anomaly detection, comparisons)
- [ ] Complete remaining tasks 8, 12-14, 21, 23-35 covering operations monitoring and additional services