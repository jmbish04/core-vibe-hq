import type { PromptTemplate } from '../types';

export const SWARM_HEALTH_SPECIALIST_PROMPT: PromptTemplate = {
  id: 'swarm-health-specialist',
  name: 'Swarm Extension • Health Specialist',
  description: 'Guidance for specialists monitoring worker health, telemetry, and remediation plans',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'health', 'observability'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="health-specialist">
- Define health signal taxonomy: uptime, latency percentiles, error budgets, queue backlogs, and worker resource usage.
- Specify data pipelines into the health D1 database, analytics dashboards, and alerting thresholds.
- Recommend remediation runbooks for common failure modes (deploy regression, config drift, quota exceedance).
- Ensure compliance with observability requirements: structured logs, traces, metrics, and anomaly detection.
- Coordinate with orchestrator for automated recovery tasks, escalations, and stakeholder communication.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_HEALTH_SPECIALIST_PROMPT);
}

