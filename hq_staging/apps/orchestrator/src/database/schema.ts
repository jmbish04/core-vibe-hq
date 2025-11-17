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
// PATCH & DELIVERY TABLES
// ========================================

export const patchEvents = sqliteTable('patch_events', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    patchId: text('patch_id').notNull(),
    eventType: text('event_type').notNull(),
    status: text('status').notNull(),
    metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
    patchIdIdx: index('patch_events_patch_id_idx').on(table.patchId),
    eventTypeIdx: index('patch_events_event_type_idx').on(table.eventType),
    createdAtIdx: index('patch_events_created_at_idx').on(table.createdAt),
}));

export const deliveryReports = sqliteTable('delivery_reports', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    patchId: text('patch_id').notNull(),
    destination: text('destination').notNull(),
    status: text('status').notNull(),
    attempts: integer('attempts').default(0),
    lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp' }),
    error: text('error'),
    metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
    patchIdIdx: index('delivery_reports_patch_id_idx').on(table.patchId),
    statusIdx: index('delivery_reports_status_idx').on(table.status),
}));

// ========================================
// AI PROVIDER TABLES
// ========================================

export const aiProviderAssignments = sqliteTable('ai_provider_assignments', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    patchId: text('patch_id').notNull(),
    providerId: text('provider_id').notNull(),
    status: text('status').notNull(),
    priority: integer('priority').default(0),
    metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
    patchIdIdx: index('ai_provider_assignments_patch_id_idx').on(table.patchId),
    providerIdIdx: index('ai_provider_assignments_provider_id_idx').on(table.providerId),
    statusIdx: index('ai_provider_assignments_status_idx').on(table.status),
}));

export const aiProviderExecutions = sqliteTable('ai_provider_executions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    assignmentId: integer('assignment_id').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    status: text('status').notNull(),
    result: text('result', { mode: 'json' }),
    error: text('error'),
}, (table) => ({
    assignmentIdIdx: index('ai_provider_executions_assignment_id_idx').on(table.assignmentId),
    statusIdx: index('ai_provider_executions_status_idx').on(table.status),
}));

export const aiProviderConfigs = sqliteTable('ai_provider_configs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    providerId: text('provider_id').notNull(),
    config: text('config', { mode: 'json' }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    version: integer('version').default(1),
}, (table) => ({
    providerIdIdx: index('ai_provider_configs_provider_id_idx').on(table.providerId),
    providerVersionUnique: uniqueIndex('ai_provider_configs_provider_id_version_idx').on(table.providerId, table.version),
}));

// ========================================
// OPS MONITORING TABLES
// ========================================

export const workerLogs = sqliteTable('worker_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    workerId: text('worker_id').notNull(),
    level: text('level').notNull(),
    message: text('message').notNull(),
    metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
    workerIdIdx: index('worker_logs_worker_id_idx').on(table.workerId),
    levelIdx: index('worker_logs_level_idx').on(table.level),
    createdAtIdx: index('worker_logs_created_at_idx').on(table.createdAt),
}));

export const buildLogs = sqliteTable('build_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    buildId: text('build_id').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    message: text('message'),
    metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
    buildIdIdx: index('build_logs_build_id_idx').on(table.buildId),
    stageIdx: index('build_logs_stage_idx').on(table.stage),
    createdAtIdx: index('build_logs_created_at_idx').on(table.createdAt),
}));

export const opsIssues = sqliteTable('ops_issues', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    status: text('status').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    metadata: text('metadata', { mode: 'json' }),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
}, (table) => ({
    statusIdx: index('ops_issues_status_idx').on(table.status),
    typeIdx: index('ops_issues_type_idx').on(table.type),
    severityIdx: index('ops_issues_severity_idx').on(table.severity),
    createdAtIdx: index('ops_issues_created_at_idx').on(table.createdAt),
}));

export const opsScans = sqliteTable('ops_scans', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    scanType: text('scan_type').notNull(),
    status: text('status').notNull(),
    findings: text('findings', { mode: 'json' }),
    metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
    scanTypeIdx: index('ops_scans_scan_type_idx').on(table.scanType),
    statusIdx: index('ops_scans_status_idx').on(table.status),
    createdAtIdx: index('ops_scans_created_at_idx').on(table.createdAt),
}));

