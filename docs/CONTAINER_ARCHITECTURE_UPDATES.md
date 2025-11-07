# Container Architecture Updates Summary

This document summarizes all critical architecture updates and requirements based on the review of Vibe SDK infrastructure.

## Confirmation: Standardized Infrastructure

**YES** - The standardized container, worker, and worker frontend (React/shadcn) from Vibe SDK examples will be:
- Applied to all downstream workers (factories, specialists)
- Shared via `@shared` infrastructure
- Used as base templates for all new workers

## Task Updates Summary

### Task 34: Python Migration Script (NEW - PREREQUISITE)

**Status**: Created as prerequisite task

**Purpose**: Automate migration of Vibe SDK code to `@shared`

**Requirements**:
1. Stage folder structure under `@shared/`
2. Copy files from STAGING locations
3. Adjust import paths using find/replace
4. Generate migration report
5. Create backup/rollback capability
6. Validate copied files

**See**: `docs/CONTAINER_MIGRATION_CHECKLIST.md` for complete mapping

### Task 4: Factory Base Dockerfile Implementation

**Critical Updates**:

1. **Monitoring System Multi-API Support**:
   - REST API: `/api/monitoring/*` endpoints
   - WebSocket API: `/ws/monitoring`
   - RPC Entrypoint: `ContainerMonitoringOps` class for service bindings
   - All monitoring outputs sent to orchestrator via entrypoints

2. **Database Architecture**:
   - **NO SQLite databases in containers**
   - All databases on orchestrator (D1 only)
   - Containers send data to orchestrator via RPC entrypoint
   - Schema includes `worker_name` and `container_name` columns
   - Use Drizzle ORM + Kysely

3. **Process Monitoring CLI**:
   - Supports REST API, WebSocket API, and RPC entrypoint
   - Orchestrator can make direct CLI commands via RPC

4. **Process Lifecycle Management**:
   - Supports REST API, WebSocket API, and RPC entrypoint
   - All paths support streaming
   - Outputs sent to orchestrator

5. **Storage**:
   - All SQLite/D1 operations routed through orchestrator RPC
   - Orchestrator added as service binding to worker/container
   - All tables from storage.ts setup on orchestrator D1

**Subtasks Added**:
- Update container monitoring scripts for orchestrator integration
- Remove local SQLite database dependencies
- Implement multi-API monitoring system architecture

### Task 32: Global Terminal Monitoring View

**Critical Updates**:

1. **Dependencies**: Adjusted to depend on shared container/worker base templates

2. **Shared Templates**:
   - Expose WebSocket endpoints
   - Expose RPC entrypoints (`ContainerMonitoringOps`)
   - Added to orchestrator as service bindings
   - Orchestrator accesses monitoring/xterm.js via service binding (RPC)

3. **Frontend**: Handled separately (own backlog) - just document goal

4. **App Generation Script**:
   - Creates new apps from shared template
   - Updates orchestrator `wrangler.jsonc` with new service binding
   - Standardizes adding new apps/factories/specialists

5. **Orchestrator Updates**:
   - Supports connecting to multiple xterm.js terminals
   - Aggregates terminal connections from all bound workers
   - Provides unified interface for frontend

6. **Health Checks**:
   - Terminal integration part of health checks
   - Endpoint: `/health/terminal`

### Task 33: WebSocket Integration

**Critical Updates**:

1. **Direct Client-to-Container**:
   - Works from worker with container binding
   - **ALSO works from orchestrator**
   - End users **DO NOT** need to navigate to app/factory/specialist frontend URL
   - Orchestrator proxies terminal/WebSocket connections
   - Routes:
     - `/api/workers/:workerName/terminal` (WebSocket proxy)
     - `/api/workers/:workerName/websocket` (WebSocket proxy)

2. **WebSocket Health Check**:
   - Part of health checks on each worker
   - Endpoint: `/health/websocket`
   - Checks WebSocket connection to container

3. **Orchestrator as Proxy**:
   - Orchestrator proxies WebSocket connections to any container
   - End users connect to orchestrator, orchestrator forwards to worker/container
   - Support for multiple simultaneous connections
   - Connection pooling and management

## Architecture Requirements

### Monitoring System Access

**Three Interfaces Required**:

1. **REST API**: `/api/monitoring/*`
   - Process status, errors, logs, process control

2. **WebSocket API**: `/ws/monitoring`
   - Real-time updates, streaming output, error notifications

3. **RPC Entrypoint**: `ContainerMonitoringOps`
   - Extends `BaseWorkerEntrypoint`
   - Used by orchestrator via service bindings
   - Supports streaming responses

### Database Architecture

**CRITICAL**: All databases on orchestrator (D1), NOT in containers.

- No SQLite databases in containers
- Containers send monitoring data to orchestrator via RPC
- Orchestrator stores in D1 with worker/container identification
- All tables include `worker_name` and `container_name` columns
- Use Drizzle ORM + Kysely

**Schema Pattern**:
```typescript
export const containerErrors = sqliteTable('container_errors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(),  // REQUIRED
  containerName: text('container_name'),      // Optional
  instanceId: text('instance_id').notNull(),
  // ... other fields
});
```

### Service Binding Pattern

Each container worker exposes `ContainerMonitoringOps`:

```typescript
export class ContainerMonitoringOps extends BaseWorkerEntrypoint {
  async getProcessStatus(instanceId: string): Promise<ProcessStatus> {
    // Implementation - sends to orchestrator
  }
  
  async getErrors(instanceId: string): Promise<Error[]> {
    // Implementation - sends to orchestrator
  }
  
  async getLogs(instanceId: string): Promise<ReadableStream<Log>> {
    // Implementation - streaming to orchestrator
  }
}
```

Orchestrator `wrangler.jsonc`:
```jsonc
{
  "binding": "[WORKER_NAME]_SERVICE",
  "service": "[worker-name]",
  "entrypoint": "ContainerMonitoringOps"
}
```

### Health Checks

**Terminal Health Check**:
- Endpoint: `/health/terminal`
- Checks: WebSocket connection to container terminal
- Status: `healthy` if terminal WebSocket connects successfully

**WebSocket Health Check**:
- Endpoint: `/health/websocket`
- Checks: WebSocket connection to container
- Status: `healthy` if WebSocket upgrade succeeds

## Migration Checklist

See `docs/CONTAINER_MIGRATION_CHECKLIST.md` for:
- Complete source → destination mapping
- Import path adjustments
- Schema updates for orchestrator D1
- Verification steps

## Key Files Created/Updated

1. `docs/CONTAINER_REQUIREMENTS.md` - Comprehensive requirements
2. `docs/CONTAINER_MIGRATION_CHECKLIST.md` - Migration mapping
3. `docs/CONTAINER_ARCHITECTURE_UPDATES.md` - This summary
4. `docs/OVERVIEW.md` - Updated with new documentation entries

## Next Steps

1. **Task 34** (Prerequisite): Create Python migration script
2. **Task 4**: Update factory base Dockerfile with orchestrator integration
3. **Task 31**: Implement xterm.js terminal integration
4. **Task 32**: Build global terminal monitoring (backend only)
5. **Task 33**: Implement WebSocket integration with orchestrator proxy

## Verification

After migration script (Task 34):
- Agent verifies migration completed correctly
- Agent adjusts Python script if large amount of issues
- Agent fixes remaining small issues (linting, etc.)
- All import paths updated correctly
- Schema migrations created for orchestrator D1
- Service binding patterns implemented

