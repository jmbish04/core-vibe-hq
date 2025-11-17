# Basic Worker Template

A basic Cloudflare Worker template with agent logic placeholders.

## Placeholders

This template uses the following placeholders that will be filled during order fulfillment:

- `{{PLACEHOLDER_IMPORTS}}` - Import statements for dependencies, types, and utilities
- `{{PLACEHOLDER_FETCH_HANDLER}}` - Request handling logic (routing, validation, etc.)
- `{{PLACEHOLDER_AGENT_LOGIC}}` - Core agent logic and processing

## Usage

This template is used by the Agent Factory to generate new agent workers. The Factory Automation System will:

1. Extract placeholders using `template-manager-tool extract-placeholders`
2. Generate micro-prompts for each placeholder based on the order requirements
3. Create skeleton files with micro-prompts as comments
4. Use code generation tools to fill in the placeholders

## Example Generated File

After fulfillment, the template might become:

```typescript
import { BaseAgent } from '@shared/base/agents/BaseAgent';
import type { Env } from '@shared/types/env';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Route requests to appropriate handlers
    const url = new URL(request.url);
    if (url.pathname === '/api/process') {
      // Process agent requests
      const agent = new MyAgent(env);
      return await agent.handle(request);
    }
    
    return new Response('OK');
  }
}
```