// ========================================
// TYPE EXPORTS FOR APPLICATION USE
// ========================================

export type Followup = typeof followups.$inferSelect;
export type NewFollowup = typeof followups.$inferInsert;

export type OperationLog = typeof operationLogs.$inferSelect;
export type NewOperationLog = typeof operationLogs.$inferInsert;

export type PatchEvent = typeof patchEvents.$inferSelect;
export type NewPatchEvent = typeof patchEvents.$inferInsert;

export type DeliveryReport = typeof deliveryReports.$inferSelect;
export type NewDeliveryReport = typeof deliveryReports.$inferInsert;

export type AIProviderAssignment = typeof aiProviderAssignments.$inferSelect;
export type NewAIProviderAssignment = typeof aiProviderAssignments.$inferInsert;

export type AIProviderExecution = typeof aiProviderExecutions.$inferSelect;
export type NewAIProviderExecution = typeof aiProviderExecutions.$inferInsert;

export type AIProviderConfig = typeof aiProviderConfigs.$inferSelect;
export type NewAIProviderConfig = typeof aiProviderConfigs.$inferInsert;

export type WorkerLog = typeof workerLogs.$inferSelect;
export type NewWorkerLog = typeof workerLogs.$inferInsert;

export type BuildLog = typeof buildLogs.$inferSelect;
export type NewBuildLog = typeof buildLogs.$inferInsert;

export type OpsIssue = typeof opsIssues.$inferSelect;
export type NewOpsIssue = typeof opsIssues.$inferInsert;

export type OpsScan = typeof opsScans.$inferSelect;
export type NewOpsScan = typeof opsScans.$inferInsert;

// ========================================
// AGENT & PROJECT MANAGEMENT TABLES
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

export type ConversationLog = typeof conversationLogs.$inferSelect;
export type NewConversationLog = typeof conversationLogs.$inferInsert;

export type ProjectOverviewCard = typeof projectOverviewCards.$inferSelect;
export type NewProjectOverviewCard = typeof projectOverviewCards.$inferInsert;

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
// HEALTH CHECK TABLES
// ========================================

/**
 * Health Checks table - Main health check instances
 */
export const healthChecks = sqliteTable('health_checks', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    healthCheckUuid: text('health_check_uuid').notNull().unique(),
    triggerType: text('trigger_type').notNull(), // 'cron' or 'on_demand'
    triggerSource: text('trigger_source'), // user_id for on_demand, 'system' for cron
    status: text('status').default('running'), // 'running', 'completed', 'failed', 'timeout'
    totalWorkers: integer('total_workers').default(0),
    completedWorkers: integer('completed_workers').default(0),
    passedWorkers: integer('passed_workers').default(0),
    failedWorkers: integer('failed_workers').default(0),
    overallHealthScore: real('overall_health_score').default(0.0), // 0.0 to 1.0
    aiAnalysis: text('ai_analysis'),
    aiRecommendations: text('ai_recommendations'),
    startedAt: integer('started_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    timeoutAt: integer('timeout_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    uuidIdx: index('health_checks_uuid_idx').on(table.healthCheckUuid),
    triggerIdx: index('health_checks_trigger_idx').on(table.triggerType, table.startedAt),
    statusIdx: index('health_checks_status_idx').on(table.status),
    createdAtIdx: index('health_checks_created_at_idx').on(table.createdAt),
}));

/**
 * Worker Health Checks table - Individual worker health check results
 */
