import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIGatewayProvider } from '../../../../../worker/services/ai-providers/providers/aiGatewayProvider';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AIGatewayProvider', () => {
  let provider: AIGatewayProvider;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = {
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      GOOGLE_API_KEY: 'test-google-key',
      AI_GATEWAY_URL: 'https://gateway.example.com/v1',
    };

    provider = new AIGatewayProvider({
      provider: 'openai',
      model: 'gpt-4',
      baseURL: 'https://api.openai.com/v1',
    }, mockEnv, 'high');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor and properties', () => {
    it('should initialize OpenAI provider with correct properties', () => {
      const openaiProvider = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, mockEnv, 'high');

      expect(openaiProvider.id).toBe('ai-gateway-openai');
      expect(openaiProvider.name).toBe('AI Gateway (openai)');
      expect(openaiProvider.costTier).toBe('high');
    });

    it('should initialize Anthropic provider with correct capabilities', () => {
      const anthropicProvider = new AIGatewayProvider({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
      }, mockEnv, 'high');

      expect(anthropicProvider.capabilities.maxTokens).toBe(200000);
      expect(anthropicProvider.capabilities.costPerToken).toBe(0.000015);
    });

    it('should initialize Google provider with correct capabilities', () => {
      const googleProvider = new AIGatewayProvider({
        provider: 'google',
        model: 'gemini-pro',
      }, mockEnv, 'medium');

      expect(googleProvider.capabilities.maxTokens).toBe(32768);
      expect(googleProvider.costTier).toBe('medium');
    });

    it('should initialize Mistral provider with low cost tier', () => {
      const mistralProvider = new AIGatewayProvider({
        provider: 'mistral',
        model: 'mistral-medium',
      }, mockEnv, 'low');

      expect(mistralProvider.capabilities.costPerToken).toBe(0.00000025);
      expect(mistralProvider.costTier).toBe('low');
    });
  });

  describe('isAvailable', () => {
    it('should return true when provider credentials are available', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when provider credentials are missing', async () => {
      const providerWithoutKey = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, {}, 'high');

      const result = await providerWithoutKey.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when baseURL is missing and no gateway URL', async () => {
      const providerWithoutURL = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, { OPENAI_API_KEY: 'test-key' }, 'high');

      const result = await providerWithoutURL.isAvailable();
      expect(result).toBe(false);
    });

    it('should handle credential lookup errors', async () => {
      const envWithError = {
        get OPENAI_API_KEY() {
          throw new Error('Credential error');
        },
      };

      const providerWithError = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, envWithError, 'high');

      const result = await providerWithError.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('supportsTask', () => {
    it('should support all task types and contexts', () => {
      const criteria = {
        taskType: 'generate' as const,
        sourceContext: { isGitHub: false, isLocalFactory: true },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
      };
      expect(provider.supportsTask(criteria)).toBe(true);
    });

    it('should support GitHub context', () => {
      const criteria = {
        taskType: 'fix' as const,
        sourceContext: { isGitHub: true, repoName: 'test', isLocalFactory: false },
        priority: 'high' as const,
        costProfile: 'balanced' as const,
      };
      expect(provider.supportsTask(criteria)).toBe(true);
    });
  });

  describe('executeTask', () => {
    const mockPrompt = 'Test prompt';
    const mockOptions = {
      temperature: 0.7,
      maxTokens: 1000,
      stream: false,
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 150 },
        }),
      });
    });

    it('should execute OpenAI task successfully', async () => {
      const result = await provider.executeTask(mockPrompt, mockOptions);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Test response');
      expect(result.usage).toEqual({ tokens: 150 });

      expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/openai', {
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-openai-key',
        }),
        body: expect.stringContaining(mockPrompt),
      });
    });

    it('should execute Anthropic task successfully', async () => {
      const anthropicProvider = new AIGatewayProvider({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
      }, mockEnv, 'high');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: 'Anthropic response' }],
          usage: { input_tokens: 50, output_tokens: 100 },
        }),
      });

      const result = await anthropicProvider.executeTask(mockPrompt);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Anthropic response');
      expect(result.usage).toEqual({ tokens: 150 });
    });

    it('should execute Google task successfully', async () => {
      const googleProvider = new AIGatewayProvider({
        provider: 'google',
        model: 'gemini-pro',
      }, mockEnv, 'medium');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [{
            content: {
              parts: [{ text: 'Google response' }],
            },
          }],
          usageMetadata: { totalTokenCount: 200 },
        }),
      });

      const result = await googleProvider.executeTask(mockPrompt);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Google response');
      expect(result.usage).toEqual({ tokens: 200 });
    });

    it('should use AI Gateway URL when no baseURL provided', async () => {
      const gatewayProvider = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, mockEnv, 'high');

      await gatewayProvider.executeTask(mockPrompt);

      expect(mockFetch).toHaveBeenCalledWith('https://gateway.example.com/v1/openai', expect.any(Object));
    });

    it('should handle provider-specific headers', async () => {
      const anthropicProvider = new AIGatewayProvider({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
      }, mockEnv, 'high');

      await anthropicProvider.executeTask(mockPrompt);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should handle streaming option', async () => {
      await provider.executeTask(mockPrompt, { stream: true });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.stream).toBe(true);
    });

    it('should handle temperature option', async () => {
      await provider.executeTask(mockPrompt, { temperature: 0.5 });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.temperature).toBe(0.5);
    });

    it('should handle maxTokens option', async () => {
      await provider.executeTask(mockPrompt, { maxTokens: 500 });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.max_tokens).toBe(500);
    });

    it('should return error when not available', async () => {
      const unavailableProvider = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, {}, 'high');

      const result = await unavailableProvider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI Gateway (openai) is not available');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limit exceeded'),
      });

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toContain('429 Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });
  });

  describe('getAvailableModels', () => {
    it('should return OpenAI models from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { id: 'gpt-4' },
            { id: 'gpt-4-turbo' },
            { id: 'gpt-3.5-turbo' },
          ],
        }),
      });

      const models = await provider.getAvailableModels();
      expect(models).toEqual(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']);
    });

    it('should return Anthropic default models when API fails', async () => {
      const anthropicProvider = new AIGatewayProvider({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
      }, mockEnv, 'high');

      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const models = await anthropicProvider.getAvailableModels();
      expect(models).toContain('claude-3-opus');
      expect(models).toContain('claude-3-sonnet');
      expect(models).toContain('claude-3-haiku');
    });

    it('should return Google default models', async () => {
      const googleProvider = new AIGatewayProvider({
        provider: 'google',
        model: 'gemini-pro',
      }, mockEnv, 'medium');

      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const models = await googleProvider.getAvailableModels();
      expect(models).toContain('gemini-pro');
      expect(models).toContain('gemini-1.5-pro');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const models = await provider.getAvailableModels();
      expect(models).toEqual(['gpt-4']); // Default model
    });
  });

  describe('getDefaultModelsForProvider', () => {
    it('should return correct defaults for each provider', () => {
      const openaiProvider = new AIGatewayProvider({
        provider: 'openai',
        model: 'gpt-4',
      }, mockEnv, 'high');

      const anthropicProvider = new AIGatewayProvider({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
      }, mockEnv, 'high');

      const googleProvider = new AIGatewayProvider({
        provider: 'google',
        model: 'gemini-pro',
      }, mockEnv, 'medium');

      expect((openaiProvider as any).getDefaultModelsForProvider()).toContain('gpt-4');
      expect((anthropicProvider as any).getDefaultModelsForProvider()).toContain('claude-3-sonnet');
      expect((googleProvider as any).getDefaultModelsForProvider()).toContain('gemini-pro');
    });
  });
});
