# Centralized Prompt Repository

This directory contains the centralized repository of AI prompt templates used across all agents in the codebase. The system provides type-safe, composable prompts for consistent AI behavior.

## Overview

The prompt system consists of:

- **Templates**: Reusable prompt components (Cloudflare base guidelines, ORM policies, etc.)
- **Builder**: Utility for composing prompts from multiple templates
- **Base Agent Integration**: Built-in prompt composition methods in `BaseAgent`

## Architecture

```
@shared/base/prompts/
├── index.ts              # Main exports
├── types.ts              # TypeScript type definitions
├── builder.ts            # PromptBuilder class
├── cloudflare-base.ts    # Cloudflare Workers guidelines
├── coding-agent.ts       # Coding agent specialization
├── endpoint-integration.ts # Multi-protocol API requirements
├── gpt-integration.ts    # GPT Actions OpenAPI requirements
├── orm-policy.ts         # Drizzle + Kysely ORM policy
├── framework-policy.ts   # Framework-specific patterns
├── security-policy.ts    # Security guidelines
├── testing-policy.ts     # Testing best practices
├── swarm/                # Swarm team assistant base + extensions per factory/specialist
├── swarm-prompts.ts      # Helper utilities for composing swarm prompts
└── README.md             # This file
```

## Usage

### Basic Prompt Building

```typescript
import { promptBuilder } from '@shared/base/prompts';

// Build a simple prompt
const prompt = promptBuilder.build('cloudflare-base', ['orm-policy']);

// Build with context
const prompt = promptBuilder.build('cloudflare-base', ['orm-policy'], {
  projectName: 'my-project',
  database: 'd1'
});
```

### In Agents (BaseAgent subclasses)

```typescript
class MyAgent extends BaseAgent {
  async generateCode(requirements: string): Promise<string> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['orm-policy', 'security-policy'],
      { projectName: this.context.projectId },
      [requirements]
    );

    return await this.env.AI.run('model', { messages: [{ role: 'user', content: prompt }] });
  }
}
```

## Available Templates

### Core Templates

| Template | Priority | Description |
|----------|----------|-------------|
| `cloudflare-base` | 100 | Core Cloudflare Workers development guidelines |
| `coding-agent` | 88 | Coding agent specialization with MCP tools |
| `endpoint-integration` | 90 | Multi-protocol API requirements (REST + WS + RPC + MCP) |
| `gpt-integration` | 95 | GPT Actions OpenAPI requirements (30 method limit) |

### Domain Templates

| Template | Priority | Description |
|----------|----------|-------------|
| `orm-policy` | 90 | Drizzle + Kysely hybrid ORM standard for D1 |
| `security-policy` | 95 | Security guidelines and best practices |
| `framework-policy` | 85 | Framework patterns (Hono, Durable Objects, etc.) |
| `testing-policy` | 80 | Testing guidelines and best practices |

### Swarm Team Assistant Prompts
Swarm prompts enable a cross-functional "swarm" experience that mirrors a PM, Program Manager, UX Designer, SWE, and SDET working together.

- `swarm-base` (Priority: 92) &mdash; baseline swarm behaviors, workflow, and tone. Depends on `cloudflare-base`.
- Factory extensions (Priority: 74) &mdash; `swarm-agent-factory`, `swarm-data-factory`, `swarm-services-factory`, `swarm-ui-factory` tailor the swarm for each factory's workflows.
- Specialist extensions (Priority: 72) &mdash; prompts such as `swarm-conflict-specialist`, `swarm-delivery-report-specialist`, `swarm-unit-test-specialist`, etc., focus on targeted operational roles.

Use the helper API in `swarm-prompts.ts` to compose these templates without manually managing IDs:

```typescript
import { buildSwarmPrompt } from '@shared/base/prompts';

const prompt = buildSwarmPrompt({
  identifier: 'agent-factory',
  context: { projectName: 'orchestrator' },
  customInstructions: ['Prioritize agent sandbox hand-off.'],
});
```

## Prompt Composition

Prompts are composed in priority order (highest first), ensuring that:

1. Base guidelines are always included
2. Domain-specific policies override general guidance
3. Custom instructions are appended last

Example composition order:
```
cloudflare-base (100) + orm-policy (90) + security-policy (95) + custom instructions
```

## Adding New Templates

1. Create a new file: `new-policy.ts`
2. Export a `PromptTemplate` object
3. Add auto-registration at the bottom
4. Update `index.ts` exports
5. Import in `builder.ts` for auto-registration

```typescript
import type { PromptTemplate } from './types';

export const NEW_POLICY_PROMPT: PromptTemplate = {
  id: 'new-policy',
  name: 'New Policy Template',
  description: 'Description of the new policy',
  version: '1.0.0',
  tags: ['tag1', 'tag2'],
  priority: 75,
  content: `# New Policy Content...`
};

// Auto-register
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(NEW_POLICY_PROMPT);
}
```

## Context Variables

Prompts support variable substitution using `${variableName}` syntax:

```typescript
const prompt = promptBuilder.compose({
  basePrompt: template,
  additionalPrompts: [],
  context: {
    projectName: 'MyProject',
    database: 'd1'
  }
});
```

## Validation

The system includes dependency validation to ensure all referenced templates exist:

```typescript
const validation = promptBuilder.validateDependencies();
if (!validation.valid) {
  console.error('Missing template dependencies:', validation.errors);
}
```

## Benefits

- **Consistency**: All agents use the same base guidelines
- **Maintainability**: Update prompts in one place
- **Composability**: Mix and match different policy templates
- **Type Safety**: Full TypeScript support with validation
- **Extensibility**: Easy to add new domain-specific policies
