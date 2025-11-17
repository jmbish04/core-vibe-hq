# Agent Prompt System Guide

This guide explains how to use the centralized prompt system for consistent AI behavior across all agents in the core-vibe-hq codebase.

## Overview

The prompt system provides:
- **Centralized prompt templates** for consistent AI behavior
- **Composable prompts** combining multiple guidelines
- **Type-safe prompt management** with validation
- **Context-aware prompt generation** with variable substitution
- **Easy maintenance** - update prompts in one place, affects all agents

## Quick Start

### Using buildAIPrompt in Agents

```typescript
class MyAgent extends BaseAgent {
  async generateCode(requirements: string): Promise<string> {
    // Build comprehensive prompt with multiple policies
    const prompt = this.buildAIPrompt(
      'cloudflare-base',           // Core Cloudflare guidelines
      ['orm-policy', 'security-policy'], // Domain-specific policies
      { projectName: 'my-app', database: 'd1' }, // Context variables
      [requirements]               // Custom instructions
    );

    // Use with AI
    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });

    return response.response;
  }
}
```

### Manual Prompt Building

```typescript
import { promptBuilder } from '@shared/base/prompts';

// Simple composition
const prompt = promptBuilder.build('cloudflare-base', ['orm-policy']);

// Advanced composition with context
const prompt = promptBuilder.compose({
  basePrompt: promptBuilder.get('cloudflare-base')!,
  additionalPrompts: [promptBuilder.get('security-policy')!],
  context: {
    projectName: 'MyProject',
    database: 'd1',
    framework: 'Hono'
  },
  customInstructions: [
    'Focus on performance optimization',
    'Include comprehensive error handling'
  ]
});
```

### Swarm Prompt Composition

Swarm prompts bundle the cross-functional “team assistant” instructions with factory/specialist overlays. Prefer these helpers whenever you need the Product/PM/UX/SWE/SDET persona set.

```typescript
import {
  composeFactorySwarmPrompt,
  composeSpecialistSwarmPrompt,
  buildSwarmPromptContent,
} from 'apps/base/worker/agents/swarmPrompts';

// Factory example (Cloudflare base + swarm base + agent-factory overlay)
const planPrompt = composeFactorySwarmPrompt(
  'agent-factory',
  { projectName: this.context.projectId },
  ['Capture missing PRD details before planning phases.']
).content;

// Specialist example (health specialist overlay plus security policy)
const healthPrompt = composeSpecialistSwarmPrompt(
  'health-specialist',
  { projectName: 'platform-health' },
  undefined,
  { additionalPromptIds: ['security-policy'] }
).content;

// Low-level helper for one-off compositions
const text = buildSwarmPromptContent({ identifier: 'ui-factory' });
```

## Available Prompt Templates

### Core Templates

| Template ID | Priority | Description |
|-------------|----------|-------------|
| `cloudflare-base` | 100 | Core Cloudflare Workers development guidelines |
| `orm-policy` | 90 | Drizzle + Kysely hybrid ORM standard |
| `security-policy` | 95 | Security best practices and guidelines |
| `framework-policy` | 85 | Framework patterns (Hono, Durable Objects, etc.) |
| `testing-policy` | 80 | Testing best practices and patterns |

### Specialized Templates

| Template ID | Priority | Description |
|-------------|----------|-------------|
| `coding-agent` | 88 | Advanced coding assistant guidelines |
| `swarm-base` | 92 | Cross-functional PM/Program/UX/SWE/SDET collaboration |
| `swarm-agent-factory` | 74 | Extension for agent-factory workers |
| `swarm-data-factory` | 74 | Extension for data-factory workers |
| `swarm-services-factory` | 74 | Extension for services-factory workers |
| `swarm-ui-factory` | 74 | Extension for UI factory workers |
| `swarm-*-specialist` | 72 | Specialist overlays (health, testing, conflict, etc.) |

## Creating New Prompt Templates

### 1. Create Template File

Create a new file in `@shared/base/prompts/your-template.ts`:

```typescript
import type { PromptTemplate } from './types';

export const YOUR_TEMPLATE_PROMPT: PromptTemplate = {
  id: 'your-template',
  name: 'Your Template Name',
  description: 'Brief description of what this template covers',
  version: '1.0.0',
  tags: ['relevant', 'tags'],
  priority: 70, // Lower than core templates
  dependencies: ['cloudflare-base'], // Optional: templates this depends on
  content: `# Your Template Content

Your detailed prompt content here...

## Guidelines
- Specific instructions for this domain
- Best practices
- Common patterns
- Anti-patterns to avoid

## Examples
\`\`\`typescript
// Good example
const goodPractice = 'example';
\`\`\`

\`\`\`typescript
// Bad example - DON'T do this
const badPractice = 'avoid this';
\`\`\`
`
};

