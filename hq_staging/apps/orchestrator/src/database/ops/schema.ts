import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ========================================
// OPERATIONAL TRACKING TABLES
// ========================================

/**
 * Followups table - Tracks follow-up actions for blocked tasks or issues
 */
export const followups = sqliteTable('followups', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: text('order_id'),
    taskUuid: text('task_uuid'),
    type: text('type').notNull(), // 'blocked', 'review', 'escalation', etc.
    impactLevel: integer('impact_level').default(1), // 1-5 scale
    status: text('status').notNull().default('open'), // 'open', 'resolved', 'closed'
    note: text('note'),
    data: text('data', { mode: 'json' }), // Additional JSON data
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
}, (table) => ({
    orderIdIdx: index('followups_order_id_idx').on(table.orderId),
    taskUuidIdx: index('followups_task_uuid_idx').on(table.taskUuid),
    statusIdx: index('followups_status_idx').on(table.status),
    typeIdx: index('followups_type_idx').on(table.type),
    createdAtIdx: index('followups_created_at_idx').on(table.createdAt),
}));

/**
 * Operation Logs table - Logs all operations for audit and debugging
 */
export const operationLogs = sqliteTable('operation_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(), // Service/module name (e.g., 'github-remediation')
    orderId: text('order_id'),
    taskUuid: text('task_uuid'),
    operation: text('operation').notNull(), // Operation name (e.g., 'github.findRenamedFile')
    level: text('level').notNull(), // 'info', 'warn', 'error', 'debug'
    details: text('details', { mode: 'json' }), // JSON details
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    sourceIdx: index('operation_logs_source_idx').on(table.source),
    orderIdIdx: index('operation_logs_order_id_idx').on(table.orderId),
    taskUuidIdx: index('operation_logs_task_uuid_idx').on(table.taskUuid),
    operationIdx: index('operation_logs_operation_idx').on(table.operation),
    levelIdx: index('operation_logs_level_idx').on(table.level),
    createdAtIdx: index('operation_logs_created_at_idx').on(table.createdAt),
}));

// ========================================
// OPS MANAGEMENT TABLES
// ========================================

/**
 * Ops Conflict Resolutions table - Tracks conflict resolution operations
 */
export const opsConflictResolutions = sqliteTable('ops_conflict_resolutions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repo: text('repo').notNull(),
    prNumber: integer('pr_number').notNull(),
    baseBranch: text('base_branch').notNull(),
    headBranch: text('head_branch').notNull(),
    filesResolved: integer('files_resolved').default(0),
    conflictsKeptBoth: integer('conflicts_kept_both').default(0),
    conflictsDeleted: integer('conflicts_deleted').default(0),
    decisionLog: text('decision_log'),
    resolutionBranch: text('resolution_branch'),
    status: text('status').default('pending'), // 'pending', 'resolved', 'failed'
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
}, (table) => ({
    repoPrIdx: index('ops_conflict_resolutions_repo_pr_idx').on(table.repo, table.prNumber),
    statusIdx: index('ops_conflict_resolutions_status_idx').on(table.status),
    createdAtIdx: index('ops_conflict_resolutions_created_at_idx').on(table.createdAt),
    uniqueRepoPrBranch: uniqueIndex('ops_conflict_resolutions_repo_pr_branch_unique').on(table.repo, table.prNumber, table.headBranch),
}));

/**
 * Ops Delivery Reports table - Tracks delivery report generation
 */
export const opsDeliveryReports = sqliteTable('ops_delivery_reports', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: text('project_id').notNull(),
    phase: text('phase'),
    complianceScore: real('compliance_score').default(0.0), // 0.0 to 1.0
    summary: text('summary'),
    issues: text('issues', { mode: 'json' }),
    recommendations: text('recommendations', { mode: 'json' }),
    originalOrderSpec: text('original_order_spec'),
    finalCodeDiff: text('final_code_diff'),
    status: text('status').default('pending'), // 'pending', 'completed', 'failed'
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    version: text('version').default('1.0'),
}, (table) => ({
    projectIdIdx: index('ops_delivery_reports_project_id_idx').on(table.projectId),
    statusIdx: index('ops_delivery_reports_status_idx').on(table.status),
    createdAtIdx: index('ops_delivery_reports_created_at_idx').on(table.createdAt),
    uniqueProjectPhaseVersion: uniqueIndex('ops_delivery_reports_project_phase_version_unique').on(table.projectId, table.phase, table.version),
}));

/**
 * Ops Orders table - Tracks orchestrator orders
 */
