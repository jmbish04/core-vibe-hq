/**
 * @shared/base/prompts/builder.ts
 *
 * Prompt builder utility for composing and concatenating AI prompts.
 */

import type { PromptTemplate, PromptContext, PromptComposition, ComposedPrompt } from './types';

export class PromptBuilder {
  private templates: Map<string, PromptTemplate> = new Map();

  /**
   * Register a prompt template
   */
  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a prompt template by ID
   */
  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * List all registered templates
   */
  list(): PromptTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Compose multiple prompts into a single prompt
   */
  compose(composition: PromptComposition): ComposedPrompt {
    const { basePrompt, additionalPrompts, context, customInstructions } = composition;

    // Get all prompts to include
    const allPrompts = [basePrompt, ...additionalPrompts];

    // Sort by priority (highest first)
    allPrompts.sort((a, b) => b.priority - a.priority);

    // Build the composed content
    let content = basePrompt.content;

    // Add additional prompts
    for (const prompt of additionalPrompts) {
      content += '\n\n---\n\n' + prompt.content;
    }

    // Add custom instructions
    if (customInstructions && customInstructions.length > 0) {
      content += '\n\n---\n\n' + customInstructions.join('\n\n');
    }

    // Apply context variables if provided
    if (context?.variables) {
      content = this.applyVariables(content, context.variables);
    }

    // Add context-specific information
    if (context) {
      content = this.applyContext(content, context);
    }

    return {
      content,
      sources: allPrompts.map(p => ({
        id: p.id,
        name: p.name,
        priority: p.priority
      })),
      metadata: {
        version: this.generateVersion(allPrompts),
        timestamp: new Date().toISOString(),
        totalPrompts: allPrompts.length
      }
    };
  }

  /**
   * Create a simple concatenated prompt from multiple prompt IDs
   */
  build(basePromptId: string, additionalPromptIds: string[] = []): ComposedPrompt {
    const basePrompt = this.get(basePromptId);
    if (!basePrompt) {
      throw new Error(`Base prompt '${basePromptId}' not found`);
    }

    const additionalPrompts: PromptTemplate[] = [];
    for (const id of additionalPromptIds) {
      const prompt = this.get(id);
      if (!prompt) {
        throw new Error(`Additional prompt '${id}' not found`);
      }
      additionalPrompts.push(prompt);
    }

    return this.compose({
      basePrompt,
      additionalPrompts
    });
  }

  /**
   * Apply variable substitution to prompt content
   */
  private applyVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Apply context-specific information to prompt
   */
  private applyContext(content: string, context: PromptContext): string {
    let result = content;

    // Add project context
    if (context.projectName) {
      result = `Project: ${context.projectName}\n\n${result}`;
    }

    // Add framework context
    if (context.framework) {
      result += `\n\nFramework Context: ${context.framework}`;
    }

    // Add database context
    if (context.database) {
      result += `\n\nDatabase Context: ${context.database}`;
    }

    // Add environment context
    if (context.environment) {
      result += `\n\nEnvironment Context: ${context.environment}`;
    }

    return result;
  }

  /**
   * Generate a version string based on prompt versions
   */
  private generateVersion(prompts: PromptTemplate[]): string {
    const versions = prompts.map(p => p.version).sort();
    return versions.join('-');
  }

  /**
   * Validate prompt dependencies
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const template of this.templates.values()) {
      if (template.dependencies) {
        for (const depId of template.dependencies) {
          if (!this.templates.has(depId)) {
            errors.push(`Template '${template.id}' depends on missing template '${depId}'`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Global prompt builder instance
export const promptBuilder = new PromptBuilder();

// Expose globally so template modules can auto-register when imported
if (typeof globalThis !== 'undefined') {
  (globalThis as any).promptBuilder = promptBuilder;
}

// Auto-register all templates
import './cloudflare-base';
import './coding-agent';
import './endpoint-integration';
import './gpt-integration';
import './orm-policy';
import './framework-policy';
import './security-policy';
import './testing-policy';
import './swarm';