// Auto-register with global prompt builder
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(YOUR_TEMPLATE_PROMPT);
}
```

### 2. Update Exports

Add to `@shared/base/prompts/index.ts`:

```typescript
export { YOUR_TEMPLATE_PROMPT } from './your-template';
```

### 3. Auto-Register in Builder

Add import to `@shared/base/prompts/builder.ts`:

```typescript
// Auto-register all templates
import './cloudflare-base';
import './your-template'; // Add this line
import './orm-policy';
// ... other imports
```

### 4. Use in Agents

```typescript
class MyAgent extends BaseAgent {
  async specializedTask(): Promise<string> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['your-template', 'security-policy'],
      { /* context */ },
      ['Custom instructions for this specific task']
    );

    return await this.env.AI.run('model', {
      messages: [{ role: 'user', content: prompt }]
    });
  }
}
```

### Swarm Extension Guidelines

Swarm overlays live in `@shared/base/prompts/swarm/` and should remain narrowly focused on the responsibilities of a factory or specialist. When editing or adding one:

1. Create `@shared/base/prompts/swarm/<name>.ts` exporting a `PromptTemplate` whose `dependencies` includes `'swarm-base'`.
2. Keep content to short, directive bullet points—avoid repeating the base Cloudflare guidance already inherited through dependencies.
3. Bump the `version` whenever behavior changes so agents can reason about prompt drift.
4. Register the template automatically by keeping the file under the `swarm/` folder (it is auto-imported via `builder.ts`).
5. Update the resolver in `@shared/base/prompts/swarm-prompts.ts` if the new overlay needs to be auto-selected for an identifier.

## Prompt Composition Rules

### Priority System

Prompts are composed in **priority order** (highest first):
- `cloudflare-base` (100) - Always first
- `security-policy` (95) - High priority security rules
- `orm-policy` (90) - Database standards
- `framework-policy` (85) - Framework patterns
- `testing-policy` (80) - Testing guidelines
- Custom templates (70-79) - Domain-specific rules

### Composition Order

```
Base Template (highest priority)
├── Additional Template 1 (next priority)
├── Additional Template 2 (next priority)
└── Custom Instructions (lowest priority)
```

### Context Variables

Prompts support variable substitution using `${variableName}` syntax:

```typescript
const prompt = this.buildAIPrompt(
  'cloudflare-base',
  ['orm-policy'],
  {
    projectName: 'MyApp',
    database: 'd1',
    framework: 'Hono',
    environment: 'production'
  },
  ['Generate user authentication API']
);
```

Available context variables:
- `projectName`: Name of the project
- `database`: Database type ('d1', 'hyperdrive', etc.)
- `framework`: Framework being used ('hono', 'react', etc.)
- `environment`: Environment ('development', 'production', etc.)
- `customInstructions`: Array of additional instructions

## Advanced Usage

### Conditional Prompt Composition

```typescript
class SmartAgent extends BaseAgent {
  async generateBasedOnComplexity(requirements: string, complexity: 'simple' | 'complex'): Promise<string> {
    const additionalPrompts = ['security-policy'];

    // Add ORM policy for complex database operations
    if (complexity === 'complex') {
      additionalPrompts.push('orm-policy');
    }

    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      additionalPrompts,
      { projectName: this.context.projectId },
      [requirements]
    );

    return await this.env.AI.run('model', { messages: [{ role: 'user', content: prompt }] });
  }
}
```

### Custom Prompt Chains

```typescript
class MultiStepAgent extends BaseAgent {
  async planAndImplement(requirements: string): Promise<string> {
    // Step 1: Planning phase
    const planningPrompt = this.buildAIPrompt(
      'cloudflare-base',
      ['framework-policy'],
      { projectName: this.context.projectId },
      [
        'Create a detailed implementation plan for:',
        requirements,
        'Focus on architecture and component breakdown.'
      ]
    );

    const plan = await this.env.AI.run('model', {
      messages: [{ role: 'user', content: planningPrompt }]
    });

    // Step 2: Implementation phase
    const implementationPrompt = this.buildAIPrompt(
      'cloudflare-base',
      ['orm-policy', 'security-policy', 'testing-policy'],
      { projectName: this.context.projectId },
      [
        'Based on this plan, implement the solution:',
        plan.response,
        'Include comprehensive error handling and tests.'
      ]
    );

    const implementation = await this.env.AI.run('model', {
      messages: [{ role: 'user', content: implementationPrompt }]
    });

    return implementation.response;
  }
}
```

## Validation and Testing

### Template Validation

The system validates template dependencies:

```typescript
import { promptBuilder } from '@shared/base/prompts';

