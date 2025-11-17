import { AIProvider, ProviderCapabilities, ProviderSelectionCriteria } from '../router';

/**
 * Workers AI Provider - Uses Cloudflare's Workers AI for inference
 */
export class WorkersAIProvider implements AIProvider {
  id = 'workers-ai';
  name = 'Workers AI';

  capabilities: ProviderCapabilities = {
    taskTypes: ['generate', 'fix', 'refactor', 'optimize'],
    contextTypes: ['github', 'local', 'container'],
    priorityLevels: ['low', 'medium', 'high', 'critical'],
    maxTokens: 4096,
    costPerToken: 0.000001, // $0.000001 per token (very low cost)
    supportsStreaming: true,
  };

  costTier: 'low' | 'medium' | 'high' = 'low';

  constructor(private env: any) {}

  /**
   * Check if Workers AI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return !!(this.env.AI && typeof this.env.AI.run === 'function');
    } catch (error) {
      console.error('Workers AI availability check failed:', error);
      return false;
    }
  }

  /**
   * Get estimated cost for tokens
   */
  getEstimatedCost(tokens: number): number {
    return tokens * this.capabilities.costPerToken!;
  }

  /**
   * Check if this provider supports the given task criteria
   */
  supportsTask(criteria: ProviderSelectionCriteria): boolean {
    // Workers AI supports all task types and contexts
    return (
      this.capabilities.taskTypes.includes(criteria.taskType) &&
      this.capabilities.contextTypes.includes(criteria.sourceContext.isGitHub ? 'github' : 'local') &&
      this.capabilities.priorityLevels.includes(criteria.priority)
    );
  }

  /**
   * Execute an AI task using Workers AI
   */
  async executeTask(prompt: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  } = {}): Promise<{
    success: boolean;
    result?: string;
    usage?: { tokens: number };
    error?: string;
  }> {
    try {
      if (!await this.isAvailable()) {
        return {
          success: false,
          error: 'Workers AI is not available',
        };
      }

      const model = options.model || '@cf/meta/llama-3.1-8b-instruct';
      const messages = [{ role: 'user' as const, content: prompt }];

      const aiOptions: any = {
        model,
        messages,
        stream: options.stream || false,
      };

      if (options.temperature !== undefined) {
        aiOptions.temperature = options.temperature;
      }

      if (options.maxTokens !== undefined) {
        aiOptions.max_tokens = options.maxTokens;
      }

      const response = await this.env.AI.run(model, aiOptions);

      if (!response) {
        return {
          success: false,
          error: 'No response from Workers AI',
        };
      }

      // Extract result from response
      let result: string;
      if (typeof response === 'string') {
        result = response;
      } else if (response.response) {
        result = response.response;
      } else if (response.choices && response.choices[0]) {
        result = response.choices[0].message?.content || response.choices[0].text || '';
      } else {
        result = JSON.stringify(response);
      }

      // Extract usage information if available
      const usage = response.usage ? {
        tokens: response.usage.total_tokens || response.usage.prompt_tokens || 0,
      } : undefined;

      return {
        success: true,
        result,
        usage,
      };

    } catch (error) {
      console.error('Workers AI execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available models from Workers AI
   */
  async getAvailableModels(): Promise<string[]> {
    // Workers AI supports various models, return common ones
    return [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.1-70b-instruct',
      '@cf/meta/llama-3-8b-instruct',
      '@cf/meta/llama-2-7b-chat-fp16',
      '@cf/meta/llama-2-13b-chat-fp16',
      '@cf/microsoft/wizardlm-2-8x22b',
      '@cf/mistral/mistral-7b-instruct-v0.1',
      '@cf/mistral/mistral-7b-instruct-v0.2',
      '@cf/google/gemma-7b-it',
      '@cf/google/gemma-2b-it',
      '@cf/openai/gpt-3.5-turbo',
      '@cf/openai/gpt-4o-mini',
      '@cf/thebloke/discolm-german-7b-v1-awq',
      '@cf/defog/sqlcoder-7b-2',
      '@cf/openchat/openchat-3.5-0106',
    ];
  }
}
