# AI Integration Plan for Shared Base Worker

This document outlines the integration of AI demos, packages, tools, and utilities into the shared base worker infrastructure for factories and specialists.

## Overview

All AI capabilities from Vibe SDK will be integrated into `@shared/worker-base/` to provide standardized AI functionality across all downstream workers (factories, specialists). All SQL databases will be routed through orchestrator D1 with proper worker/container identification.

## Integration Components

### 1. AI Demos Integration

#### Source: `STAGING/ai/demos/`
#### Destination: `@shared/worker-base/ai/`

| Source Directory | Destination | Purpose | SQL Tables (Orchestrator D1) |
|-----------------|-------------|---------|------------------------------|
| `evaluator-optimiser/` | `@shared/worker-base/ai/evaluator-optimiser/` | AI model evaluation and optimization workflows | `ai_evaluations` (worker_name, container_name) |
| `agent-task-manager/` | `@shared/worker-base/ai/agent-task-manager/` | AI-powered task management with Durable Objects | `ai_tasks` (worker_name, container_name) |
| `agent-task-manager-human-in-the-loop/` | `@shared/worker-base/ai/agent-task-manager-hitl/` | Human-in-the-loop task management | `ai_tasks_hitl` (worker_name, container_name) |
| `routing/` | `@shared/worker-base/ai/routing/` | AI model routing based on prompt complexity | `ai_routing_decisions` (worker_name, container_name) |
| `structured-output/` | `@shared/worker-base/ai/structured-output/` | Structured output generation | `ai_structured_outputs` (worker_name, container_name) |
| `structured-output-node/` | `@shared/worker-base/ai/structured-output-node/` | Node.js structured output | Same as above |
| `tool-calling/` | `@shared/worker-base/ai/tool-calling/` | AI tool calling capabilities | `ai_tool_calls` (worker_name, container_name) |
| `tool-calling-stream/` | `@shared/worker-base/ai/tool-calling-stream/` | Streaming tool calls | `ai_tool_call_streams` (worker_name, container_name) |
| `tool-calling-stream-traditional/` | `@shared/worker-base/ai/tool-calling-stream-traditional/` | Traditional streaming tool calls | Same as above |

**Key Integration Points**:
- All Durable Object state → Orchestrator D1 via RPC entrypoints
- All task storage → Orchestrator D1 with worker_name/container_name
- All AI model calls → Route through orchestrator AI gateway
- All evaluation results → Orchestrator D1

### 2. AI Packages Integration

#### Source: `STAGING/ai/packages/`
#### Destination: `@shared/ai-packages/`

| Source Package | Destination | Purpose |
|---------------|-------------|---------|
| `ai-gateway-provider/` | `@shared/ai-packages/ai-gateway-provider/` | AI Gateway provider for Vercel AI SDK |
| `workers-ai-provider/` | `@shared/ai-packages/workers-ai-provider/` | Workers AI provider for Vercel AI SDK |

**Integration Requirements**:
- Export providers for use in downstream workers
- Configure AI bindings via orchestrator entrypoints
- Support multi-provider fallback
- Route all AI calls through orchestrator for logging/monitoring

### 3. AI Tools Integration

#### Source: `STAGING/ai/tools/`
#### Destination: `@shared/ai-tools/`

| Source Tool | Destination | Purpose |
|------------|-------------|---------|
| `aicli/` | `@shared/ai-tools/aicli/` | AI CLI tool for command-line AI interactions |
| `create-demo/` | `@shared/ai-tools/create-demo/` | Scaffolding tool for creating new AI demos |
| `readme-generator/` | `@shared/ai-tools/readme-generator/` | README generation tool |

**Integration Requirements**:
- Make tools available in container environment
- Configure to use orchestrator AI gateway
- Support worker/container identification

### 4. AI Utils Integration

#### Source: `STAGING/ai/libs/utils/`
#### Destination: `@shared/ai-utils/`

| Source File | Destination | Purpose |
|------------|-------------|---------|
| `src/fsm.ts` | `@shared/ai-utils/fsm.ts` | Finite State Machine utilities |
| `src/fsm.test.ts` | `@shared/ai-utils/fsm.test.ts` | FSM tests |

**Note**: Logger excluded (already handled via orchestrator)

### 5. Load Balancer Integration

#### Source: `STAGING/containers-demos/load-balancer/`
#### Destination: `@shared/container-load-balancer/`

**Purpose**: Container lifecycle management, health checks, scaling, and restart capabilities

**Key Features**:
- Container health monitoring
- Automatic scaling up/down
- Container restart on failure
- Load balancing across healthy containers
- KV-based container pool management

**Integration Requirements**:
- **REST API**: `/api/containers/scale/:instances` - Scale containers
- **REST API**: `/api/containers/status` - Get container statuses
- **REST API**: `/api/containers/health/:containerId` - Health check
- **WebSocket API**: `/ws/containers` - Real-time container status
- **RPC Entrypoint**: `ContainerLoadBalancerOps` - For orchestrator service bindings
- **Health Check**: `/health/load-balancer` - Load balancer health

