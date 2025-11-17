/**
 * @shared/base/prompts/framework-policy.ts
 *
 * Framework-specific development guidelines and patterns.
 */

import type { PromptTemplate } from './types';

export const FRAMEWORK_POLICY_PROMPT: PromptTemplate = {
  id: 'framework-policy',
  name: 'Framework Development Policy',
  description: 'Framework-specific patterns and conventions',
  version: '1.0.0',
  tags: ['framework', 'patterns', 'conventions'],
  dependencies: ['cloudflare-base'],
  priority: 85,
  content: `# Framework Development Policy

## Core Framework Patterns

### Hono Router Usage
- Use Hono for all HTTP routing in Cloudflare Workers
- Follow RESTful API conventions
- Implement proper middleware chains
- Use typed routes with Hono's type inference

### Durable Objects
- Use Durable Objects for stateful operations
- Implement proper WebSocket Hibernation API
- Handle state persistence correctly
- Use alarms for scheduled operations

### Error Handling
- Implement consistent error responses
- Use proper HTTP status codes
- Include meaningful error messages
- Log errors appropriately

### Validation
- Use Zod for runtime type validation
- Validate all input data
- Provide clear validation error messages
- Sanitize user inputs`
};

// Auto-register the template
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(FRAMEWORK_POLICY_PROMPT);
}
