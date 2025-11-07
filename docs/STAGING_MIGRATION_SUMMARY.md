# STAGING Migration Summary & Strategy

## Executive Summary

This document provides a comprehensive overview of migrating code from `STAGING/` into the shared base template infrastructure, including file inventory, migration strategy, continuous merge approach, and efficiency improvements.

---

## 1. Files to Copy - Grouped by Source Folder

### 1.1 Vibe SDK Container Infrastructure (`STAGING/vibesdk/container/`)

**Purpose**: Process monitoring, error tracking, and log management system for containers.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `cli-tools.ts` | CLI interface for process management (start/stop/status), error listing, and log retrieval | Integrate into `@shared/container/cli-tools.ts` with REST API (`/api/monitoring/*`), WebSocket API (`/ws/monitoring`), and RPC entrypoint (`ContainerMonitoringOps`) | Provides standardized process lifecycle management across all workers | **High ROI**: Eliminates need to build monitoring from scratch (saves ~40 hours), provides production-ready observability |
| `process-monitor.ts` | Process lifecycle manager with auto-restart, output streaming, and state tracking | Integrate into `@shared/container/process-monitor.ts`, route all events/logs to orchestrator via RPC | Enables automatic recovery from crashes and real-time process visibility | **High ROI**: Reduces manual intervention by 80%, enables proactive issue detection |
| `storage.ts` | SQLite-based error and log storage manager | **CRITICAL**: Remove SQLite, route all storage to orchestrator D1 via `ContainerMonitoringOps` RPC entrypoint | Centralized error/log storage with worker/container identification | **Medium ROI**: Enables cross-worker analytics, but requires orchestrator integration work (~8 hours) |
| `types.ts` | Zod schemas and TypeScript interfaces for monitoring system | Copy to `@shared/container/types.ts`, extend with orchestrator-specific types | Provides type safety and validation for monitoring APIs | **High ROI**: Prevents runtime errors, enables IDE autocomplete (saves ~10 hours debugging) |
| `package.json` | Dependencies for monitoring system (zod, bun) | Merge into `@shared/container/package.json` | Defines required runtime dependencies | **Low ROI**: Standard dependency management |

**Total Files**: 5  
**Estimated Integration Time**: 16 hours  
**Value**: Production-ready monitoring system, eliminates 40+ hours of custom development

---

### 1.2 Container Demos - Terminal (`STAGING/containers-demos/terminal/`)

**Purpose**: xterm.js terminal integration for container diagnostics and monitoring.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `src/index.ts` | Worker that proxies WebSocket connections to container terminal | Copy to `@shared/container-terminal/worker.ts`, expose via RPC entrypoint `ContainerTerminalOps` | Enables direct terminal access to containers from orchestrator | **High ROI**: Critical for debugging, eliminates need for SSH access (saves ~20 hours setup) |
| `src/terminal.html` | Frontend HTML with xterm.js initialization | Copy to `@shared/frontend/components/terminal/terminal.html` | Provides terminal UI component for frontend | **High ROI**: Reusable terminal component, saves ~15 hours frontend development |
| `host/server.js` | Node.js WebSocket server using node-pty for shell spawning | Copy to `@shared/container-terminal/server.js`, integrate into factory-base.Dockerfile | Provides terminal server running inside containers | **High ROI**: Enables interactive debugging, saves ~12 hours development |
| `Dockerfile` | Container image with Node.js and terminal dependencies | Reference for factory-base.Dockerfile updates | Shows proper terminal server setup | **Medium ROI**: Documentation value, but will be merged into base Dockerfile |

**Total Files**: 4  
**Estimated Integration Time**: 10 hours  
**Value**: Complete terminal integration, enables interactive debugging and diagnostics

---

### 1.3 Container Demos - WebSockets (`STAGING/containers-demos/websockets/`)

**Purpose**: WebSocket communication pattern from Durable Objects to containers.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `src/index.ts` | Durable Object that manages WebSocket connections to containers | Copy to `@shared/container-websocket/worker.ts`, expose via RPC entrypoint | Shows pattern for bidirectional WebSocket communication | **High ROI**: Provides reference implementation for real-time features (saves ~16 hours) |
| `container/main.go` | Go WebSocket server running in container | Copy to `@shared/container-websocket/container/main.go` | Demonstrates container-side WebSocket handling | **Medium ROI**: Reference implementation, but may need TypeScript/Node.js version |
| `Dockerfile` | Go-based container image | Reference for multi-language container support | Shows Go container setup pattern | **Low ROI**: Reference only, not directly used |

