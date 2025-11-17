import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIProviderRouter, ProviderSelectionCriteria, AIProvider } from '../../../orchestrator/worker/services/ai-providers/router';

describe('AIProviderRouter', () => {
  let router: AIProviderRouter;
  let mockLogger: any;
  let mockProviders: AIProvider[];

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    router = new AIProviderRouter(mockLogger);

    // Create mock providers
    mockProviders = [
      {
        id: 'jules',
        name: 'Jules AI',
        capabilities: {
          taskTypes: ['generate', 'fix', 'refactor', 'optimize'],
          contextTypes: ['github'],
          priorityLevels: ['medium', 'high', 'critical']
        },
        costTier: 'high',
        isAvailable: vi.fn().mockResolvedValue(true),
        getEstimatedCost: vi.fn().mockReturnValue(0.02),
        supportsTask: vi.fn().mockReturnValue(true)
      },
      {
        id: 'codex',
        name: 'Codex AI',
        capabilities: {
          taskTypes: ['generate', 'fix'],
          contextTypes: ['local', 'container'],
          priorityLevels: ['low', 'medium']
        },
        costTier: 'medium',
        isAvailable: vi.fn().mockResolvedValue(true),
        getEstimatedCost: vi.fn().mockReturnValue(0.01),
        supportsTask: vi.fn().mockReturnValue(true)
      },
      {
        id: 'unavailable',
        name: 'Unavailable AI',
        capabilities: {
          taskTypes: ['generate'],
          contextTypes: ['local'],
          priorityLevels: ['low']
        },
        costTier: 'low',
        isAvailable: vi.fn().mockResolvedValue(false),
        getEstimatedCost: vi.fn().mockReturnValue(0.005),
        supportsTask: vi.fn().mockReturnValue(true)
      }
    ];

    // Register providers
    mockProviders.forEach(provider => router.registerProvider(provider));
  });

  describe('Provider Registration', () => {
    it('should register providers successfully', () => {
      expect(router.getProviders()).toHaveLength(3);
      expect(mockLogger.info).toHaveBeenCalledWith('Registered AI provider: Jules AI (jules)');
      expect(mockLogger.info).toHaveBeenCalledWith('Registered AI provider: Codex AI (codex)');
      expect(mockLogger.info).toHaveBeenCalledWith('Registered AI provider: Unavailable AI (unavailable)');
    });

    it('should unregister providers', () => {
      router.unregisterProvider('jules');
      expect(router.getProviders()).toHaveLength(2);
      expect(router.getProviders().find(p => p.id === 'jules')).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Unregistered AI provider: jules');
    });
  });

  describe('Provider Selection', () => {
    it('should select the best provider for GitHub context', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: true,
          repoName: 'test-repo',
          branchName: 'main',
          isLocalFactory: false
        },
        priority: 'high',
        costProfile: 'performance'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('jules'); // Jules supports GitHub context
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.reason).toContain('supports generate tasks');
    });

    it('should select provider based on cost profile', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'fix',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('codex'); // Codex has medium cost, better for economy
    });

    it('should handle manual override', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy',
        manualOverride: 'jules'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('jules');
      expect(result!.confidence).toBe(1.0);
      expect(result!.reason).toContain('Manual override');
    });

    it('should reject manual override for unavailable provider', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy',
        manualOverride: 'unavailable'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("Manual override provider 'unavailable' is not available");
    });

    it('should return null when no providers are available', async () => {
      // Make all providers unavailable
      mockProviders.forEach(provider => {
        provider.isAvailable = vi.fn().mockResolvedValue(false);
      });

      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No AI providers available');
    });

    it('should return null when no providers support the task', async () => {
      // Make all providers not support the task
      mockProviders.forEach(provider => {
        provider.supportsTask = vi.fn().mockReturnValue(false);
      });

      const criteria: ProviderSelectionCriteria = {
        taskType: 'refactor',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No providers can handle the requested task type and context');
    });
  });

  describe('Provider Scoring', () => {
    it('should prefer providers that match task type', async () => {
      // Make Codex not support 'optimize' task
      mockProviders[1].supportsTask = vi.fn((criteria) => criteria.taskType !== 'optimize');

      const criteria: ProviderSelectionCriteria = {
        taskType: 'optimize',
        sourceContext: {
          isGitHub: true,
          isLocalFactory: false
        },
        priority: 'high',
        costProfile: 'performance'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('jules'); // Only Jules supports optimize
    });

    it('should consider context compatibility', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: true,
          isLocalFactory: false
        },
        priority: 'medium',
        costProfile: 'balanced'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('jules'); // Jules has GitHub context support
    });

    it('should consider cost alignment', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'fix',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      // Should prefer codex (medium cost) over jules (high cost) for economy profile
      expect(result!.provider.id).toBe('codex');
    });
  });

  describe('Provider Statistics', () => {
    it('should return correct provider statistics', async () => {
      const stats = await router.getProviderStats();

      expect(stats.total).toBe(3);
      expect(stats.available).toBe(2); // unavailable provider is not available
      expect(stats.byCapability.generate).toBe(3); // All providers support generate
      expect(stats.byCapability.fix).toBe(2); // Jules and Codex support fix
    });
  });

  describe('Error Handling', () => {
    it('should handle provider availability check failures', async () => {
      // Make Jules throw an error during availability check
      mockProviders[0].isAvailable = vi.fn().mockRejectedValue(new Error('Network error'));

      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'low',
        costProfile: 'economy'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('codex'); // Should still select codex
      expect(mockLogger.warn).toHaveBeenCalledWith('Provider jules availability check failed:', expect.any(Error));
    });
  });

  describe('Preferred Model Bonus', () => {
    it('should give bonus for preferred model matches', async () => {
      const criteria: ProviderSelectionCriteria = {
        taskType: 'generate',
        sourceContext: {
          isGitHub: false,
          isLocalFactory: true
        },
        priority: 'medium',
        costProfile: 'balanced',
        preferredModel: 'jules'
      };

      const result = await router.selectProvider(criteria);

      expect(result).toBeDefined();
      expect(result!.provider.id).toBe('jules'); // Should prefer Jules due to model preference
    });
  });
});
