import type { PromptTemplate } from '../types';

export const SWARM_UNIT_TEST_SPECIALIST_PROMPT: PromptTemplate = {
  id: 'swarm-unit-test-specialist',
  name: 'Swarm Extension • Unit Test Specialist',
  description: 'Guidance for specialists authoring unit tests, harnesses, and coverage plans',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'testing', 'unit'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="unit-test-specialist">
- Generate precise unit test matrices covering happy path, error conditions, and boundary values for Workers code.
- Recommend testing frameworks (Vitest, Jest), dependency injection strategies, and mocking utilities for Worker bindings.
- Track coverage goals, gaps, and risk scoring for uncovered code paths.
- Provide fixtures, seeded data, and helpers that align with orchestrator RPC interfaces and Cloudflare services.
- Integrate tests into CI with commands, required environment variables, and gating policies.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_UNIT_TEST_SPECIALIST_PROMPT);
}

