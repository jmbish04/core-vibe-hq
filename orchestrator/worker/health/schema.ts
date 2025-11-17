import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Test Profiles Table - defines health tests and their metadata
export const testProfiles = sqliteTable('test_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'unit', 'integration', 'performance', 'security', 'ai'
  target: text('target').notNull(), // which worker/service to test
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  schedule: text('schedule').default('daily'), // 'hourly', 'daily', 'weekly'
  timeoutSeconds: integer('timeout_seconds').default(300),
  retryAttempts: integer('retry_attempts').default(3),
  config: text('config', { mode: 'json' }), // test-specific configuration
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// Test Results Table - logs individual test runs and outcomes
export const testResults = sqliteTable('test_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testProfileId: integer('test_profile_id').notNull(),
  runId: text('run_id').notNull(), // UUID for grouping related tests
  status: text('status').notNull(), // 'pending', 'running', 'passed', 'failed', 'skipped'
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  output: text('output', { mode: 'json' }), // detailed test output
  metrics: text('metrics', { mode: 'json' }), // performance metrics, coverage, etc.
  environment: text('environment').default('production'), // 'development', 'staging', 'production'
  triggeredBy: text('triggered_by').default('cron'), // 'cron', 'manual', 'webhook'
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// AI Logs Table - tracks AI model usage and diagnostics
export const aiLogs = sqliteTable('ai_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testResultId: integer('test_result_id'),
  model: text('model').notNull(),
  provider: text('provider').notNull(),
  prompt: text('prompt'),
  response: text('response'),
  tokensUsed: integer('tokens_used'),
  cost: real('cost'),
  latencyMs: integer('latency_ms'),
  success: integer('success', { mode: 'boolean' }).default(true),
  errorMessage: text('error_message'),
  reasoning: text('reasoning', { mode: 'json' }), // AI reasoning and diagnostics
  metadata: text('metadata', { mode: 'json' }), // additional context
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// Health Summary Table - aggregated health status over time
export const healthSummaries = sqliteTable('health_summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // YYYY-MM-DD format
  overallStatus: text('overall_status').notNull(), // 'healthy', 'degraded', 'critical'
  totalTests: integer('total_tests').default(0),
  passedTests: integer('passed_tests').default(0),
  failedTests: integer('failed_tests').default(0),
  skippedTests: integer('skipped_tests').default(0),
  averageLatency: integer('average_latency'), // milliseconds
  totalCost: real('total_cost'),
  aiUsageCount: integer('ai_usage_count').default(0),
  issues: text('issues', { mode: 'json' }), // list of current issues
  recommendations: text('recommendations', { mode: 'json' }), // AI-generated recommendations
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// Type definitions for Kysely
export interface Database {
  test_profiles: typeof testProfiles.$inferSelect;
  test_results: typeof testResults.$inferSelect;
  ai_logs: typeof aiLogs.$inferSelect;
  health_summaries: typeof healthSummaries.$inferSelect;
}

// Insert types
export type InsertTestProfile = typeof testProfiles.$inferInsert;
export type InsertTestResult = typeof testResults.$inferInsert;
export type InsertAiLog = typeof aiLogs.$inferInsert;
export type InsertHealthSummary = typeof healthSummaries.$inferInsert;

// Select types
export type TestProfile = typeof testProfiles.$inferSelect;
export type TestResult = typeof testResults.$inferSelect;
export type AiLog = typeof aiLogs.$inferSelect;
export type HealthSummary = typeof healthSummaries.$inferSelect;
