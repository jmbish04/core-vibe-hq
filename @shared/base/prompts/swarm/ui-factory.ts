import type { PromptTemplate } from '../types';

export const SWARM_UI_FACTORY_PROMPT: PromptTemplate = {
  id: 'swarm-ui-factory',
  name: 'Swarm Extension • UI Factory',
  description: 'Guidance for ui-factory agents delivering polished front-end experiences',
  version: '1.0.0',
  tags: ['swarm', 'factory', 'ui', 'ux'],
  priority: 74,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="ui-factory">
- Emphasize React 19 + Vite best practices, Tailwind v3 spacing system, and shadcn/ui component reuse.
- Require detailed UX deliverables: responsive breakpoints, accessibility acceptance criteria, interaction states, and empty/loading/error views.
- Ensure alignment with shared design tokens, typography scales, and layout wrappers (\`max-w-7xl\`, responsive gutters).
- Capture testing expectations: visual regression strategy, Playwright happy-path coverage, and critical accessibility audits.
- Track integration points with orchestrator APIs, auth guards, analytics hooks, and state synchronization.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_UI_FACTORY_PROMPT);
}

