import type { PromptTemplate } from '../types';

export const SWARM_AGENT_FACTORY_PROMPT: PromptTemplate = {
  id: 'swarm-agent-factory',
  name: 'Swarm Extension • Agent Factory',
  description: 'Specialized guidance for agent-factory workers generating Cloudflare Agents',
  version: '1.0.0',
  tags: ['swarm', 'factory', 'agents'],
  priority: 74,
  dependencies: ['swarm-base'],
  content: `<swarm_extension target="agent-factory">
- Prioritize Cloudflare Agents architecture: Durable Objects, AgentNamespace bindings, and Workflow integration.
- Ensure specifications describe WorkerEntrypoint classes, service bindings in orchestrator, and migration requirements (\`migrations[].new_sqlite_classes\`).
- Capture requirements for AI tool selection (Workers AI, OpenAI, Anthropic) and prompt composition strategies.
- Document logging, observability, and hand-off expectations between orchestrator and generated agents.
- Track code generation secondary effects: template selection, placeholder resolution, sandbox operations, and MCP tool usage.
</swarm_extension>`
};

if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SWARM_AGENT_FACTORY_PROMPT);
}