export const opsOrders = sqliteTable('ops_orders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderType: text('order_type').notNull(), // 'conflict-resolution', 'delivery-report', 'rollback', etc.
    orderPayload: text('order_payload', { mode: 'json' }).notNull(),
    status: text('status').default('pending'), // 'pending', 'processing', 'completed', 'failed'
    assignedSpecialist: text('assigned_specialist'),
    result: text('result', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    processedAt: integer('processed_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
    typeStatusIdx: index('ops_orders_type_status_idx').on(table.orderType, table.status),
    createdAtIdx: index('ops_orders_created_at_idx').on(table.createdAt),
}));

// ========================================
// TYPE EXPORTS FOR APPLICATION USE
// ========================================

export type Followup = typeof followups.$inferSelect;
export type NewFollowup = typeof followups.$inferInsert;

export type OperationLog = typeof operationLogs.$inferSelect;
export type NewOperationLog = typeof operationLogs.$inferInsert;

export type OpsConflictResolution = typeof opsConflictResolutions.$inferSelect;
export type NewOpsConflictResolution = typeof opsConflictResolutions.$inferInsert;

export type OpsDeliveryReport = typeof opsDeliveryReports.$inferSelect;
export type NewOpsDeliveryReport = typeof opsDeliveryReports.$inferInsert;

export type OpsOrder = typeof opsOrders.$inferSelect;
export type NewOpsOrder = typeof opsOrders.$inferInsert;

// ========================================
// FACTORY MANAGEMENT TABLES
// ========================================

/**
 * Factories table - Tracks factory metadata
 */
export const factories = sqliteTable('factories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  provider: text('provider').notNull(),
  repoOwner: text('repo_owner').notNull(),
  repoName: text('repo_name').notNull(),
  path: text('path').notNull(),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`),
  updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`),
  active: integer('active').default(1), // 0/1
}, (table) => ({
  nameIdx: index('factories_name_idx').on(table.name),
  activeIdx: index('factories_active_idx').on(table.active),
}));

/**
 * Container Settings table - Stores container configuration per factory
 */
