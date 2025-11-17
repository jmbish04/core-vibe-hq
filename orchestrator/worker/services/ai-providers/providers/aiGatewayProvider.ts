import { AIProvider, ProviderCapabilities, ProviderSelectionCriteria } from '../router';

/**
 * Supported AI Gateway providers
 */
export type AIGatewayProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'together'
  | 'replicate'
  | 'huggingface'
  | 'cohere';

/**
 * AI Gateway Provider Configuration
 */
export interface AIGatewayConfig {
  provider: AIGatewayProviderType;
  model: string;
  baseURL?: string;
  apiKey?: string; // Will be injected from secrets
}

/**
 * AI Gateway Provider - Routes requests through Cloudflare AI Gateway
 * Supports multiple AI providers with unified interface and cost/rate limiting
 */
export class AIGatewayProvider implements AIProvider {
  id: string;
  name: string;

  capabilities: ProviderCapabilities = {
    taskTypes: ['generate', 'fix', 'refactor', 'optimize'],
    contextTypes: ['github', 'local', 'container'],
    priorityLevels: ['low', 'medium', 'high', 'critical'],
    maxTokens: 32768, // Higher limit through gateway
    costPerToken: 0.00001, // Variable based on provider
    supportsStreaming: true,
  };

  costTier: 'low' | 'medium' | 'high';

  constructor(
    private config: AIGatewayConfig,
    private env: any,
    costTier: 'low' | 'medium' | 'high' = 'medium'
  ) {
    this.id = `ai-gateway-${config.provider}`;
    this.name = `AI Gateway (${config.provider})`;
    this.costTier = costTier;

    // Adjust capabilities based on provider
    this.updateCapabilitiesForProvider(config.provider);
  }

  /**
   * Update capabilities based on the specific provider
   */
  private updateCapabilitiesForProvider(provider: AIGatewayProviderType): void {
    switch (provider) {
      case 'openai':
        this.capabilities.maxTokens = 128000; // GPT-4 Turbo
        this.capabilities.costPerToken = 0.00003; // GPT-4 pricing
        break;
      case 'anthropic':
        this.capabilities.maxTokens = 200000; // Claude
        this.capabilities.costPerToken = 0.000015; // Claude pricing
        break;
      case 'google':
        this.capabilities.maxTokens = 32768; // Gemini
        this.capabilities.costPerToken = 0.0000025; // Gemini pricing
        break;
      case 'mistral':
        this.capabilities.maxTokens = 32768;
        this.capabilities.costPerToken = 0.00000025;
        break;
      case 'groq':
        this.capabilities.maxTokens = 8192;
        this.capabilities.costPerToken = 0.0000002;
        break;
      default:
        this.capabilities.maxTokens = 4096;
        this.capabilities.costPerToken = 0.00001;
    }
  }

