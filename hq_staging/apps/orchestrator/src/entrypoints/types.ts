/**
 * orchestrator/worker/entrypoints/types.ts
 * ------------------------------------------------------------
 * Shared response interfaces for all WorkerEntrypoint methods.
 * These provide explicit typing for RPC/API boundaries.
 * ------------------------------------------------------------
 */

import { Selectable } from 'kysely'
import { Database, TasksTable } from '@shared/types/db'

// --- GitHub ---
export interface UpsertFileResponse {
  commit: {
    sha: string
  }
  // ... other properties
}

export interface OpenPRResponse {
  html_url: string
  // ... other properties
}

// --- Tasks ---
export interface CreateOrderResponse {
  order_id: string
}

export interface TasksForOrderResponse {
  order_id: string
  tasks: Selectable<TasksTable>[]
}

export interface TaskHelpResponse {
  uuid: string
  agent_name: string
  question: string
  error?: string
  original_instruction: string
  ai_guidance: string
  summary: string
}

export interface UpdateTaskStatusResponse {
  uuid: string
  status: string
}

// --- Factory ---
export interface RemediationResult {
  task_uuid: string | undefined
  ok: boolean
  action: string
  note: string
}

export interface RemediationReportResponse {
  ok: boolean
  remediation: RemediationResult[]
}

export interface InitializeFactoryResponse {
  ok: boolean
  factory_name: string
  files_created: string[]
  branch?: string
  pr_url?: string
  error?: string
}

// --- Delivery ---
export interface DeployWorkerResponse {
  ok: boolean
  worker_url: string
  // ... other properties
}

export interface DeployPagesResponse {
  ok: boolean
  pages_url: string
  // ... other properties
}

// --- Logging ---
export interface LogResponse {
  ok: boolean
  error?: string
}

// --- Specialist ---
export interface ConflictResolutionResponse {
  id: number
  repo: string
  pr_number: number
  status: string
  created_at: string
}

export interface DeliveryReportResponse {
  id: number
  project_id: string
  status: string
  compliance_score: number
  created_at: string
}

export interface OpsOrderResponse {
  id: number
  order_type: string
  status: string
  assigned_specialist: string | null
  created_at: string
}

// --- Health ---
export interface HealthCheckResponse {
  health_check_uuid: string
  status: string
  total_workers: number
  message: string
}

export interface HealthCheckStatusResponse {
  health_check_uuid: string
  status: string
  total_workers: number
  completed_workers: number
  passed_workers: number
  failed_workers: number
  overall_health_score: number
  ai_analysis?: string
  ai_recommendations?: string
  worker_results: any[]
}

export interface HealthCheckHistoryResponse {
  health_checks: any[]
  total_count: number
  page: number
  limit: number
}