**Database Requirements** (Orchestrator D1):
```typescript
export const containerInstances = sqliteTable('container_instances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(),
  containerName: text('container_name'),
  instanceId: text('instance_id').notNull(),
  state: text('state').notNull(), // 'starting' | 'running' | 'unhealthy' | 'stopped' | 'failed'
  port: integer('port').default(8080),
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  workerNameIdx: index('container_instances_worker_name_idx').on(table.workerName),
  stateIdx: index('container_instances_state_idx').on(table.state),
}));
```

**Orchestrator Integration**:
- Orchestrator can scale containers via RPC
- Orchestrator monitors container health
- Orchestrator can force restart stuck containers
- Orchestrator tracks container usage for cost optimization

### 6. Task Queue System Integration

#### Source: `STAGING/containers-demos/sqlite/`
#### Destination: `@shared/container-task-queue/`

**Purpose**: Task queueing system for orchestrator to assign tasks to containers

**Use Case**: Scheduled health audit identifies 5 deployed workers with issues → Orchestrator creates task plan → Tasks staged in D1 → Containers pick up tasks

**Key Features**:
- Task submission and queuing
- Task assignment to containers
- Task execution tracking
- Task priority management
- Task result storage

**Database Schema** (Orchestrator D1):
```typescript
export const containerTasks = sqliteTable('container_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: text('task_id').notNull().unique(),
  workerName: text('worker_name'), // null = any worker, specific = assigned worker
  containerName: text('container_name'), // null = any container
  priority: integer('priority').default(0), // Higher = more priority
  status: text('status').notNull().default('pending'), // 'pending' | 'assigned' | 'running' | 'completed' | 'failed'
  taskType: text('task_type').notNull(), // 'health_audit', 'code_fix', 'deployment', etc.
  command: text('command').notNull(), // Command to execute
  parameters: text('parameters', { mode: 'json' }), // JSON parameters
  assignedTo: text('assigned_to'), // worker_name:container_name
  output: text('output'), // Task output/result
  error: text('error'), // Error message if failed
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  taskIdIdx: index('container_tasks_task_id_idx').on(table.taskId),
  workerNameIdx: index('container_tasks_worker_name_idx').on(table.workerName),
  statusIdx: index('container_tasks_status_idx').on(table.status),
  priorityIdx: index('container_tasks_priority_idx').on(table.priority),
}));
```

**Integration Requirements**:
- **REST API**: `POST /api/tasks` - Submit task
- **REST API**: `GET /api/tasks` - List tasks
- **REST API**: `GET /api/tasks/:taskId` - Get task status
- **REST API**: `POST /api/tasks/:taskId/claim` - Container claims task
- **REST API**: `POST /api/tasks/:taskId/complete` - Container completes task
- **WebSocket API**: `/ws/tasks` - Real-time task updates
- **RPC Entrypoint**: `ContainerTaskQueueOps` - For orchestrator service bindings

**Orchestrator Integration**:
- Orchestrator creates tasks via RPC entrypoint
- Orchestrator assigns tasks to appropriate containers
- Containers poll for tasks or receive via WebSocket
- Task results stored in orchestrator D1

## Database Schema Updates

### New Tables in Orchestrator D1

All tables must include `worker_name` and `container_name` columns:

1. **AI Evaluation Tables**:
   - `ai_evaluations` - Model evaluation results
   - `ai_routing_decisions` - Routing decision history
   - `ai_structured_outputs` - Structured output results
   - `ai_tool_calls` - Tool call history
   - `ai_tool_call_streams` - Streaming tool call data

2. **Task Management Tables**:
   - `ai_tasks` - AI task management
   - `ai_tasks_hitl` - Human-in-the-loop tasks
   - `container_tasks` - Container task queue

3. **Container Management Tables**:
   - `container_instances` - Container instance tracking
   - `container_health_checks` - Health check history

### Drizzle Schema Location

All schemas go in: `orchestrator/worker/database/schema.ts`

Use Drizzle ORM + Kysely patterns as established.

## Service Binding Requirements

### New Orchestrator Entrypoints

1. **AIOps** - AI operations entrypoint
   ```typescript
   export class AIOps extends BaseWorkerEntrypoint {
     async evaluateModel(prompt: string, model: string): Promise<EvaluationResult>;
     async routePrompt(prompt: string): Promise<RoutingDecision>;
     async generateStructuredOutput(prompt: string, schema: Schema): Promise<StructuredOutput>;
     async callTool(toolName: string, params: Record<string, unknown>): Promise<ToolResult>;
   }
   ```

