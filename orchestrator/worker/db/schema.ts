/**
 * Kysely Schema for Factory Management
 * 
 * This schema uses Kysely for type-safe database queries.
 * Separate from the Drizzle schemas used elsewhere.
 */

import { Kysely, Generated, ColumnType } from 'kysely'

export interface DB {
  factories: {
    id: Generated<number>
    name: string            // 'agent-factory'
    provider: string        // 'codex' | 'gemini' | 'claude' | 'copilot' | 'cursor' | 'jules'
    repo_owner: string
    repo_name: string
    path: string            // 'factory/agent-factory'
    created_at: ColumnType<string, string | undefined, never>
    updated_at: ColumnType<string, string | undefined, never>
    active: number          // 0/1
  }
  container_settings: {
    id: Generated<number>
    factory_name: string
    dockerfile_path: string // e.g. 'factory/agent-factory/Dockerfile'
    json: string            // JSON blob of container settings / envs
    updated_at: ColumnType<string, string | undefined, never>
  }
  operation_logs: {
    id: Generated<number>
    ts: ColumnType<string, string | undefined, never>
    source: string
    operation: string
    level: 'info'|'warn'|'error'
    details: string
  }
  /* Patch Events Table */
  patch_events: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    patch_id: string
    event_type: string
    status: string
    metadata: unknown
  }
  /* Delivery Reports Table */
  delivery_reports: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    patch_id: string
    destination: string
    status: string
    attempts: number
    last_attempt_at: ColumnType<string, string | undefined, never>
    error: string | null
    metadata: unknown
  }
  /* AI Provider Tables */
  ai_provider_assignments: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    patch_id: string
    provider_id: string
    status: string
    priority: number
    metadata: unknown
  }
  ai_provider_executions: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    assignment_id: number
    started_at: ColumnType<string, string | undefined, never>
    completed_at: ColumnType<string, string | null, never>
    status: string
    result: unknown | null
    error: string | null
  }
  ai_provider_configs: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    provider_id: string
    config: unknown
    is_active: number
    version: number
  }
  /* Ops Monitoring Tables */
  worker_logs: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    worker_id: string
    level: string
    message: string
    metadata: unknown
  }
  build_logs: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    build_id: string
    stage: string
    status: string
    message: string
    metadata: unknown
  }
  ops_issues: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    type: string
    severity: string
    status: string
    title: string
    description: string
    metadata: unknown
    resolved_at: ColumnType<string, string | null, never>
  }
  ops_scans: {
    id: Generated<number>
    created_at: ColumnType<string, string | undefined, never>
    scan_type: string
    status: string
    findings: unknown
    metadata: unknown
  }
}

export type D1DB = Kysely<DB>



