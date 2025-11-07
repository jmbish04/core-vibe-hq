# Container Infrastructure Migration Checklist

This document outlines the migration of Vibe SDK container infrastructure to `@shared` for use by all downstream workers.

## Overview

The standardized container, worker, and worker frontend (React/shadcn) from Vibe SDK examples will be shared by all downstream workers (factories, specialists) via `@shared` infrastructure.

## Migration Source → Destination Mapping

### 1. Container Monitoring System

#### Source: `STAGING/vibesdk/container/`
#### Destination: `@shared/container/`

| Source File | Destination | Import Path Adjustments |
|------------|-------------|------------------------|
| `container/cli-tools.ts` | `@shared/container/cli-tools.ts` | Update imports from `./storage.js` → `@shared/container/storage.js`<br>Update imports from `./process-monitor.js` → `@shared/container/process-monitor.js`<br>Update imports from `./types.js` → `@shared/container/types.js` |
| `container/process-monitor.ts` | `@shared/container/process-monitor.ts` | Update imports from `./storage.js` → `@shared/container/storage.js`<br>Update imports from `./types.js` → `@shared/container/types.js` |
| `container/storage.ts` | `@shared/container/storage.ts` | Update imports from `./types.js` → `@shared/container/types.js` |
| `container/types.ts` | `@shared/container/types.ts` | No changes (base types) |
| `container/package.json` | `@shared/container/package.json` | Update name to `@shared/container`<br>Update paths if needed |

### 2. Worker Base Templates

#### Source: `STAGING/vibesdk/worker/`
#### Destination: `@shared/worker-base/`

| Source Directory/File | Destination | Import Path Adjustments |
|----------------------|-------------|------------------------|
| `worker/api/` | `@shared/worker-base/api/` | Update all imports from relative paths to `@shared/worker-base/...`<br>Update imports from `../../database/` → `@shared/worker-base/database/`<br>Update imports from `../../services/` → `@shared/worker-base/services/` |
| `worker/database/` | `@shared/worker-base/database/` | Update imports to use `@shared/worker-base/...` paths<br>Note: Schema will be adapted for orchestrator D1 |
| `worker/services/` | `@shared/worker-base/services/` | Update imports to use `@shared/worker-base/...` paths |
| `worker/middleware/` | `@shared/worker-base/middleware/` | Update imports to use `@shared/worker-base/...` paths |
| `worker/app.ts` | `@shared/worker-base/app.ts` | Update all imports to `@shared/worker-base/...` paths |
| `worker/index.ts` | `@shared/worker-base/index.ts` | Update all imports to `@shared/worker-base/...` paths |

**Note**: Only copy relevant parts, not the entire Vibe SDK worker structure. Focus on:
- Base entrypoint pattern
- API routing structure
- Service patterns
- Middleware patterns

### 3. Frontend Components (React/shadcn)

#### Source: `STAGING/vibesdk/src/`
#### Destination: `@shared/frontend/`

| Source Directory/File | Destination | Import Path Adjustments |
|----------------------|-------------|------------------------|
| `src/components/` | `@shared/frontend/components/` | Update imports from `../lib/` → `@shared/frontend/lib/`<br>Update imports from `../hooks/` → `@shared/frontend/hooks/`<br>Update imports from `../utils/` → `@shared/frontend/utils/` |
| `src/components/ui/` | `@shared/frontend/components/ui/` | Update imports from `../utils` → `@shared/frontend/utils` |
| `src/lib/` | `@shared/frontend/lib/` | Update imports to use `@shared/frontend/...` paths |
| `src/hooks/` | `@shared/frontend/hooks/` | Update imports to use `@shared/frontend/...` paths |
| `src/utils/` | `@shared/frontend/utils/` | Update imports to use `@shared/frontend/...` paths |
| `src/contexts/` | `@shared/frontend/contexts/` | Update imports to use `@shared/frontend/...` paths |

**Note**: Focus on terminal components, monitoring components, and shared UI components.

### 4. Terminal Integration

#### Source: `STAGING/containers-demos/terminal/`
#### Destination: `@shared/container-terminal/`

| Source File | Destination | Import Path Adjustments |
|------------|-------------|------------------------|
| `terminal/src/index.ts` | `@shared/container-terminal/worker.ts` | Update Container import if needed<br>Update HTML import path |
| `terminal/src/terminal.html` | `@shared/container-terminal/terminal.html` | No changes (HTML file) |
| `terminal/host/server.js` | `@shared/container-terminal/server.js` | Update require paths if needed |
| `terminal/Dockerfile` | `@shared/container-terminal/Dockerfile` | Update COPY paths |

### 5. WebSocket Integration

#### Source: `STAGING/containers-demos/websockets/`
#### Destination: `@shared/container-websocket/`

| Source File | Destination | Import Path Adjustments |
|------------|-------------|------------------------|
| `websockets/src/index.ts` | `@shared/container-websocket/worker.ts` | Update DurableObject import if needed |
| `websockets/container/main.go` | `@shared/container-websocket/container/main.go` | No changes (Go file) |
| `websockets/Dockerfile` | `@shared/container-websocket/Dockerfile` | Update COPY paths |

### 6. Dockerfile Base

#### Source: `STAGING/vibesdk/SandboxDockerfile`
#### Destination: `@shared/factory-templates/factory-base.Dockerfile`

| Source File | Destination | Adjustments |
|------------|-------------|-------------|
| `SandboxDockerfile` | `@shared/factory-templates/factory-base.Dockerfile` | Update COPY paths to `@shared/container/`<br>Update WORKDIR paths<br>Add patch management utilities |

## Import Path Pattern Replacements

### Common Patterns to Replace