2. **ContainerLoadBalancerOps** - Load balancer operations
   ```typescript
   export class ContainerLoadBalancerOps extends BaseWorkerEntrypoint {
     async scaleContainers(instances: number): Promise<ScaleResult>;
     async getContainerStatus(): Promise<ContainerStatus[]>;
     async restartContainer(containerId: string): Promise<void>;
     async healthCheck(containerId: string): Promise<HealthStatus>;
   }
   ```

3. **ContainerTaskQueueOps** - Task queue operations
   ```typescript
   export class ContainerTaskQueueOps extends BaseWorkerEntrypoint {
     async submitTask(task: TaskDefinition): Promise<string>; // Returns taskId
     async getTasks(filter: TaskFilter): Promise<Task[]>;
     async claimTask(workerName: string, containerName: string): Promise<Task | null>;
     async completeTask(taskId: string, output: string): Promise<void>;
     async failTask(taskId: string, error: string): Promise<void>;
   }
   ```

### Orchestrator Wrangler Config Updates

```jsonc
{
  "services": [
    {
      "binding": "ORCHESTRATOR_AI",
      "service": "vibehq-orchestrator",
      "entrypoint": "AIOps"
    },
    {
      "binding": "ORCHESTRATOR_LOAD_BALANCER",
      "service": "vibehq-orchestrator",
      "entrypoint": "ContainerLoadBalancerOps"
    },
    {
      "binding": "ORCHESTRATOR_TASK_QUEUE",
      "service": "vibehq-orchestrator",
      "entrypoint": "ContainerTaskQueueOps"
    }
  ]
}
```

## Import Path Adjustments

### Common Patterns

1. **AI Provider Imports**:
   - `ai-gateway-provider` → `@shared/ai-packages/ai-gateway-provider`
   - `workers-ai-provider` → `@shared/ai-packages/workers-ai-provider`

2. **AI Demo Imports**:
   - `demos/evaluator-optimiser` → `@shared/worker-base/ai/evaluator-optimiser`
   - `demos/agent-task-manager` → `@shared/worker-base/ai/agent-task-manager`
   - etc.

3. **Utils Imports**:
   - `libs/utils/fsm` → `@shared/ai-utils/fsm`

4. **Database Imports**:
   - All database operations → Orchestrator RPC entrypoints
   - No direct database imports in containers

## Migration Checklist

### Phase 1: AI Packages & Utils
- [ ] Copy `ai-gateway-provider` to `@shared/ai-packages/`
- [ ] Copy `workers-ai-provider` to `@shared/ai-packages/`
- [ ] Copy `libs/utils` (except logger) to `@shared/ai-utils/`
- [ ] Update import paths in copied files
- [ ] Create orchestrator `AIOps` entrypoint

### Phase 2: AI Demos
- [ ] Copy all AI demos to `@shared/worker-base/ai/`
- [ ] Update import paths
- [ ] Replace Durable Object storage with orchestrator RPC calls
- [ ] Add worker_name/container_name to all database operations
- [ ] Create Drizzle schemas for all AI tables

### Phase 3: Load Balancer
- [ ] Copy load balancer to `@shared/container-load-balancer/`
- [ ] Update to use orchestrator D1 for container state
- [ ] Create `ContainerLoadBalancerOps` entrypoint
- [ ] Add health check endpoints
- [ ] Integrate with container monitoring system

### Phase 4: Task Queue
- [ ] Copy SQLite demo to `@shared/container-task-queue/`
- [ ] Replace SQLite with orchestrator D1 schema
- [ ] Create `ContainerTaskQueueOps` entrypoint
- [ ] Implement task claiming and completion
- [ ] Add WebSocket support for real-time task updates

### Phase 5: Integration
- [ ] Update shared worker base templates
- [ ] Add AI capabilities to factory/specialist templates
- [ ] Update orchestrator wrangler.jsonc with new service bindings
- [ ] Create migration scripts for database schemas
- [ ] Update documentation

## Testing Requirements

1. **AI Functionality**:
   - Test AI model calls through orchestrator
   - Test routing decisions
   - Test structured output generation
   - Test tool calling

2. **Load Balancer**:
   - Test container scaling
   - Test health checks
   - Test container restart
   - Test load balancing

3. **Task Queue**:
   - Test task submission
   - Test task claiming
   - Test task execution
   - Test task completion
   - Test priority handling

4. **Database Integration**:
   - Verify all data stored in orchestrator D1
   - Verify worker_name/container_name populated
   - Test queries filtered by worker_name
   - Verify no local databases in containers

## Manual Factory/Specialist Creation

**Note**: This is for manual creation by user, not automated by orchestrator.

**Script**: `scripts/create-new-worker.sh` (or similar)

**Process**:
1. Copy shared worker base template
2. Configure worker-specific settings
3. Update orchestrator `wrangler.jsonc` with service binding
4. Initialize worker in orchestrator database
5. Deploy worker

**Template Includes**:
- AI capabilities (all demos, packages, tools)
- Load balancer integration
- Task queue integration
- Container monitoring
- Terminal integration
- WebSocket support
- Health checks

