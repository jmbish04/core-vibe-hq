import { z } from 'zod';
import { WorkersAIProvider, AIGatewayProvider } from './providers';

/**
 * Provider selection criteria schema
 */
export const ProviderSelectionCriteriaSchema = z.object({
  taskType: z.enum(['generate', 'fix', 'refactor', 'optimize']),
  sourceContext: z.object({
    isGitHub: z.boolean(),
    repoName: z.string().optional(),
    branchName: z.string().optional(),
    isLocalFactory: z.boolean(),
  }),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  costProfile: z.enum(['economy', 'balanced', 'performance']),
  preferredModel: z.string().optional(),
  manualOverride: z.string().optional(),
});

export type ProviderSelectionCriteria = z.infer<typeof ProviderSelectionCriteriaSchema>;

/**
 * Provider capabilities interface
 */
export interface ProviderCapabilities {
  taskTypes: Array<'generate' | 'fix' | 'refactor' | 'optimize'>;
  contextTypes: Array<'github' | 'local' | 'container'>;
  priorityLevels: Array<'low' | 'medium' | 'high' | 'critical'>;
  maxTokens?: number;
  costPerToken?: number;
  supportsStreaming?: boolean;
}

/**
 * Provider interface that all AI providers must implement
 */
export interface AIProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  costTier: 'low' | 'medium' | 'high';
  isAvailable: () => Promise<boolean>;
  getEstimatedCost: (tokens: number) => number;
  supportsTask: (criteria: ProviderSelectionCriteria) => boolean;
}

/**
 * Provider selection result
 */
export interface ProviderSelectionResult {
  provider: AIProvider;
  confidence: number;
  reason: string;
  estimatedCost?: number;
}

/**
 * AI Provider Router - automatically selects the best AI provider based on task requirements
 */
export class AIProviderRouter {
  private providers: Map<string, AIProvider> = new Map();
  private logger: any;

  constructor(logger: any, env?: any) {
    this.logger = logger;

    // Auto-register default providers if environment is provided
    if (env) {
      this.registerDefaultProviders(env);
    }
  }

  /**
   * Register default AI providers
   */
  private registerDefaultProviders(env: any): void {
    try {
      // Register Workers AI provider
      const workersAIProvider = new WorkersAIProvider(env);
      this.registerProvider(workersAIProvider);

      // Register AI Gateway providers for common services
      const gatewayProviders = [
        { provider: 'openai' as const, model: 'gpt-4', costTier: 'high' as const },
        { provider: 'anthropic' as const, model: 'claude-3-sonnet', costTier: 'high' as const },
        { provider: 'google' as const, model: 'gemini-pro', costTier: 'medium' as const },
        { provider: 'mistral' as const, model: 'mistral-medium', costTier: 'low' as const },
        { provider: 'groq' as const, model: 'mixtral-8x7b-32768', costTier: 'low' as const },
      ];

      for (const config of gatewayProviders) {
        const gatewayProvider = new AIGatewayProvider(config, env, config.costTier);
        this.registerProvider(gatewayProvider);
      }

      this.logger.info('Registered default AI providers');
    } catch (error) {
      this.logger.error('Failed to register default AI providers:', error);
    }
  }

  /**
   * Register an AI provider with the router
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.logger.info(`Registered AI provider: ${provider.name} (${provider.id})`);
  }

  /**
   * Unregister an AI provider
   */
  unregisterProvider(providerId: string): void {
    if (this.providers.delete(providerId)) {
      this.logger.info(`Unregistered AI provider: ${providerId}`);
    }
  }

  /**
   * Get all registered providers
   */
  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Select the best AI provider for the given criteria
   */
  async selectProvider(criteria: ProviderSelectionCriteria): Promise<ProviderSelectionResult | null> {
    // Handle manual override first
    if (criteria.manualOverride) {
      const manualResult = await this.handleManualOverride(criteria.manualOverride, criteria);
      if (manualResult) {
        return manualResult;
      }
    }

    // Get available providers that support the task
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      this.logger.warn('No AI providers available');
      return null;
    }

    // Filter providers that can handle the task
    const capableProviders = availableProviders.filter(provider =>
      provider.supportsTask(criteria),
    );

    if (capableProviders.length === 0) {
      this.logger.warn('No providers can handle the requested task type and context');
      return null;
    }

    // Score and rank providers
    const scoredProviders = await this.scoreProviders(capableProviders, criteria);

    if (scoredProviders.length === 0) {
      return null;
    }

