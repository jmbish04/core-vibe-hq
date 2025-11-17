/**
 * @shared/base/prompts/endpoint-integration.ts
 *
 * Endpoint Integration prompt template.
 * Defines comprehensive requirements for multi-protocol Cloudflare Worker APIs.
 */

import type { PromptTemplate } from './types';

export const ENDPOINT_INTEGRATION_PROMPT: PromptTemplate = {
  id: 'endpoint-integration',
  name: 'Endpoint Integration Guidelines',
  description: 'Multi-protocol API requirements for Cloudflare Workers (REST + WebSocket + RPC + MCP) with OpenAPI 3.1.0 and GPT compliance',
  version: '1.0.0',
  tags: ['api', 'openapi', 'websocket', 'rpc', 'mcp', 'gpt', 'cloudflare'],
  priority: 90, // High priority - API design affects everything
  dependencies: ['cloudflare-base'],
  content: `<endpoint_integration_requirements>

You are implementing a multi-protocol Cloudflare Worker that must expose APIs through multiple interfaces while maintaining strict OpenAPI 3.1.0 compliance and GPT Action requirements.

<authentication_requirements>

**MANDATORY: WORKER_API_KEY Authentication**
- ALL endpoints MUST authenticate using WORKER_API_KEY secret in environment
- Authentication method: Bearer token in Authorization header
- Header format: "Authorization: Bearer {WORKER_API_KEY}"
- Reject all requests without valid WORKER_API_KEY
- Return 401 Unauthorized for invalid/missing API keys

</authentication_requirements>

<protocol_requirements>

**MANDATORY: Multi-Protocol Support**
1. **WebSocket API (PRIMARY/DEFAULT)**: Real-time interface using Durable Objects WebSocket Hibernation API
2. **REST API (FALLBACK)**: HTTP interface with identical methods (1:1 mapping)
3. **RPC Entry Points (CONDITIONAL)**: Direct service binding calls for Worker-to-Worker communication
4. **MCP Endpoints (CONDITIONAL)**: Model Context Protocol for AI agent integration

**CONDITIONAL ACTIVATION:**
- RPC support: Only if "rpc" or "service-bindings" requested in order sheet
- MCP support: Only if "mcp" requested in order sheet
- GPT support: Only if "gpt" requested in order sheet

</protocol_requirements>

<openapi_31_compliance>

**MANDATORY: OpenAPI 3.1.0 Specification**

openapi: 3.1.0

info:
  title: "Worker API"
  description: "Multi-protocol Cloudflare Worker API"
  version: "1.0.0"

servers:
  - url: "https://your-worker-name.cloudflareworkers.com"
    description: "Production Cloudflare Worker"

**PATHS OBJECT:**
- Maximum 30 operations total across all paths
- Each operation MUST have unique operationId
- operationId format: camelCase (getUser, createTask, runAnalysis)
- Each operation MUST have summary field
- Each operation MUST have at least one response (usually 200)

**SECURITY SCHEMES:**
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: "WORKER_API_KEY authentication"
security:
  - bearerAuth: []

</openapi_31_compliance>

<gpt_action_requirements>

**MANDATORY WHEN GPT SUPPORT REQUESTED**

**OpenAPI 3.1.0 Requirements:**
- openapi: 3.1.0 (not 3.0.x)
- Title, description, version in info block
- At least one server URL (production Worker URL)
- operationId on every method
- summary on every method
- At least one response per method
- Maximum 30 methods total

**GPT-Specific Limits:**
- Maximum 30 operations across entire API
- Each operation counts: GET /users, POST /users, PUT /users = 3 operations
- GPT Actions will fail if you exceed 30 operations

**operationId Rules:**
- Must be unique across all operations
- No spaces, alphanumeric + underscores
- Recommended: camelCase (getUserData, createNewTask)
- Used by GPT to reference functions in logic

**Response Schemas:**
- application/json responses MUST have schema definitions
- GPT uses schemas to understand response structure
- Include examples where helpful

**Hosting Requirements:**
- OpenAPI spec must be hosted on public URL
- Supported formats: .json, .yaml, .yml
- GPT fetches spec at setup time

</gpt_action_requirements>

<mcp_integration_requirements>

**MANDATORY WHEN MCP SUPPORT REQUESTED**

**MCP Server Endpoints:**
- GET /mcp/tools - List available tools
- POST /mcp/execute - Execute tools (JSON-RPC style)
- GET /mcp/schema - Tool schema definitions

**Tool Registration:**
- Each RPC method becomes an MCP tool
- Tool name = RPC method name
- Tool description from operation summary
- Tool schema from Zod validation schema

**Request/Response Format:**
POST /mcp/execute
{
  "tool": "methodName",
  "params": { ... }
}

Response:
{
  "success": true,
  "result": { ... }
}

</mcp_integration_requirements>

<websocket_implementation>

**MANDATORY: Durable Objects WebSocket Hibernation API**

**DO Implementation Requirements:**
- Use this.ctx.acceptWebSocket(server) - NOT server.accept()
- Implement webSocketMessage(), webSocketClose(), webSocketError()
- DO NOT use addEventListener pattern
- Support hibernation for connection persistence

**Message Format:**
{
  "type": "method_name",
  "payload": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "iso-string"
  }
}

**Connection Management:**
- Track connections via this.ctx.getWebSockets()
- Support project/room multiplexing via URL params
- Broadcast messages to all connections in room
- Handle connection lifecycle properly

</websocket_implementation>

<rpc_entrypoint_requirements>

**MANDATORY WHEN RPC SUPPORT REQUESTED**

**Service Binding Interface:**
- Expose WorkerEntrypoint class
- Support direct method calls via service bindings
- env.YOUR_WORKER.methodName(params)

**RPC Registry:**
- Central registry of all available methods
- Zod validation for all inputs/outputs
- Consistent error handling
- Type-safe method signatures

**Method Mapping:**
- 1:1 mapping with REST/WebSocket methods
- Same validation, same business logic
- Different transport, same behavior

</rpc_entrypoint_requirements>

<implementation_patterns>

**Code Organization:**
src/
  index.ts          # Main router/dispatcher
  rpc.ts            # Shared command registry
  router.ts         # REST routes (Hono)
  mcp.ts            # MCP server adapter
  do/RoomDO.ts      # WebSocket Durable Object
  schemas/          # Zod schemas for validation
  utils/openapi.ts  # Dynamic OpenAPI generation
  types.ts          # Type definitions

**Shared Command Registry:**
- Single source of truth for all methods
- Used by REST, WebSocket, RPC, and MCP
- Zod validation schemas
- Consistent error responses

**OpenAPI Generation:**
- Dynamic generation from Zod schemas
- zod-to-openapi for schema extraction
- Runtime generation at /openapi.json and /openapi.yaml
- Proper OpenAPI 3.1.0 compliance

**Error Handling:**
- Consistent error envelope across all protocols
- Proper HTTP status codes
- Structured error messages
- Security: Don't leak sensitive information

</implementation_patterns>

<security_headers>

**MANDATORY: Security Headers**
- Content-Security-Policy: default-src 'self'
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000; includeSubDomains

**CORS Configuration:**
- Enable CORS only for /api/* routes
- Allow specific origins (not *)
- Proper preflight handling

</security_headers>

<testing_validation>

**OpenAPI Validation:**
- Test /openapi.json and /openapi.yaml generation
- Validate against OpenAPI 3.1.0 schema
- Ensure operationId uniqueness
- Verify method count ≤ 30 for GPT

**Protocol Testing:**
- REST API: curl commands for all endpoints
- WebSocket: Connection, message sending/receiving
- RPC: Service binding calls from test worker
- MCP: Tool listing and execution

**Authentication Testing:**
- Valid WORKER_API_KEY works
- Invalid/missing API key returns 401
- All protocols respect authentication

</testing_validation>

<deployment_configuration>

**Wrangler Configuration:**
{
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  }
}

**Bindings (as needed):**
- Durable Objects for WebSocket rooms
- KV for session/caching if needed
- D1 for data persistence if needed
- Service bindings for RPC calls

**Environment Variables:**
- WORKER_API_KEY: Required for authentication
- Other service-specific keys as needed

</deployment_configuration>

<priority_order>

**Implementation Order:**
1. Define Zod schemas and RPC registry
2. Implement REST API routes
3. Add WebSocket Durable Object
4. Add RPC entry points (if requested)
5. Add MCP endpoints (if requested)
6. Generate OpenAPI specification
7. Add authentication and security
8. Testing and validation

**Testing Priority:**
1. Authentication works across all protocols
2. REST API functionality
3. WebSocket connections and messaging
4. OpenAPI generation and validity
5. RPC calls (if implemented)
6. MCP tools (if implemented)
7. Cross-protocol consistency

</priority_order>

</endpoint_integration_requirements>`
};

// Auto-register the template
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(ENDPOINT_INTEGRATION_PROMPT);
}