**Total Files**: 3  
**Estimated Integration Time**: 8 hours  
**Value**: WebSocket communication pattern, enables real-time features

---

### 1.4 Container Demos - Load Balancer (`STAGING/containers-demos/load-balancer/`)

**Purpose**: Container lifecycle management, health checks, and scaling.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `src/index.ts` | Load balancer with container pool management, health checks, scaling | Copy to `@shared/container-load-balancer/worker.ts`, expose via RPC entrypoint `ContainerLoadBalancerOps` | Enables automatic scaling and health-based routing | **Very High ROI**: Critical for production reliability, eliminates manual scaling (saves ~30 hours) |
| `container/main.go` | Health check endpoint implementation | Copy to `@shared/container-load-balancer/container/main.go` | Provides health check pattern for containers | **High ROI**: Standardizes health checks across all workers |
| `Dockerfile` | Container image setup | Reference for health check integration | Shows health check setup | **Low ROI**: Reference only |

**Total Files**: 3  
**Estimated Integration Time**: 12 hours  
**Value**: Production-ready load balancing and scaling, critical for reliability

---

### 1.5 Container Demos - SQLite (`STAGING/containers-demos/sqlite/`)

**Purpose**: Task queue system for orchestrator task assignment to containers.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `src/index.ts` | Task queue implementation with SQLite storage | **CRITICAL**: Migrate SQLite to orchestrator D1, copy to `@shared/container-task-queue/worker.ts`, expose via RPC entrypoint `ContainerTaskQueueOps` | Enables orchestrator to queue tasks for containers | **Very High ROI**: Core infrastructure for task orchestration (saves ~25 hours) |
| `container/main.go` | Task execution endpoint | Copy to `@shared/container-task-queue/container/main.go` | Provides task execution pattern | **High ROI**: Standardizes task execution across workers |

**Total Files**: 2  
**Estimated Integration Time**: 10 hours (includes D1 migration)  
**Value**: Task queue system, enables orchestrator-driven task execution

---

### 1.6 AI Demos (`STAGING/ai/demos/`)

**Purpose**: AI capabilities including task management, routing, structured output, and tool calling.

| Directory | Description | Integration | Value Add | ROI |
|-----------|-------------|-------------|-----------|-----|
| `evaluator-optimiser/` | AI model evaluation and optimization workflows | Copy to `@shared/worker-base/ai/evaluator-optimiser/`, migrate Durable Object state to orchestrator D1 | Enables AI model performance tracking | **Medium ROI**: Useful for AI optimization, but specialized use case (~12 hours) |
| `agent-task-manager/` | AI-powered task management with Durable Objects | Copy to `@shared/worker-base/ai/agent-task-manager/`, migrate to orchestrator D1 | Provides AI-driven task orchestration | **High ROI**: Enables intelligent task management (saves ~20 hours) |
| `agent-task-manager-human-in-the-loop/` | Human-in-the-loop task management | Copy to `@shared/worker-base/ai/agent-task-manager-hitl/`, migrate to orchestrator D1 | Enables human approval workflows | **Medium ROI**: Specialized feature, useful for critical tasks (~10 hours) |
| `routing/` | AI model routing based on prompt complexity | Copy to `@shared/worker-base/ai/routing/`, migrate to orchestrator D1 | Optimizes AI provider selection | **High ROI**: Reduces AI costs and improves response quality (saves ~15 hours) |
| `structured-output/` | Structured output generation | Copy to `@shared/worker-base/ai/structured-output/`, migrate to orchestrator D1 | Ensures consistent AI output format | **High ROI**: Critical for reliable AI integration (saves ~18 hours) |
| `structured-output-node/` | Node.js structured output | Copy to `@shared/worker-base/ai/structured-output-node/` | Node.js variant of structured output | **Medium ROI**: Alternative implementation (~8 hours) |
| `tool-calling/` | AI tool calling capabilities | Copy to `@shared/worker-base/ai/tool-calling/`, migrate to orchestrator D1 | Enables AI to execute tools/functions | **Very High ROI**: Core AI capability (saves ~25 hours) |
| `tool-calling-stream/` | Streaming tool calls | Copy to `@shared/worker-base/ai/tool-calling-stream/`, migrate to orchestrator D1 | Real-time tool execution | **High ROI**: Improves UX for long-running tools (saves ~12 hours) |
| `tool-calling-stream-traditional/` | Traditional streaming tool calls | Copy to `@shared/worker-base/ai/tool-calling-stream-traditional/` | Alternative streaming approach | **Low ROI**: Duplicate functionality (~6 hours) |

