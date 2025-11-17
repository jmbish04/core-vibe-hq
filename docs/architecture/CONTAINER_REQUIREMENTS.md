# Container Requirements Documentation

This document outlines the container requirements for apps/* worker containers based on the Vibe SDK official repository samples and demo examples.

## Overview

All factory and specialist worker containers should be based on the Vibe SDK container infrastructure, which provides:
- Process monitoring and management
- Error and log storage
- CLI tools for development
- Terminal access via xterm.js
- WebSocket communication capabilities

## Base Container Requirements

### 1. Base Image: Cloudflare Sandbox

Based on `STAGING/vibesdk/SandboxDockerfile`:

```dockerfile
FROM docker.io/cloudflare/sandbox:0.4.14
```

**Key Features:**
- Cloudflare's official sandbox image
- Multi-architecture support (amd64, arm64)
- Includes cloudflared for tunneling
- Git pre-configured

### 2. Process Monitoring System

**Location**: `/workspace/container/` (from Vibe SDK)

**Components**:
- `cli-tools.ts` - Main CLI interface for process management
- `process-monitor.ts` - Process lifecycle management
- `storage.ts` - SQLite-based error and log storage
- `types.ts` - TypeScript type definitions

**Key Capabilities**:
- Start/stop/status process management
- Automatic restart on crashes (configurable max restarts)
- Error detection and storage (SQLite)
- Log aggregation and storage
- Health monitoring

**CLI Commands**:
```bash
# Start a process
bun run cli-tools.ts process start --instance-id my-app --port 8080 -- bun run dev

# Check status
bun run cli-tools.ts process status --instance-id my-app

# View errors
bun run cli-tools.ts errors list --instance-id my-app

# View logs
bun run cli-tools.ts logs get --instance-id my-app --format raw
```

### 3. Required Dependencies

**System Packages**:
- `git` - Version control
- `ca-certificates` - SSL certificates
- `curl` - HTTP client
- `procps` - Process utilities
- `net-tools` - Network utilities
- `cloudflared` - Cloudflare tunnel (latest release)

**Runtime**:
- `bun` - JavaScript runtime (for container scripts)
- `Node.js 22` - For application runtime
- `Python 3` - For patch management and utilities
- `tsc` (TypeScript compiler) - Via bunx

**Container Scripts**:
- Process monitoring CLI (`cli-tools.ts`)
- Storage manager (`storage.ts`)
- Process monitor (`process-monitor.ts`)

### 4. Directory Structure

```
/workspace/
├── container/          # Process monitoring system
│   ├── cli-tools.ts
│   ├── process-monitor.ts
│   ├── storage.ts
│   ├── types.ts
│   └── package.json
├── data/               # SQLite databases for errors/logs
│   ├── errors.db
│   └── logs.db
└── [app workspace]     # Application code
```

## Terminal Integration (xterm.js)

### Requirements

Based on `STAGING/containers-demos/terminal/`:

**Backend (Container)**:
- Node.js WebSocket server using `node-pty`
- Exposes WebSocket endpoint at `/terminal` (or `/ws`)
- Creates PTY (pseudo-terminal) for each connection
- Handles terminal I/O bidirectionally

**Frontend (Worker)**:
- xterm.js library (v5.3.0)
- xterm-addon-attach (v0.9.0)
- xterm-addon-fit (v0.8.0)
- WebSocket connection to container
- Terminal UI component

**Implementation Pattern**:
```typescript
// Container extends Cloudflare Container
export class TerminalContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "1h";
  enableInternet = true;

  async fetch(request: Request): Promise<Response> {
    return await this.containerFetch(request, this.defaultPort);
  }
}
```

**Worker Route**:
```typescript
if (url.pathname === "/terminal") {
  return await getContainer(env.TERMINAL).fetch(request);
}
```

### Integration Points

1. **Factory/Specialist Worker Frontend**:
   - Terminal component available in diagnostics panel
   - Accessible via `/diagnostics/terminal` route
   - Real-time terminal output and input

2. **Global Monitoring View**:
   - Grid layout showing all factory/specialist terminals
   - Route: `/monitoring/terminals`
   - Each terminal in its own grid cell
   - Auto-refresh and reconnection handling

## WebSocket Integration

### Requirements

Based on `STAGING/containers-demos/websockets/`:

**Pattern**: Durable Object → Container WebSocket

**Key Capabilities**:
- Durable Object can open WebSocket to container
- Standard WebSocket upgrade from Worker to Container
- Client connects directly to container via Worker proxy

**Implementation Pattern**:
```typescript
export class Container extends DurableObject<Env> {
  container: globalThis.Container;
  conn?: WebSocket;

  async initWebsocket() {
    if (!this.container.running) this.container.start();
    
    const res = await this.container.getTcpPort(8080).fetch(
      new Request('http://container/ws', { 
        headers: { Upgrade: 'websocket' } 
      })
    );
    
    if (res.webSocket === null) throw new Error('websocket server is faulty');
    res.webSocket.accept();
    this.conn = res.webSocket;
  }
}
```

**Worker Proxy**:
```typescript
// Worker can proxy WebSocket requests to container
const res = await container.getTcpPort(8080).fetch(request);
// Client connects directly to container
```

## Container Configuration

### Environment Variables

```dockerfile
ENV CONTAINER_ENV=docker
ENV VITE_LOGGER_TYPE=json
ENV PORT=8080
```

### Port Exposure

```dockerfile
EXPOSE 3000  # Application port (configurable)
EXPOSE 8080  # Terminal/WebSocket port
```

### Startup Script

The container should use a startup script that:
1. Initializes the process monitoring system
2. Starts the application process via `cli-tools.ts`
3. Handles graceful shutdown

## Integration with Factory Base Dockerfile

The `@shared/factory-templates/factory-base.Dockerfile` should:

1. **Extend Cloudflare Sandbox**:
   ```dockerfile
   FROM docker.io/cloudflare/sandbox:0.4.14
   ```

2. **Install Process Monitoring System**:
   ```dockerfile
   COPY container/ /workspace/container/
   WORKDIR /workspace/container
   RUN bun install && bun run build
   ```

3. **Install Node.js 22 and Python 3**:
   ```dockerfile
   # Node.js 22
   RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
       && apt-get install -y nodejs
   
   # Python 3
   RUN apt-get install -y python3 python3-pip
   ```

4. **Install Patch Management**:
   ```dockerfile
   COPY patch_manager.py /usr/local/bin/shared-scripts/
   COPY patchctl /usr/local/bin/
   RUN chmod +x /usr/local/bin/patchctl
   ```

5. **Set Up Data Directories**:
   ```dockerfile
   RUN mkdir -p /workspace/data
   RUN chmod 755 /workspace/data
   ```

## Frontend Integration Requirements

**Note**: Frontend development is handled separately with its own backlog. This section documents the goal/context only.

### 1. Terminal Component

**Location**: `@shared/frontend/components/terminal/` (for reference)

**Features** (for frontend team):
- xterm.js integration
- WebSocket connection management
- Auto-reconnect on disconnect
- Terminal resizing
- Copy/paste support

### 2. Global Terminal Monitoring

**Location**: UI Factory or main frontend (for frontend team)

**Goal**: Show multiple xterm.js terminals in a single view

**Features** (for frontend team):
- Grid layout (responsive)
- One terminal per factory/specialist
- Terminal status indicators
- Connection status
- Full-screen mode for individual terminals
- Terminal filtering/search

**Route Structure** (for frontend team):
- `/monitoring/terminals` - Grid view
- `/monitoring/terminals/:workerId` - Single terminal view
- `/diagnostics/terminal` - Per-worker diagnostics terminal

**Backend Support**:
- Orchestrator provides unified interface for multiple terminals
- Route: `/api/workers/:workerName/terminal` (WebSocket proxy)
- Orchestrator aggregates connections from all bound workers

## Architecture Requirements

### Monitoring System Access

The monitoring system must be accessible via **three interfaces**:

1. **REST API**: `/api/monitoring/*` endpoints
   - Process status: `GET /api/monitoring/process/:instanceId/status`
   - Error list: `GET /api/monitoring/errors/:instanceId`
   - Log retrieval: `GET /api/monitoring/logs/:instanceId`
   - Process control: `POST /api/monitoring/process/:instanceId/start|stop`

2. **WebSocket API**: `/ws/monitoring`
   - Real-time process status updates
   - Streaming log output
   - Error notifications
   - Process lifecycle events

3. **RPC Entrypoint**: `ContainerMonitoringOps` class
   - Extends `BaseWorkerEntrypoint`
   - Methods: `getProcessStatus()`, `getErrors()`, `getLogs()`, `startProcess()`, `stopProcess()`
   - Used by orchestrator via service bindings
   - Supports streaming responses

### Database Architecture

**CRITICAL**: All databases must be on orchestrator (D1), NOT in containers.

- **No SQLite databases in containers**
- Containers send monitoring data to orchestrator via RPC entrypoint
- Orchestrator stores data in D1 with worker/container identification
- All tables must include `worker_name` and `container_name` columns
- Use Drizzle ORM + Kysely for schema definitions

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

Each container worker exposes `ContainerMonitoringOps` entrypoint:

```typescript
export class ContainerMonitoringOps extends BaseWorkerEntrypoint {
  async getProcessStatus(instanceId: string): Promise<ProcessStatus> {
    // Implementation
  }
  
  async getErrors(instanceId: string): Promise<Error[]> {
    // Implementation - sends to orchestrator
  }
  
  async getLogs(instanceId: string): Promise<ReadableStream<Log>> {
    // Implementation - streaming
  }
}
```

Orchestrator wrangler.jsonc includes:
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

## Testing Requirements

1. **Container Build**:
   - Verify all dependencies install correctly
   - Test process monitoring CLI
   - Verify terminal server starts

2. **Terminal Integration**:
   - Test WebSocket connection
   - Verify PTY creation
   - Test terminal I/O
   - Test reconnection
   - Test orchestrator proxy access

3. **WebSocket Integration**:
   - Test DO → Container WebSocket
   - Test Worker → Container proxy
   - Test Orchestrator → Container proxy
   - Test client → Orchestrator → Container connection

4. **Process Monitoring**:
   - Test process start/stop via REST API
   - Test process start/stop via WebSocket
   - Test process start/stop via RPC entrypoint
   - Test error detection and routing to orchestrator
   - Test log aggregation and routing to orchestrator
   - Test automatic restart
   - Test streaming responses

5. **Database Integration**:
   - Verify all monitoring data stored in orchestrator D1
   - Verify worker_name/container_name columns populated
   - Test queries filtered by worker_name
   - Verify no SQLite databases in containers

## Migration Path

1. Update `@shared/factory-templates/factory-base.Dockerfile` with Vibe SDK base
2. Copy container monitoring system from Vibe SDK
3. Integrate terminal server (node-pty)
4. Add WebSocket support
5. Create frontend terminal components
6. Build global monitoring view
7. Test end-to-end integration

## References

- Vibe SDK Container: `/Volumes/Projects/workers/core-vibe-hq/STAGING/vibesdk/container/`
- Terminal Demo: `/Volumes/Projects/workers/core-vibe-hq/STAGING/containers-demos/terminal/`
- WebSocket Demo: `/Volumes/Projects/workers/core-vibe-hq/STAGING/containers-demos/websockets/`
- Sandbox Dockerfile: `/Volumes/Projects/workers/core-vibe-hq/STAGING/vibesdk/SandboxDockerfile`

