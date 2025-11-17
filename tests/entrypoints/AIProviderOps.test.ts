import type { ExecutionContext } from '@cloudflare/workers-types';
import { AIProviderOps } from '../../orchestrator/worker/entrypoints/AIProviderOps';
import { AIProviderRouter } from '../../orchestrator/worker/services/ai-providers/router';
import { SecretService } from '../../orchestrator/worker/services/secrets/secretService';
import { CLIAgentService } from '../../orchestrator/worker/services/ai-providers/cli/cliAgentService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AIProviderOps', () => {
  let aiProviderOps: AIProviderOps;
  let mockRouter: AIProviderRouter;
  let mockSecretService: SecretService;
  let mockCLIAgentService: CLIAgentService;
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockRouter = {
      selectProvider: vi.fn(),
      getProviders: vi.fn().mockReturnValue([]),
      getProviderStats: vi.fn().mockResolvedValue({
        total: 0,
        available: 0,
        byCapability: {}
      })
    } as unknown as AIProviderRouter;

    mockSecretService = {
      getLLMCredentials: vi.fn().mockReturnValue({
        jules: 'test-jules-key',
        codex: 'test-codex-key'
      })
    } as unknown as SecretService;

    mockCLIAgentService = {
      executeCommand: vi.fn()
    } as unknown as CLIAgentService;

    mockEnv = {
      // Mock environment
    };
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;

    // Mock the constructor dependencies
    vi.spyOn(require('../../orchestrator/worker/services/ai-providers/router'), 'AIProviderRouter')
      .mockImplementation(() => mockRouter);

    vi.spyOn(require('../../orchestrator/worker/services/secrets/secretService'), 'SecretService')
      .mockImplementation(() => mockSecretService);

    vi.spyOn(require('../../orchestrator/worker/services/ai-providers/cli/cliAgentService'), 'CLIAgentService')
      .mockImplementation(() => mockCLIAgentService);

    aiProviderOps = new AIProviderOps(mockCtx, mockEnv);
  });

  describe('assignProvider', () => {
    it('should successfully assign a provider', async () => {
      const mockResult = {
        provider: { id: 'jules', name: 'Jules AI' },
        confidence: 0.9,
        reason: 'Best match for task type'
      };

      mockRouter.selectProvider = vi.fn().mockResolvedValue(mockResult);

      const result = await aiProviderOps.assignProvider({
        taskId: 'task-123',
        criteria: {
          taskType: 'generate',
          priority: 'high'
        }
      });

      expect(result.success).toBe(true);
      expect(result.providerId).toBe('jules');
      expect(result.confidence).toBe(0.9);
      expect(result.reason).toBe('Best match for task type');

      expect(mockRouter.selectProvider).toHaveBeenCalledWith({
        taskType: 'generate',
        sourceContext: {
          isGitHub: false,
          repoName: undefined,
          branchName: undefined,
          isLocalFactory: true
        },
        priority: 'high',
        costProfile: 'balanced',
        preferredModel: undefined,
        manualOverride: undefined
      });
    });

    it('should handle manual provider override', async () => {
      const mockResult = {
        provider: { id: 'codex', name: 'Codex AI' },
        confidence: 1.0,
        reason: 'Manual override: codex'
      };

      mockRouter.selectProvider = vi.fn().mockResolvedValue(mockResult);

      const result = await aiProviderOps.assignProvider({
        taskId: 'task-456',
        manualProvider: 'codex'
      });

      expect(result.success).toBe(true);
      expect(result.providerId).toBe('codex');
      expect(result.confidence).toBe(1.0);
    });

    it('should return error when no provider is found', async () => {
      mockRouter.selectProvider = vi.fn().mockResolvedValue(null);

      const result = await aiProviderOps.assignProvider({
        taskId: 'task-789'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable AI provider found');
    });

    it('should handle provider selection errors', async () => {
      mockRouter.selectProvider = vi.fn().mockRejectedValue(new Error('Selection failed'));

      const result = await aiProviderOps.assignProvider({
        taskId: 'task-error'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Selection failed');
    });
  });

  describe('executeTask', () => {
    it('should execute task with automatic provider assignment', async () => {
      // Mock provider assignment
      mockRouter.selectProvider = vi.fn().mockResolvedValue({
        provider: { id: 'jules' },
        confidence: 0.8,
        reason: 'Auto-selected'
      });

      // Mock CLI execution
      mockCLIAgentService.executeCommand = vi.fn().mockResolvedValue({
        success: true,
        output: { result: 'Generated content' },
        exitCode: 0,
        executionTime: 1500
      });

      const result = await aiProviderOps.executeTask({
        taskId: 'task-123',
        prompt: 'Generate a function',
        options: { temperature: 0.8 }
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ result: 'Generated content' });
      expect(result.providerId).toBe('jules');
      expect(result.executionTime).toBeGreaterThan(0);

      expect(mockCLIAgentService.executeCommand).toHaveBeenCalledWith({
        command: 'ai-execute',
        args: ['--provider', 'jules', '--prompt', 'Generate a function', '--task-id', 'task-123'],
        environmentVariables: {
          jules: 'test-jules-key',
          codex: 'test-codex-key',
          TEMPERATURE: '0.8',
          MAX_TOKENS: '1000'
        },
        timeout: 30000,
        outputFormat: 'json'
      });
    });

    it('should execute task with specified provider', async () => {
      mockCLIAgentService.executeCommand = vi.fn().mockResolvedValue({
        success: true,
        output: 'Direct execution result',
        exitCode: 0,
        executionTime: 1000
      });

      const result = await aiProviderOps.executeTask({
        taskId: 'task-456',
        prompt: 'Test prompt',
        providerId: 'codex'
      });

      expect(result.success).toBe(true);
      expect(result.providerId).toBe('codex');

      expect(mockCLIAgentService.executeCommand).toHaveBeenCalledWith({
        command: 'ai-execute',
        args: ['--provider', 'codex', '--prompt', 'Test prompt', '--task-id', 'task-456'],
        environmentVariables: expect.objectContaining({
          jules: 'test-jules-key',
          codex: 'test-codex-key'
        }),
        timeout: 30000,
        outputFormat: 'json'
      });
    });

    it('should handle execution failure', async () => {
      mockRouter.selectProvider = vi.fn().mockResolvedValue({
        provider: { id: 'jules' },
        confidence: 0.8,
        reason: 'Selected'
      });

      mockCLIAgentService.executeCommand = vi.fn().mockResolvedValue({
        success: false,
        error: 'Execution timeout',
        exitCode: 1,
        executionTime: 35000
      });

      const result = await aiProviderOps.executeTask({
        taskId: 'task-fail',
        prompt: 'This will fail'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution timeout');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle provider assignment failure', async () => {
      mockRouter.selectProvider = vi.fn().mockResolvedValue(null);

      const result = await aiProviderOps.executeTask({
        taskId: 'task-no-provider',
        prompt: 'No provider available'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to assign provider');
    });
  });

  describe('checkProviderStatus', () => {
    it('should check status of all providers', async () => {
      const mockProviders = [
        {
          id: 'jules',
          name: 'Jules AI',
          costTier: 'high',
          capabilities: { taskTypes: ['generate', 'fix'] },
          isAvailable: vi.fn().mockResolvedValue(true)
        },
        {
          id: 'codex',
          name: 'Codex AI',
          costTier: 'medium',
          capabilities: { taskTypes: ['generate'] },
          isAvailable: vi.fn().mockResolvedValue(false)
        }
      ];

      mockRouter.getProviders = vi.fn().mockReturnValue(mockProviders);

      const result = await aiProviderOps.checkProviderStatus();

      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(2);
      expect(result.providers![0]).toEqual({
        id: 'jules',
        available: true,
        costTier: 'high',
        capabilities: ['generate', 'fix'],
        lastChecked: expect.any(Date)
      });
      expect(result.providers![1]).toEqual({
        id: 'codex',
        available: false,
        costTier: 'medium',
        capabilities: ['generate'],
        lastChecked: expect.any(Date)
      });
    });

    it('should check status of specific provider', async () => {
      const mockProvider = {
        id: 'jules',
        name: 'Jules AI',
        costTier: 'high',
        capabilities: { taskTypes: ['generate'] },
        isAvailable: vi.fn().mockResolvedValue(true)
      };

      mockRouter.getProviders = vi.fn().mockReturnValue([mockProvider]);

      const result = await aiProviderOps.checkProviderStatus({ providerId: 'jules' });

      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(1);
      expect(result.providers![0].id).toBe('jules');
      expect(result.providers![0].available).toBe(true);
    });

    it('should handle unknown provider', async () => {
      mockRouter.getProviders = vi.fn().mockReturnValue([]);

      const result = await aiProviderOps.checkProviderStatus({ providerId: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Provider 'unknown' not found");
    });
  });

  describe('listAvailableProviders', () => {
    it('should list all providers without filters', async () => {
      const mockProviders = [
        {
          id: 'jules',
          name: 'Jules AI',
          costTier: 'high',
          capabilities: {
            taskTypes: ['generate', 'fix'],
            contextTypes: ['github'],
            priorityLevels: ['high']
          },
          getEstimatedCost: vi.fn().mockReturnValue(0.02)
        }
      ];

      mockRouter.getProviders = vi.fn().mockReturnValue(mockProviders);

      const result = await aiProviderOps.listAvailableProviders();

      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(1);
      expect(result.providers![0]).toEqual({
        id: 'jules',
        name: 'Jules AI',
        costTier: 'high',
        capabilities: {
          taskTypes: ['generate', 'fix'],
          contextTypes: ['github'],
          priorityLevels: ['high']
        },
        estimatedCost: 0.02
      });
    });

    it('should filter providers by task type', async () => {
      const mockProviders = [
        {
          id: 'jules',
          name: 'Jules AI',
          costTier: 'high',
          capabilities: {
            taskTypes: ['generate', 'fix'],
            contextTypes: ['github'],
            priorityLevels: ['high']
          },
          getEstimatedCost: vi.fn().mockReturnValue(0.02)
        },
        {
          id: 'codex',
          name: 'Codex AI',
          costTier: 'medium',
          capabilities: {
            taskTypes: ['generate'],
            contextTypes: ['local'],
            priorityLevels: ['medium']
          },
          getEstimatedCost: vi.fn().mockReturnValue(0.01)
        }
      ];

      mockRouter.getProviders = vi.fn().mockReturnValue(mockProviders);

      const result = await aiProviderOps.listAvailableProviders({ taskType: 'fix' });

      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(1);
      expect(result.providers![0].id).toBe('jules');
    });

    it('should filter providers by cost profile', async () => {
      const mockProviders = [
        {
          id: 'cheap',
          name: 'Cheap AI',
          costTier: 'low',
          capabilities: {
            taskTypes: ['generate'],
            contextTypes: ['local'],
            priorityLevels: ['low']
          },
          getEstimatedCost: vi.fn().mockReturnValue(0.005)
        }
      ];

      mockRouter.getProviders = vi.fn().mockReturnValue(mockProviders);

      const result = await aiProviderOps.listAvailableProviders({ costProfile: 'economy' });

      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(1);
      expect(result.providers![0].id).toBe('cheap');
    });
  });

  describe('getProviderStats', () => {
    it('should return provider statistics', async () => {
      mockRouter.getProviderStats = vi.fn().mockResolvedValue({
        total: 3,
        available: 2,
        byCapability: { generate: 3, fix: 2 }
      });

      const mockProviders = [
        {
          id: 'p1',
          name: 'Provider 1',
          costTier: 'high',
          capabilities: { taskTypes: ['generate', 'fix'] }
        },
        {
          id: 'p2',
          name: 'Provider 2',
          costTier: 'medium',
          capabilities: { taskTypes: ['generate'] }
        }
      ];

      mockRouter.getProviders = vi.fn().mockReturnValue(mockProviders);

      const result = await aiProviderOps.getProviderStats();

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        totalProviders: 3,
        availableProviders: 2,
        utilizationByTier: { high: 1, medium: 1 },
        capabilities: { generate: 2, fix: 1 }
      });
    });

    it('should handle stats retrieval errors', async () => {
      mockRouter.getProviderStats = vi.fn().mockRejectedValue(new Error('Stats error'));

      const result = await aiProviderOps.getProviderStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stats error');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockRouter.selectProvider = vi.fn().mockRejectedValue('Unexpected error');

      const result = await aiProviderOps.assignProvider({ taskId: 'error-task' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });
  });
});
