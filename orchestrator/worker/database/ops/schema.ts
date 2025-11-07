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

