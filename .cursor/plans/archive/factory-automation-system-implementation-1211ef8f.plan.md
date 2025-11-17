<!-- 1211ef8f-9cda-408a-bf03-f0b18ab39e7f a94c45c8-072d-428b-a765-df53369821c7 -->
# Factory Order Orchestration System

## Overview

Extend the factory automation system to support validated orders, template/placeholder management in D1, HIL (Human-in-the-Loop) workflows, and a unified Python tool with multiple interfaces. The system enables factories to receive orders, validate them, process placeholder replacements, and handle AI provider clarifications through a specialized orchestrator agent.

## Components

### 1. Shared TypeScript Order Validation

**Location**: `@shared/types/orders.ts`

- Create Zod schema for order validation extending existing `Order` interface
- Fields: `id`, `project_id`, `factory`, `template_name`, `overall_prompt`, `placeholder_payload` (JSON), `ai_provider`, `metadata`
- Export validation function `validateOrder(order: unknown): Order`
- Export type `ValidatedOrder` for use across workers

**Reference**: Extend `orchestrator/worker/entrypoints/tasks.ts` `TaskInstructionFile` structure

### 2. Factory Orchestrator Agent (Shared)

**Location**: `@shared/base/agents/FactoryOrchestratorAgent.ts`

- Extends `BaseFactoryAgent`
- `validateOrder(order: Order): Promise<ValidationResult>` - validates order schema
- `fulfillOrder(order: ValidatedOrder): Promise<OrderFulfillmentResult>` - orchestrates fulfillment:
  - Receives placeholder JSON payload from order
  - Saves payload to `/workspace/order_${order.id}_placeholders.json` in container
  - Calls Python script to process placeholders (see Python tool section)
- `reportValidationError(orderId: string, errors: string[]): Promise<void>` - communicates back to main orchestrator

**Integration**: Each factory worker will instantiate this agent with factory-specific config

### 3. D1 Database Schema Extensions

**Location**: `orchestrator/worker/database/schema.ts` (add to existing schema)

**New Tables** (use DB_OPS database):

- `template_files` - Stores template file metadata
  - Fields: `id`, `factory_name`, `template_name`, `file_path`, `is_active`, `created_at`, `updated_at`

- `template_placeholders` - Maps placeholders to template files
  - Fields: `id`, `template_file_id` (FK), `placeholder_id`, `placeholder_pattern`, `mini_prompt`, `is_active`, `created_at`, `updated_at`

- `order_placeholder_mappings` - Links orders to placeholder mappings
  - Fields: `id`, `order_id`, `project_id`, `template_file_id`, `placeholder_id`, `mini_prompt`, `created_at`

- `ai_provider_conversations` - Stores codex-cli/orchestrator conversations
  - Fields: `id`, `order_id`, `conversation_id`, `provider_name`, `question`, `response`, `solution`, `status`, `hil_triggered`, `created_at`, `updated_at`

- `hil_requests` - Human-in-the-loop requests
  - Fields: `id`, `order_id`, `conversation_id`, `question`, `context`, `status`, `user_response`, `resolved_at`, `created_at`, `updated_at`

**Migration**: Create `orchestrator/migrations/011_factory_order_tables.sql`

### 4. Orchestrator Agent for Order Initiation

**Location**: `orchestrator/worker/agents/OrderInitAgent.ts`

- Extends `BaseAgent`
- `initiateOrder(params): Promise<Order>` - Creates order with:
  - Validates template files exist in D1
  - Retrieves placeholder mappings from `template_placeholders` table
  - Generates mini-prompts for each placeholder using AI
  - Creates order record and `order_placeholder_mappings` entries
  - Returns validated order with placeholder payload JSON

**D1 Operations**:

- Query `template_files` filtered by `factory_name` and `is_active=true`
- Query `template_placeholders` for each template file
- Insert into `orders` and `order_placeholder_mappings` tables

### 5. Orchestrator Entrypoint for Template Management

**Location**: `orchestrator/worker/entrypoints/TemplateOps.ts`

**RPC Methods** (exposed via service binding):

- `upsertTemplateFile(params)` - Insert or update template file (soft delete via `is_active=false`)
- `upsertTemplatePlaceholder(params)` - Insert or update placeholder mapping
- `getTemplateFiles(factory_name, template_name?)` - List template files
- `getPlaceholdersForTemplate(template_file_id)` - Get placeholders for a template
- `getOrderPlaceholderMapping(order_id)` - Get placeholder mapping for an order

**REST API**: Add routes in `orchestrator/worker/api/routes/templateRoutes.ts`

- `GET /api/templates/:factory` - List templates
- `POST /api/templates` - Create/update template file
- `DELETE /api/templates/:id` - Soft delete (set `is_active=false`)
- `GET /api/templates/:id/placeholders` - Get placeholders
- `POST /api/templates/:id/placeholders` - Add/update placeholder
- `GET /api/orders/:orderId/placeholders` - Get order placeholder mapping

**WebSocket**: Add message types for template updates (extend `websocketTypes.ts`)

### 6. Specialized Orchestrator Agent for AI Provider Clarifications

**Location**: `orchestrator/worker/agents/AiProviderClarificationAgent.ts`

- Extends `BaseAgent`
- `handleClarificationRequest(params): Promise<ClarificationResponse>`:
  - Receives question from codex-cli (or other AI provider)
  - Looks up order, template files, placeholder maps from D1
  - Uses AI to analyze question vs order requirements
  - Returns clarification response
  - Logs conversation to `ai_provider_conversations` table
