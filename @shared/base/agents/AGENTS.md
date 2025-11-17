# Agent Development Guide

This guide provides comprehensive instructions for developing, deploying, and maintaining AI agents in the core-vibe-hq codebase.

## Overview

Agents in this codebase are built on Cloudflare's Durable Objects infrastructure, providing:
- **Long-running conversations** with persistent state
- **WebSocket support** for real-time communication
- **Database integration** through D1 and service bindings
- **Centralized prompt management** for consistent AI behavior
- **Factory-based architecture** for specialized agent types

## Architecture

### Base Agent Hierarchy

```
BaseAgent (abstract)
├── BaseFactoryAgent (abstract)
│   ├── DataFactory Agents
│   ├── ServiceFactory Agents
│   └── UIFactory Agents
└── Specialized Agents
    ├── HealthSpecialist
    ├── UnitTestSpecialist
    └── FrontendTestingSpecialist
```

### Key Components

- **BaseAgent**: Core functionality (logging, error handling, WebSocket)
- **BaseFactoryAgent**: Template management and order fulfillment
- **Prompt System**: Centralized prompt templates in `@shared/base/prompts/`
- **Durable Objects**: State persistence and scaling

## Creating New Agents

### 1. Choose Agent Type

**For Factory Agents (recommended for most cases):**
```typescript
import { BaseFactoryAgent, StructuredLogger, AgentContext } from '@shared/base/agents';

export class MyFactoryAgent extends BaseFactoryAgent {
  constructor(
    env: MyEnv,
    logger: StructuredLogger,
    context: AgentContext = {}
  ) {
    super(env, logger, 'path/to/templates', ['tool1', 'tool2'], context);
  }

  getFactoryType(): string {
    return 'my-factory-type';
  }

  // Implement factory-specific methods
}
```

**For Specialized Agents:**
```typescript
import { BaseAgent, StructuredLogger, AgentContext } from '@shared/base/agents';

export class MySpecialist extends BaseAgent {
  constructor(
    env: MyEnv,
    logger: StructuredLogger,
    context: AgentContext = {}
  ) {
    super(env, logger, context);
  }

  // Implement specialized methods
}
```

### 2. Define Environment Interface

```typescript
export interface MyAgentEnv extends BaseEnv {
  // Orchestrator RPC bindings
  ORCHESTRATOR_DATA?: any;
  ORCHESTRATOR_PROJECTS?: any;

  // AI and other services
  AI: any;

  // Specialized bindings
  MY_CUSTOM_BINDING?: any;
}
```

### 3. Implement Required Methods

#### For Factory Agents:
- `getFactoryType(): string` - Returns unique factory identifier

#### For All Agents:
- `onRequest(request: Request): Promise<Response>` - HTTP request handler
- `onConnect(connection: any): Promise<void>` - WebSocket connection handler (optional)

### 4. Add Durable Object Configuration

Update `wrangler.jsonc`:
```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "MY_AGENT",
        "class_name": "MyAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["MyAgent"]
    }
  ]
}
```

## AI Integration

### Using the Prompt System

Agents use the centralized prompt repository for consistent AI behavior:

```typescript
class MyAgent extends BaseAgent {
  async generateCode(requirements: string): Promise<string> {
    // Build comprehensive prompt
    const prompt = this.buildAIPrompt(
      'cloudflare-base',           // Base Cloudflare guidelines
      ['orm-policy', 'security-policy'], // Domain-specific policies
      { projectName: this.context.projectId }, // Context variables
      [requirements]               // Custom instructions
    );

    // Call AI with composed prompt
    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048
    });

    return response.response;
  }
}
```

### Available Prompt Templates

- `cloudflare-base`: Core Cloudflare Workers guidelines
- `orm-policy`: Drizzle + Kysely database policies
- `security-policy`: Security best practices
- `framework-policy`: Framework patterns and conventions
- `testing-policy`: Testing guidelines

### Custom Prompts

Create domain-specific prompts in `@shared/base/prompts/`:

```typescript
import type { PromptTemplate } from '../types';

export const MY_DOMAIN_PROMPT: PromptTemplate = {
  id: 'my-domain',
  name: 'My Domain Guidelines',
  description: 'Specialized guidelines for my domain',
  version: '1.0.0',
  tags: ['domain-specific'],
  priority: 75,
  content: `# My Domain Guidelines

Custom instructions for my specific domain...`
};
```

## State Management

### Durable Object Storage

Agents use Durable Object storage for persistence:

```typescript
interface MyState {
  projectId: string;
  status: 'idle' | 'processing' | 'complete';
  data: any[];
}

export class MyAgent extends BaseAgent {
  private state: MyState;

  constructor(env: MyEnv, logger: StructuredLogger, context: AgentContext = {}) {
    super(env, logger, context);
    this.state = {
      projectId: '',
      status: 'idle',
      data: []
    };
  }

  private async loadState(): Promise<void> {
    // Load from Durable Object storage
    const stored = await this.storage.get('agent-state') as MyState;
    if (stored) {
      this.state = { ...this.state, ...stored };
    }
  }

  private async saveState(): Promise<void> {
    // Save to Durable Object storage
    await this.storage.put('agent-state', this.state);
  }
}
```

