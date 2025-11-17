# STAGING Patterns Adapted

This document tracks patterns from `STAGING/` that have been adapted for the factory order orchestration system.

## Human-in-the-Loop (HIL) Pattern

**Source**: `STAGING/ai/demos/agent-task-manager-human-in-the-loop/`

**Pattern Adapted**: Confirmation/approval workflow for AI-generated actions

**Original Pattern**:
- Uses Durable Objects for stateful agent management
- Creates `Confirmation` objects that wait for human approval
- REST API endpoint: `POST /confirmations/:confirmationId` with `{ agentId, confirm: boolean }`
- Agent method: `confirm(confirmationId, userConfirmed)`

**Our Adaptation**:
- Uses stateless WorkerEntrypoint pattern (no Durable Objects)
- Creates `hil_requests` table in D1 for persistence
- REST API endpoint: `POST /api/hil/requests/:id/response` with `{ user_response: string }`
- RPC method: `HilOps.submitHilResponse({ id, user_response })`
- Status-based workflow: `pending` → `in_progress` → `resolved` / `cancelled`

**Key Differences**:
1. **State Management**: Durable Objects (STAGING) vs D1 + WorkerEntrypoint (our system)
2. **Confirmation Model**: Simple boolean confirm (STAGING) vs text response (our system)
3. **Workflow**: Immediate action on confirm (STAGING) vs async resolution with context (our system)

**Files Created**:
- `orchestrator/worker/agents/AiProviderClarificationAgent.ts` - Handles clarification requests and triggers HIL
- `orchestrator/worker/entrypoints/HilOps.ts` - Manages HIL requests via RPC
- `orchestrator/worker/api/routes/hilRoutes.ts` - REST API for HIL management
- `orchestrator/worker/database/ops/schema.ts` - `hil_requests` table definition

## Notes

The STAGING pattern was designed for Durable Objects, which maintain stateful agent instances. Our system uses stateless workers with D1 for persistence, so we adapted the confirmation pattern to work with our architecture while maintaining the core human-in-the-loop concept.