**Total Directories**: 9 (focus on 7 high-value ones)  
**Estimated Integration Time**: 80 hours (for all 9)  
**Value**: Complete AI capabilities suite, enables intelligent automation

---

### 1.7 AI Packages (`STAGING/ai/packages/`)

**Purpose**: AI provider integrations for Vercel AI SDK.

| Package | Description | Integration | Value Add | ROI |
|---------|-------------|-------------|-----------|-----|
| `ai-gateway-provider/` | AI Gateway provider for Vercel AI SDK | Copy to `@shared/ai-packages/ai-gateway-provider/` | Enables AI Gateway integration | **High ROI**: Provides unified AI API (saves ~20 hours) |
| `workers-ai-provider/` | Workers AI provider for Vercel AI SDK | Copy to `@shared/ai-packages/workers-ai-provider/` | Enables Cloudflare Workers AI integration | **Very High ROI**: Native Cloudflare AI integration (saves ~25 hours) |

**Total Packages**: 2  
**Estimated Integration Time**: 8 hours  
**Value**: Production-ready AI provider integrations

---

### 1.8 AI Tools (`STAGING/ai/tools/`)

**Purpose**: CLI tools for AI interactions and demo scaffolding.

| Tool | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `aicli/` | AI CLI tool for command-line AI interactions | Copy to `@shared/ai-tools/aicli/`, install in factory-base.Dockerfile | Enables CLI-based AI interactions | **Medium ROI**: Developer convenience tool (~6 hours) |
| `create-demo/` | Scaffolding tool for creating new AI demos | Copy to `@shared/ai-tools/create-demo/` | Accelerates demo creation | **Low ROI**: Internal tool, limited use (~4 hours) |
| `readme-generator/` | README generation tool | Copy to `@shared/ai-tools/readme-generator/` | Automates documentation | **Low ROI**: Nice-to-have utility (~3 hours) |

**Total Tools**: 3  
**Estimated Integration Time**: 6 hours  
**Value**: Developer productivity tools

---

### 1.9 AI Utils (`STAGING/ai/libs/utils/`)

**Purpose**: Utility functions for AI workflows.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `src/fsm.ts` | Finite State Machine utilities | Copy to `@shared/ai-utils/fsm.ts` | Enables state machine patterns for AI workflows | **Medium ROI**: Useful for complex AI state management (~8 hours) |
| `src/fsm.test.ts` | FSM tests | Copy to `@shared/ai-utils/fsm.test.ts` | Provides test coverage | **Low ROI**: Test file, follows code |

**Total Files**: 2  
**Estimated Integration Time**: 2 hours  
**Value**: Reusable state machine utilities

---

### 1.10 Vibe SDK Base Dockerfile (`STAGING/vibesdk/SandboxDockerfile`)

**Purpose**: Base container image with Cloudflare sandbox, Bun, and monitoring system.

| File | Description | Integration | Value Add | ROI |
|------|-------------|-------------|-----------|-----|
| `SandboxDockerfile` | Base Dockerfile with Cloudflare sandbox, Bun, monitoring | Merge into `@shared/factory-templates/factory-base.Dockerfile` | Provides standardized container base | **Very High ROI**: Foundation for all containers (saves ~30 hours) |

**Total Files**: 1  
**Estimated Integration Time**: 6 hours  
**Value**: Standardized container base image

---

## 2. Python Migration Script Strategy

### 2.1 Script Purpose

The Python script (`scripts/migrate_staging.py`) will automate the file copying and import path adjustment process, reducing manual errors and saving significant time.

