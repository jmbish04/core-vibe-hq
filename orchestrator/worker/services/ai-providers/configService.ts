import { Kysely } from 'kysely';
import type { DB } from '../../db/schema';

/**
 * Provider configuration stored in database
 */
export interface ProviderConfig {
  id: string;
  provider: string;
  name: string;
  model: string;
  baseURL?: string;
  costTier: 'low' | 'medium' | 'high';
  isActive: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Provider Configuration Service
 * Manages persistent configuration for AI providers in the database
 */
export class AIProviderConfigService {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Save provider configuration
   */
  async saveConfig(config: {
    id: string;
    provider: string;
    name: string;
    model: string;
    baseURL?: string;
    costTier: 'low' | 'medium' | 'high';
    config?: Record<string, any>;
  }): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .insertInto('ai_provider_configs')
      .values({
        id: config.id,
        provider: config.provider,
        name: config.name,
        model: config.model,
        base_url: config.baseURL || null,
        cost_tier: config.costTier,
        is_active: true,
        config: JSON.stringify(config.config || {}),
        created_at: now,
        updated_at: now,
      })
      .onConflict('id')
      .doUpdateSet({
        provider: config.provider,
        name: config.name,
        model: config.model,
        base_url: config.baseURL || null,
        cost_tier: config.costTier,
        config: JSON.stringify(config.config || {}),
        updated_at: now,
      })
      .execute();
  }

  /**
   * Get active provider configuration
   */
  async getActiveConfig(providerId: string): Promise<ProviderConfig | null> {
    const result = await this.db
      .selectFrom('ai_provider_configs')
      .select([
        'id',
        'provider',
        'name',
        'model',
        'base_url',
        'cost_tier',
        'is_active',
        'config',
        'created_at',
        'updated_at',
      ])
      .where('id', '=', providerId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      provider: result.provider,
      name: result.name,
      model: result.model,
      baseURL: result.base_url || undefined,
      costTier: result.cost_tier as 'low' | 'medium' | 'high',
      isActive: result.is_active,
      config: JSON.parse(result.config || '{}'),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  /**
   * List all provider configurations
   */
  async listConfigs(activeOnly = false): Promise<ProviderConfig[]> {
    let query = this.db
      .selectFrom('ai_provider_configs')
      .select([
        'id',
        'provider',
        'name',
        'model',
        'base_url',
        'cost_tier',
        'is_active',
        'config',
        'created_at',
        'updated_at',
      ])
      .orderBy('created_at', 'desc');

    if (activeOnly) {
      query = query.where('is_active', '=', true);
    }

    const results = await query.execute();

    return results.map(result => ({
      id: result.id,
      provider: result.provider,
      name: result.name,
      model: result.model,
      baseURL: result.base_url || undefined,
      costTier: result.cost_tier as 'low' | 'medium' | 'high',
      isActive: result.is_active,
      config: JSON.parse(result.config || '{}'),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  /**
   * Activate/deactivate provider
   */
  async setActive(providerId: string, isActive: boolean): Promise<void> {
    await this.db
      .updateTable('ai_provider_configs')
      .set({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', providerId)
      .execute();
  }

  /**
   * Delete provider configuration
   */
  async deleteConfig(providerId: string): Promise<void> {
    await this.db
      .deleteFrom('ai_provider_configs')
      .where('id', '=', providerId)
      .execute();
  }

  /**
   * Get configurations by provider type
   */
  async getConfigsByProvider(providerType: string): Promise<ProviderConfig[]> {
    const results = await this.db
      .selectFrom('ai_provider_configs')
      .select([
        'id',
        'provider',
        'name',
        'model',
        'base_url',
        'cost_tier',
        'is_active',
        'config',
        'created_at',
        'updated_at',
      ])
      .where('provider', '=', providerType)
      .where('is_active', '=', true)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(result => ({
      id: result.id,
      provider: result.provider,
      name: result.name,
      model: result.model,
      baseURL: result.base_url || undefined,
      costTier: result.cost_tier as 'low' | 'medium' | 'high',
      isActive: result.is_active,
      config: JSON.parse(result.config || '{}'),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  /**
   * Update provider configuration
   */
  async updateConfig(
    providerId: string,
    updates: Partial<{
      name: string;
      model: string;
      baseURL: string;
      costTier: 'low' | 'medium' | 'high';
      config: Record<string, any>;
    }>
  ): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.baseURL !== undefined) updateData.base_url = updates.baseURL;
    if (updates.costTier !== undefined) updateData.cost_tier = updates.costTier;
    if (updates.config !== undefined) updateData.config = JSON.stringify(updates.config);

    await this.db
      .updateTable('ai_provider_configs')
      .set(updateData)
      .where('id', '=', providerId)
      .execute();
  }

  /**
   * Bulk update provider configurations
   */
  async bulkUpdateConfigs(
    updates: Array<{
      id: string;
      updates: Partial<{
        name: string;
        model: string;
        baseURL: string;
        costTier: 'low' | 'medium' | 'high';
        isActive: boolean;
        config: Record<string, any>;
      }>;
    }>
  ): Promise<void> {
    const now = new Date().toISOString();

    for (const update of updates) {
      const updateData: any = { updated_at: now };

      if (update.updates.name !== undefined) updateData.name = update.updates.name;
      if (update.updates.model !== undefined) updateData.model = update.updates.model;
      if (update.updates.baseURL !== undefined) updateData.base_url = update.updates.baseURL;
      if (update.updates.costTier !== undefined) updateData.cost_tier = update.updates.costTier;
      if (update.updates.isActive !== undefined) updateData.is_active = update.updates.isActive;
      if (update.updates.config !== undefined) updateData.config = JSON.stringify(update.updates.config);

      await this.db
        .updateTable('ai_provider_configs')
        .set(updateData)
        .where('id', '=', update.id)
        .execute();
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<Array<{
    provider: string;
    count: number;
    activeCount: number;
  }>> {
    const results = await this.db
      .selectFrom('ai_provider_configs')
      .select([
        'provider',
        this.db.fn.count('id').as('count'),
        this.db.fn.count(this.db.case().when('is_active', '=', true).then(1).end()).as('active_count'),
      ])
      .groupBy('provider')
      .execute();

    return results.map(result => ({
      provider: result.provider,
      count: Number(result.count),
      activeCount: Number(result.active_count),
    }));
  }
}