export const workerHealthChecks = sqliteTable('worker_health_checks', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workerCheckUuid: text('worker_check_uuid').notNull().unique(),
    healthCheckUuid: text('health_check_uuid').notNull().references(() => healthChecks.healthCheckUuid),
    workerName: text('worker_name').notNull(),
    workerType: text('worker_type').notNull(), // 'agent-factory', 'data-factory', etc.
    workerUrl: text('worker_url'),
    status: text('status').default('pending'), // 'pending', 'running', 'completed', 'failed', 'timeout'
    
    // Health check results
    overallStatus: text('overall_status'), // 'healthy', 'degraded', 'unhealthy', 'critical'
    healthScore: real('health_score').default(0.0), // 0.0 to 1.0
    
    // System metrics
    uptimeSeconds: integer('uptime_seconds'),
    memoryUsageMb: real('memory_usage_mb'),
    cpuUsagePercent: real('cpu_usage_percent'),
    responseTimeMs: integer('response_time_ms'),
    
    // Connectivity tests
    orchestratorConnectivity: integer('orchestrator_connectivity', { mode: 'boolean' }).default(false),
    externalApiConnectivity: integer('external_api_connectivity', { mode: 'boolean' }).default(false),
    databaseConnectivity: integer('database_connectivity', { mode: 'boolean' }).default(false),
    
    // Unit test results
    unitTestsTotal: integer('unit_tests_total').default(0),
    unitTestsPassed: integer('unit_tests_passed').default(0),
    unitTestsFailed: integer('unit_tests_failed').default(0),
    unitTestResults: text('unit_test_results', { mode: 'json' }),
    
    // Performance tests
    performanceTestsTotal: integer('performance_tests_total').default(0),
    performanceTestsPassed: integer('performance_tests_passed').default(0),
    performanceTestsFailed: integer('performance_tests_failed').default(0),
    performanceTestResults: text('performance_test_results', { mode: 'json' }),
    
    // Integration tests
    integrationTestsTotal: integer('integration_tests_total').default(0),
    integrationTestsPassed: integer('integration_tests_passed').default(0),
    integrationTestsFailed: integer('integration_tests_failed').default(0),
    integrationTestResults: text('integration_test_results', { mode: 'json' }),
    
    // Error details
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    warnings: text('warnings', { mode: 'json' }),
    
    // Detailed results payload
    rawResults: text('raw_results', { mode: 'json' }),
    
    // AI analysis for this specific worker
    aiWorkerAnalysis: text('ai_worker_analysis'),
    aiWorkerRecommendations: text('ai_worker_recommendations'),
    
    // Timestamps
    requestedAt: integer('requested_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
    uuidIdx: index('worker_health_checks_uuid_idx').on(table.workerCheckUuid),
    healthUuidIdx: index('worker_health_checks_health_uuid_idx').on(table.healthCheckUuid),
    workerIdx: index('worker_health_checks_worker_idx').on(table.workerName, table.workerType),
    statusIdx: index('worker_health_checks_status_idx').on(table.status),
    overallStatusIdx: index('worker_health_checks_overall_status_idx').on(table.overallStatus),
    requestedAtIdx: index('worker_health_checks_requested_at_idx').on(table.requestedAt),
}));

/**
 * Health Check Schedules table - Configuration for scheduled health checks
 */
export const healthCheckSchedules = sqliteTable('health_check_schedules', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    cronExpression: text('cron_expression').notNull(), // e.g., '0 0 * * *' for daily at midnight
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    timeoutMinutes: integer('timeout_minutes').default(30),
    includeUnitTests: integer('include_unit_tests', { mode: 'boolean' }).default(true),
    includePerformanceTests: integer('include_performance_tests', { mode: 'boolean' }).default(true),
    includeIntegrationTests: integer('include_integration_tests', { mode: 'boolean' }).default(true),
    workerFilters: text('worker_filters', { mode: 'json' }), // JSON array of worker names/types to include
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    nameIdx: index('health_check_schedules_name_idx').on(table.name),
}));

// ========================================
// ADDITIONAL TYPE EXPORTS
// ========================================

export type OpsConflictResolution = typeof opsConflictResolutions.$inferSelect;
export type NewOpsConflictResolution = typeof opsConflictResolutions.$inferInsert;

export type OpsDeliveryReport = typeof opsDeliveryReports.$inferSelect;
export type NewOpsDeliveryReport = typeof opsDeliveryReports.$inferInsert;

export type OpsOrder = typeof opsOrders.$inferSelect;
export type NewOpsOrder = typeof opsOrders.$inferInsert;

export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;

export type WorkerHealthCheck = typeof workerHealthChecks.$inferSelect;
export type NewWorkerHealthCheck = typeof workerHealthChecks.$inferInsert;

export type HealthCheckSchedule = typeof healthCheckSchedules.$inferSelect;
export type NewHealthCheckSchedule = typeof healthCheckSchedules.$inferInsert;

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

