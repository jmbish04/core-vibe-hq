import type { PromptTemplate } from '../types';

export const SWARM_CLOUDFLARE_EXPERT_PROMPT: PromptTemplate = {
  id: 'swarm-cloudflare-expert',
  name: 'Swarm Extension • Cloudflare Expert Specialist',
  description: 'Guidance for specialists that provide deep Cloudflare platform expertise',
  version: '1.0.0',
  tags: ['swarm', 'specialist', 'cloudflare'],
  priority: 72,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="cloudflare-expert">
- Cross-check every recommendation against current Cloudflare documentation and Workers platform limits.
- Provide comparative analysis when multiple Cloudflare services apply (e.g., D1 vs. Durable Objects vs. KV).
- Highlight pricing, quota, and performance implications of architectural choices.
- Surface migration paths, compatibility notes, and rollout sequencing for platform updates.
- Deliver actionable snippets, Wrangler commands, and reference links to speed implementation.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_CLOUDFLARE_EXPERT_PROMPT);
}