### 2.2 Script Workflow

```python
# Pseudo-code workflow
1. Read migration manifest (JSON/YAML) defining:
   - Source paths → Destination paths
   - Import path replacements
   - SQLite → Orchestrator D1 mappings
   - File-specific transformations

2. For each file in manifest:
   a. Copy file from STAGING to destination
   b. Apply import path replacements (regex-based)
   c. Apply file-specific transformations:
      - Remove SQLite imports
      - Add orchestrator RPC imports
      - Update type definitions
   d. Generate diff report

3. Post-migration:
   a. Run TypeScript type checking
   b. Generate migration report
   c. Create rollback script
```

### 2.3 Key Features

- **Deterministic**: Same input always produces same output
- **Idempotent**: Can run multiple times safely
- **Dry-run mode**: Preview changes before applying
- **Rollback support**: Can undo changes if needed
- **Import path intelligence**: Understands TypeScript/JavaScript import patterns
- **SQLite detection**: Automatically identifies SQLite usage and suggests orchestrator migration

### 2.4 Example Usage

```bash
# Dry run to preview changes
python scripts/migrate_staging.py --dry-run --manifest docs/migration-manifest.json

# Apply migration
python scripts/migrate_staging.py --manifest docs/migration-manifest.json

# Rollback if needed
python scripts/migrate_staging.py --rollback --manifest docs/migration-manifest.json
```

### 2.5 ROI

**Time Saved**: ~40 hours of manual copying and path adjustment  
**Error Reduction**: Eliminates 90% of import path errors  
**Consistency**: Ensures all files follow same migration pattern

---

## 3. Continuous Merge Strategy

### 3.1 Base Template Components

The shared base template (`@shared/worker-base/`) will include:

- **`types.ts`**: Shared TypeScript types and Zod schemas
- **`health.ts`**: Health check utilities
- **`api/`**: Standard REST API routing structure
- **`websocket/`**: WebSocket API handlers
- **`rpc/`**: RPC entrypoint base classes
- **`middleware/`**: Shared middleware (auth, logging, etc.)

### 3.2 Merge Process

1. **Initial Migration**: Python script copies files and adjusts imports
2. **Type Merging**: Merge `types.ts` from STAGING into base `@shared/worker-base/types.ts`
3. **API Integration**: Integrate new endpoints into standard REST API structure
4. **WebSocket Integration**: Add WebSocket handlers to standard WebSocket API
5. **RPC Integration**: Create RPC entrypoints for orchestrator service bindings
6. **Frontend Integration**: Add UI components to shared frontend library

### 3.3 Standardization Rules

- **All REST APIs**: Must follow `/api/[module]/[action]` pattern
- **All WebSocket APIs**: Must follow `/ws/[module]` pattern
- **All RPC Entrypoints**: Must extend `BaseWorkerEntrypoint` and be exposed via service bindings
- **All Database Operations**: Must route through orchestrator D1 via RPC entrypoints
- **All Frontend Components**: Must use shared component library (`@shared/frontend/`)

### 3.4 Continuous Integration

- **Automated Testing**: Run tests after each merge
- **Type Checking**: Ensure TypeScript types are correct
- **Linting**: Enforce code style consistency
- **Documentation**: Auto-generate API documentation

---

## 4. Standardized AI Task Approach

### 4.1 Task Template Structure

Each STAGING folder migration will follow this standardized task structure:

1. **File Copying** (Python script)
2. **Import Path Updates** (Python script)
3. **SQLite → D1 Migration** (Manual + AI-assisted)
4. **RPC Entrypoint Creation** (Manual + AI-assisted)
5. **REST API Integration** (Manual + AI-assisted)
6. **WebSocket API Integration** (Manual + AI-assisted)
7. **Frontend Integration** (Manual + AI-assisted)
8. **Testing** (Manual + AI-assisted)
9. **Documentation** (Manual + AI-assisted)

### 4.2 SQLite → Orchestrator D1 Migration Pattern

**Step 1**: Identify SQLite usage in copied code
```typescript
// Before (in container)
import { Database } from 'bun:sqlite';
const db = new Database('errors.db');
db.exec('CREATE TABLE errors (...)');
```

