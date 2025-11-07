import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ========================================
// CHAT CONVERSATION TABLES
// ========================================

/**
 * Conversation Logs table - Stores all agent-user conversations
 */
export const conversationLogs = sqliteTable('conversation_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    conversationId: text('conversation_id').notNull(), // Unique conversation identifier
    projectId: text('project_id'),
    userId: text('user_id'),
    agentName: text('agent_name').notNull(),
    
    // Message content
    role: text('role').notNull(), // 'user' or 'agent'
    message: text('message').notNull(), // The message content
    messageType: text('message_type').default('text'), // 'text', 'card_update', 'requirement_update', etc.
    
    // Structured data
    structuredData: text('structured_data', { mode: 'json' }), // Any structured data (card updates, requirements, etc.)
    
    // Metadata
    timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    websocketSent: integer('websocket_sent', { mode: 'boolean' }).default(false), // Whether sent via WebSocket
}, (table) => ({
    conversationIdIdx: index('conversation_logs_conversation_id_idx').on(table.conversationId),
    projectIdIdx: index('conversation_logs_project_id_idx').on(table.projectId),
    userIdIdx: index('conversation_logs_user_id_idx').on(table.userId),
    agentNameIdx: index('conversation_logs_agent_name_idx').on(table.agentName),
    timestampIdx: index('conversation_logs_timestamp_idx').on(table.timestamp),
}));

// ========================================
// TYPE EXPORTS
// ========================================

export type ConversationLog = typeof conversationLogs.$inferSelect;
export type NewConversationLog = typeof conversationLogs.$inferInsert;

