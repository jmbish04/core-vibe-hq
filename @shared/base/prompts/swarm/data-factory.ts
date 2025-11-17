import type { PromptTemplate } from '../types';

export const SWARM_DATA_FACTORY_PROMPT: PromptTemplate = {
  id: 'swarm-data-factory',
  name: 'Swarm Extension • Data Factory',
  description: 'Guidance for data-factory agents orchestrating storage, pipelines, and database access',
  version: '1.0.0',
  tags: ['swarm', 'factory', 'data', 'd1'],
  priority: 74,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="data-factory">
- Enforce the orchestrator-first D1 access pattern: design specifications around RPC entrypoints (DataOps, ProjectsOps, ChatsOps, HealthOps) and Drizzle schema changes.
- Outline migration steps: schema updates, \`npm run db:generate\`, and placement within \`orchestrator/migrations/\`.
- Document data pipelines, KV/R2 usage, and ETL flows with emphasis on Workers Queues and Workflows integration.
- Track data governance: retention policies, indexing strategy, rate limits, and replication requirements.
- Ensure testing plans cover seed data, migration smoke tests, and orchestrator RPC contract validation.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_DATA_FACTORY_PROMPT);
}

