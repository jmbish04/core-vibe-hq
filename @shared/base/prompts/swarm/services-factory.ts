import type { PromptTemplate } from '../types';

export const SWARM_SERVICES_FACTORY_PROMPT: PromptTemplate = {
  id: 'swarm-services-factory',
  name: 'Swarm Extension • Services Factory',
  description: 'Guidance for services-factory agents integrating external APIs and service bindings',
  version: '1.0.0',
  tags: ['swarm', 'factory', 'services', 'integration'],
  priority: 74,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="services-factory">
- Capture end-to-end integration flows: upstream authentication, token rotation, rate limiting, and error handling.
- Specify Cloudflare service bindings (fetcher, queues, workflows) and outline fallback strategies.
- Document security controls: secret management, payload validation, input sanitization, and observability hooks.
- Ensure testing strategy covers mocked upstreams, contract tests, retry semantics, and failure drills.
- Highlight deployment and change-management requirements for downstream consumers.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_SERVICES_FACTORY_PROMPT);
}

