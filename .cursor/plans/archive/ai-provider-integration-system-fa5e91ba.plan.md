<!-- fa5e91ba-3f61-4e16-b515-04bfcfbe4eae 1d0ac204-a42b-458a-a2b3-7bf1562466ac -->
# AI Provider Integration System

## Overview

This plan implements a comprehensive AI provider integration system that allows tasks to be automatically routed to appropriate AI coding agents (Jules, Codex, Gemini, Claude, Cursor, GitHub Copilot) based on task characteristics. The system supports both GitHub-based workflows (Jules) and container-based CLI execution (other providers), with all providers outputting structured patches that flow through the Patch Manager.

## Architecture Components

### 1. AI Provider Routing System (`orchestrator/worker/services/ai-providers/`)

**Routing Logic** (`router.ts`):

- Automatic provider selection based on:
  - `task.type` (generate, fix, refactor, optimize)
  - `sourceContext` (GitHub branch vs local factory)
  - `priority` and `cost_profile`
  - `preferredModel` tag from project settings
- Provider-specific rules:
  - Jules: Only when `repo` + `branch` exists in GitHub
  - CLI agents: For incremental code generation/refactoring in factory containers
- Manual override support per order

**Provider Registry** (`registry.ts`):

- Provider definitions with capabilities, cost, availability
- Health checks and status tracking
- Fallback chains for provider failures

### 2. Database Schema Updates (`orchestrator/worker/database/schema.ts`)

**New Tables**:

- `ai_provider_assignments`: Links tasks to AI providers
  - `task_uuid`, `provider_name`, `provider_type` (jules|cli), `status`, `execution_id`
- `ai_provider_executions`: Tracks execution history
  - `execution_id`, `provider_name`, `task_uuid`, `input`, `output`, `patch_data`, `status`, `duration_ms`
- `ai_provider_configs`: Provider-specific configurations
  - `provider_name`, `api_endpoint`, `default_model`, `rate_limits`, `cost_per_token`

### 3. Jules Integration (`orchestrator/worker/services/ai-providers/jules/`)

**Jules Client** (`julesClient.ts`):

- API client for Jules task creation
- Handles both scenarios:
  - Existing repositories: Direct operation against GitHub
  - New builds: Factory commits to `factory/<order-id>` branch first
- Task payload structure:
  ```typescript
  {
    repo: "github.com/owner/repo",
    branch: "factory/ORD-12345",
    task_type: "refactor",
    context: "logging pipeline migration",
    instructions: "..."
  }
  ```


**Jules Task Handler** (`julesHandler.ts`):

- Polls Jules API for task completion
- Webhook receiver for Jules callbacks
- Converts Jules output to structured patch format

### 4. CLI Agent Container Integration

**Base Container** (`factory-base.Dockerfile`):

- Node.js 22 base with Python 3
- Pre-installed CLI tools:
  - `codex-cli`, `@google/gemini-cli`, `@anthropic/claude-cli`
  - `cursor-agent-cli`, `github-copilot-cli`
- Shared scripts in `/usr/local/bin/`
- Patch Manager Python script included

**Per-Factory Overlay** (e.g., `apps/agent-factory/Dockerfile`):

- Extends `factory-base:latest`
- Factory-specific dependencies
- Custom entrypoints

**CLI Agent Service** (`orchestrator/worker/services/ai-providers/cli/`):

- `cliAgentService.ts`: Manages CLI container execution
- Queue consumer for CLI tasks
- Environment variable injection (API keys, GitHub token)
- Structured output parsing

### 5. Orchestrator Entrypoints

**New Entrypoint** (`orchestrator/worker/entrypoints/AIProviderOps.ts`):

- `assignProvider(taskId, preferredProvider?)`: Auto-assign or manually assign provider
- `executeTask(taskId, provider?)`: Execute task with specified provider
- `getProviderStatus(providerName)`: Health check and availability
- `listAvailableProviders(taskId)`: Get suitable providers for a task

**Service Binding** (`@shared/base/wrangler.base.jsonc`):

- Add `ORCHESTRATOR_AI_PROVIDER` binding to orchestrator entrypoint

### 6. Secret Management

**Secret Injection** (`orchestrator/worker/services/secrets/`):

- `secretService.ts`: Retrieves secrets from Cloudflare Workers secrets
- Secrets stored as:
  - `JULES_API_KEY`
  - `CODEX_API_KEY`
  - `GEMINI_API_KEY`
  - `CLAUDE_API_KEY`
  - `CURSOR_API_KEY`
  - `GITHUB_TOKEN`
