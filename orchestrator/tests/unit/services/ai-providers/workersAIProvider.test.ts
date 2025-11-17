import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkersAIProvider } from '../../../../../worker/services/ai-providers/providers/workersAIProvider';

// Mock the env.AI
const mockAI = {
  run: vi.fn(),
};

const mockEnv = {
  AI: mockAI,
};

describe('WorkersAIProvider', () => {
  let provider: WorkersAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new WorkersAIProvider(mockEnv);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor and properties', () => {
    it('should initialize with correct properties', () => {
      expect(provider.id).toBe('workers-ai');
      expect(provider.name).toBe('Workers AI');
      expect(provider.costTier).toBe('low');
    });

    it('should have correct capabilities', () => {
      expect(provider.capabilities.taskTypes).toEqual(['generate', 'fix', 'refactor', 'optimize']);
      expect(provider.capabilities.contextTypes).toEqual(['github', 'local', 'container']);
      expect(provider.capabilities.priorityLevels).toEqual(['low', 'medium', 'high', 'critical']);
      expect(provider.capabilities.maxTokens).toBe(4096);
      expect(provider.capabilities.costPerToken).toBe(0.000001);
      expect(provider.capabilities.supportsStreaming).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when env.AI.run is available', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when env.AI is not available', async () => {
      const providerWithoutAI = new WorkersAIProvider({});
      const result = await providerWithoutAI.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when env.AI.run is not available', async () => {
      const providerWithoutRun = new WorkersAIProvider({ AI: {} });
      const result = await providerWithoutRun.isAvailable();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const envWithError = {
        AI: {
          get run() {
            throw new Error('Test error');
          },
        },
      };
      const providerWithError = new WorkersAIProvider(envWithError);
      const result = await providerWithError.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getEstimatedCost', () => {
    it('should calculate cost correctly', () => {
      const cost = provider.getEstimatedCost(1000);
      expect(cost).toBe(1000 * 0.000001);
    });

    it('should return 0 for 0 tokens', () => {
      const cost = provider.getEstimatedCost(0);
      expect(cost).toBe(0);
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

    it('should support all priority levels', () => {
      ['low', 'medium', 'high', 'critical'].forEach(priority => {
        const criteria = {
          taskType: 'generate' as const,
          sourceContext: { isGitHub: false, isLocalFactory: true },
          priority: priority as 'low' | 'medium' | 'high' | 'critical',
          costProfile: 'balanced' as const,
        };
        expect(provider.supportsTask(criteria)).toBe(true);
      });
    });
  });

  describe('executeTask', () => {
    const mockPrompt = 'Test prompt';
    const mockOptions = {
      model: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.7,
      maxTokens: 1000,
      stream: false,
    };

    it('should execute task successfully with string response', async () => {
      const mockResponse = 'Generated response';
      mockAI.run.mockResolvedValue(mockResponse);

      const result = await provider.executeTask(mockPrompt, mockOptions);

      expect(result.success).toBe(true);
      expect(result.result).toBe(mockResponse);
      expect(result.usage).toBeUndefined();

      expect(mockAI.run).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', {
        model: '@cf/meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: mockPrompt }],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      });
    });

    it('should execute task successfully with object response', async () => {
      const mockResponse = {
        response: 'Generated response from object',
        choices: [{ message: { content: 'Alternative content' } }],
      };
      mockAI.run.mockResolvedValue(mockResponse);

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Generated response from object');
      expect(result.usage).toBeUndefined();
    });

    it('should handle OpenAI-style response format', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'OpenAI style response' } }],
        usage: { total_tokens: 150, prompt_tokens: 50, completion_tokens: 100 },
      };
      mockAI.run.mockResolvedValue(mockResponse);

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(true);
      expect(result.result).toBe('OpenAI style response');
      expect(result.usage).toEqual({ tokens: 150 });
    });

    it('should handle text-only response format', async () => {
      const mockResponse = {
        choices: [{ text: 'Text-only response' }],
        usage: { total_tokens: 200 },
      };
      mockAI.run.mockResolvedValue(mockResponse);

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Text-only response');
      expect(result.usage).toEqual({ tokens: 200 });
    });

    it('should use default model when not specified', async () => {
      mockAI.run.mockResolvedValue('Default model response');

      await provider.executeTask(mockPrompt);

      expect(mockAI.run).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', expect.any(Object));
    });

    it('should handle streaming option', async () => {
      mockAI.run.mockResolvedValue('Streaming response');

      await provider.executeTask(mockPrompt, { stream: true });

      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({ stream: true })
      );
    });

    it('should handle temperature option', async () => {
      mockAI.run.mockResolvedValue('Temperature response');

      await provider.executeTask(mockPrompt, { temperature: 0.5 });

      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({ temperature: 0.5 })
      );
    });

    it('should handle maxTokens option', async () => {
      mockAI.run.mockResolvedValue('Max tokens response');

      await provider.executeTask(mockPrompt, { maxTokens: 500 });

      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({ max_tokens: 500 })
      );
    });

    it('should return error when not available', async () => {
      const unavailableProvider = new WorkersAIProvider({});
      const result = await unavailableProvider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workers AI is not available');
      expect(mockAI.run).not.toHaveBeenCalled();
    });

    it('should handle AI execution errors', async () => {
      const executionError = new Error('AI execution failed');
      mockAI.run.mockRejectedValue(executionError);

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI execution failed');
    });

    it('should handle null/undefined AI response', async () => {
      mockAI.run.mockResolvedValue(null);

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No response from Workers AI');
    });

    it('should handle unknown error types', async () => {
      mockAI.run.mockRejectedValue('String error');

      const result = await provider.executeTask(mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('getAvailableModels', () => {
    it('should return all supported models', async () => {
      const models = await provider.getAvailableModels();

      expect(models).toContain('@cf/meta/llama-3.1-8b-instruct');
      expect(models).toContain('@cf/meta/llama-3.1-70b-instruct');
      expect(models).toContain('@cf/microsoft/wizardlm-2-8x22b');
      expect(models).toContain('@cf/openai/gpt-3.5-turbo');
      expect(models).toContain('@cf/google/gemma-7b-it');
      expect(models.length).toBeGreaterThan(10);
    });
  });
});