  /**
   * Check if AI Gateway is available for this provider
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if we have the necessary configuration
      if (!this.config.baseURL && !this.env.AI_GATEWAY_URL) {
        return false;
      }

      // Check if provider credentials are available
      const credentials = this.getProviderCredentials();
      return !!(credentials && credentials.apiKey);
    } catch (error) {
      console.error('AI Gateway availability check failed:', error);
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
    return (
      this.capabilities.taskTypes.includes(criteria.taskType) &&
      this.capabilities.contextTypes.includes(criteria.sourceContext.isGitHub ? 'github' : 'local') &&
      this.capabilities.priorityLevels.includes(criteria.priority)
    );
  }

  /**
   * Get provider credentials from environment
   */
  private getProviderCredentials(): { apiKey: string; baseURL?: string } | null {
    const envKey = `${this.config.provider.toUpperCase()}_API_KEY`;
    const apiKey = this.env[envKey] || this.config.apiKey;

    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      baseURL: this.config.baseURL || this.env.AI_GATEWAY_URL,
    };
  }

  /**
   * Execute an AI task through AI Gateway
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
          error: `${this.name} is not available`,
        };
      }

      const credentials = this.getProviderCredentials();
      if (!credentials) {
        return {
          success: false,
          error: 'Provider credentials not available',
        };
      }

      const gatewayURL = credentials.baseURL || 'https://gateway.ai.cloudflare.com/v1';
      const model = options.model || this.config.model;

      // Prepare request for AI Gateway
      const requestBody: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: options.stream || false,
      };

      if (options.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      if (options.maxTokens !== undefined) {
        requestBody.max_tokens = options.maxTokens;
      }

      // Add provider-specific headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.apiKey}`,
      };

      // Add provider-specific headers based on provider type
      switch (this.config.provider) {
        case 'openai':
          headers['OpenAI-Organization'] = this.env.OPENAI_ORG_ID || '';
          break;
        case 'anthropic':
          headers['anthropic-version'] = '2023-06-01';
          break;
        case 'google':
          headers['x-goog-api-key'] = credentials.apiKey;
          break;
      }

      const response = await fetch(`${gatewayURL}/${this.config.provider}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `AI Gateway error: ${response.status} ${errorText}`,
        };
      }

      const responseData = await response.json();

      // Extract result based on provider response format
      let result: string;
      let usage: { tokens: number } | undefined;

      switch (this.config.provider) {
        case 'openai':
        case 'mistral':
        case 'groq':
          result = responseData.choices?.[0]?.message?.content || '';
          usage = responseData.usage ? {
            tokens: responseData.usage.total_tokens || responseData.usage.prompt_tokens || 0,
          } : undefined;
          break;

        case 'anthropic':
          result = responseData.content?.[0]?.text || '';
          usage = responseData.usage ? {
            tokens: responseData.usage.input_tokens + (responseData.usage.output_tokens || 0),
          } : undefined;
          break;

        case 'google':
          result = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          usage = responseData.usageMetadata ? {
            tokens: responseData.usageMetadata.totalTokenCount || 0,
          } : undefined;
          break;

        default:
          result = responseData.response || responseData.text || JSON.stringify(responseData);
          usage = responseData.usage ? { tokens: responseData.usage.total_tokens || 0 } : undefined;
      }

      return {
        success: true,
        result,
        usage,
      };

    } catch (error) {
      console.error('AI Gateway execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available models for this provider through AI Gateway
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const credentials = this.getProviderCredentials();
      if (!credentials) {
        return [];
      }

      const gatewayURL = credentials.baseURL || 'https://gateway.ai.cloudflare.com/v1';

      const response = await fetch(`${gatewayURL}/${this.config.provider}/models`, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
        },
      });

      if (!response.ok) {
        // Return default models if API call fails
        return this.getDefaultModelsForProvider();
      }

      const data = await response.json();

      switch (this.config.provider) {
        case 'openai':
          return data.data?.map((m: any) => m.id) || [];
        case 'anthropic':
          return ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'];
        case 'google':
          return ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro'];
        case 'mistral':
          return ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large'];
        case 'groq':
          return ['mixtral-8x7b-32768', 'gemma-7b-it', 'llama2-70b-4096'];
        default:
          return this.getDefaultModelsForProvider();
      }

    } catch (error) {
      console.error('Failed to fetch models from AI Gateway:', error);
      return this.getDefaultModelsForProvider();
    }
  }

  /**
   * Get default models for a provider when API is unavailable
   */
  private getDefaultModelsForProvider(): string[] {
    switch (this.config.provider) {
      case 'openai':
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      case 'anthropic':
        return ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      case 'google':
        return ['gemini-pro', 'gemini-1.5-pro'];
      case 'mistral':
        return ['mistral-small', 'mistral-medium', 'mistral-large'];
      case 'groq':
        return ['mixtral-8x7b-32768', 'llama2-70b-4096'];
      default:
        return [this.config.model];
    }
  }
}
