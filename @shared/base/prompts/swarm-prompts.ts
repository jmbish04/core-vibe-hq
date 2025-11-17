import { promptBuilder } from './builder';
import type { PromptContext, PromptTemplate, ComposedPrompt } from './types';

export const SWARM_BASE_PROMPT_ID = 'swarm-base';

const EXTENSION_PATTERNS: Array<{ pattern: RegExp; templateId: string }> = [
  { pattern: /^agent-factory/i, templateId: 'swarm-agent-factory' },
  { pattern: /^data-factory/i, templateId: 'swarm-data-factory' },
  { pattern: /^services-factory/i, templateId: 'swarm-services-factory' },
  { pattern: /^ui-factory/i, templateId: 'swarm-ui-factory' },
  { pattern: /^cloud-worker-retrofit/i, templateId: 'swarm-cloud-worker-retrofit' },
  { pattern: /^cloudflare-expert/i, templateId: 'swarm-cloudflare-expert' },
  { pattern: /^conflict-specialist/i, templateId: 'swarm-conflict-specialist' },
  { pattern: /^delivery-report-specialist/i, templateId: 'swarm-delivery-report-specialist' },
  { pattern: /^frontend-testing-specialist/i, templateId: 'swarm-frontend-testing-specialist' },
  { pattern: /^health-specialist/i, templateId: 'swarm-health-specialist' },
  { pattern: /^ops-specialist/i, templateId: 'swarm-ops-specialist' },
  { pattern: /^unit-test-specialist/i, templateId: 'swarm-unit-test-specialist' },
];

export interface SwarmPromptOptions {
  /**
   * Identifier used to resolve a specific factory or specialist extension.
   * Examples: "agent-factory", "data-factory-orm-new-worker", "conflict-specialist".
   */
  identifier?: string;
  /**
   * Additional prompt template IDs to include beyond the resolved extension.
   */
  additionalPromptIds?: string[];
  /**
   * Prompt context applied during composition.
   */
  context?: PromptContext;
  /**
   * Custom instructions appended to the composed prompt.
   */
  customInstructions?: string[];
  /**
   * When true (default), include the Cloudflare base prompt before the swarm prompts.
   */
  includeCloudflareBase?: boolean;
}

export function resolveSwarmExtensionId(identifier: string): string | undefined {
  const normalized = identifier.trim().toLowerCase();
  for (const { pattern, templateId } of EXTENSION_PATTERNS) {
    if (pattern.test(normalized)) {
      return templateId;
    }
  }
  return undefined;
}

export function buildSwarmPrompt(options: SwarmPromptOptions = {}): ComposedPrompt {
  const {
    identifier,
    additionalPromptIds = [],
    context,
    customInstructions,
    includeCloudflareBase = true,
  } = options;

  const basePromptId = includeCloudflareBase ? 'cloudflare-base' : SWARM_BASE_PROMPT_ID;
  const basePrompt = getPromptTemplateOrFallback(basePromptId);

  const promptIdSet = new Set<string>();
  if (includeCloudflareBase) {
    promptIdSet.add(SWARM_BASE_PROMPT_ID);
  }

  if (identifier) {
    const extensionId = resolveSwarmExtensionId(identifier);
    if (extensionId) {
      promptIdSet.add(extensionId);
    }
  }

  for (const id of additionalPromptIds) {
    if (id) {
      promptIdSet.add(id);
    }
  }

  const additionalPrompts: PromptTemplate[] = Array.from(promptIdSet)
    .map(getPromptTemplateOrFallback)
    .filter(Boolean) as PromptTemplate[];

  return promptBuilder.compose({
    basePrompt,
    additionalPrompts,
    context,
    customInstructions,
  });
}

function getPromptTemplateOrFallback(id: string): PromptTemplate {
  const template = promptBuilder.get(id);
  if (template) {
    return template;
  }

  console.warn(`[swarm-prompts] Prompt template '${id}' is not registered. Using fallback.`);
  return {
    id: `fallback:${id}`,
    name: `Missing Prompt (${id})`,
    description: `Fallback prompt inserted because '${id}' was not registered.`,
    version: '0.0.0',
    tags: ['fallback', 'swarm'],
    priority: 0,
    content: `The expected prompt template '${id}' was not registered. Proceed with caution and ensure templates are imported correctly.`,
  };
}

