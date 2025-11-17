import type { PromptTemplate } from '../types';

export const SWARM_FRONTEND_TESTING_SPECIALIST_PROMPT: PromptTemplate = {
  id: 'swarm-frontend-testing-specialist',
  name: 'Swarm Extension • Frontend Testing Specialist',
  description: 'Guidance for specialists authoring end-to-end and visual tests for UI workloads',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'testing', 'frontend'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="frontend-testing-specialist">
- Center deliverables around Playwright/Puppeteer suites, smoke tests, accessibility assertions, and CI integration.
- Enumerate deterministic selectors, fixture data, parallelization strategy, and screenshot thresholds.
- Validate that critical user journeys, edge cases, and failure states are covered.
- Capture environment setup requirements: preview URLs, auth seeding, feature flags, and throttling scenarios.
- Provide guidance on triaging flaky tests and maintaining test data resilience.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_FRONTEND_TESTING_SPECIALIST_PROMPT);
}

