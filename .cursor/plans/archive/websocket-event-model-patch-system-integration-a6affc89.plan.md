<!-- a6affc89-5d88-4144-a49f-0413c8e6d067 21655620-fd76-49e1-898f-110974ba52d5 -->
# WebSocket Event Model & Patch System Integration

This plan implements the complete patch governance system with WebSocket event broadcasting, D1 logging, analytics, delivery reports, and ops monitoring as specified in `docs/vibe-ecosystem-setup-prompts/websocket_event_model.md`.

## Phase 1: Foundation - Shared Contracts & Schemas

### 1.1 Create Shared Contracts Module

**Location**: Create `@shared/contracts/` directory at repo root

**Files to create:**

- `@shared/contracts/contracts.ts` - All Zod schemas for WebSocket messages, patch operations, and factory contracts
- `@shared/contracts/patchEvents.ts` - Patch event types and constants
- `@shared/contracts/messages.ts` - WebSocket message type definitions

**Key schemas to include:**

- `WebSocketMessageResponses` and `WebSocketMessageRequests` constants
- `PatchEvents` constants (PATCH_REQUESTED, PATCH_APPLIED, etc.)
- `PatchOperationSchema` (discriminated union for replace-block, insert-before, insert-after, append, prepend)
- `PatchBatchSchema`
- `PatchEventSchema`
- All existing factory schemas (TemplateSelectionSchema, FileOutputSchema, PhaseConceptSchema, etc.)

**Integration points:**

- Update `orchestrator/worker/packages/shared-types/` to import from `@shared/contracts`
- Ensure factories can import patch schemas without duplication

### 1.2 Update Database Schema

**Location**: `orchestrator/worker/database/schema.ts`

**Add to schema:**

- `PatchEventsTable` interface with Kysely types
- `DeliveryReportsTable` interface (if not already present)
- Add to `Database` interface

**Create migration:**

- `orchestrator/migrations/005_patch_events.sql` - Create `patch_events` table with all required columns
- `orchestrator/migrations/006_delivery_reports.sql` - Create `delivery_reports` table (if not exists)
- `orchestrator/migrations/025_ops_monitoring.sql` - Create ops monitoring tables (worker_logs, build_logs, ops_issues, ops_scans)

## Phase 2: Patch Operations Core

### 2.1 Create Patch Runner Service

**Location**: `orchestrator/worker/services/patch/patchRunner.ts`

**Functionality:**

