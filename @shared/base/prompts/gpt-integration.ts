/**
 * @shared/base/prompts/gpt-integration.ts
 *
 * GPT Integration prompt template.
 * Defines requirements for creating GPT Action compatible OpenAPI schemas (top 30 methods).
 */

import type { PromptTemplate } from './types';

export const GPT_INTEGRATION_PROMPT: PromptTemplate = {
  id: 'gpt-integration',
  name: 'GPT Action Integration',
  description: 'Requirements for creating OpenAPI 3.1.0 schemas compatible with GPT Actions (30 method limit)',
  version: '1.0.0',
  tags: ['gpt', 'openapi', 'actions', 'ai', 'integration'],
  priority: 95, // Very high - GPT integration is specialized and critical
  dependencies: ['endpoint-integration'],
  content: `<gpt_integration_requirements>

You are creating a specialized OpenAPI schema for GPT Actions integration. This is SEPARATE from your main OpenAPI schema and has strict limits and requirements.

<gpt_action_limitations>

**CRITICAL LIMITS:**
- Maximum 30 operations (methods) total across ALL paths
- Each HTTP method counts separately: GET /users, POST /users, DELETE /users = 3 operations
- GPT setup will FAIL if you exceed 30 operations
- Choose only the most essential methods that GPT users will need

**Selection Strategy:**
- Prioritize read operations (GET methods) over write operations
- Include essential CRUD operations for core entities
- Focus on methods that enable GPT to perform useful tasks
- Prefer methods that return structured data over simple status responses

</gpt_action_limitations>

<openapi_31_gpt_requirements>

**MANDATORY OpenAPI 3.1.0 Structure:**

openapi: 3.1.0

info:
  title: "GPT Actions API"  # Different from main API title
  description: "Top 30 essential methods for GPT Actions"
  version: "1.0.0"

servers:
  - url: "https://your-worker-name.cloudflareworkers.com"
    description: "GPT Actions API Endpoint"

**Paths Section:**
- Only include paths with the top 30 most essential operations
- Each path must have operationId (unique, camelCase)
- Each operation must have summary
- Each operation must have at least one response with schema

**Components:**
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: "WORKER_API_KEY for GPT Actions"
  schemas:
    # Include only schemas used in the top 30 operations

security:
  - bearerAuth: []

</openapi_31_gpt_requirements>

<method_selection_guidelines>

**Essential Method Categories (Priority Order):**

1. **Data Retrieval (High Priority - 40% of methods):**
   - GET methods to fetch data
   - List/search operations
   - Status checks
   - Configuration retrieval

2. **Core Business Operations (Medium Priority - 35% of methods):**
   - Create essential entities
   - Update critical data
   - Execute primary workflows

3. **Utility Operations (Low Priority - 25% of methods):**
   - Delete operations (if essential)
   - Bulk operations
   - Advanced search/filtering

**Exclusion Rules:**
- Remove administrative/setup methods
- Remove debugging/testing endpoints
- Remove internal system endpoints
- Remove methods with complex authentication
- Remove methods that return unstructured data

</method_selection_guidelines>

<schema_optimization>

**GPT-Specific Schema Optimizations:**

**Response Schemas:**
- Ensure all responses have application/json content type
- Include schema definitions for GPT to understand response structure
- Use descriptive property names
- Include examples where helpful

**Parameter Schemas:**
- Simplify complex parameter objects
- Use enums for limited choice parameters
- Provide clear descriptions
- Include validation constraints in schema

**Error Responses:**
- Include 400/401/404/500 error responses
- Use consistent error schema across all operations
- Include error codes and descriptive messages

</schema_optimization>

<gpt_action_validation>

**Validation Checklist:**

**OpenAPI Structure:**
- [ ] openapi: 3.1.0 (not 3.0.x)
- [ ] Valid info block with title, description, version
- [ ] At least one server URL
- [ ] Exactly 30 or fewer operations total
- [ ] Each operation has unique operationId
- [ ] Each operation has summary
- [ ] Each operation has at least one response with schema

**GPT Compatibility:**
- [ ] Bearer authentication configured
- [ ] JSON response schemas defined
- [ ] Reasonable parameter schemas
- [ ] No complex nested structures in requests
- [ ] Clear, descriptive operation summaries

**Hosting Requirements:**
- [ ] Schema hosted on public URL
- [ ] Accessible via HTTPS
- [ ] Content-Type: application/json or application/yaml
- [ ] No authentication required to fetch schema

</gpt_action_validation>

<implementation_pattern>

**Dual Schema Architecture:**

**Main OpenAPI Schema (/openapi.json):**
- Complete API documentation
- All available methods
- Full schema definitions
- For developers and documentation

**GPT OpenAPI Schema (/gpt-openapi.json):**
- Top 30 essential methods only
- Optimized for GPT Actions
- Simplified schemas where possible
- Separate endpoint to avoid conflicts

**Implementation:**

\`\`\`typescript
// Main OpenAPI - all methods
app.get('/openapi.json', (c) => {
  const fullSchema = generateFullOpenAPISchema();
  return c.json(fullSchema);
});

// GPT OpenAPI - top 30 methods only
app.get('/gpt-openapi.json', (c) => {
  const gptSchema = generateGPTLimitedSchema();
  return c.json(gptSchema);
});
\`\`\`

</implementation_pattern>

<gpt_setup_instructions>

**GPT Action Configuration:**

**In GPT Builder:**
1. Go to "Actions" tab
2. Click "Create new action"
3. Select "Import from OpenAPI"
4. Enter your GPT schema URL: https://your-worker-name.cloudflareworkers.com/gpt-openapi.json
5. Configure authentication:
   - Auth Type: Bearer
   - Token: YOUR_WORKER_API_KEY
6. Test the actions
7. Save and publish

**Common Issues:**
- Schema validation errors (check OpenAPI 3.1.0 compliance)
- Method count exceeded (limit to 30)
- Missing operationId (ensure all methods have unique IDs)
- Authentication failures (verify WORKER_API_KEY)
- Schema complexity (simplify nested structures)

</gpt_setup_instructions>

<method_count_tracking>

**Operation Counting Template:**

**Current Count: 0/30**

**GET Methods (Data Retrieval):**
- [ ] GET /health - Health check
- [ ] GET /users - List users
- [ ] GET /users/{id} - Get user details
- [ ] GET /projects - List projects
- [ ] GET /projects/{id} - Get project details
- [ ] GET /tasks - List tasks
- [ ] GET /tasks/{id} - Get task details

**POST Methods (Create Operations):**
- [ ] POST /users - Create user
- [ ] POST /projects - Create project
- [ ] POST /tasks - Create task

**PUT Methods (Update Operations):**
- [ ] PUT /users/{id} - Update user
- [ ] PUT /projects/{id} - Update project
- [ ] PUT /tasks/{id} - Update task

**DELETE Methods (Removal Operations):**
- [ ] DELETE /users/{id} - Delete user
- [ ] DELETE /projects/{id} - Delete project
- [ ] DELETE /tasks/{id} - Delete task

**Track your count and stay under 30 total operations!**

</method_count_tracking>

</gpt_integration_requirements>`
};

// Auto-register the template
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(GPT_INTEGRATION_PROMPT);
}