1. **Relative imports to shared imports**:
   - `./storage.js` → `@shared/container/storage.js`
   - `../database/` → `@shared/worker-base/database/`
   - `../../services/` → `@shared/worker-base/services/`

2. **Vibe SDK specific paths**:
   - `@vibesdk/...` → `@shared/...`
   - Any absolute paths referencing STAGING → `@shared/...`

3. **Worker-specific paths**:
   - `worker/database/` → `@shared/worker-base/database/`
   - `worker/services/` → `@shared/worker-base/services/`

4. **Frontend-specific paths**:
   - `src/components/` → `@shared/frontend/components/`
   - `src/lib/` → `@shared/frontend/lib/`
   - `src/hooks/` → `@shared/frontend/hooks/`

## Directory Structure to Create

```
@shared/
├── container/
│   ├── cli-tools.ts
│   ├── process-monitor.ts
│   ├── storage.ts
│   ├── types.ts
│   └── package.json
├── container-terminal/
│   ├── worker.ts
│   ├── terminal.html
│   ├── server.js
│   └── Dockerfile
├── container-websocket/
│   ├── worker.ts
│   ├── container/
│   │   └── main.go
│   └── Dockerfile
├── worker-base/
│   ├── api/
│   ├── database/
│   ├── services/
│   ├── middleware/
│   ├── app.ts
│   └── index.ts
└── frontend/
    ├── components/
    ├── lib/
    ├── hooks/
    ├── utils/
    └── contexts/
```

## Schema Adjustments for Orchestrator D1

### Tables Requiring `worker_name` Column

All tables from `storage.ts` that will be migrated to orchestrator D1:

1. **simple_errors** table:
   - Add: `worker_name TEXT NOT NULL`
   - Add: `container_name TEXT`
   - Index: `CREATE INDEX idx_worker_errors ON simple_errors(worker_name)`

2. **process_logs** table:
   - Add: `worker_name TEXT NOT NULL`
   - Add: `container_name TEXT`
   - Index: `CREATE INDEX idx_worker_logs ON process_logs(worker_name)`

### Drizzle Schema Updates

Update `orchestrator/worker/database/schema.ts` to include:

```typescript
export const containerErrors = sqliteTable('container_errors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(),
  containerName: text('container_name'),
  instanceId: text('instance_id').notNull(),
  processId: text('process_id').notNull(),
  errorHash: text('error_hash').notNull(),
  timestamp: text('timestamp').notNull(),
  level: integer('level').notNull(),
  message: text('message').notNull(),
  rawOutput: text('raw_output').notNull(),
  occurrenceCount: integer('occurrence_count').default(1),
  createdAt: text('created_at').default(sql`datetime('now')`),
}, (table) => ({
  workerNameIdx: index('container_errors_worker_name_idx').on(table.workerName),
  instanceIdIdx: index('container_errors_instance_id_idx').on(table.instanceId),
}));

export const containerLogs = sqliteTable('container_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(),
  containerName: text('container_name'),
  instanceId: text('instance_id').notNull(),
  processId: text('process_id').notNull(),
  level: text('level').notNull(),
  message: text('message').notNull(),
  timestamp: text('timestamp').notNull(),
  stream: text('stream').notNull(),
  source: text('source'),
  metadata: text('metadata'),
  sequence: integer('sequence').notNull(),
  createdAt: text('created_at').default(sql`datetime('now')`),
}, (table) => ({
  workerNameIdx: index('container_logs_worker_name_idx').on(table.workerName),
  instanceIdIdx: index('container_logs_instance_id_idx').on(table.instanceId),
}));
```

## Service Binding Requirements

### Orchestrator → Container Worker

Each container worker must expose:
- **RPC Entrypoint**: `ContainerMonitoringOps` class extending `BaseWorkerEntrypoint`
- **REST API**: `/api/monitoring/*` endpoints
- **WebSocket**: `/ws/monitoring` and `/ws/terminal`

### Orchestrator Wrangler Config

Each new worker requires service binding in `orchestrator/wrangler.jsonc`:

```jsonc
{
  "binding": "[WORKER_NAME]_SERVICE",
  "service": "[worker-name]",
  "entrypoint": "ContainerMonitoringOps"
}
```

## Health Check Integration

### Terminal Health Check

- Endpoint: `/health/terminal`
- Checks: WebSocket connection to container terminal
- Status: `healthy` if terminal WebSocket connects successfully

### WebSocket Health Check

- Endpoint: `/health/websocket`
- Checks: WebSocket connection to container
- Status: `healthy` if WebSocket upgrade succeeds

## Python Migration Script Requirements

The migration script should:

1. **Create directory structure** under `@shared/`
2. **Copy files** from STAGING locations to `@shared/` destinations
3. **Update import paths** using regex find/replace patterns
4. **Generate migration report** with:
   - Files copied
   - Import paths updated
   - Files skipped (with reasons)
   - Errors encountered
5. **Validate** copied files for syntax errors
6. **Create rollback** capability (backup original files)

## Verification Checklist

After migration script runs:

- [ ] All files copied to correct destinations
- [ ] All import paths updated correctly
- [ ] No broken imports remain
- [ ] TypeScript compilation succeeds
- [ ] Linting passes (with minimal manual fixes)
- [ ] Schema migrations created for orchestrator D1
- [ ] Service binding patterns documented
- [ ] Health check endpoints implemented

## AI Integration Components

See `docs/AI_INTEGRATION_PLAN.md` for complete AI integration checklist including:
- AI demos migration (evaluator-optimiser, agent-task-manager, routing, etc.)
- AI packages migration (ai-gateway-provider, workers-ai-provider)
- AI tools migration (aicli, create-demo, readme-generator)
- AI utils migration (fsm.ts - excluding logger)
- Load balancer integration
- Task queue integration