- Execute `patchctl` commands safely (Note: Cloudflare Workers can't execute shell commands directly - this may need to be adapted or handled via service binding to a worker that can execute patchctl)
- Stream patch results
- Return `PatchEvent[]` array
- Handle errors gracefully

**Note**: Since Workers can't execute shell commands, this may need:

- A service binding to a worker that can execute patchctl
- Or an HTTP API that executes patchctl
- Or a Durable Object that manages patch execution

### 2.2 Create Coordinate Resolver

**Location**: `orchestrator/worker/services/patch/coordResolver.ts`

**Functionality:**

- `resolveCoordsByMarker(filePath, markerRegex)` - Find placeholder markers in files
- Return `{ mode: "new" }` or `{ mode: "existing", span: {...} }` or `{ mode: "existing", insertBeforeLine: number }`
- Support template markers like `###FINAL_MILE_PROMPT__...###`

### 2.3 Create Patch Bridge Adapter

**Location**: `orchestrator/worker/services/patch/patchBridge.ts` (or in shared if used by factories)

**Functionality:**

- `filesToPatches(phase, coordResolver)` - Convert `PhaseImplementationSchemaType` to `PatchBatch`
- Handle new files vs existing files
- Map file operations to patch operations

### 2.4 Create PatchOps Entrypoint

**Location**: `orchestrator/worker/entrypoints/patch.ts`

**Functionality:**

- RPC entrypoint class `PatchOps extends WorkerEntrypoint`
- Method: `applyPatches(batch: unknown)` - Validates PatchBatch, runs patchRunner, logs to D1, broadcasts via WebSocket
- HTTP route: `POST /api/patches/apply` - Same functionality via REST

**Integration:**

- Uses `patchRunner.ts` for execution
- Uses `d1Logger.ts` for logging
- Uses `websocketHub.ts` for broadcasting
- Validates with Zod schemas from `@shared/contracts`

## Phase 3: WebSocket Broadcasting & Logging

### 3.1 Create WebSocket Hub

**Location**: `orchestrator/worker/services/websocket/websocketHub.ts`

**Functionality:**

- `registerConnection(ws: WebSocket)` - Track connected clients
- `broadcast(event: PatchBroadcast)` - Send patch events to all connected clients
- Handle connection cleanup on close

**Integration:**

- Works with Cloudflare's WebSocketPair
- Stores connections in memory (Set<WebSocket>)
- Removes failed connections automatically

### 3.2 Create WebSocket Routes

**Location**: `orchestrator/worker/api/routes/websocket.ts`

**Functionality:**

- `GET /ws` - WebSocket upgrade endpoint
- Accept WebSocket connections
- Register with websocketHub
- Send connection confirmation

### 3.3 Create D1 Logger

**Location**: `orchestrator/worker/services/patch/d1Logger.ts`

**Functionality:**

- `logPatchEvent(env: Env, evt: PatchEvent)` - Insert patch event into D1
- Uses Drizzle/Kysely for type safety
- Handles errors gracefully

### 3.4 Update PatchOps to Wire Everything

**Location**: `orchestrator/worker/entrypoints/patch.ts`

**Integration:**

- Call `logPatchEvent()` after patch execution
- Call `broadcast()` with PatchEvent
- Validate events with `PatchEventSchema`

## Phase 4: API Routes & Analytics

### 4.1 Create Patch Logs API

**Location**: `orchestrator/worker/api/routes/patchLogs.ts`

**Functionality:**

- `GET /api/patches/logs` - Query patch_events table
- Supports filtering: `task_id`, `file`, `search`, `limit`, `offset`, `order`
- Returns paginated results

### 4.2 Create Patch Stats API

**Location**: `orchestrator/worker/api/routes/patchStats.ts`

**Functionality:**

- `GET /api/patches/stats` - Aggregated metrics
- Daily counts, success rate by factory, operation distribution, error summary
- Supports date range filtering (`from`, `to`)
- Uses Kysely for queries

### 4.3 Create Patch Trends API

**Location**: `orchestrator/worker/api/routes/patchTrends.ts`

**Functionality:**

- `GET /api/patches/trends` - Trend analysis
- Grouping modes: `weekly`, `phase`, `order`
- Computes success rates, timelines, patch counts
- Uses Kysely with proper type safety

### 4.4 Create JSON Response Utility

**Location**: `orchestrator/worker/utils/jsonResponse.ts`

**Functionality:**

- `jsonResponse(data, status)` - Consistent JSON response helper
- Used by all API routes

## Phase 5: Delivery Reports Integration

### 5.1 Create Delivery Reports Service

**Location**: `orchestrator/worker/services/delivery/deliveryReportsService.ts`

**Functionality:**

- `generateReports()` - Aggregate patch trends by order_id, generate Markdown reports
- `getLatestReports(limit)` - Fetch recent reports
- `getReport(orderId)` - Get report for specific order
- Uses Kysely for database queries
- Generates both Markdown (`report_md`) and JSON (`report_json`)

### 5.2 Create Delivery Reports Entrypoint

**Location**: `orchestrator/worker/entrypoints/deliveryReports.ts`

**Functionality:**

- RPC methods: `generateAll()`, `getRecent(limit)`, `getByOrder(orderId)`
- Uses `DeliveryReportsService`

### 5.3 Create Delivery Reports API Route

**Location**: `orchestrator/worker/api/routes/deliveryReports.ts`

**Functionality:**

- `GET /api/delivery/reports` - List reports
- `GET /api/delivery/reports?order_id=X` - Get specific report
- `GET /api/delivery/reports?generate=true` - Trigger report generation

### 5.4 Update Service Bindings

**Location**: `@shared/base/wrangler.base.jsonc`

**Add binding:**

- `ORCHESTRATOR_DELIVERY` - Service binding to `DeliveryReportsEntrypoint`

## Phase 6: Ops Monitoring System

### 6.1 Create Ops Monitor Service

**Location**: `orchestrator/worker/services/ops/OpsMonitorService.ts`

**Functionality:**

- `ingestLogs(scope)` - Fetch logs from `CORE_CLOUDFLARE_API` and `CORE_GITHUB_API`, persist to D1
- `analyzeAndFile(scope)` - Analyze logs with LLM, create GitHub issues, persist to ops_issues
- `analyzeWithLLM(inputs)` - Stub for LLM analysis (can be enhanced later)
- `openGitHubIssue(title, body)` - Create GitHub issues via IntegrationsModule

### 6.2 Create Ops Routes

**Location**: `orchestrator/worker/api/routes/ops.ts`

**Functionality:**

- `POST /api/ops/scan` - Trigger scan (ingestLogs + analyzeAndFile)
- `GET /api/ops/issues` - List ops issues
- `POST /api/ops/issues/:id/claim` - Claim an issue (mark in_progress, comment on GitHub)
- `GET /api/ops/summary` - Aggregate counts by status/severity

### 6.3 Create Ops Scan Entrypoint

**Location**: `orchestrator/worker/entrypoints/opsScan.ts`

**Functionality:**

- RPC method: `scan(scope)` - Trigger ops monitoring scan

### 6.4 Add Scheduled Cron Handler

**Location**: `orchestrator/worker/index.ts`

**Functionality:**

- Export `scheduled` handler for nightly cron job
- Runs `OpsMonitorService.ingestLogs("full")` and `analyzeAndFile("full")`

### 6.5 Update Wrangler Config

**Location**: `orchestrator/wrangler.jsonc`

**Add:**

- `triggers.crons: ["0 09 * * *"]` - Daily at 09:00 UTC
- Service bindings: `CORE_CLOUDFLARE_API`, `CORE_GITHUB_API` (if not already present)
- Environment variable: `LLM_MODEL`

## Phase 7: GitHub Integration Module

### 7.1 Create Integrations Module

**Location**: `orchestrator/worker/integrations/module.ts`

**Functionality:**

- `IntegrationsModule` class with methods:
- `listRepoIssues(repo)`
- `listRepoPRs(repo)`
- `createIssue(title, body, repo)`
- `commentOnIssue(number, body, repo)`
- `updateIssueState(number, state, repo)`
- Uses `CORE_GITHUB_API` service binding
- Uses `env.GITHUB_REPO` for default repo

### 7.2 Create GitHub Tools Registry

**Location**: `orchestrator/worker/tools/githubTools.ts`

**Functionality:**

- `getGitHubTools(env)` - Returns tool registry for orchestrator agents
- Exposes GitHub operations as tools

### 7.3 Update OpsMonitorService

**Location**: `orchestrator/worker/services/ops/OpsMonitorService.ts`

**Refactor:**

- Replace internal GitHub fetch calls with `IntegrationsModule`
- Use `integrations.createIssue()` instead of direct fetch

## Phase 8: Factory Integration & Migration

### 8.1 Update Factories to Use Shared Contracts

**Location**: All factory workers (`apps/agent-factory`, `apps/ui-factory`, etc.)

**Changes:**

- Import patch schemas from `@shared/contracts` instead of local definitions
- Remove duplicate event type definitions
- Use `PatchBatch` type when sending patch requests

### 8.2 Create Patch Adapter for Factories

**Location**: `@shared/adapters/patchBridge.ts` (or in each factory as needed)

**Functionality:**

- `filesToPatches()` function to convert factory outputs to patch batches
- Coordinate resolver integration

### 8.3 Update Factory-to-Orchestrator Calls

**Location**: Factory workers

**Changes:**

- Replace direct file writes with `PatchBatch` requests to orchestrator
- Use `ORCHESTRATOR_PATCH` service binding (if RPC) or HTTP `/api/patches/apply`
- Handle patch event responses

### 8.4 Add Service Bindings

**Location**: `@shared/base/wrangler.base.jsonc`

**Add bindings:**

- `ORCHESTRATOR_PATCH` - Service binding to `PatchOps` entrypoint
- `ORCHESTRATOR_DELIVERY` - Service binding to `DeliveryReportsEntrypoint`
- `ORCHESTRATOR_OPS` - Service binding to `OpsScanEntrypoint`

## Phase 9: Testing & Validation

### 9.1 Database Migrations

- Run all migrations: `npm run db:migrate:local` then `npm run db:migrate:remote`
- Verify all tables created correctly

### 9.2 Type Checking

- Run `npm run typecheck:all` - Ensure no TypeScript errors
- Fix any type mismatches

### 9.3 Linting

- Run `npm run lint:all` - Ensure no linting errors

### 9.4 Integration Testing

- Test patch application flow end-to-end
- Test WebSocket broadcasting
- Test delivery report generation
- Test ops monitoring scan

## Implementation Notes

### Critical Considerations

1. **Patch Execution**: Cloudflare Workers cannot execute shell commands. The `patchRunner.ts` service needs to either:

- Use a service binding to a worker that can execute patchctl
- Use an HTTP API endpoint that executes patchctl
- Use a Durable Object for patch execution
- Or patch_manager.py needs to POST events directly to orchestrator

2. **Database Access**: Only orchestrator has direct D1 access. All patch logging must go through orchestrator.

3. **WebSocket Connections**: Cloudflare Workers support WebSocket via `WebSocketPair`. The hub should manage connections in memory.

4. **Service Bindings**: All factories must use service bindings to communicate with orchestrator, not direct HTTP calls (unless needed for external access).

5. **Type Safety**: All schemas use Zod for validation. All database operations use Kysely for type safety.

### Files to Create/Modify Summary

**New Files (30+):**

- `@shared/contracts/contracts.ts`
- `@shared/contracts/patchEvents.ts`
- `orchestrator/worker/services/patch/patchRunner.ts`
- `orchestrator/worker/services/patch/coordResolver.ts`
- `orchestrator/worker/services/patch/patchBridge.ts`
- `orchestrator/worker/services/patch/d1Logger.ts`
- `orchestrator/worker/services/websocket/websocketHub.ts`
- `orchestrator/worker/services/delivery/deliveryReportsService.ts`
- `orchestrator/worker/services/ops/OpsMonitorService.ts`
- `orchestrator/worker/integrations/module.ts`
- `orchestrator/worker/tools/githubTools.ts`
- `orchestrator/worker/entrypoints/patch.ts`
- `orchestrator/worker/entrypoints/deliveryReports.ts`
- `orchestrator/worker/entrypoints/opsScan.ts`
- `orchestrator/worker/api/routes/patchLogs.ts`
- `orchestrator/worker/api/routes/patchStats.ts`
- `orchestrator/worker/api/routes/patchTrends.ts`
- `orchestrator/worker/api/routes/deliveryReports.ts`
- `orchestrator/worker/api/routes/ops.ts`
- `orchestrator/worker/api/routes/websocket.ts`
- `orchestrator/worker/utils/jsonResponse.ts`
- `orchestrator/migrations/005_patch_events.sql`
- `orchestrator/migrations/006_delivery_reports.sql`
- `orchestrator/migrations/025_ops_monitoring.sql`

**Modified Files:**

- `orchestrator/worker/database/schema.ts` - Add new table interfaces
- `orchestrator/worker/index.ts` - Add scheduled handler, register new routes
- `orchestrator/wrangler.jsonc` - Add cron triggers, service bindings
- `@shared/base/wrangler.base.jsonc` - Add orchestrator service bindings
- Factory workers - Update to use shared contracts

This plan provides a complete roadmap for implementing the entire WebSocket event model and patch system as specified in the document.

### To-dos

- [ ] Phase 1: Create shared contracts module with Zod schemas for WebSocket messages, patch operations, and factory contracts
- [ ] Phase 1: Update database schema with PatchEventsTable, DeliveryReportsTable, and ops monitoring tables
- [ ] Phase 2: Create patchRunner service (note: adapt for Workers execution constraints)
- [ ] Phase 2: Create coordResolver service for placeholder detection
- [ ] Phase 2: Create PatchOps entrypoint with RPC and HTTP interfaces
- [ ] Phase 3: Create WebSocket hub for broadcasting patch events
- [ ] Phase 3: Create D1 logger service for patch events
- [ ] Phase 3: Wire PatchOps to use WebSocket broadcasting and D1 logging
- [ ] Phase 4: Create API routes for patch logs, stats, and trends
- [ ] Phase 5: Create delivery reports service and entrypoint with patch trend integration
- [ ] Phase 6: Create ops monitoring service with nightly cron job
- [ ] Phase 7: Create GitHub integrations module and update ops monitoring to use it
- [ ] Phase 8: Update factories to use shared contracts and send patch batches
- [ ] Phase 9: Run migrations, type checking, linting, and integration tests