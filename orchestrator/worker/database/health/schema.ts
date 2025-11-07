import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, real } from 'drizzle-orm/sqlite-core';

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
// TYPE EXPORTS
// ========================================

export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;

export type WorkerHealthCheck = typeof workerHealthChecks.$inferSelect;
export type NewWorkerHealthCheck = typeof workerHealthChecks.$inferInsert;

export type HealthCheckSchedule = typeof healthCheckSchedules.$inferSelect;
export type NewHealthCheckSchedule = typeof healthCheckSchedules.$inferInsert;

