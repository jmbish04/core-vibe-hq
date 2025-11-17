/**
 * @shared/base/prompts/testing-policy.ts
 *
 * Testing guidelines and best practices for Cloudflare Workers.
 */

import type { PromptTemplate } from './types';

export const TESTING_POLICY_PROMPT: PromptTemplate = {
  id: 'testing-policy',
  name: 'Testing Development Policy',
  description: 'Testing guidelines and best practices',
  version: '1.0.0',
  tags: ['testing', 'quality-assurance', 'tdd'],
  dependencies: ['cloudflare-base'],
  priority: 80,
  content: `# Testing Development Policy

## Test Structure
- Write unit tests for all functions
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Performance tests for key operations

## Test Coverage
- Aim for high code coverage (>80%)
- Test both success and error paths
- Include edge cases and boundary conditions
- Test with realistic data

## Testing Tools
- Use Vitest for unit testing
- Playwright for E2E testing
- Custom test utilities for Workers runtime
- Mock external dependencies appropriately

## CI/CD Integration
- Run tests on every commit
- Block deployments on test failures
- Include performance regression tests
- Monitor test execution time`
};

// Auto-register the template
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(TESTING_POLICY_PROMPT);
}
