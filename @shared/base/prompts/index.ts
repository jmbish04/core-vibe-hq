/**
 * @shared/base/prompts/index.ts
 *
 * Centralized repository of prompt templates for AI agents.
 *
 * This module provides:
 * - Base Cloudflare Workers development guidelines
 * - Specialized domain prompts (ORM, frameworks, etc.)
 * - Prompt concatenation utilities
 * - Type-safe prompt management
 */

export { CLOUDFLARE_BASE_PROMPT } from './cloudflare-base';
export { CODING_AGENT_PROMPT } from './coding-agent';
export { ENDPOINT_INTEGRATION_PROMPT } from './endpoint-integration';
export { GPT_INTEGRATION_PROMPT } from './gpt-integration';
export { ORM_POLICY_PROMPT } from './orm-policy';
export { FRAMEWORK_POLICY_PROMPT } from './framework-policy';
export { SECURITY_POLICY_PROMPT } from './security-policy';
export { TESTING_POLICY_PROMPT } from './testing-policy';

export {
  SWARM_BASE_PROMPT,
  SWARM_AGENT_FACTORY_PROMPT,
  SWARM_DATA_FACTORY_PROMPT,
  SWARM_SERVICES_FACTORY_PROMPT,
  SWARM_UI_FACTORY_PROMPT,
  SWARM_CLOUD_WORKER_RETROFIT_PROMPT,
  SWARM_CLOUDFLARE_EXPERT_PROMPT,
  SWARM_CONFLICT_SPECIALIST_PROMPT,
  SWARM_DELIVERY_REPORT_SPECIALIST_PROMPT,
  SWARM_FRONTEND_TESTING_SPECIALIST_PROMPT,
  SWARM_HEALTH_SPECIALIST_PROMPT,
  SWARM_OPS_SPECIALIST_PROMPT,
  SWARM_UNIT_TEST_SPECIALIST_PROMPT,
} from './swarm';

export {
  buildSwarmPrompt,
  resolveSwarmExtensionId,
  SWARM_BASE_PROMPT_ID,
  type SwarmPromptOptions,
} from './swarm-prompts';

export { PromptBuilder } from './builder';
export type { PromptTemplate, PromptContext, PromptComposition, ComposedPrompt } from './types';