export const containerSettings = sqliteTable('container_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  factoryName: text('factory_name').notNull().unique(),
  dockerfilePath: text('dockerfile_path').notNull(),
  json: text('json').notNull(), // JSON blob of container settings / envs
  updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`),
}, (table) => ({
  factoryNameIdx: index('container_settings_factory_name_idx').on(table.factoryName),
}));

export type Factory = typeof factories.$inferSelect;
export type NewFactory = typeof factories.$inferInsert;

export type ContainerSetting = typeof containerSettings.$inferSelect;
export type NewContainerSetting = typeof containerSettings.$inferInsert;

// ========================================
// FACTORY ORDER ORCHESTRATION TABLES
// ========================================

/**
 * Template Files table - Stores template file metadata
 * Tracks which template files exist for each factory
 */
export const templateFiles = sqliteTable('template_files', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    factoryName: text('factory_name').notNull(), // 'agent-factory', 'ui-factory', etc.
    templateName: text('template_name').notNull(), // 'basic-worker', 'react-app', etc.
    filePath: text('file_path').notNull(), // Relative path within template directory
    isActive: integer('is_active', { mode: 'boolean' }).default(true), // Soft delete flag
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    factoryTemplateIdx: index('template_files_factory_template_idx').on(table.factoryName, table.templateName),
    filePathIdx: index('template_files_file_path_idx').on(table.filePath),
    isActiveIdx: index('template_files_is_active_idx').on(table.isActive),
    createdAtIdx: index('template_files_created_at_idx').on(table.createdAt),
}));

/**
 * Template Placeholders table - Maps placeholders to template files
 * Stores placeholder patterns and their associated mini-prompts
 */
export const templatePlaceholders = sqliteTable('template_placeholders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    templateFileId: integer('template_file_id').notNull().references(() => templateFiles.id),
    placeholderId: text('placeholder_id').notNull(), // e.g., 'PLACEHOLDER_IMPORTS'
    placeholderPattern: text('placeholder_pattern').notNull(), // e.g., '{{PLACEHOLDER_IMPORTS}}'
    miniPrompt: text('mini_prompt'), // Default mini-prompt for this placeholder
    isActive: integer('is_active', { mode: 'boolean' }).default(true), // Soft delete flag
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    templateFileIdIdx: index('template_placeholders_template_file_id_idx').on(table.templateFileId),
    placeholderIdIdx: index('template_placeholders_placeholder_id_idx').on(table.placeholderId),
    isActiveIdx: index('template_placeholders_is_active_idx').on(table.isActive),
    createdAtIdx: index('template_placeholders_created_at_idx').on(table.createdAt),
}));

/**
 * Order Placeholder Mappings table - Links orders to placeholder mappings
 * Stores the actual mini-prompts used for each placeholder in a specific order
 */
export const orderPlaceholderMappings = sqliteTable('order_placeholder_mappings', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: text('order_id').notNull(), // References orders.id
    projectId: text('project_id'), // Optional project reference
    templateFileId: integer('template_file_id').notNull().references(() => templateFiles.id),
    placeholderId: text('placeholder_id').notNull(), // e.g., 'PLACEHOLDER_IMPORTS'
    miniPrompt: text('mini_prompt').notNull(), // Order-specific mini-prompt
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    orderIdIdx: index('order_placeholder_mappings_order_id_idx').on(table.orderId),
    projectIdIdx: index('order_placeholder_mappings_project_id_idx').on(table.projectId),
    templateFileIdIdx: index('order_placeholder_mappings_template_file_id_idx').on(table.templateFileId),
    orderPlaceholderIdx: index('order_placeholder_mappings_order_placeholder_idx').on(table.orderId, table.placeholderId),
    createdAtIdx: index('order_placeholder_mappings_created_at_idx').on(table.createdAt),
}));

/**
 * AI Provider Conversations table - Stores codex-cli/orchestrator conversations
 * Tracks clarification requests from AI providers during code generation
 */
export const aiProviderConversations = sqliteTable('ai_provider_conversations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: text('order_id').notNull(), // References orders.id
    conversationId: text('conversation_id').notNull(), // Unique conversation identifier
    providerName: text('provider_name').notNull(), // 'codex-cli', 'claude', etc.
    question: text('question').notNull(), // Question from AI provider
    response: text('response'), // Response from orchestrator agent
    solution: text('solution'), // Final solution/resolution
    status: text('status').default('open'), // 'open', 'resolved', 'escalated', 'closed'
    hilTriggered: integer('hil_triggered', { mode: 'boolean' }).default(false), // Whether HIL was triggered
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    orderIdIdx: index('ai_provider_conversations_order_id_idx').on(table.orderId),
    conversationIdIdx: index('ai_provider_conversations_conversation_id_idx').on(table.conversationId),
    providerNameIdx: index('ai_provider_conversations_provider_name_idx').on(table.providerName),
    statusIdx: index('ai_provider_conversations_status_idx').on(table.status),
    createdAtIdx: index('ai_provider_conversations_created_at_idx').on(table.createdAt),
}));

/**
 * HIL Requests table - Human-in-the-loop requests
 * Tracks requests that require human intervention
 */
export const hilRequests = sqliteTable('hil_requests', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: text('order_id').notNull(), // References orders.id
    conversationId: text('conversation_id').notNull(), // References ai_provider_conversations.conversation_id
    question: text('question').notNull(), // Original question that triggered HIL
    context: text('context', { mode: 'json' }), // Additional context (order details, template info, etc.)
    status: text('status').default('pending'), // 'pending', 'in_progress', 'resolved', 'cancelled'
    userResponse: text('user_response'), // Human-provided response
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    orderIdIdx: index('hil_requests_order_id_idx').on(table.orderId),
    conversationIdIdx: index('hil_requests_conversation_id_idx').on(table.conversationId),
    statusIdx: index('hil_requests_status_idx').on(table.status),
    createdAtIdx: index('hil_requests_created_at_idx').on(table.createdAt),
}));

// ========================================
// ADDITIONAL TYPE EXPORTS FOR FACTORY ORDER ORCHESTRATION
// ========================================

export type TemplateFile = typeof templateFiles.$inferSelect;
export type NewTemplateFile = typeof templateFiles.$inferInsert;

export type TemplatePlaceholder = typeof templatePlaceholders.$inferSelect;
export type NewTemplatePlaceholder = typeof templatePlaceholders.$inferInsert;

export type OrderPlaceholderMapping = typeof orderPlaceholderMappings.$inferSelect;
export type NewOrderPlaceholderMapping = typeof orderPlaceholderMappings.$inferInsert;

export type AIProviderConversation = typeof aiProviderConversations.$inferSelect;
export type NewAIProviderConversation = typeof aiProviderConversations.$inferInsert;

export type HilRequest = typeof hilRequests.$inferSelect;
export type NewHilRequest = typeof hilRequests.$inferInsert;

