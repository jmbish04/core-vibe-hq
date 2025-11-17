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

// ========================================
// CONTAINER MONITORING TABLES
// ========================================

/**
 * Container Errors table - Stores errors from container processes
 * All errors are routed through orchestrator RPC, not stored locally in containers
 */
export const containerErrors = sqliteTable('container_errors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(), // REQUIRED: Worker identifier
  containerName: text('container_name'), // Optional: Container identifier
  instanceId: text('instance_id').notNull(), // Process instance ID
  processId: text('process_id').notNull(), // Process PID
  errorHash: text('error_hash').notNull(), // Hash for deduplication
  timestamp: text('timestamp').notNull(), // ISO timestamp
  level: integer('level').notNull(), // Pino log level (50=error, 60=fatal)
  message: text('message').notNull(), // Error message
  rawOutput: text('raw_output').notNull(), // Complete raw JSON log line
  occurrenceCount: integer('occurrence_count').default(1), // Number of times this error occurred
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  workerContainerIdx: index('container_errors_worker_container_idx').on(table.workerName, table.containerName),
  instanceIdIdx: index('container_errors_instance_id_idx').on(table.instanceId),
  processIdIdx: index('container_errors_process_id_idx').on(table.processId),
  errorHashIdx: index('container_errors_error_hash_idx').on(table.errorHash),
  createdAtIdx: index('container_errors_created_at_idx').on(table.createdAt),
}));

/**
 * Container Logs table - Stores logs from container processes
 * All logs are routed through orchestrator RPC, not stored locally in containers
 */
export const containerLogs = sqliteTable('container_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(), // REQUIRED: Worker identifier
  containerName: text('container_name'), // Optional: Container identifier
  instanceId: text('instance_id').notNull(), // Process instance ID
  processId: text('process_id').notNull(), // Process PID
  sequence: integer('sequence').notNull(), // Sequence number for ordering
  timestamp: text('timestamp').notNull(), // ISO timestamp
  level: text('level').notNull(), // 'debug', 'info', 'warn', 'error', 'output'
  message: text('message').notNull(), // Log message
  stream: text('stream').notNull(), // 'stdout' or 'stderr'
  source: text('source'), // Optional source identifier
  metadata: text('metadata', { mode: 'json' }), // Optional JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  workerContainerIdx: index('container_logs_worker_container_idx').on(table.workerName, table.containerName),
  instanceIdIdx: index('container_logs_instance_id_idx').on(table.instanceId),
  processIdIdx: index('container_logs_process_id_idx').on(table.processId),
  timestampIdx: index('container_logs_timestamp_idx').on(table.timestamp),
  createdAtIdx: index('container_logs_created_at_idx').on(table.createdAt),
  instanceSequenceIdx: index('container_logs_instance_sequence_idx').on(table.instanceId, table.sequence),
}));

/**
 * Container Processes table - Tracks container process lifecycle
 * All process state is routed through orchestrator RPC, not stored locally in containers
 */
export const containerProcesses = sqliteTable('container_processes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerName: text('worker_name').notNull(), // REQUIRED: Worker identifier
  containerName: text('container_name'), // Optional: Container identifier
  instanceId: text('instance_id').notNull().unique(), // Process instance ID (unique)
  processId: text('process_id'), // Process PID (may be null if not started)
  command: text('command').notNull(), // Command being executed
  args: text('args', { mode: 'json' }), // Command arguments as JSON array
  cwd: text('cwd').notNull(), // Working directory
  status: text('status').notNull().default('starting'), // 'starting', 'running', 'stopping', 'stopped', 'crashed', 'restarting'
  restartCount: integer('restart_count').default(0), // Number of restarts
  startTime: integer('start_time', { mode: 'timestamp' }), // Process start time
  endTime: integer('end_time', { mode: 'timestamp' }), // Process end time
  exitCode: integer('exit_code'), // Process exit code
  lastError: text('last_error'), // Last error message if crashed
  env: text('env', { mode: 'json' }), // Environment variables as JSON object
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  workerContainerIdx: index('container_processes_worker_container_idx').on(table.workerName, table.containerName),
  instanceIdIdx: index('container_processes_instance_id_idx').on(table.instanceId),
  statusIdx: index('container_processes_status_idx').on(table.status),
  createdAtIdx: index('container_processes_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('container_processes_updated_at_idx').on(table.updatedAt),
}));