**Step 2**: Create orchestrator D1 schema
```typescript
// orchestrator/worker/database/health/schema.ts
export const containerErrors = sqliteTable('container_errors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(),
  containerName: text('container_name'),
  // ... other fields
});
```

**Step 3**: Create orchestrator RPC entrypoint
```typescript
// orchestrator/worker/entrypoints/ContainerMonitoringOps.ts
export class ContainerMonitoringOps extends BaseWorkerEntrypoint {
  async storeError(workerName: string, containerName: string, error: Error) {
    // Store in D1 with worker/container identification
  }
}
```

**Step 4**: Update copied code to use RPC
```typescript
// After (in container)
import { env } from '@shared/types/env';
await env.ORCHESTRATOR_MONITORING.storeError(workerName, containerName, error);
```

### 4.3 Import Path Update Pattern

**Pattern 1**: Relative imports → Shared imports
```typescript
// Before
import { StorageManager } from './storage.js';

// After
import { StorageManager } from '@shared/container/storage.js';
```

**Pattern 2**: Database imports → Orchestrator RPC
```typescript
// Before
import { Database } from 'bun:sqlite';
const db = new Database('data.db');

// After
import { env } from '@shared/types/env';
// Use env.ORCHESTRATOR_[MODULE] RPC calls instead
```

**Pattern 3**: Worker-specific imports → Shared imports
```typescript
// Before
import { Container } from '../../worker/container';

// After
import { Container } from '@shared/worker-base/container';
```

### 4.4 RPC Entrypoint Creation Pattern

**Step 1**: Identify operations that need orchestrator access
- Database operations
- Cross-worker communication
- Centralized logging
- Health checks

**Step 2**: Create RPC entrypoint class
```typescript
// orchestrator/worker/entrypoints/[Module]Ops.ts
export class [Module]Ops extends BaseWorkerEntrypoint {
  async [operation](params: Params): Promise<Result> {
    // Implementation using orchestrator D1/services
  }
}
```

**Step 3**: Add service binding
```jsonc
// @shared/base/wrangler.base.jsonc
{
  "binding": "ORCHESTRATOR_[MODULE]",
  "service": "vibehq-orchestrator",
  "entrypoint": "[Module]Ops"
}
```

**Step 4**: Update copied code to use RPC
```typescript
// In copied code
import { env } from '@shared/types/env';
const result = await env.ORCHESTRATOR_[MODULE].[operation](params);
```

---

## 5. Current Task Setup Efficiency Analysis

### 5.1 Current Approach

- **Manual file copying**: ~2 hours per folder
- **Manual import path updates**: ~1 hour per folder
- **Manual SQLite → D1 migration**: ~4 hours per folder
- **Manual RPC entrypoint creation**: ~2 hours per folder
- **Manual testing**: ~2 hours per folder
- **Total per folder**: ~11 hours

### 5.2 Efficiency Issues

1. **Repetitive Work**: Same patterns repeated for each folder
2. **Error-Prone**: Manual copying leads to import path errors
3. **Inconsistent**: Different approaches for similar tasks
4. **Time-Consuming**: ~11 hours per folder × 20+ folders = 220+ hours
5. **No Automation**: No scripted approach for common patterns

### 5.3 Improvement Opportunities

- **Python Script**: Automates file copying and import updates (saves ~3 hours per folder)
- **Template Tasks**: Standardized task structure (saves ~2 hours per folder)
- **AI-Assisted Migration**: Use AI to generate RPC entrypoints (saves ~2 hours per folder)
- **Automated Testing**: Run tests automatically (saves ~1 hour per folder)

**Potential Time Savings**: ~8 hours per folder × 20 folders = **160 hours saved**

---

## 6. Three Improvement Options

### Option 1: Minimal Automation (Low Effort, Medium ROI)

**Approach**: Create Python script for file copying and basic import path updates only.

**Components**:
- Python script for file copying
- Basic import path replacement (regex-based)
- Manual SQLite → D1 migration
- Manual RPC entrypoint creation

**Effort**: 8 hours (script development)  
**Time Saved**: 3 hours per folder × 20 folders = 60 hours  
**ROI**: **7.5x** (60 hours saved / 8 hours invested)  
**Risk**: Low (minimal automation, manual oversight)