- `evaluateComplexity(conversation): Promise<boolean>` - Determines if HIL needed:
  - Threshold logic: number of unresolved questions > 3 OR confidence < 0.7 OR question complexity score > 8/10
- `triggerHIL(orderId, conversationId, question): Promise<HilRequest>` - Creates HIL request

**D1 Operations**:

- Query `order_placeholder_mappings` by `order_id`
- Query `template_files` and `template_placeholders` for context
- Insert conversation into `ai_provider_conversations`
- Insert HIL request into `hil_requests` if threshold exceeded

### 7. HIL Management Entrypoint

**Location**: `orchestrator/worker/entrypoints/HilOps.ts`

**RPC Methods**:

- `getHilRequests(orderId?, status?)` - List HIL requests
- `getHilRequest(id)` - Get specific HIL request
- `submitHilResponse(id, userResponse)` - Submit human response
- `updateHilStatus(id, status)` - Update request status

**REST API**: Add routes in `orchestrator/worker/api/routes/hilRoutes.ts`

- `GET /api/hil/requests` - List requests (with filters)
- `GET /api/hil/requests/:id` - Get request details
- `POST /api/hil/requests/:id/response` - Submit response
- `PATCH /api/hil/requests/:id/status` - Update status

**WebSocket**: Broadcast HIL notifications to frontend when requests created/resolved

### 8. Unified Python Tool with Multiple Interfaces

**Location**: `packages/factory-orchestrator-tool/`

**Structure**:

```
factory_orchestrator_tool/
  __init__.py
  main.py              # CLI/TUI entrypoint with typer
  api.py               # FastAPI server
  mcp_server.py        # MCP server implementation
  modules/
    placeholder_processor.py  # Process placeholders in cloned files
    order_validator.py        # Validate order structure
    template_manager.py       # Template file operations
```

**Features**:

- **CLI**: `factory-orchestrator --command <cmd> [args]` with menu wizard
- **TUI**: Interactive menu using `rich` or `textual`
- **MCP**: Expose as MCP tool for agents
- **FastAPI**: REST API server on port 8000

**Core Function**: `process_placeholders(order_id, placeholder_json_path, workspace_path)`

- Reads placeholder JSON from file
- Scans workspace for template files
- For each placeholder: finds `/** PLACEHOLDER_ID **/` pattern
- Inserts comment docstring + newline + placeholder:
  ```typescript
  /** agent: mini prompt from JSON **/
  /** PLACEHOLDER_ID **/
  ```


### 9. Container Bash Script for AI Providers

**Location**: `@shared/factory-templates/scripts/ask-orchestrator.sh`

- Simple wrapper: `./ask-orchestrator --question "..." --order-id <id>`
- Calls orchestrator REST API: `POST /api/ai-provider/clarify`
- Returns JSON response for codex-cli to parse
- Handles errors and retries

### 10. Python Tool Integration

**Location**: `packages/factory-orchestrator-tool/pyproject.toml`

- Add to base Dockerfile installation
- Expose as MCP tool in factory orchestrator agent
- Add FastAPI server startup in container init script

### 11. Borrow from STAGING

**From STAGING/ai/demos/agent-task-manager-human-in-the-loop**:

- Copy `TaskManagerAgent.ts` pattern for confirmation/HIL workflow
- Adapt confirmation pattern to HIL request workflow
- Copy REST API structure for confirmations → adapt to HIL requests

**From STAGING/vibesdk** (general recommendations):

- `worker/api/routes/` structure for REST API organization
- `worker/database/services/` pattern for D1 service layer
- WebSocket message type definitions pattern
- Agent state management patterns

**Migration Script**: Create `scripts/migrate-staging-patterns.sh` to copy and adapt files

### 12. API Integration Points

**REST API Routes** (add to `orchestrator/worker/api/routes/index.ts`):

- `/api/templates/*` - Template management
- `/api/orders/:orderId/placeholders` - Order placeholder retrieval
- `/api/ai-provider/clarify` - AI provider clarification endpoint
- `/api/hil/*` - HIL management

**WebSocket Messages** (extend `websocketTypes.ts`):

- `hil_request_created` - Notify frontend of new HIL request
- `hil_request_resolved` - Notify when HIL resolved
- `template_updated` - Notify of template changes
- `order_placeholder_mapping_updated` - Notify of mapping changes

**RPC Entrypoints**:

- `TemplateOps` - Template CRUD operations
- `HilOps` - HIL request management
- Extend `Factory` entrypoint with clarification methods

## Implementation Order

1. Create shared order validation types (`@shared/types/orders.ts`)
2. Extend D1 schema with new tables (migration 011)
3. Create `OrderInitAgent` for orchestrator
4. Create `TemplateOps` entrypoint with RPC/REST/WebSocket
5. Create `FactoryOrchestratorAgent` (shared)
6. Create Python tool with placeholder processor
7. Create `AiProviderClarificationAgent`
8. Create `HilOps` entrypoint
9. Create container bash script
10. Integrate Python tool into factory containers
11. Copy and adapt STAGING patterns
12. Add REST/WebSocket routes
13. Update factory agents to use `FactoryOrchestratorAgent`

## Dependencies

- Existing: `orders`, `tasks` tables in DB_OPS
- Existing: `BaseAgent`, `BaseFactoryAgent` classes
- Existing: REST API routing structure
- Existing: WebSocket message types
- New: Python dependencies (typer, rich, fastapi, mcp)
- New: D1 migration for template/placeholder/HIL tables