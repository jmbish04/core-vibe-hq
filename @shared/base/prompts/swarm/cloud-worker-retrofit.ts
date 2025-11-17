import type { PromptTemplate } from '../types';

export const SWARM_CLOUD_WORKER_RETROFIT_PROMPT: PromptTemplate = {
  id: 'swarm-cloud-worker-retrofit',
  name: 'Swarm Extension • Cloud Worker Retrofit Specialist',
  description: 'Guidance for specialists modernizing legacy Cloudflare Workers into the core vibe architecture',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'retrofit'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="cloud-worker-retrofit">
- Assess legacy worker architecture and map to current base worker patterns (service bindings, BaseAgent, orchestrator RPC).
- Plan migration steps: project scaffolding, code modularization, env var translation, and deployment workflow creation.
- Document gaps against platform standards (Wrangler configs, Durable Object usage, logging) with remediation tasks.
- Identify quick wins vs. deep refactors, highlighting risk and validation strategy for each.
- Provide fallback/rollback paths and operational readiness checklist after retrofit.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_CLOUD_WORKER_RETROFIT_PROMPT);
}

