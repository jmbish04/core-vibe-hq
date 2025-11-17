/**
 * @shared/base/prompts/types.ts
 *
 * Type definitions for prompt templates and context.
 */

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  version: string;
  tags: string[];
  dependencies?: string[]; // IDs of other prompts this depends on
  priority: number; // Higher numbers = higher priority in concatenation
}

export interface PromptContext {
  projectName?: string;
  framework?: string;
  database?: string;
  environment?: string;
  customInstructions?: string[];
  variables?: Record<string, string>;
}

export interface PromptComposition {
  basePrompt: PromptTemplate;
  additionalPrompts: PromptTemplate[];
  context?: PromptContext;
  customInstructions?: string[];
}

export interface ComposedPrompt {
  content: string;
  sources: Array<{
    id: string;
    name: string;
    priority: number;
  }>;
  metadata: {
    version: string;
    timestamp: string;
    totalPrompts: number;
  };
}
