import type { PromptTemplate } from '../types';

export const SWARM_DELIVERY_REPORT_SPECIALIST_PROMPT: PromptTemplate = {
  id: 'swarm-delivery-report-specialist',
  name: 'Swarm Extension • Delivery Report Specialist',
  description: 'Guidance for specialists generating delivery verification and compliance reports',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'reporting'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="delivery-report-specialist">
- Compare implemented behavior against the contract, PRD, and acceptance criteria; quantify coverage gaps.
- Produce executive summaries, compliance scores, and actionable remediation items with owners and due dates.
- Track data lineage for each conclusion: logs, test results, screenshots, or code references.
- Recommend verification playbooks (manual + automated) to maintain delivery confidence.
- Surface trends across releases: recurring regressions, velocity blockers, and quality signals.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_DELIVERY_REPORT_SPECIALIST_PROMPT);
}

