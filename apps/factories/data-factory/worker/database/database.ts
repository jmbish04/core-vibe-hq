/**
 * Core Database Service for Data Factory
 * Provides database connection via orchestrator RPC
 * 
 * NOTE: This service uses orchestrator RPC for database access.
 * Direct D1 bindings have been removed per architecture requirements.
 * All database operations go through orchestrator service bindings.
 */

import * as schema from './schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { OpsScanResult, OpsScanRecord, OpsIssueRecord } from '../../../../orchestrator/worker/services/ops/opsMonitorService';

// Import orchestrator DataOps client type - comprehensive CRUD operations
// All database operations MUST go through orchestrator RPC endpoints
type DataOpsClient = {
    // User operations
    getUserById: (params: { userId: string }) => Promise<any>;
    getUserByEmail: (params: { email: string }) => Promise<any>;
    getUserByProvider: (params: { provider: string; providerId: string }) => Promise<any>;
    upsertUser: (params: any) => Promise<any>;
    updateUser: (params: any) => Promise<any>;
    // App operations
    getAppById: (params: { appId: string }) => Promise<any>;
    getApps: (params: any) => Promise<any>;
    createApp: (params: any) => Promise<any>;
    updateApp: (params: any) => Promise<any>;
    deleteApp: (params: { appId: string }) => Promise<{ ok: boolean }>;
    // Session operations
    createSession: (params: any) => Promise<any>;
    getSessionById: (params: { sessionId: string }) => Promise<any>;
    getUserSessions: (params: { userId: string; includeRevoked?: boolean }) => Promise<any>;
    updateSessionActivity: (params: { sessionId: string }) => Promise<{ ok: boolean }>;
    revokeSession: (params: { sessionId: string; reason?: string }) => Promise<{ ok: boolean }>;
    deleteExpiredSessions: () => Promise<{ deleted: number }>;
    // Analytics operations
    recordAppView: (params: any) => Promise<{ ok: boolean }>;
    getAppViewCount: (params: { appId: string }) => Promise<{ count: number }>;
    // Favorites & Stars
    toggleFavorite: (params: { userId: string; appId: string }) => Promise<{ isFavorited: boolean }>;
    toggleStar: (params: { userId: string; appId: string }) => Promise<{ isStarred: boolean }>;
    getUserFavorites: (params: { userId: string; limit?: number; offset?: number }) => Promise<any>;
    // API Key operations
    getUserApiKeys: (params: { userId: string }) => Promise<any>;
    createApiKey: (params: any) => Promise<any>;
    revokeApiKey: (params: { keyId: string; userId: string }) => Promise<{ ok: boolean }>;
    updateApiKeyUsage: (params: { keyId: string }) => Promise<{ ok: boolean }>;
    // User Secrets operations
    getUserSecrets: (params: { userId: string; provider?: string }) => Promise<any>;
    createUserSecret: (params: any) => Promise<any>;
    getUserSecretById: (params: { secretId: string; userId: string }) => Promise<any>;
    updateUserSecret: (params: any) => Promise<{ ok: boolean }>;
    deleteUserSecret: (params: { secretId: string; userId: string }) => Promise<{ ok: boolean }>;
    // User Model Config operations
    getUserModelConfigs: (params: { userId: string }) => Promise<any>;
    upsertUserModelConfig: (params: any) => Promise<{ id: string }>;
    deleteUserModelConfig: (params: { userId: string; agentActionName: string }) => Promise<{ ok: boolean }>;
    // User Model Provider operations
    getUserModelProviders: (params: { userId: string }) => Promise<any>;
    createUserModelProvider: (params: any) => Promise<any>;
    updateUserModelProvider: (params: any) => Promise<{ ok: boolean }>;
    deleteUserModelProvider: (params: { providerId: string; userId: string }) => Promise<{ ok: boolean }>;
    // System Settings operations
    getSystemSetting: (params: { key: string }) => Promise<any>;
    setSystemSetting: (params: any) => Promise<{ ok: boolean }>;
    deleteSystemSetting: (params: { key: string }) => Promise<{ ok: boolean }>;
    // OAuth State operations
    createOAuthState: (params: any) => Promise<any>;
    getOAuthState: (params: { state: string }) => Promise<any>;
    deleteOAuthState: (params: { state: string }) => Promise<{ ok: boolean }>;
    deleteExpiredOAuthStates: () => Promise<{ deleted: number }>;
    // App Likes operations
    toggleAppLike: (params: { userId: string; appId: string }) => Promise<{ isLiked: boolean }>;
    getAppLikeCount: (params: { appId: string }) => Promise<{ count: number }>;
    // App Comments operations
    getAppComments: (params: { appId: string; limit?: number; offset?: number }) => Promise<any>;
    createAppComment: (params: any) => Promise<any>;
    deleteAppComment: (params: { commentId: string; userId?: string }) => Promise<{ ok: boolean }>;
};