### State Updates

```typescript
private async updateState(updates: Partial<MyState>): Promise<void> {
  this.state = { ...this.state, ...updates };
  await this.saveState();
}
```

## WebSocket Communication

### Real-time Updates

```typescript
async onConnect(connection: any): Promise<void> {
  // Send initial state
  connection.send(JSON.stringify({
    type: 'status_update',
    data: { status: this.state.status }
  }));

  // Store connection for later updates
  this.activeConnections.add(connection);
}

private broadcastUpdate(update: any): void {
  const message = JSON.stringify({
    type: 'update',
    data: update,
    timestamp: Date.now()
  });

  for (const connection of this.activeConnections) {
    connection.send(message);
  }
}
```

## Database Integration

### Via Orchestrator RPC (Recommended)

```typescript
// Get data through orchestrator service binding
const users = await this.env.ORCHESTRATOR_DATA.getUsers({
  projectId: this.context.projectId
});
```

### Direct D1 Access (Orchestrator Only)

```typescript
// Only in orchestrator agents
const result = await this.dbService.ops
  .select()
  .from(schema.users)
  .where(eq(schema.users.projectId, projectId));
```

## Logging

### Structured Logging

```typescript
// Info level
this.logger.info('Operation started', {
  operation: 'code_generation',
  projectId: this.context.projectId
});

// Error level with context
this.logger.error('Operation failed', {
  error: error.message,
  operation: 'code_generation',
  projectId: this.context.projectId
});
```

## Error Handling

### Consistent Error Responses

```typescript
async onRequest(request: Request): Promise<Response> {
  try {
    // Operation logic
    const result = await this.performOperation(request);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Log error
    await this.logAction('request_failed', 'error', {
      error: error instanceof Error ? error.message : String(error),
      url: request.url
    });

    // Return consistent error response
    return new Response(JSON.stringify({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Testing Agents

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyAgent } from './MyAgent';

describe('MyAgent', () => {
  let agent: MyAgent;
  let mockEnv: MyAgentEnv;
  let mockLogger: StructuredLogger;

  beforeEach(() => {
    mockEnv = { /* mock environment */ };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    agent = new MyAgent(mockEnv, mockLogger);
  });

  it('should handle requests correctly', async () => {
    const request = new Request('http://example.com/test');
    const response = await agent.onRequest(request);

    expect(response.status).toBe(200);
  });
});
```

### Integration Tests

```typescript
describe('MyAgent Integration', () => {
  it('should persist state correctly', async () => {
    // Test with actual Durable Object environment
    const id = mockEnv.MY_AGENT.newUniqueId();
    const agentInstance = mockEnv.MY_AGENT.get(id);

    // Perform operations and verify state persistence
  });
});
```

## Deployment

### Wrangler Configuration

Ensure proper Durable Object bindings and migrations:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "MY_AGENT",
        "class_name": "MyAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["MyAgent"]
    }
  ],
  "vars": {
    "AGENT_TYPE": "my-agent",
    "MAX_CONCURRENT_OPERATIONS": "10"
  }
}
```

### GitHub Actions

Add deployment workflow in `.github/workflows/`:

```yaml
name: Deploy My Agent
on:
  push:
    branches: [main]
    paths: [apps/specialists/my-agent/**]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Agent
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/specialists/my-agent
```

## Best Practices

### Code Organization
- Keep agent logic focused and single-purpose
- Use composition over inheritance for complex behavior
- Separate business logic from infrastructure concerns

### Performance
- Minimize cold starts with efficient initialization
- Use streaming responses for large AI outputs
- Cache frequently accessed data appropriately

### Security
- Validate all inputs thoroughly
- Use least-privilege access patterns
- Implement proper authentication and authorization
- Sanitize outputs before returning to clients

### Monitoring
- Log all significant operations
- Track performance metrics
- Monitor error rates and response times
- Set up alerts for critical failures

## Troubleshooting

### Common Issues

**Agent not responding:**
- Check Durable Object bindings in wrangler.jsonc
- Verify migrations are applied
- Check logs for initialization errors

**State not persisting:**
- Ensure `this.storage.put()` calls are awaited
- Check Durable Object storage limits
- Verify state serialization works correctly

**WebSocket connections failing:**
- Check WebSocket hibernation implementation
- Verify connection cleanup on disconnect
- Monitor connection limits

**AI calls failing:**
- Check AI binding configuration
- Verify API keys and permissions
- Monitor rate limits and quotas

## Reference

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/api/websockets/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
