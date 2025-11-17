import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIProviderRouter } from '../../../../worker/services/ai-providers/router';
import { AIProviderConfigService } from '../../../../worker/services/ai-providers/configService';
import { WorkersAIProvider } from '../../../../worker/services/ai-providers/providers/workersAIProvider';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

// Mock database
const mockDb = {
  insertInto: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflict: vi.fn(() => ({
        doUpdateSet: vi.fn(() => ({
          execute: vi.fn(),
        })),
      })),
      execute: vi.fn(),
    })),
  })),
  selectFrom: vi.fn(() => ({
    select: vi.fn(() => ({
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              executeTakeFirst: vi.fn(),
              execute: vi.fn(),
            })),
          })),
          execute: vi.fn(),
        })),
      })),
      orderBy: vi.fn(() => ({
        execute: vi.fn(),
      })),
      execute: vi.fn(),
    })),
  })),
  updateTable: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        execute: vi.fn(),
      })),
    })),
  })),
  deleteFrom: vi.fn(() => ({
    where: vi.fn(() => ({
      execute: vi.fn(),
    })),
  })),
};

vi.mock('kysely-d1');

describe('AI Provider Integration', () => {
  let router: AIProviderRouter;
  let configService: AIProviderConfigService;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {
      AI: { run: vi.fn() },
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
    };

    // Mock Kysely
    (Kysely as any).mockImplementation(() => mockDb);

    router = new AIProviderRouter(console, mockEnv);
    configService = new AIProviderConfigService(mockDb as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Provider Router with Default Providers', () => {
    it('should auto-register default providers when env is provided', () => {
      // Check that providers were registered
      const providers = router.getProviders();
      expect(providers.length).toBeGreaterThan(0);

      // Should have Workers AI
      const workersAI = providers.find(p => p.id === 'workers-ai');
      expect(workersAI).toBeDefined();
      expect(workersAI?.name).toBe('Workers AI');

      // Should have AI Gateway providers
      const openaiGateway = providers.find(p => p.id === 'ai-gateway-openai');
      expect(openaiGateway).toBeDefined();
      expect(openaiGateway?.name).toBe('AI Gateway (openai)');
    });

    it('should select appropriate provider based on criteria', async () => {
      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result?.provider).toBeDefined();
      expect(result?.confidence).toBeGreaterThan(0);
      expect(result?.reason).toBeDefined();
    });

    it('should prefer lower cost providers for balanced cost profile', async () => {
      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
      };

      const result = await router.selectProvider(criteria);

      // Should prefer lower cost tiers
      expect(['low', 'medium']).toContain(result?.provider.costTier);
    });

    it('should handle manual provider override', async () => {
      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
        manualOverride: 'workers-ai',
      };

      const result = await router.selectProvider(criteria);

      expect(result?.provider.id).toBe('workers-ai');
    });

    it('should return null when no suitable provider is found', async () => {
      // Create router without providers
      const emptyRouter = new AIProviderRouter(console);

      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
      };

      const result = await emptyRouter.selectProvider(criteria);
      expect(result).toBeNull();
    });
  });

  describe('Provider Config Service Integration', () => {
    it('should save and retrieve provider configuration', async () => {
      const config = {
        id: 'test-openai-config',
        provider: 'openai',
        name: 'Test OpenAI Config',
        model: 'gpt-4',
        baseURL: 'https://api.openai.com/v1',
        costTier: 'high' as const,
        config: { temperature: 0.7 },
      };

      // Mock save operation
      mockDb.insertInto.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflict: vi.fn().mockReturnValue({
            doUpdateSet: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      });

      await configService.saveConfig(config);

      expect(mockDb.insertInto).toHaveBeenCalledWith('ai_provider_configs');

      // Mock retrieval
      const mockConfigResult = {
        id: config.id,
        provider: config.provider,
        name: config.name,
        model: config.model,
        base_url: config.baseURL,
        cost_tier: config.costTier,
        is_active: true,
        config: JSON.stringify(config.config),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(mockConfigResult),
            }),
          }),
        }),
      });

      const retrieved = await configService.getActiveConfig(config.id);

      expect(retrieved).toEqual({
        id: config.id,
        provider: config.provider,
        name: config.name,
        model: config.model,
        baseURL: config.baseURL,
        costTier: config.costTier,
        isActive: true,
        config: config.config,
        createdAt: mockConfigResult.created_at,
        updatedAt: mockConfigResult.updated_at,
      });
    });

    it('should return null for non-existent configuration', async () => {
      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });

      const result = await configService.getActiveConfig('non-existent');
      expect(result).toBeNull();
    });

    it('should list all configurations', async () => {
      const mockConfigs = [
        {
          id: 'config1',
          provider: 'openai',
          name: 'OpenAI Config',
          model: 'gpt-4',
          base_url: 'https://api.openai.com/v1',
          cost_tier: 'high',
          is_active: true,
          config: '{}',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'config2',
          provider: 'anthropic',
          name: 'Anthropic Config',
          model: 'claude-3-sonnet',
          base_url: null,
          cost_tier: 'high',
          is_active: true,
          config: '{}',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockConfigs),
          }),
        }),
      });

      const configs = await configService.listConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0].provider).toBe('openai');
      expect(configs[1].provider).toBe('anthropic');
    });

    it('should update provider configuration', async () => {
      const updates = {
        name: 'Updated OpenAI Config',
        model: 'gpt-4-turbo',
      };

      mockDb.updateTable.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      await configService.updateConfig('test-config', updates);

      expect(mockDb.updateTable).toHaveBeenCalledWith('ai_provider_configs');
    });

    it('should delete provider configuration', async () => {
      mockDb.deleteFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await configService.deleteConfig('test-config');

      expect(mockDb.deleteFrom).toHaveBeenCalledWith('ai_provider_configs');
    });

    it('should get provider statistics', async () => {
      const mockStats = [
        { provider: 'openai', count: 2, active_count: 2 },
        { provider: 'anthropic', count: 1, active_count: 1 },
      ];

      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockStats),
          }),
        }),
      });

      const stats = await configService.getProviderStats();

      expect(stats).toEqual([
        { provider: 'openai', count: 2, activeCount: 2 },
        { provider: 'anthropic', count: 1, activeCount: 1 },
      ]);
    });
  });

  describe('Provider Execution Flow', () => {
    it('should execute task through provider with telemetry', async () => {
      // Mock Workers AI availability
      mockEnv.AI.run.mockResolvedValue('Test response');

      const workersProvider = new WorkersAIProvider(mockEnv);
      router.registerProvider(workersProvider);

      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
      };

      const selection = await router.selectProvider(criteria);
      expect(selection).toBeDefined();

      const execution = await selection!.provider.executeTask('Test prompt');
      expect(execution.success).toBe(true);
      expect(execution.result).toBe('Test response');
    });

    it('should handle provider execution failures gracefully', async () => {
      // Mock provider failure
      mockEnv.AI.run.mockRejectedValue(new Error('Provider error'));

      const workersProvider = new WorkersAIProvider(mockEnv);
      router.registerProvider(workersProvider);

      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'medium' as const,
        costProfile: 'balanced' as const,
      };

      const selection = await router.selectProvider(criteria);
      expect(selection).toBeDefined();

      const execution = await selection!.provider.executeTask('Test prompt');
      expect(execution.success).toBe(false);
      expect(execution.error).toBe('Provider error');
    });
  });

  describe('Cost Optimization', () => {
    it('should prefer lower cost providers for cost-conscious tasks', async () => {
      const criteria = {
        taskType: 'generate' as const,
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true,
        },
        priority: 'low' as const,
        costProfile: 'economy' as const,
      };

      const result = await router.selectProvider(criteria);

      // Should prefer the lowest cost provider available
      expect(result?.provider.costTier).toBe('low');
    });

    it('should calculate costs accurately', async () => {
      const workersProvider = new WorkersAIProvider(mockEnv);

      const cost1000 = workersProvider.getEstimatedCost(1000);
      const cost2000 = workersProvider.getEstimatedCost(2000);

      expect(cost2000).toBe(cost1000 * 2); // Should scale linearly
      expect(cost1000).toBeGreaterThan(0);
    });
  });
});
