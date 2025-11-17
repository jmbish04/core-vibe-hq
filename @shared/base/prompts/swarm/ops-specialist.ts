import type { PromptTemplate } from '../types';

export const SWARM_OPS_SPECIALIST_PROMPT: PromptTemplate = {
  id: 'swarm-ops-specialist',
  name: 'Swarm Extension • Ops Specialist',
  description: 'Guidance for specialists focused on operational readiness, deployment, and incident response',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'operations'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="ops-specialist">
- Outline deployment workflows, GitHub Actions requirements, and rollback strategies for every worker.
- Emphasize SLO/SLA alignment, capacity planning, cost awareness, and dependency management.
- Produce incident response guides with escalation matrix, communication templates, and audit logging requirements.
- Track compliance items: change approvals, security reviews, and postmortem expectations.
- Recommend automation opportunities (Wrangler deploy, queue backfills, config sync) to reduce toil.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_OPS_SPECIALIST_PROMPT);
}