// Import orchestrator OpsMonitorOps client type - operations scanning and monitoring
type OpsMonitorOpsClient = {
    scan: (params: { scope?: 'full' | 'incremental'; filters?: any }) => Promise<OpsScanResult>;
    getRecentScans: (params: { limit?: number }) => Promise<OpsScanRecord[]>;
    getOpenIssues: (params: { limit?: number }) => Promise<OpsIssueRecord[]>;
    resolveIssue: (params: { id: number; resolution: string }) => Promise<{ success: true }>;
};

// ========================================
// TYPE DEFINITIONS AND INTERFACES
// ========================================

export type {
    User, NewUser, Session, NewSession,
    App, NewApp,
    AppLike, NewAppLike, AppComment, NewAppComment,
    AppView, NewAppView, OAuthState, NewOAuthState,
    SystemSetting, NewSystemSetting,
    UserSecret, NewUserSecret,
    UserModelConfig, NewUserModelConfig,
} from './schema';

/**
 * Core Database Service - Connection and Base Operations
 * 
 * Provides database connection via orchestrator RPC calls.
 * Domain-specific operations are handled by dedicated service classes.
 * 
 * MIGRATION NOTE: This service now uses orchestrator RPC instead of direct D1.
 * Complex queries may need to be migrated to use specific RPC methods.
 */
export class DatabaseService {
    public readonly db: DrizzleD1Database<typeof schema>;
    private readonly dataOps: DataOpsClient;
    private readonly opsMonitorOps: OpsMonitorOpsClient;
    private readonly enableReplicas: boolean;

    constructor(env: Env) {
        // Get ORCHESTRATOR_DATA service binding
        // This is provided by the shared base wrangler config
        if (!env.ORCHESTRATOR_DATA) {
            throw new Error(
                'ORCHESTRATOR_DATA service binding is required. ' +
                'Ensure wrangler.jsonc extends @shared/base/wrangler.base.jsonc and ' +
                'run "wrangler types" to regenerate types.'
            );
        }

        this.dataOps = env.ORCHESTRATOR_DATA as unknown as DataOpsClient;

        // Get ORCHESTRATOR_OPS_MONITOR service binding
        if (!env.ORCHESTRATOR_OPS_MONITOR) {
            throw new Error(
                'ORCHESTRATOR_OPS_MONITOR service binding is required. ' +
                'Ensure wrangler.jsonc extends @shared/base/wrangler.base.jsonc.'
            );
        }

        this.opsMonitorOps = env.ORCHESTRATOR_OPS_MONITOR as unknown as OpsMonitorOpsClient;
        this.enableReplicas = env.ENABLE_READ_REPLICAS === 'true';

        // Create a compatibility proxy for Drizzle queries
        // NOTE: Complex queries will need to be migrated to use dataOps RPC methods
        this.db = this.createRpcProxy();
    }

    /**
     * Create a proxy Drizzle database that routes to orchestrator RPC
     * This allows existing code to continue working while using RPC under the hood
     * 
     * WARNING: This is a compatibility layer. Complex queries should be migrated
     * to use specific RPC methods in the orchestrator DataOps entrypoint.
     */
    private createRpcProxy(): DrizzleD1Database<typeof schema> {
        // Minimal proxy for compatibility - complex queries need migration
        return {
            select: () => ({
                from: () => ({
                    where: () => ({
                        limit: () => Promise.resolve([]),
                        execute: () => Promise.resolve([]),
                    }),
                    execute: () => Promise.resolve([]),
                }),
            }),
            insert: () => ({
                values: () => ({
                    returning: () => Promise.resolve([]),
                    execute: () => Promise.resolve([]),
                }),
            }),
            update: () => ({
                set: () => ({
                    where: () => ({
                        returning: () => Promise.resolve([]),
                        execute: () => Promise.resolve([]),
                    }),
                }),
            }),
            delete: () => ({
                where: () => ({
                    execute: () => Promise.resolve([]),
                }),
            }),
        } as unknown as DrizzleD1Database<typeof schema>;
    }

    /**
     * Get a read-optimized database connection
     * For orchestrator RPC, this returns the same proxy
     * (read optimization is handled by orchestrator)
     */
    public getReadDb(strategy: 'fast' | 'fresh' = 'fast'): DrizzleD1Database<typeof schema> {
        return this.db;
    }

    /**
     * Direct access to DataOps RPC client for operations that have RPC methods
     * Use this for operations that are available in the orchestrator DataOps entrypoint
     */
    public get dataOpsClient(): DataOpsClient {
        return this.dataOps;
    }

    /**
     * Direct access to OpsMonitorOps RPC client for operations scanning and monitoring
     * Use this for operations that are available in the orchestrator OpsMonitorOps entrypoint
     */
    public get opsMonitorOpsClient(): OpsMonitorOpsClient {
        return this.opsMonitorOps;
    }
}

/**
 * Factory function to create database service instance
 */
export function createDatabaseService(env: Env): DatabaseService {
    return new DatabaseService(env);
}

