# Factory Shared Infrastructure

This directory contains the shared base configuration and templates for all VibeHQ factories.

## Structure

```
@shared/factory-templates/
├── factory-base.Dockerfile      # Base Docker image with Node 22, Python, Wrangler, and AI CLIs
├── wrangler.partial.jsonc       # Partial Wrangler config to merge into factory wrangler.jsonc
├── scripts/
│   └── init_factory.sh          # Helper script to initialize a new factory locally
└── README.md                    # This file
```

## Base Dockerfile

The `factory-base.Dockerfile` provides:

- **Node.js 22** - Latest LTS Node.js runtime
- **Bun** - Fast JavaScript runtime for monitoring and tooling
- **Python 3** - For Python-based tooling and REST API monitoring
- **Cloudflare Wrangler** - For deploying Workers
- **Multi-API Monitoring** - REST, WebSocket, and RPC monitoring infrastructure
- **AI CLI Toolchain** - Pre-installed but dormant:
  - Codex CLI
  - Google Gemini CLI
  - Anthropic Claude CLI
  - Cursor Agent CLI
  - GitHub Copilot CLI

**Note**: AI CLI tools are installed but remain inactive until their API keys are injected at runtime by the orchestrator.

### Multi-API Monitoring System

The factory base image includes a comprehensive monitoring system:

- **REST API Monitoring** (`monitoring/rest_monitor.py`):
  - FastAPI-based health checks and metrics
  - Component status tracking (REST, WebSocket, RPC, AI providers)
  - System resource monitoring (memory, CPU)

- **WebSocket Monitoring** (`monitoring/ws_monitor.py`):
  - WebSocket connectivity testing
  - Connection health checks
  - Message throughput monitoring

- **Bun/Node.js Monitoring** (`monitoring/monitor.js`):
  - JavaScript-based monitoring server
  - Integrated health check endpoints
  - Real-time metrics collection

**Health Check Endpoints**:
- `GET /health` - Overall system health
- `GET /metrics` - Detailed performance metrics
- `POST /check/rest` - REST API connectivity
- `POST /check/websocket` - WebSocket connectivity
- `POST /check/rpc` - RPC connectivity
- `POST /check/all` - All components health

## Wrangler Partial Config

The `wrangler.partial.jsonc` provides:

- Standard service bindings to orchestrator entrypoints
- Common environment variables
- Observability configuration
- Build configuration pointing to the shared Dockerfile

Each factory should extend this partial config:

```jsonc
{
  "$ref": "../../@shared/base/wrangler.base.jsonc",
  "name": "your-factory-name",
  "main": "worker/index.ts",
  // factory-specific overrides
}
```

## Initialization

### Manual Initialization (Local)

Use the helper script to initialize a new factory locally:

```bash
./@shared/factory-templates/scripts/init_factory.sh agent-factory
```

This creates:
- `apps/agent-factory/Dockerfile` (copied from base)
- `apps/agent-factory/wrangler.jsonc` (copied from partial)

### Programmatic Initialization (Orchestrator)

Use the orchestrator's `FactoryOps` entrypoint to initialize a factory programmatically:

```typescript
// From an apps worker or orchestrator
const result = await env.ORCHESTRATOR_FACTORY.initializeFactory({
  factory_name: 'new-factory',
  factory_type: 'agent',
  create_pr: true,
  order_id: 'order-123',
  task_uuid: 'task-456'
})
```

This will:
1. Create a new branch `factory/new-factory-init`
2. Generate all necessary files:
   - `apps/new-factory/wrangler.jsonc`
   - `apps/new-factory/worker/index.ts`
   - `apps/new-factory/package.json`
   - `apps/new-factory/README.md`
   - `.github/workflows/deploy-new-factory.yml`
3. Commit all files to GitHub
4. Optionally create a PR for review

## Integration Summary

- All factories inherit: Node 22 + Python + Wrangler + AI CLIs
- API keys injected at runtime by the orchestrator (never baked into images)
- Wrangler partial standardizes:
  - Service bindings → orchestrator RPC entrypoints
  - Observability configuration
  - Common environment variables
- Orchestrator controls which provider runs each task (via `AI_PROVIDER` var in queue payload)
- Patch Manager remains single gateway for all code mutations

## Architecture

The shared infrastructure enables:

1. **Consistency**: All factories use the same base image and configuration patterns
2. **Security**: API keys are injected at runtime, never stored in images
3. **Flexibility**: Each factory can override specific settings while inheriting common config
4. **Automation**: Factories can be initialized programmatically via orchestrator RPC

## Next Steps

After initializing a factory:

1. Customize `wrangler.jsonc` with factory-specific settings
2. Implement factory-specific logic in `worker/index.ts`
3. Add factory-specific dependencies to `package.json`
4. Create factory-specific agents/tools in `worker/agents/` or `worker/tools/`
5. Deploy via GitHub Actions workflow (automatically created)