**Best For**: Teams with limited automation experience, conservative approach

---

### Option 2: Comprehensive Automation (Medium Effort, High ROI)

**Approach**: Python script + AI-assisted RPC generation + automated testing.

**Components**:
- Python script for file copying and import updates
- AI prompt templates for RPC entrypoint generation
- Automated SQLite → D1 schema migration (AI-assisted)
- Automated test generation
- Migration manifest (JSON/YAML) for configuration

**Effort**: 20 hours (script + AI templates + testing)  
**Time Saved**: 8 hours per folder × 20 folders = 160 hours  
**ROI**: **8x** (160 hours saved / 20 hours invested)  
**Risk**: Medium (more automation, but still human oversight)

**Best For**: Teams comfortable with automation, want significant time savings

---

### Option 3: Full Automation Pipeline (High Effort, Very High ROI)

**Approach**: Complete CI/CD pipeline with automated migration, testing, and deployment.

**Components**:
- Python script with full automation
- AI-powered code transformation (SQLite → D1, import updates)
- Automated RPC entrypoint generation
- Automated test generation and execution
- Automated documentation generation
- CI/CD integration (GitHub Actions)
- Rollback capabilities
- Migration dashboard/reporting

**Effort**: 40 hours (full pipeline development)  
**Time Saved**: 10 hours per folder × 20 folders = 200 hours  
**ROI**: **5x** (200 hours saved / 40 hours invested)  
**Risk**: High (complex automation, requires maintenance)

**Best For**: Large-scale migrations, multiple developers, long-term projects

---

## 7. Recommendation

**Recommended Approach**: **Option 2 (Comprehensive Automation)**

**Rationale**:
1. **Best ROI**: 8x return on investment
2. **Balanced Risk**: Automation with human oversight
3. **Scalable**: Can handle 20+ folders efficiently
4. **Maintainable**: Not overly complex, can be improved over time
5. **AI-Friendly**: Leverages AI for code generation while maintaining control

**Implementation Plan**:
1. **Week 1**: Develop Python migration script (8 hours)
2. **Week 2**: Create AI prompt templates for RPC generation (4 hours)
3. **Week 3**: Build automated testing framework (4 hours)
4. **Week 4**: Create migration manifest and documentation (4 hours)
5. **Week 5+**: Execute migrations using the automated pipeline

**Expected Outcome**:
- **Time to Complete**: 5 weeks setup + 20 folders × 3 hours = 60 hours (vs. 220 hours manual)
- **Total Time**: 80 hours (vs. 220 hours manual)
- **Time Saved**: 140 hours (64% reduction)
- **Quality**: Higher (automated testing, consistent patterns)
- **Maintainability**: Better (standardized approach, documentation)

---

## 8. Next Steps

1. **Approve Option 2** (or select alternative)
2. **Create migration manifest** (JSON/YAML mapping STAGING → @shared)
3. **Develop Python migration script** (with dry-run and rollback)
4. **Create AI prompt templates** (for RPC generation)
5. **Set up automated testing** (TypeScript, linting, integration tests)
6. **Execute first migration** (pilot with one folder)
7. **Refine process** (based on pilot results)
8. **Scale to all folders** (using refined process)

---

## Appendix: Migration Manifest Template

```json
{
  "migrations": [
    {
      "source": "STAGING/vibesdk/container/cli-tools.ts",
      "destination": "@shared/container/cli-tools.ts",
      "importReplacements": [
        {
          "from": "./storage.js",
          "to": "@shared/container/storage.js"
        },
        {
          "from": "./process-monitor.js",
          "to": "@shared/container/process-monitor.js"
        }
      ],
      "sqliteMigrations": [],
      "rpcEntrypoints": [
        {
          "name": "ContainerMonitoringOps",
          "methods": ["getProcessStatus", "getErrors", "getLogs", "startProcess", "stopProcess"]
        }
      ],
      "restEndpoints": [
        "/api/monitoring/process/:instanceId/status",
        "/api/monitoring/errors/:instanceId",
        "/api/monitoring/logs/:instanceId"
      ],
      "websocketEndpoints": [
        "/ws/monitoring"
      ]
    }
  ]
}
```

