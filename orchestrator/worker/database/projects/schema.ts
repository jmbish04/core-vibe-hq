import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ========================================
// PROJECT MANAGEMENT TABLES
// ========================================

/**
 * Project Requirements table - Versioned storage of project requirements/PRD
 * Each version represents a snapshot of requirements at a point in time
 */
export const projectRequirements = sqliteTable('project_requirements', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: text('project_id').notNull(),
    version: integer('version').notNull(), // Version number (increments on each change)
    section: text('section').notNull(), // 'backend', 'frontend', 'api', 'auth', 'webhook', 'actions', etc.
    title: text('title').notNull(), // Section title
    description: text('description'), // Detailed description
    requirements: text('requirements', { mode: 'json' }), // Array of requirement items
    metadata: text('metadata', { mode: 'json' }), // Additional metadata (tags, priorities, etc.)
    
    // Change tracking
    changeType: text('change_type'), // 'added', 'modified', 'removed'
    changeReason: text('change_reason'), // Why this change was made (from conversation)
    
    // Agent context
    agentName: text('agent_name').notNull().default('project-clarification'),
    conversationId: text('conversation_id'), // Links to conversation that triggered this change
    userId: text('user_id'),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    projectIdIdx: index('project_requirements_project_id_idx').on(table.projectId),
    versionIdx: index('project_requirements_version_idx').on(table.version),
    sectionIdx: index('project_requirements_section_idx').on(table.section),
    conversationIdIdx: index('project_requirements_conversation_id_idx').on(table.conversationId),
    createdAtIdx: index('project_requirements_created_at_idx').on(table.createdAt),
}));

/**
 * Project Overview Cards table - Stores the generative UI card state
 * Represents the current state of the project overview card displayed in chat
 */
export const projectOverviewCards = sqliteTable('project_overview_cards', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: text('project_id').notNull(),
    conversationId: text('conversation_id').notNull(),
    
    // Card structure
    title: text('title').notNull(), // Project title
    description: text('description'), // Project description
    sections: text('sections', { mode: 'json' }).notNull(), // Array of sections: [{ name: 'Backend', items: ['API', 'Auth', 'Webhook'] }]
    
    // Version tracking
    version: integer('version').notNull().default(1),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    projectIdIdx: index('project_overview_cards_project_id_idx').on(table.projectId),
    conversationIdIdx: index('project_overview_cards_conversation_id_idx').on(table.conversationId),
    versionIdx: index('project_overview_cards_version_idx').on(table.version),
}));

// ========================================
// TYPE EXPORTS
// ========================================

export type ProjectRequirement = typeof projectRequirements.$inferSelect;
export type NewProjectRequirement = typeof projectRequirements.$inferInsert;

export type ProjectOverviewCard = typeof projectOverviewCards.$inferSelect;
export type NewProjectOverviewCard = typeof projectOverviewCards.$inferInsert;