- Injected as environment variables to containers at runtime
- Never persisted in code or logs

### 7. Patch Manager Integration

**Structured Patch Format**:

```typescript
interface AIPatch {
  task_id: string
  file: string
  operation: "replace-block" | "insert-before" | "insert-after" | "append"
  start?: number
  end?: number
  line?: number
  block: string
  metadata: {
    provider: string
    confidence?: number
    model?: string
  }
}
```

**Patch Processing** (`orchestrator/worker/services/patch-manager/`):

- `patchProcessor.ts`: Validates and processes AI-generated patches
- Calls Patch Manager Python script via RPC or local execution
- Logs to `operation_logs` with patch metadata
- Triggers validation phase on success
- Creates remediation tasks on failure

### 8. Container Configuration Updates

**Wrangler Config** (`orchestrator/wrangler.jsonc`):

- Add container definitions for AI provider execution
- Environment variables for secret injection
- Queue bindings for async task processing

**Factory Wrangler Configs** (e.g., `apps/agent-factory/wrangler.jsonc`):

- Reference base container image
- Factory-specific overrides
- Service bindings to orchestrator

### 9. Queue System

**New Queue** (`ai-provider-tasks`):

- Messages contain:
  - `task_id`, `provider`, `factory`, `cli_command`, `env_vars`
- Processed by orchestrator or factory workers
- Retry logic for failed executions
- Dead letter queue for unrecoverable failures

### 10. Monitoring & Logging

**Operation Logging**:

- All AI provider executions logged to `operation_logs`
- Execution metrics (duration, token usage, cost)
- Provider health tracking
- Error tracking and alerting

## Implementation Phases

### Phase 1: Foundation

1. Database schema migrations for AI provider tables
2. Base container Dockerfile with CLI toolchain
3. Secret service for API key management
4. Basic routing logic in orchestrator

### Phase 2: Jules Integration

1. Jules API client implementation
2. GitHub branch management for factory commits
3. Jules task creation and polling
4. Webhook handler for Jules callbacks

### Phase 3: CLI Agent Integration

1. CLI agent service implementation
2. Container execution orchestration
3. Environment variable injection
4. Structured output parsing

### Phase 4: Patch Manager Integration

1. Structured patch format definition
2. Patch processor service
3. Integration with existing Patch Manager Python script
4. Validation and remediation workflows

### Phase 5: Orchestration & Routing

1. AIProviderOps entrypoint implementation
2. Automatic routing logic
3. Provider health checks
4. Fallback mechanisms

### Phase 6: Testing & Documentation

1. Unit tests for routing logic
2. Integration tests for each provider
3. Documentation for provider setup
4. Deployment guides

## Files to Create/Modify

**New Files**:

- `orchestrator/worker/services/ai-providers/router.ts`
- `orchestrator/worker/services/ai-providers/registry.ts`
- `orchestrator/worker/services/ai-providers/jules/julesClient.ts`
- `orchestrator/worker/services/ai-providers/jules/julesHandler.ts`
- `orchestrator/worker/services/ai-providers/cli/cliAgentService.ts`
- `orchestrator/worker/services/secrets/secretService.ts`
- `orchestrator/worker/services/patch-manager/patchProcessor.ts`
- `orchestrator/worker/entrypoints/AIProviderOps.ts`
- `factory-base.Dockerfile`
- `docs/ai-providers/INTEGRATION.md`

**Modified Files**:

- `orchestrator/worker/database/schema.ts` (add AI provider tables)
- `orchestrator/wrangler.jsonc` (container config, queue bindings)
- `@shared/base/wrangler.base.jsonc` (AI provider service binding)
- `orchestrator/worker/entrypoints/tasks.ts` (integrate provider assignment)
- `apps/agent-factory/wrangler.jsonc` (container reference)
- `orchestrator/migrations/` (new migration for AI provider tables)

## Security Considerations

- All API keys stored as Cloudflare Workers secrets
- Secrets injected at runtime only, never in code
- Patch Manager validates all code changes before application
- GitHub token scoped to minimal required permissions
- Container isolation prevents secret leakage

## Success Criteria

- Tasks automatically routed to appropriate AI providers
- Jules successfully creates tasks for GitHub-based code
- CLI agents execute in containers with proper secret injection
- All providers output structured patches processed by Patch Manager
- Complete audit trail of all AI-generated code changes
- Zero hardcoded secrets in codebase