// ========================================
// CONTAINER MONITORING TYPE EXPORTS
// ========================================

export type ContainerError = typeof containerErrors.$inferSelect;
export type NewContainerError = typeof containerErrors.$inferInsert;

export type ContainerLog = typeof containerLogs.$inferSelect;
export type NewContainerLog = typeof containerLogs.$inferInsert;

export type ContainerProcess = typeof containerProcesses.$inferSelect;
export type NewContainerProcess = typeof containerProcesses.$inferInsert;

// ========================================
// SPECIALIST AUTOMATION TABLES
// ========================================

/**
 * Specialist Queue table - Manages automated specialist invocations
 */
export const specialistQueues = sqliteTable('specialist_queues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  specialistType: text('specialist_type').notNull(), // 'docstring-architect', 'lint-surgeon', 'dependency-auditor', etc.
  triggerEvent: text('trigger_event').notNull(), // 'code-generation-complete', 'lint-errors-detected', 'dependency-changed', etc.
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  priority: integer('priority').default(0), // 0=normal, 1=high, 2=critical
  payload: text('payload', { mode: 'json' }), // Event-specific data
  result: text('result', { mode: 'json' }), // Specialist execution result
  error: text('error'), // Error message if failed
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),

  // Metadata
  triggeredBy: text('triggered_by'), // Service/module that triggered this
  orderId: text('order_id'), // Associated order if applicable
  taskUuid: text('task_uuid'), // Associated task if applicable
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
}, (table) => ({
  specialistTypeIdx: index('specialist_queues_specialist_type_idx').on(table.specialistType),
  triggerEventIdx: index('specialist_queues_trigger_event_idx').on(table.triggerEvent),
  statusIdx: index('specialist_queues_status_idx').on(table.status),
  priorityIdx: index('specialist_queues_priority_idx').on(table.priority),
  orderIdIdx: index('specialist_queues_order_id_idx').on(table.orderId),
  taskUuidIdx: index('specialist_queues_task_uuid_idx').on(table.taskUuid),
  createdAtIdx: index('specialist_queues_created_at_idx').on(table.createdAt),
}));

/**
 * Specialist Triggers table - Defines when specialists should be invoked
 */
export const specialistTriggers = sqliteTable('specialist_triggers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  specialistType: text('specialist_type').notNull(),
  triggerEvent: text('trigger_event').notNull(),
  triggerSource: text('trigger_source').notNull(), // 'factory-agent', 'lint-runner', 'dependency-scanner', etc.
  condition: text('condition', { mode: 'json' }), // Additional conditions for triggering
  isActive: integer('is_active').default(1), // Boolean: 1=active, 0=disabled

  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  specialistTypeIdx: index('specialist_triggers_specialist_type_idx').on(table.specialistType),
  triggerEventIdx: index('specialist_triggers_trigger_event_idx').on(table.triggerEvent),
  triggerSourceIdx: index('specialist_triggers_trigger_source_idx').on(table.triggerSource),
  isActiveIdx: index('specialist_triggers_is_active_idx').on(table.isActive),
  uniqueTrigger: uniqueIndex('specialist_triggers_unique').on(table.specialistType, table.triggerEvent, table.triggerSource),
}));

// ========================================
// SPECIALIST AUTOMATION TYPE EXPORTS
// ========================================

export type SpecialistQueue = typeof specialistQueues.$inferSelect;
export type NewSpecialistQueue = typeof specialistQueues.$inferInsert;

export type SpecialistTrigger = typeof specialistTriggers.$inferSelect;
export type NewSpecialistTrigger = typeof specialistTriggers.$inferInsert;