const validation = promptBuilder.validateDependencies();
if (!validation.valid) {
  console.error('Missing template dependencies:', validation.errors);
}
```

### Testing Prompt Composition

```typescript
describe('Prompt Composition', () => {
  it('should compose cloudflare base with orm policy', () => {
    const prompt = promptBuilder.build('cloudflare-base', ['orm-policy']);

    expect(prompt.content).toContain('Cloudflare Workers');
    expect(prompt.content).toContain('Drizzle + Kysely');
    expect(prompt.sources).toHaveLength(2);
  });

  it('should apply context variables', () => {
    const prompt = promptBuilder.compose({
      basePrompt: promptBuilder.get('cloudflare-base')!,
      additionalPrompts: [],
      context: { projectName: 'TestProject' }
    });

    expect(prompt.content).toContain('TestProject');
  });
});
```

## Best Practices

### Template Design
- **Keep templates focused** - One responsibility per template
- **Use clear versioning** - Semantic versioning for template updates
- **Include examples** - Show both good and bad practices
- **Document dependencies** - Specify required base templates

### Agent Usage
- **Use appropriate templates** - Only include relevant policies
- **Provide context** - Always include project-specific context
- **Custom instructions** - Add task-specific guidance
- **Test compositions** - Verify prompt combinations work well

### Maintenance
- **Update versions** - Increment version when templates change
- **Review compositions** - Test new template combinations
- **Monitor usage** - Track which templates are most effective
- **Gather feedback** - Improve templates based on results
- **Refresh swarm overlays** - Keep `swarm-*` templates aligned with factory/specialist responsibilities

## Troubleshooting

### Common Issues

**Template not found:**
```typescript
// Error: Template 'unknown-template' not found
const prompt = this.buildAIPrompt('cloudflare-base', ['unknown-template']);
```
**Solution:** Check template ID spelling and ensure it's exported in `index.ts`

**Missing dependencies:**
```typescript
const validation = promptBuilder.validateDependencies();
// Check validation.errors for missing templates
```
**Solution:** Add missing template files or fix dependency references

**Context variables not applied:**
```typescript
// Variables not showing up in final prompt
const prompt = this.buildAIPrompt('cloudflare-base', [], { projectName: 'MyApp' });
```
**Solution:** Ensure template content includes `\${projectName}` placeholder

**Priority conflicts:**
- Symptoms: Unexpected prompt ordering
- Solution: Check priority values in template definitions

### Debug Mode

Enable debug logging for prompt composition:

```typescript
class DebugAgent extends BaseAgent {
  async debugPrompt(requirements: string): Promise<void> {
    const prompt = this.buildAIPrompt('cloudflare-base', ['orm-policy'], {
      projectName: 'DebugProject'
    }, [requirements]);

    this.logger.info('Generated prompt', {
      contentLength: prompt.content.length,
      sources: prompt.sources.length,
      metadata: prompt.metadata
    });

    // Log first 500 characters for inspection
    this.logger.debug('Prompt preview', {
      preview: prompt.content.substring(0, 500) + '...'
    });
  }
}
```

## Migration Guide

### From Hardcoded Prompts

**Before:**
```typescript
const prompt = `
You are an AI assistant specialized in generating Cloudflare Workers code.
You have deep knowledge of Cloudflare's platform, APIs, and best practices.
// ... 100+ lines of hardcoded prompt
`;
```

**After:**
```typescript
const prompt = this.buildAIPrompt(
  'cloudflare-base',
  ['orm-policy'], // Add domain-specific policies as needed
  { projectName: this.context.projectId },
  ['Custom task-specific instructions']
);
```

### Upgrading to Swarm Helpers

```typescript
// Before: stitched-together swarm persona instructions
const specPrompt = `
You are a product manager, UX designer, SWE, and SDET...
`;

// After: rely on centralized swarm overlays
const specPrompt = composeFactorySwarmPrompt('ui-factory', {
  projectName: this.context.projectId,
}).content;
```

### Benefits of Migration
- **Consistency** - All agents use same base guidelines
- **Maintainability** - Update prompts centrally
- **Reusability** - Compose different combinations easily
- **Testing** - Test prompt compositions independently
- **Versioning** - Track prompt changes over time

## Reference

### Template API

```typescript
interface PromptTemplate {
  id: string;              // Unique identifier
  name: string;            // Human-readable name
  description: string;     // Brief description
  version: string;         // Semantic version
  tags: string[];          // Categorization tags
  priority: number;        // Composition priority (higher = first)
  dependencies?: string[]; // Required template IDs
  content: string;         // The actual prompt text
}
```

### Context API

```typescript
interface PromptContext {
  projectName?: string;
  framework?: string;
  database?: string;
  environment?: string;
  customInstructions?: string[];
  variables?: Record<string, string>;
}
```

### Composed Prompt API

```typescript
interface ComposedPrompt {
  content: string;         // Final composed prompt
  sources: Array<{         // Source templates used
    id: string;
    name: string;
    priority: number;
  }>;
  metadata: {              // Composition metadata
    version: string;
    timestamp: string;
    totalPrompts: number;
  };
}
```

## Contributing

When adding new templates:

1. Follow the template structure above
2. Include comprehensive examples
3. Add appropriate tests
4. Update this documentation
5. Test composition with existing templates

For questions or issues with the prompt system, refer to the main agent documentation or create an issue in the repository.
