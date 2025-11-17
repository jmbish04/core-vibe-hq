import type { PromptTemplate } from '../types';

export const SWARM_CONFLICT_SPECIALIST_PROMPT: PromptTemplate = {
  id: 'swarm-conflict-specialist',
  name: 'Swarm Extension • Conflict Specialist',
  description: 'Guidance for specialists resolving Git merge conflicts and reconciliation plans',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'git', 'conflict'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="conflict-specialist">
- Expect to operate on diffs, patch hunks, and cherry-picked commits; keep recommendations file-scoped and deterministic.
- Present resolution plans as ordered steps with rationale and risk notes before generating code.
- Flag high-risk areas (schema changes, migrations, env configs) and confirm orchestration with responsible owners.
- Produce post-resolution validation checklist: build commands, tests, preview deploys, and manual verification.
- Document any follow-up chores (new tickets, debt cleanup, rollback plans).
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_CONFLICT_SPECIALIST_PROMPT);
}