    // Return the highest scoring provider
    const bestProvider = scoredProviders[0];
    return {
      provider: bestProvider.provider,
      confidence: bestProvider.score,
      reason: bestProvider.reason,
      estimatedCost: bestProvider.estimatedCost,
    };
  }

  /**
   * Handle manual provider override
   */
  private async handleManualOverride(providerId: string, criteria: ProviderSelectionCriteria): Promise<ProviderSelectionResult | null> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      this.logger.warn(`Manual override provider '${providerId}' not found`);
      return null;
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      this.logger.warn(`Manual override provider '${providerId}' is not available`);
      return null;
    }

    const supportsTask = provider.supportsTask(criteria);
    if (!supportsTask) {
      this.logger.warn(`Manual override provider '${providerId}' does not support the task`);
      return null;
    }

    return {
      provider,
      confidence: 1.0,
      reason: `Manual override: ${providerId}`,
      estimatedCost: provider.getEstimatedCost(1000), // Estimate for 1000 tokens
    };
  }

  /**
   * Get all available providers
   */
  private async getAvailableProviders(): Promise<AIProvider[]> {
    const availableProviders: AIProvider[] = [];

    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          availableProviders.push(provider);
        }
      } catch (error) {
        this.logger.warn(`Provider ${provider.id} availability check failed:`, error);
      }
    }

    return availableProviders;
  }

  /**
   * Score providers based on selection criteria
   */
  private async scoreProviders(providers: AIProvider[], criteria: ProviderSelectionCriteria): Promise<Array<{
    provider: AIProvider;
    score: number;
    reason: string;
    estimatedCost: number;
  }>> {
    const scored = await Promise.all(
      providers.map(async (provider) => {
        const score = await this.calculateProviderScore(provider, criteria);
        const estimatedCost = provider.getEstimatedCost(1000); // Estimate for 1000 tokens

        return {
          provider,
          score,
          reason: this.generateScoreReason(provider, criteria, score),
          estimatedCost,
        };
      }),
    );

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate a score for how well a provider matches the criteria
   */
  private async calculateProviderScore(provider: AIProvider, criteria: ProviderSelectionCriteria): Promise<number> {
    let score = 0;

    // Task type compatibility (40% weight)
    if (provider.capabilities.taskTypes.includes(criteria.taskType)) {
      score += 0.4;
    }

    // Context compatibility (20% weight)
    const contextMatch = this.evaluateContextCompatibility(provider, criteria.sourceContext);
    score += contextMatch * 0.2;

    // Priority compatibility (15% weight)
    if (provider.capabilities.priorityLevels.includes(criteria.priority)) {
      score += 0.15;
    }

    // Cost profile alignment (15% weight)
    const costAlignment = this.evaluateCostAlignment(provider, criteria.costProfile);
    score += costAlignment * 0.15;

    // Preferred model bonus (10% weight)
    if (criteria.preferredModel && provider.name.toLowerCase().includes(criteria.preferredModel.toLowerCase())) {
      score += 0.1;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Evaluate how well the provider matches the source context
   */
  private evaluateContextCompatibility(provider: AIProvider, context: ProviderSelectionCriteria['sourceContext']): number {
    let compatibility = 0;

    if (context.isGitHub && provider.capabilities.contextTypes.includes('github')) {
      compatibility += 0.6;
    }

    if (context.isLocalFactory && provider.capabilities.contextTypes.includes('local')) {
      compatibility += 0.4;
    }

    // Repository-specific scoring could be added here
    if (context.repoName) {
      // Provider might have repository-specific optimizations
      compatibility += 0.1;
    }

    return Math.min(compatibility, 1.0);
  }

  /**
   * Evaluate cost alignment with the requested profile
   */
  private evaluateCostAlignment(provider: AIProvider, costProfile: string): number {
    const costTiers = { 'low': 0, 'medium': 1, 'high': 2 };
    const profileTiers = { 'economy': 0, 'balanced': 1, 'performance': 2 };

    const providerTier = costTiers[provider.costTier as keyof typeof costTiers] ?? 1;
    const profileTier = profileTiers[costProfile as keyof typeof profileTiers] ?? 1;

    // Perfect match
    if (providerTier === profileTier) {
      return 1.0;
    }

    // Adjacent tiers are acceptable
    if (Math.abs(providerTier - profileTier) === 1) {
      return 0.7;
    }

    // Far apart tiers are less desirable
    return 0.3;
  }

  /**
   * Generate a human-readable reason for the provider score
   */
  private generateScoreReason(provider: AIProvider, criteria: ProviderSelectionCriteria, score: number): string {
    const reasons: string[] = [];

    if (provider.capabilities.taskTypes.includes(criteria.taskType)) {
      reasons.push(`supports ${criteria.taskType} tasks`);
    }

    if (criteria.sourceContext.isGitHub && provider.capabilities.contextTypes.includes('github')) {
      reasons.push('optimized for GitHub context');
    }

    if (provider.capabilities.priorityLevels.includes(criteria.priority)) {
      reasons.push(`handles ${criteria.priority} priority`);
    }

    reasons.push(`${provider.costTier} cost tier`);

    return reasons.join(', ');
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<{
    total: number;
    available: number;
    byCapability: Record<string, number>;
  }> {
    const providers = this.getProviders();
    const available = await this.getAvailableProviders();

    const byCapability: Record<string, number> = {};
    for (const provider of providers) {
      for (const taskType of provider.capabilities.taskTypes) {
        byCapability[taskType] = (byCapability[taskType] || 0) + 1;
      }
    }

    return {
      total: providers.length,
      available: available.length,
      byCapability,
    };
  }
}
