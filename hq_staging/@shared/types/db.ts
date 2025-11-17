// Assumed in a shared types file, e.g., @shared/types/db.ts
import { Generated } from 'kysely'

interface OrdersTable {
  id: string
  factory: string
  created_at: Generated<string>
}

interface TasksTable {
  uuid: string
  order_id: string
  file_path: string
  placeholder: string
  instruction: string
  status: Generated<string>
  created_at: Generated<string>
}

interface OperationLogsTable {
  id: Generated<number>
  ts: Generated<string>
  source: string
  order_id: string | null
  task_uuid: string | null
  operation: string
  level: string
  details: string // JSON blob
}

interface ErrorEventsTable {
  id: Generated<number>
  ts: Generated<string>
  order_id: string | null
  task_uuid: string | null
  factory: string
  file_path: string
  placeholder: string | null
  error_code: string
  message: string
  context: string // JSON blob
}

interface FollowupsTable {
  id: Generated<number>
  ts: Generated<string>
  order_id: string | null
  task_uuid: string | null
  type: string
  impact_level: number
  status: Generated<string>
  note: string
  github_issue_id: string | null
  data: string // JSON blob
}

// Ops Tables (from ops-specialists migrations)
interface OpsConflictResolutionsTable {
  id: Generated<number>
  repo: string
  pr_number: number
  base_branch: string
  head_branch: string
  files_resolved: Generated<number>
  conflicts_kept_both: Generated<number>
  conflicts_deleted: Generated<number>
  decision_log: string | null
  resolution_branch: string | null
  status: Generated<string>
  created_at: Generated<string>
  resolved_at: string | null
}

interface OpsDeliveryReportsTable {
  id: Generated<number>
  project_id: string
  phase: string | null
  compliance_score: Generated<number>
  summary: string | null
  issues: string | null // JSON
  recommendations: string | null // JSON
  original_order_spec: string | null
  final_code_diff: string | null
  status: Generated<string>
  created_at: Generated<string>
  completed_at: string | null
  version: Generated<string>
}

interface OpsOrdersTable {
  id: Generated<number>
  order_type: string
  order_payload: string // JSON
  status: Generated<string>
  assigned_specialist: string | null
  result: string | null // JSON
  created_at: Generated<string>
  processed_at: string | null
  completed_at: string | null
}

// Health Check Tables
interface HealthChecksTable {
  id: Generated<number>
  health_check_uuid: string
  trigger_type: string
  trigger_source: string | null
  status: Generated<string>
  total_workers: Generated<number>
  completed_workers: Generated<number>
  passed_workers: Generated<number>
  failed_workers: Generated<number>
  overall_health_score: Generated<number>
  ai_analysis: string | null
  ai_recommendations: string | null
  started_at: Generated<string>
  completed_at: string | null
  timeout_at: string | null
  created_at: Generated<string>
}

interface WorkerHealthChecksTable {
  id: Generated<number>
  worker_check_uuid: string
  health_check_uuid: string
  worker_name: string
  worker_type: string
  worker_url: string | null
  status: Generated<string>
  overall_status: string | null
  health_score: Generated<number>
  uptime_seconds: number | null
  memory_usage_mb: number | null
  cpu_usage_percent: number | null
  response_time_ms: number | null
  orchestrator_connectivity: Generated<boolean>
  external_api_connectivity: Generated<boolean>
  database_connectivity: Generated<boolean>
  unit_tests_total: Generated<number>
  unit_tests_passed: Generated<number>
  unit_tests_failed: Generated<number>
  unit_test_results: string | null
  performance_tests_total: Generated<number>
  performance_tests_passed: Generated<number>
  performance_tests_failed: Generated<number>
  performance_test_results: string | null
  integration_tests_total: Generated<number>
  integration_tests_passed: Generated<number>
  integration_tests_failed: Generated<number>
  integration_test_results: string | null
  error_message: string | null
  error_stack: string | null
  warnings: string | null
  raw_results: string | null
  ai_worker_analysis: string | null
  ai_worker_recommendations: string | null
  requested_at: Generated<string>
  started_at: string | null
  completed_at: string | null
}

interface HealthCheckSchedulesTable {
  id: Generated<number>
  name: string
  cron_expression: string
  enabled: Generated<boolean>
  timeout_minutes: Generated<number>
  include_unit_tests: Generated<boolean>
  include_performance_tests: Generated<boolean>
  include_integration_tests: Generated<boolean>
  worker_filters: string | null
  created_at: Generated<string>
  updated_at: Generated<string>
}

export interface Database {
  orders: OrdersTable
  tasks: TasksTable
  operation_logs: OperationLogsTable
  error_events: ErrorEventsTable
  followups: FollowupsTable
  ops_conflict_resolutions: OpsConflictResolutionsTable
  ops_delivery_reports: OpsDeliveryReportsTable
  ops_orders: OpsOrdersTable
  health_checks: HealthChecksTable
  worker_health_checks: WorkerHealthChecksTable
  health_check_schedules: HealthCheckSchedulesTable
}

// Export individual table types
export type { 
  OrdersTable, 
  TasksTable, 
  OperationLogsTable, 
  ErrorEventsTable, 
  FollowupsTable,
  OpsConflictResolutionsTable,
  OpsDeliveryReportsTable,
  OpsOrdersTable,
  HealthChecksTable,
  WorkerHealthChecksTable,
  HealthCheckSchedulesTable
}