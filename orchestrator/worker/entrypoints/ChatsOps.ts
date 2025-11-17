/**
 * orchestrator/worker/entrypoints/ChatsOps.ts
 * ------------------------------------------------------------
 * Chats Database Operations RPC Entrypoint
 *
 * Provides RPC methods for database operations on DB_CHATS.
 * This entrypoint allows apps/ workers to access the chats database
 * through the orchestrator service binding instead of direct D1 bindings.
 *
 * Responsibilities:
 * - Conversation logs operations (CRUD)
 * - Chat message operations
 * - Conversation history operations
 *
 * All operations use Drizzle ORM on DB_CHATS database.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { createDatabaseService } from '../database/database';
import { eq, and, desc, asc } from 'drizzle-orm';
import * as schema from '../database/chat/schema';

export interface ConversationLogResponse {
    id: number;
    conversationId: string;
    projectId: string | null;
    userId: string | null;
    agentName: string;
    role: string;
    message: string;
    messageType: string;
    structuredData: any;
    timestamp: number;
    websocketSent: boolean;
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

export class ChatsOps extends BaseWorkerEntrypoint<CoreEnv> {
  private dbService = createDatabaseService(this.env);

  // ========================================
  // CONVERSATION LOGS OPERATIONS
  // ========================================

  /**
     * Get conversation logs
     */
  async getConversationLogs(params: {
        conversationId: string;
        projectId?: string;
        userId?: string;
        agentName?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<ConversationLogResponse>> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const conditions = [eq(schema.conversationLogs.conversationId, params.conversationId)];
    if (params.projectId) {
      conditions.push(eq(schema.conversationLogs.projectId, params.projectId));
    }
    if (params.userId) {
      conditions.push(eq(schema.conversationLogs.userId, params.userId));
    }
    if (params.agentName) {
      conditions.push(eq(schema.conversationLogs.agentName, params.agentName));
    }

    const logs = await this.dbService.chats
      .select()
      .from(schema.conversationLogs)
      .where(and(...conditions))
      .orderBy(asc(schema.conversationLogs.timestamp))
      .limit(limit)
      .offset(offset);

    // Get total count
    const allLogs = await this.dbService.chats
      .select()
      .from(schema.conversationLogs)
      .where(and(...conditions));

    const total = allLogs.length;

    return {
      data: logs.map(log => ({
        id: log.id,
        conversationId: log.conversationId,
        projectId: log.projectId ?? null,
        userId: log.userId ?? null,
        agentName: log.agentName,
        role: log.role,
        message: log.message,
        messageType: log.messageType ?? 'text',
        structuredData: log.structuredData,
        timestamp: log.timestamp ?? Date.now(),
        websocketSent: log.websocketSent ?? false,
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
     * Create conversation log
     */
  async createConversationLog(params: {
        conversationId: string;
        projectId?: string;
        userId?: string;
        agentName: string;
        role: 'user' | 'agent';
        message: string;
        messageType?: string;
        structuredData?: any;
        websocketSent?: boolean;
    }): Promise<{ id: number }> {
    const [log] = await this.dbService.chats
      .insert(schema.conversationLogs)
      .values({
        conversationId: params.conversationId,
        projectId: params.projectId ?? null,
        userId: params.userId ?? null,
        agentName: params.agentName,
        role: params.role,
        message: params.message,
        messageType: params.messageType ?? 'text',
        structuredData: params.structuredData ?? null,
        websocketSent: params.websocketSent ?? false,
      })
      .returning();

    return { id: log.id };
  }

  /**
     * Update conversation log
     */
  async updateConversationLog(params: {
        id: number;
        message?: string;
        structuredData?: any;
        websocketSent?: boolean;
    }): Promise<{ ok: boolean }> {
    const updateData: Partial<typeof schema.conversationLogs.$inferInsert> = {};

    if (params.message !== undefined) {
      updateData.message = params.message;
    }
    if (params.structuredData !== undefined) {
      updateData.structuredData = params.structuredData;
    }
    if (params.websocketSent !== undefined) {
      updateData.websocketSent = params.websocketSent;
    }

    await this.dbService.chats
      .update(schema.conversationLogs)
      .set(updateData)
      .where(eq(schema.conversationLogs.id, params.id));

    return { ok: true };
  }

  /**
     * Delete conversation log
     */
  async deleteConversationLog(params: { id: number }): Promise<{ ok: boolean }> {
    await this.dbService.chats
      .delete(schema.conversationLogs)
      .where(eq(schema.conversationLogs.id, params.id));

    return { ok: true };
  }

  /**
     * Delete conversation logs by conversation ID
     */
  async deleteConversationLogs(params: { conversationId: string }): Promise<{ deleted: number }> {
    const result = await this.dbService.chats
      .delete(schema.conversationLogs)
      .where(eq(schema.conversationLogs.conversationId, params.conversationId));

    return { deleted: result.changes ?? 0 };
  }
}

