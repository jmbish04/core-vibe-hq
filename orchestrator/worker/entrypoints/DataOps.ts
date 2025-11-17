/**
 * orchestrator/worker/entrypoints/DataOps.ts
 * ------------------------------------------------------------
 * Data Operations RPC Entrypoint
 *
 * Provides RPC methods for database operations from apps/ workers.
 * This entrypoint allows apps/ workers to access D1 databases through
 * the orchestrator service binding instead of direct D1 bindings.
 *
 * Responsibilities:
 * - User management operations (users, sessions, apiKeys)
 * - App management operations (apps, favorites, stars)
 * - Analytics operations (appViews, appLikes, comments)
 * - OAuth and authentication operations
 * - System settings operations
 *
 * All operations use Drizzle ORM on DB_OPS database which contains
 * the main schema (data-factory tables) combined with ops schema.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { createDatabaseService } from '../database/database';
import { eq, and, or, desc, asc, sql, isNull, inArray } from 'drizzle-orm';
import * as schema from '../database/schema';

export interface UserResponse {
    id: string;
    email: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    provider: string;
    providerId: string;
    emailVerified: boolean;
    isActive: boolean;
    isSuspended: boolean;
    createdAt: number;
    updatedAt: number;
    lastActiveAt: number | null;
}

export interface AppResponse {
    id: string;
    title: string;
    description: string | null;
    iconUrl: string | null;
    originalPrompt: string;
    finalPrompt: string | null;
    framework: string | null;
    userId: string | null;
    sessionToken: string | null;
    visibility: 'private' | 'public';
    status: 'generating' | 'completed';
    deploymentId: string | null;
    githubRepositoryUrl: string | null;
    githubRepositoryVisibility: 'public' | 'private' | null;
    isArchived: boolean;
    isFeatured: boolean;
    version: number;
    parentAppId: string | null;
    screenshotUrl: string | null;
    screenshotCapturedAt: number | null;
    createdAt: number;
    updatedAt: number;
    lastDeployedAt: number | null;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
}

export class DataOps extends BaseWorkerEntrypoint<CoreEnv> {
  private dbService = createDatabaseService(this.env);

  // ========================================
  // USER OPERATIONS
  // ========================================

  /**
     * Get user by ID
     */
  async getUserById(params: { userId: string }): Promise<UserResponse | null> {
    const [user] = await this.dbService.ops
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, params.userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      provider: user.provider,
      providerId: user.providerId,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
      isSuspended: user.isSuspended ?? false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now(),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : null,
    };
  }

  /**
     * Get user by email
     */
  async getUserByEmail(params: { email: string }): Promise<UserResponse | null> {
    const [user] = await this.dbService.ops
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, params.email))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      provider: user.provider,
      providerId: user.providerId,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
      isSuspended: user.isSuspended ?? false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now(),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : null,
    };
  }

  /**
     * Create or update user
     */
  async upsertUser(params: {
        id: string;
        email: string;
        displayName: string;
        provider: string;
        providerId: string;
        username?: string;
        avatarUrl?: string;
        bio?: string;
        emailVerified?: boolean;
    }): Promise<UserResponse> {
    const [user] = await this.dbService.ops
      .insert(schema.users)
      .values({
        id: params.id,
        email: params.email,
        displayName: params.displayName,
        provider: params.provider,
        providerId: params.providerId,
        username: params.username ?? null,
        avatarUrl: params.avatarUrl ?? null,
        bio: params.bio ?? null,
        emailVerified: params.emailVerified ?? false,
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          email: params.email,
          displayName: params.displayName,
          username: params.username ?? null,
          avatarUrl: params.avatarUrl ?? null,
          bio: params.bio ?? null,
          emailVerified: params.emailVerified ?? false,
          updatedAt: Date.now(),
        },
      })
      .returning();

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      provider: user.provider,
      providerId: user.providerId,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
      isSuspended: user.isSuspended ?? false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now(),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : null,
    };
  }

  // ========================================
  // APP OPERATIONS
  // ========================================

  /**
     * Get app by ID
     */
  async getAppById(params: { appId: string }): Promise<AppResponse | null> {
    const [app] = await this.dbService.ops
      .select()
      .from(schema.apps)
      .where(eq(schema.apps.id, params.appId))
      .limit(1);

    if (!app) {
      return null;
    }

    return this.mapAppToResponse(app);
  }

  /**
     * Get apps with pagination and filters
     */
  async getApps(params: {
        userId?: string;
        sessionToken?: string;
        visibility?: 'private' | 'public';
        status?: 'generating' | 'completed';
        limit?: number;
        offset?: number;
        orderBy?: 'createdAt' | 'updatedAt' | 'lastDeployedAt';
        orderDirection?: 'asc' | 'desc';
    }): Promise<PaginatedResponse<AppResponse>> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const orderBy = params.orderBy ?? 'createdAt';
    const orderDirection = params.orderDirection ?? 'desc';

    const conditions = [];
    if (params.userId) {
      conditions.push(eq(schema.apps.userId, params.userId));
    }
    if (params.sessionToken) {
      conditions.push(eq(schema.apps.sessionToken, params.sessionToken));
    }
    if (params.visibility) {
      conditions.push(eq(schema.apps.visibility, params.visibility));
    }
    if (params.status) {
      conditions.push(eq(schema.apps.status, params.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByColumn =
            orderBy === 'createdAt' ? schema.apps.createdAt :
              orderBy === 'updatedAt' ? schema.apps.updatedAt :
                schema.apps.lastDeployedAt;

    const orderFn = orderDirection === 'asc' ? asc : desc;

    const apps = await this.dbService.ops
      .select()
      .from(schema.apps)
      .where(whereClause)
      .orderBy(orderFn(orderByColumn))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await this.dbService.ops
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.apps)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    return {
      data: apps.map(app => this.mapAppToResponse(app)),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
     * Create app
     */
  async createApp(params: {
        id: string;
        title: string;
        originalPrompt: string;
        userId?: string;
        sessionToken?: string;
        description?: string;
        visibility?: 'private' | 'public';
    }): Promise<AppResponse> {
    const [app] = await this.dbService.ops
      .insert(schema.apps)
      .values({
        id: params.id,
        title: params.title,
        originalPrompt: params.originalPrompt,
        userId: params.userId ?? null,
        sessionToken: params.sessionToken ?? null,
        description: params.description ?? null,
        visibility: params.visibility ?? 'private',
        status: 'generating',
      })
      .returning();

    return this.mapAppToResponse(app);
  }

  /**
     * Update app
     */
  async updateApp(params: {
        appId: string;
        title?: string;
        description?: string;
        finalPrompt?: string;
        framework?: string;
        status?: 'generating' | 'completed';
        deploymentId?: string;
        githubRepositoryUrl?: string;
        githubRepositoryVisibility?: 'public' | 'private';
        screenshotUrl?: string;
        visibility?: 'private' | 'public';
    }): Promise<AppResponse | null> {
    const updateData: Partial<typeof schema.apps.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (params.title !== undefined) {
      updateData.title = params.title;
    }
    if (params.description !== undefined) {
      updateData.description = params.description;
    }
    if (params.finalPrompt !== undefined) {
      updateData.finalPrompt = params.finalPrompt;
    }
    if (params.framework !== undefined) {
      updateData.framework = params.framework;
    }
    if (params.status !== undefined) {
      updateData.status = params.status;
    }
    if (params.deploymentId !== undefined) {
      updateData.deploymentId = params.deploymentId;
    }
    if (params.githubRepositoryUrl !== undefined) {
      updateData.githubRepositoryUrl = params.githubRepositoryUrl;
    }
    if (params.githubRepositoryVisibility !== undefined) {
      updateData.githubRepositoryVisibility = params.githubRepositoryVisibility;
    }
    if (params.screenshotUrl !== undefined) {
      updateData.screenshotUrl = params.screenshotUrl;
      updateData.screenshotCapturedAt = Date.now();
    }
    if (params.visibility !== undefined) {
      updateData.visibility = params.visibility;
    }
    if (params.status === 'completed') {
      updateData.lastDeployedAt = Date.now();
    }

    const [app] = await this.dbService.ops
      .update(schema.apps)
      .set(updateData)
      .where(eq(schema.apps.id, params.appId))
      .returning();

    if (!app) {
      return null;
    }

    return this.mapAppToResponse(app);
  }

  // ========================================
  // SESSION OPERATIONS
  // ========================================

  /**
     * Create session
     */
  async createSession(params: {
        id: string;
        userId: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        expiresAt: number;
        deviceInfo?: string;
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{ id: string; createdAt: number }> {
    const [session] = await this.dbService.ops
      .insert(schema.sessions)
      .values({
        id: params.id,
        userId: params.userId,
        accessTokenHash: params.accessTokenHash,
        refreshTokenHash: params.refreshTokenHash,
        expiresAt: params.expiresAt,
        deviceInfo: params.deviceInfo ?? null,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
      })
      .returning();

    return {
      id: session.id,
      createdAt: session.createdAt ? new Date(session.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Get session by ID
     */
  async getSessionById(params: { sessionId: string }): Promise<{
        id: string;
        userId: string;
        expiresAt: number;
        isRevoked: boolean;
        createdAt: number;
    } | null> {
    const [session] = await this.dbService.ops
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, params.sessionId))
      .limit(1);

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      isRevoked: session.isRevoked ?? false,
      createdAt: session.createdAt ? new Date(session.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Revoke session
     */
  async revokeSession(params: {
        sessionId: string;
        reason?: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .update(schema.sessions)
      .set({
        isRevoked: true,
        revokedAt: Date.now(),
        revokedReason: params.reason ?? null,
      })
      .where(eq(schema.sessions.id, params.sessionId));

    return { ok: true };
  }

  // ========================================
  // ANALYTICS OPERATIONS
  // ========================================

  /**
     * Record app view
     */
  async recordAppView(params: {
        appId: string;
        userId?: string;
        sessionToken?: string;
        ipAddressHash?: string;
        referrer?: string;
        userAgent?: string;
        deviceType?: string;
        durationSeconds?: number;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .insert(schema.appViews)
      .values({
        id: crypto.randomUUID(),
        appId: params.appId,
        userId: params.userId ?? null,
        sessionToken: params.sessionToken ?? null,
        ipAddressHash: params.ipAddressHash ?? null,
        referrer: params.referrer ?? null,
        userAgent: params.userAgent ?? null,
        deviceType: params.deviceType ?? null,
        durationSeconds: params.durationSeconds ?? null,
      });

    return { ok: true };
  }

  /**
     * Get app view count
     */
  async getAppViewCount(params: { appId: string }): Promise<{ count: number }> {
    const [result] = await this.dbService.ops
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.appViews)
      .where(eq(schema.appViews.appId, params.appId));

    return { count: result?.count ?? 0 };
  }

  // ========================================
  // FAVORITES & STARS OPERATIONS
  // ========================================

  /**
     * Toggle favorite
     */
  async toggleFavorite(params: {
        userId: string;
        appId: string;
    }): Promise<{ isFavorited: boolean }> {
    // Check if already favorited
    const [existing] = await this.dbService.ops
      .select()
      .from(schema.favorites)
      .where(
        and(
          eq(schema.favorites.userId, params.userId),
          eq(schema.favorites.appId, params.appId),
        ),
      )
      .limit(1);

    if (existing) {
      // Remove favorite
      await this.dbService.ops
        .delete(schema.favorites)
        .where(eq(schema.favorites.id, existing.id));

      return { isFavorited: false };
    } else {
      // Add favorite
      await this.dbService.ops
        .insert(schema.favorites)
        .values({
          id: crypto.randomUUID(),
          userId: params.userId,
          appId: params.appId,
        });

      return { isFavorited: true };
    }
  }

  /**
     * Toggle star
     */
  async toggleStar(params: {
        userId: string;
        appId: string;
    }): Promise<{ isStarred: boolean }> {
    // Check if already starred
    const [existing] = await this.dbService.ops
      .select()
      .from(schema.stars)
      .where(
        and(
          eq(schema.stars.userId, params.userId),
          eq(schema.stars.appId, params.appId),
        ),
      )
      .limit(1);

    if (existing) {
      // Remove star
      await this.dbService.ops
        .delete(schema.stars)
        .where(eq(schema.stars.id, existing.id));

      return { isStarred: false };
    } else {
      // Add star
      await this.dbService.ops
        .insert(schema.stars)
        .values({
          id: crypto.randomUUID(),
          userId: params.userId,
          appId: params.appId,
        });

      return { isStarred: true };
    }
  }

  /**
     * Get user favorites
     */
  async getUserFavorites(params: {
        userId: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<{ appId: string; createdAt: number }>> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    const favorites = await this.dbService.ops
      .select({
        appId: schema.favorites.appId,
        createdAt: schema.favorites.createdAt,
      })
      .from(schema.favorites)
      .where(eq(schema.favorites.userId, params.userId))
      .orderBy(desc(schema.favorites.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.dbService.ops
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.favorites)
      .where(eq(schema.favorites.userId, params.userId));

    const total = countResult?.count ?? 0;

    return {
      data: favorites.map(fav => ({
        appId: fav.appId,
        createdAt: fav.createdAt ? new Date(fav.createdAt).getTime() : Date.now(),
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
     * Update user
     */
  async updateUser(params: {
        userId: string;
        username?: string;
        displayName?: string;
        avatarUrl?: string;
        bio?: string;
        emailVerified?: boolean;
        isActive?: boolean;
        isSuspended?: boolean;
        lastActiveAt?: number;
    }): Promise<UserResponse | null> {
    const updateData: Partial<typeof schema.users.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (params.username !== undefined) {
      updateData.username = params.username;
    }
    if (params.displayName !== undefined) {
      updateData.displayName = params.displayName;
    }
    if (params.avatarUrl !== undefined) {
      updateData.avatarUrl = params.avatarUrl;
    }
    if (params.bio !== undefined) {
      updateData.bio = params.bio;
    }
    if (params.emailVerified !== undefined) {
      updateData.emailVerified = params.emailVerified;
    }
    if (params.isActive !== undefined) {
      updateData.isActive = params.isActive;
    }
    if (params.isSuspended !== undefined) {
      updateData.isSuspended = params.isSuspended;
    }
    if (params.lastActiveAt !== undefined) {
      updateData.lastActiveAt = params.lastActiveAt;
    }

    const [user] = await this.dbService.ops
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, params.userId))
      .returning();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      provider: user.provider,
      providerId: user.providerId,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
      isSuspended: user.isSuspended ?? false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now(),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : null,
    };
  }

  /**
     * Get user by provider
     */
  async getUserByProvider(params: {
        provider: string;
        providerId: string;
    }): Promise<UserResponse | null> {
    const [user] = await this.dbService.ops
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.provider, params.provider),
          eq(schema.users.providerId, params.providerId),
        ),
      )
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      provider: user.provider,
      providerId: user.providerId,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
      isSuspended: user.isSuspended ?? false,
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now(),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : null,
    };
  }

  /**
     * Delete app
     */
  async deleteApp(params: { appId: string }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .delete(schema.apps)
      .where(eq(schema.apps.id, params.appId));

    return { ok: true };
  }

  /**
     * Get sessions for user
     */
  async getUserSessions(params: {
        userId: string;
        includeRevoked?: boolean;
    }): Promise<Array<{
        id: string;
        expiresAt: number;
        isRevoked: boolean;
        createdAt: number;
        lastActivity: number | null;
    }>> {
    const conditions = [eq(schema.sessions.userId, params.userId)];
    if (!params.includeRevoked) {
      conditions.push(eq(schema.sessions.isRevoked, false));
    }

    const sessions = await this.dbService.ops
      .select({
        id: schema.sessions.id,
        expiresAt: schema.sessions.expiresAt,
        isRevoked: schema.sessions.isRevoked,
        createdAt: schema.sessions.createdAt,
        lastActivity: schema.sessions.lastActivity,
      })
      .from(schema.sessions)
      .where(and(...conditions))
      .orderBy(desc(schema.sessions.createdAt));

    return sessions.map(s => ({
      id: s.id,
      expiresAt: s.expiresAt,
      isRevoked: s.isRevoked ?? false,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      lastActivity: s.lastActivity ?? null,
    }));
  }

  /**
     * Update session activity
     */
  async updateSessionActivity(params: {
        sessionId: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .update(schema.sessions)
      .set({ lastActivity: Date.now() })
      .where(eq(schema.sessions.id, params.sessionId));

    return { ok: true };
  }

  /**
     * Delete expired sessions
     */
  async deleteExpiredSessions(): Promise<{ deleted: number }> {
    const result = await this.dbService.ops
      .delete(schema.sessions)
      .where(sql`${schema.sessions.expiresAt} < ${Date.now()}`);

    return { deleted: result.changes ?? 0 };
  }

  // ========================================
  // API KEY OPERATIONS
  // ========================================

  /**
     * Get user API keys
     */
  async getUserApiKeys(params: { userId: string }): Promise<Array<{
        id: string;
        name: string;
        keyPreview: string;
        isActive: boolean;
        createdAt: number;
        lastUsed: number | null;
    }>> {
    const keys = await this.dbService.ops
      .select({
        id: schema.apiKeys.id,
        name: schema.apiKeys.name,
        keyPreview: schema.apiKeys.keyPreview,
        isActive: schema.apiKeys.isActive,
        createdAt: schema.apiKeys.createdAt,
        lastUsed: schema.apiKeys.lastUsed,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, params.userId))
      .orderBy(desc(schema.apiKeys.createdAt));

    return keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPreview: k.keyPreview,
      isActive: k.isActive ?? true,
      createdAt: k.createdAt ? new Date(k.createdAt).getTime() : Date.now(),
      lastUsed: k.lastUsed ?? null,
    }));
  }

  /**
     * Create API key
     */
  async createApiKey(params: {
        id: string;
        userId: string;
        name: string;
        keyHash: string;
        keyPreview: string;
        scopes?: string[];
        expiresAt?: number;
    }): Promise<{ id: string; createdAt: number }> {
    const [key] = await this.dbService.ops
      .insert(schema.apiKeys)
      .values({
        id: params.id,
        userId: params.userId,
        name: params.name,
        keyHash: params.keyHash,
        keyPreview: params.keyPreview,
        scopes: JSON.stringify(params.scopes ?? []),
        expiresAt: params.expiresAt ?? null,
        isActive: true,
      })
      .returning();

    return {
      id: key.id,
      createdAt: key.createdAt ? new Date(key.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Revoke API key
     */
  async revokeApiKey(params: {
        keyId: string;
        userId: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .update(schema.apiKeys)
      .set({
        isActive: false,
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(schema.apiKeys.id, params.keyId),
          eq(schema.apiKeys.userId, params.userId),
        ),
      );

    return { ok: true };
  }

  /**
     * Update API key usage
     */
  async updateApiKeyUsage(params: {
        keyId: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .update(schema.apiKeys)
      .set({
        lastUsed: Date.now(),
        requestCount: sql`${schema.apiKeys.requestCount} + 1`,
      })
      .where(eq(schema.apiKeys.id, params.keyId));

    return { ok: true };
  }

  // ========================================
  // USER SECRETS OPERATIONS
  // ========================================

  /**
     * Get user secrets
     */
  async getUserSecrets(params: {
        userId: string;
        provider?: string;
    }): Promise<Array<{
        id: string;
        name: string;
        provider: string;
        secretType: string;
        keyPreview: string;
        isActive: boolean;
        createdAt: number;
        lastUsed: number | null;
    }>> {
    const conditions = [eq(schema.userSecrets.userId, params.userId)];
    if (params.provider) {
      conditions.push(eq(schema.userSecrets.provider, params.provider));
    }

    const secrets = await this.dbService.ops
      .select({
        id: schema.userSecrets.id,
        name: schema.userSecrets.name,
        provider: schema.userSecrets.provider,
        secretType: schema.userSecrets.secretType,
        keyPreview: schema.userSecrets.keyPreview,
        isActive: schema.userSecrets.isActive,
        createdAt: schema.userSecrets.createdAt,
        lastUsed: schema.userSecrets.lastUsed,
      })
      .from(schema.userSecrets)
      .where(and(...conditions))
      .orderBy(desc(schema.userSecrets.createdAt));

    return secrets.map(s => ({
      id: s.id,
      name: s.name,
      provider: s.provider,
      secretType: s.secretType,
      keyPreview: s.keyPreview,
      isActive: s.isActive ?? true,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      lastUsed: s.lastUsed ?? null,
    }));
  }

  /**
     * Create user secret
     */
  async createUserSecret(params: {
        id: string;
        userId: string;
        name: string;
        provider: string;
        secretType: string;
        encryptedValue: string;
        keyPreview: string;
        description?: string;
        expiresAt?: number;
    }): Promise<{ id: string; createdAt: number }> {
    const [secret] = await this.dbService.ops
      .insert(schema.userSecrets)
      .values({
        id: params.id,
        userId: params.userId,
        name: params.name,
        provider: params.provider,
        secretType: params.secretType,
        encryptedValue: params.encryptedValue,
        keyPreview: params.keyPreview,
        description: params.description ?? null,
        expiresAt: params.expiresAt ?? null,
        isActive: true,
      })
      .returning();

    return {
      id: secret.id,
      createdAt: secret.createdAt ? new Date(secret.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Get user secret by ID
     */
  async getUserSecretById(params: {
        secretId: string;
        userId: string;
    }): Promise<{
        id: string;
        encryptedValue: string;
        keyPreview: string;
    } | null> {
    const [secret] = await this.dbService.ops
      .select({
        id: schema.userSecrets.id,
        encryptedValue: schema.userSecrets.encryptedValue,
        keyPreview: schema.userSecrets.keyPreview,
      })
      .from(schema.userSecrets)
      .where(
        and(
          eq(schema.userSecrets.id, params.secretId),
          eq(schema.userSecrets.userId, params.userId),
          eq(schema.userSecrets.isActive, true),
        ),
      )
      .limit(1);

    if (!secret) {
      return null;
    }

    return {
      id: secret.id,
      encryptedValue: secret.encryptedValue,
      keyPreview: secret.keyPreview,
    };
  }

  /**
     * Update user secret
     */
  async updateUserSecret(params: {
        secretId: string;
        userId: string;
        name?: string;
        encryptedValue?: string;
        keyPreview?: string;
        description?: string;
        isActive?: boolean;
    }): Promise<{ ok: boolean }> {
    const updateData: Partial<typeof schema.userSecrets.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (params.name !== undefined) {
      updateData.name = params.name;
    }
    if (params.encryptedValue !== undefined) {
      updateData.encryptedValue = params.encryptedValue;
    }
    if (params.keyPreview !== undefined) {
      updateData.keyPreview = params.keyPreview;
    }
    if (params.description !== undefined) {
      updateData.description = params.description;
    }
    if (params.isActive !== undefined) {
      updateData.isActive = params.isActive;
    }

    await this.dbService.ops
      .update(schema.userSecrets)
      .set(updateData)
      .where(
        and(
          eq(schema.userSecrets.id, params.secretId),
          eq(schema.userSecrets.userId, params.userId),
        ),
      );

    return { ok: true };
  }

  /**
     * Delete user secret
     */
  async deleteUserSecret(params: {
        secretId: string;
        userId: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .delete(schema.userSecrets)
      .where(
        and(
          eq(schema.userSecrets.id, params.secretId),
          eq(schema.userSecrets.userId, params.userId),
        ),
      );

    return { ok: true };
  }

  // ========================================
  // USER MODEL CONFIG OPERATIONS
  // ========================================

  /**
     * Get user model configs
     */
  async getUserModelConfigs(params: {
        userId: string;
    }): Promise<Array<{
        id: string;
        agentActionName: string;
        modelName: string | null;
        maxTokens: number | null;
        temperature: number | null;
        reasoningEffort: string | null;
        fallbackModel: string | null;
        isActive: boolean;
    }>> {
    const configs = await this.dbService.ops
      .select()
      .from(schema.userModelConfigs)
      .where(
        and(
          eq(schema.userModelConfigs.userId, params.userId),
          eq(schema.userModelConfigs.isActive, true),
        ),
      );

    return configs.map(c => ({
      id: c.id,
      agentActionName: c.agentActionName,
      modelName: c.modelName ?? null,
      maxTokens: c.maxTokens ?? null,
      temperature: c.temperature ?? null,
      reasoningEffort: c.reasoningEffort ?? null,
      fallbackModel: c.fallbackModel ?? null,
      isActive: c.isActive ?? true,
    }));
  }

  /**
     * Upsert user model config
     */
  async upsertUserModelConfig(params: {
        id: string;
        userId: string;
        agentActionName: string;
        modelName?: string | null;
        maxTokens?: number | null;
        temperature?: number | null;
        reasoningEffort?: string | null;
        fallbackModel?: string | null;
    }): Promise<{ id: string }> {
    const [config] = await this.dbService.ops
      .insert(schema.userModelConfigs)
      .values({
        id: params.id,
        userId: params.userId,
        agentActionName: params.agentActionName,
        modelName: params.modelName ?? null,
        maxTokens: params.maxTokens ?? null,
        temperature: params.temperature ?? null,
        reasoningEffort: params.reasoningEffort ?? null,
        fallbackModel: params.fallbackModel ?? null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [schema.userModelConfigs.userId, schema.userModelConfigs.agentActionName],
        set: {
          modelName: params.modelName ?? null,
          maxTokens: params.maxTokens ?? null,
          temperature: params.temperature ?? null,
          reasoningEffort: params.reasoningEffort ?? null,
          fallbackModel: params.fallbackModel ?? null,
          updatedAt: Date.now(),
        },
      })
      .returning();

    return { id: config.id };
  }

  /**
     * Delete user model config
     */
  async deleteUserModelConfig(params: {
        userId: string;
        agentActionName: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .update(schema.userModelConfigs)
      .set({ isActive: false, updatedAt: Date.now() })
      .where(
        and(
          eq(schema.userModelConfigs.userId, params.userId),
          eq(schema.userModelConfigs.agentActionName, params.agentActionName),
        ),
      );

    return { ok: true };
  }

  // ========================================
  // USER MODEL PROVIDER OPERATIONS
  // ========================================

  /**
     * Get user model providers
     */
  async getUserModelProviders(params: {
        userId: string;
    }): Promise<Array<{
        id: string;
        name: string;
        baseUrl: string;
        secretId: string | null;
        isActive: boolean;
        createdAt: number;
    }>> {
    const providers = await this.dbService.ops
      .select()
      .from(schema.userModelProviders)
      .where(
        and(
          eq(schema.userModelProviders.userId, params.userId),
          eq(schema.userModelProviders.isActive, true),
        ),
      )
      .orderBy(desc(schema.userModelProviders.createdAt));

    return providers.map(p => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      secretId: p.secretId ?? null,
      isActive: p.isActive ?? true,
      createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
    }));
  }

  /**
     * Create user model provider
     */
  async createUserModelProvider(params: {
        id: string;
        userId: string;
        name: string;
        baseUrl: string;
        secretId?: string;
    }): Promise<{ id: string; createdAt: number }> {
    const [provider] = await this.dbService.ops
      .insert(schema.userModelProviders)
      .values({
        id: params.id,
        userId: params.userId,
        name: params.name,
        baseUrl: params.baseUrl,
        secretId: params.secretId ?? null,
        isActive: true,
      })
      .returning();

    return {
      id: provider.id,
      createdAt: provider.createdAt ? new Date(provider.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Update user model provider
     */
  async updateUserModelProvider(params: {
        providerId: string;
        userId: string;
        name?: string;
        baseUrl?: string;
        secretId?: string;
        isActive?: boolean;
    }): Promise<{ ok: boolean }> {
    const updateData: Partial<typeof schema.userModelProviders.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (params.name !== undefined) {
      updateData.name = params.name;
    }
    if (params.baseUrl !== undefined) {
      updateData.baseUrl = params.baseUrl;
    }
    if (params.secretId !== undefined) {
      updateData.secretId = params.secretId;
    }
    if (params.isActive !== undefined) {
      updateData.isActive = params.isActive;
    }

    await this.dbService.ops
      .update(schema.userModelProviders)
      .set(updateData)
      .where(
        and(
          eq(schema.userModelProviders.id, params.providerId),
          eq(schema.userModelProviders.userId, params.userId),
        ),
      );

    return { ok: true };
  }

  /**
     * Delete user model provider
     */
  async deleteUserModelProvider(params: {
        providerId: string;
        userId: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .delete(schema.userModelProviders)
      .where(
        and(
          eq(schema.userModelProviders.id, params.providerId),
          eq(schema.userModelProviders.userId, params.userId),
        ),
      );

    return { ok: true };
  }

  // ========================================
  // SYSTEM SETTINGS OPERATIONS
  // ========================================

  /**
     * Get system setting
     */
  async getSystemSetting(params: {
        key: string;
    }): Promise<{ key: string; value: any; updatedAt: number } | null> {
    const [setting] = await this.dbService.ops
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, params.key))
      .limit(1);

    if (!setting) {
      return null;
    }

    return {
      key: setting.key,
      value: setting.value,
      updatedAt: setting.updatedAt ? new Date(setting.updatedAt).getTime() : Date.now(),
    };
  }

  /**
     * Set system setting
     */
  async setSystemSetting(params: {
        key: string;
        value: any;
        description?: string;
        updatedBy?: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .insert(schema.systemSettings)
      .values({
        id: crypto.randomUUID(),
        key: params.key,
        value: params.value,
        description: params.description ?? null,
        updatedBy: params.updatedBy ?? null,
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: {
          value: params.value,
          description: params.description ?? null,
          updatedBy: params.updatedBy ?? null,
          updatedAt: Date.now(),
        },
      });

    return { ok: true };
  }

  /**
     * Delete system setting
     */
  async deleteSystemSetting(params: {
        key: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .delete(schema.systemSettings)
      .where(eq(schema.systemSettings.key, params.key));

    return { ok: true };
  }

  // ========================================
  // OAUTH STATE OPERATIONS
  // ========================================

  /**
     * Create OAuth state
     */
  async createOAuthState(params: {
        id: string;
        state: string;
        provider: string;
        redirectUrl?: string;
        expiresAt: number;
    }): Promise<{ id: string; createdAt: number }> {
    const [oauthState] = await this.dbService.ops
      .insert(schema.oauthStates)
      .values({
        id: params.id,
        state: params.state,
        provider: params.provider,
        redirectUrl: params.redirectUrl ?? null,
        expiresAt: params.expiresAt,
      })
      .returning();

    return {
      id: oauthState.id,
      createdAt: oauthState.createdAt ? new Date(oauthState.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Get OAuth state
     */
  async getOAuthState(params: {
        state: string;
    }): Promise<{
        id: string;
        provider: string;
        redirectUrl: string | null;
        expiresAt: number;
    } | null> {
    const [oauthState] = await this.dbService.ops
      .select()
      .from(schema.oauthStates)
      .where(eq(schema.oauthStates.state, params.state))
      .limit(1);

    if (!oauthState) {
      return null;
    }

    return {
      id: oauthState.id,
      provider: oauthState.provider,
      redirectUrl: oauthState.redirectUrl ?? null,
      expiresAt: oauthState.expiresAt,
    };
  }

  /**
     * Delete OAuth state
     */
  async deleteOAuthState(params: {
        state: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.ops
      .delete(schema.oauthStates)
      .where(eq(schema.oauthStates.state, params.state));

    return { ok: true };
  }

  /**
     * Delete expired OAuth states
     */
  async deleteExpiredOAuthStates(): Promise<{ deleted: number }> {
    const result = await this.dbService.ops
      .delete(schema.oauthStates)
      .where(sql`${schema.oauthStates.expiresAt} < ${Date.now()}`);

    return { deleted: result.changes ?? 0 };
  }

  // ========================================
  // APP LIKES OPERATIONS
  // ========================================

  /**
     * Toggle app like
     */
  async toggleAppLike(params: {
        userId: string;
        appId: string;
    }): Promise<{ isLiked: boolean }> {
    const [existing] = await this.dbService.ops
      .select()
      .from(schema.appLikes)
      .where(
        and(
          eq(schema.appLikes.userId, params.userId),
          eq(schema.appLikes.appId, params.appId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.dbService.ops
        .delete(schema.appLikes)
        .where(eq(schema.appLikes.id, existing.id));

      return { isLiked: false };
    } else {
      await this.dbService.ops
        .insert(schema.appLikes)
        .values({
          id: crypto.randomUUID(),
          userId: params.userId,
          appId: params.appId,
        });

      return { isLiked: true };
    }
  }

  /**
     * Get app like count
     */
  async getAppLikeCount(params: { appId: string }): Promise<{ count: number }> {
    const [result] = await this.dbService.ops
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.appLikes)
      .where(eq(schema.appLikes.appId, params.appId));

    return { count: result?.count ?? 0 };
  }

  // ========================================
  // APP COMMENTS OPERATIONS
  // ========================================

  /**
     * Get app comments
     */
  async getAppComments(params: {
        appId: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<{
        id: string;
        userId: string | null;
        content: string;
        createdAt: number;
    }>> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    const comments = await this.dbService.ops
      .select({
        id: schema.appComments.id,
        userId: schema.appComments.userId,
        content: schema.appComments.content,
        createdAt: schema.appComments.createdAt,
      })
      .from(schema.appComments)
      .where(eq(schema.appComments.appId, params.appId))
      .orderBy(desc(schema.appComments.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.dbService.ops
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.appComments)
      .where(eq(schema.appComments.appId, params.appId));

    const total = countResult?.count ?? 0;

    return {
      data: comments.map(c => ({
        id: c.id,
        userId: c.userId ?? null,
        content: c.content,
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
     * Create app comment
     */
  async createAppComment(params: {
        id: string;
        appId: string;
        userId?: string;
        content: string;
    }): Promise<{ id: string; createdAt: number }> {
    const [comment] = await this.dbService.ops
      .insert(schema.appComments)
      .values({
        id: params.id,
        appId: params.appId,
        userId: params.userId ?? null,
        content: params.content,
      })
      .returning();

    return {
      id: comment.id,
      createdAt: comment.createdAt ? new Date(comment.createdAt).getTime() : Date.now(),
    };
  }

  /**
     * Delete app comment
     */
  async deleteAppComment(params: {
        commentId: string;
        userId?: string;
    }): Promise<{ ok: boolean }> {
    const conditions = [eq(schema.appComments.id, params.commentId)];
    if (params.userId) {
      conditions.push(eq(schema.appComments.userId, params.userId));
    }

    await this.dbService.ops
      .delete(schema.appComments)
      .where(and(...conditions));

    return { ok: true };
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private mapAppToResponse(app: typeof schema.apps.$inferSelect): AppResponse {
    return {
      id: app.id,
      title: app.title,
      description: app.description ?? null,
      iconUrl: app.iconUrl ?? null,
      originalPrompt: app.originalPrompt,
      finalPrompt: app.finalPrompt ?? null,
      framework: app.framework ?? null,
      userId: app.userId ?? null,
      sessionToken: app.sessionToken ?? null,
      visibility: app.visibility as 'private' | 'public',
      status: app.status as 'generating' | 'completed',
      deploymentId: app.deploymentId ?? null,
      githubRepositoryUrl: app.githubRepositoryUrl ?? null,
      githubRepositoryVisibility: app.githubRepositoryVisibility as 'public' | 'private' | null,
      isArchived: app.isArchived ?? false,
      isFeatured: app.isFeatured ?? false,
      version: app.version ?? 1,
      parentAppId: app.parentAppId ?? null,
      screenshotUrl: app.screenshotUrl ?? null,
      screenshotCapturedAt: app.screenshotCapturedAt ?? null,
      createdAt: app.createdAt ? new Date(app.createdAt).getTime() : Date.now(),
      updatedAt: app.updatedAt ? new Date(app.updatedAt).getTime() : Date.now(),
      lastDeployedAt: app.lastDeployedAt ?? null,
    };
  }
}

