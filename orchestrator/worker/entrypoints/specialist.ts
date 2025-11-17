/**
 * orchestrator/worker/entrypoints/specialist.ts
 * (Kysely-enabled)
 * ------------------------------------------------------------
 * Manages operations specialist tasks including conflict resolution,
 * delivery reports, and operational metrics. This entrypoint provides
 * the interface for ops-related database operations.
 *
 * Responsibilities:
 * - Manage conflict resolution records
 * - Handle delivery report generation and storage
 * - Track ops orders and assignments
 * - Provide metrics and reporting for ops activities
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import {
  OpsConflictResolutionsTable,
  OpsDeliveryReportsTable,
  OpsOrdersTable,
} from '@shared/types/db';
import { Selectable } from 'kysely';

export interface CreateConflictResolutionParams {
  repo: string
  pr_number: number
  base_branch: string
  head_branch: string
  decision_log?: string
  resolution_branch?: string
}

export interface CreateDeliveryReportParams {
  project_id: string
  phase?: string
  compliance_score?: number
  summary?: string
  issues?: object
  recommendations?: object
  original_order_spec?: string
  final_code_diff?: string
}

export interface CreateOpsOrderParams {
  order_type: string
  order_payload: object
  assigned_specialist?: string
}

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

export class Specialist extends BaseWorkerEntrypoint<CoreEnv> {

  /**
   * Create a new conflict resolution record
   */
  async createConflictResolution(params: CreateConflictResolutionParams): Promise<ConflictResolutionResponse> {
    const result = await this.db
      .insertInto('ops_conflict_resolutions')
      .values({
        repo: params.repo,
        pr_number: params.pr_number,
        base_branch: params.base_branch,
        head_branch: params.head_branch,
        decision_log: params.decision_log || null,
        resolution_branch: params.resolution_branch || null,
      })
      .returning(['id', 'repo', 'pr_number', 'status', 'created_at'])
      .executeTakeFirstOrThrow();

    // Log the operation
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'ops.createConflictResolution',
        level: 'info',
        details: JSON.stringify({ repo: params.repo, pr_number: params.pr_number }),
        order_id: null,
        task_uuid: null,
      })
      .execute();

    return result;
  }

  /**
   * Update conflict resolution status
   */
  async updateConflictResolution(id: number, updates: {
    files_resolved?: number
    conflicts_kept_both?: number
    conflicts_deleted?: number
    status?: string
    resolved_at?: string
  }): Promise<void> {
    await this.db
      .updateTable('ops_conflict_resolutions')
      .set(updates)
      .where('id', '=', id)
      .execute();

    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'ops.updateConflictResolution',
        level: 'info',
        details: JSON.stringify({ id, updates }),
        order_id: null,
        task_uuid: null,
      })
      .execute();
  }

  /**
   * Create a delivery report
   */
  async createDeliveryReport(params: CreateDeliveryReportParams): Promise<DeliveryReportResponse> {
    const result = await this.db
      .insertInto('ops_delivery_reports')
      .values({
        project_id: params.project_id,
        phase: params.phase || null,
        compliance_score: params.compliance_score || 0.0,
        summary: params.summary || null,
        issues: params.issues ? JSON.stringify(params.issues) : null,
        recommendations: params.recommendations ? JSON.stringify(params.recommendations) : null,
        original_order_spec: params.original_order_spec || null,
        final_code_diff: params.final_code_diff || null,
      })
      .returning(['id', 'project_id', 'status', 'compliance_score', 'created_at'])
      .executeTakeFirstOrThrow();

    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'ops.createDeliveryReport',
        level: 'info',
        details: JSON.stringify({ project_id: params.project_id }),
        order_id: null,
        task_uuid: null,
      })
      .execute();

    return result;
  }

  /**
   * Create an ops order
   */
  async createOpsOrder(params: CreateOpsOrderParams): Promise<OpsOrderResponse> {
    const result = await this.db
      .insertInto('ops_orders')
      .values({
        order_type: params.order_type,
        order_payload: JSON.stringify(params.order_payload),
        assigned_specialist: params.assigned_specialist || null,
      })
      .returning(['id', 'order_type', 'status', 'assigned_specialist', 'created_at'])
      .executeTakeFirstOrThrow();

    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'ops.createOpsOrder',
        level: 'info',
        details: JSON.stringify({ order_type: params.order_type }),
        order_id: null,
        task_uuid: null,
      })
      .execute();

    return result;
  }

  /**
   * Get pending ops orders by type
   */
  async getPendingOpsOrders(order_type?: string): Promise<Selectable<OpsOrdersTable>[]> {
    let query = this.db
      .selectFrom('ops_orders')
      .selectAll()
      .where('status', '=', 'pending');

    if (order_type) {
      query = query.where('order_type', '=', order_type);
    }

    return query.execute();
  }

  /**
   * Update ops order status
   */
  async updateOpsOrder(id: number, updates: {
    status?: string
    assigned_specialist?: string
    result?: object
    processed_at?: string
    completed_at?: string
  }): Promise<void> {
    const updateData: any = { ...updates };
    if (updates.result) {
      updateData.result = JSON.stringify(updates.result);
    }

    await this.db
      .updateTable('ops_orders')
      .set(updateData)
      .where('id', '=', id)
      .execute();

    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'ops.updateOpsOrder',
        level: 'info',
        details: JSON.stringify({ id, updates }),
        order_id: null,
        task_uuid: null,
      })
      .execute();
  }

  /**
   * Get conflict resolutions by repo and PR
   */
  async getConflictResolutions(repo: string, pr_number?: number): Promise<Selectable<OpsConflictResolutionsTable>[]> {
    let query = this.db
      .selectFrom('ops_conflict_resolutions')
      .selectAll()
      .where('repo', '=', repo);

    if (pr_number !== undefined) {
      query = query.where('pr_number', '=', pr_number);
    }

    return query.execute();
  }

  /**
   * Get delivery reports by project
   */
  async getDeliveryReports(project_id: string): Promise<Selectable<OpsDeliveryReportsTable>[]> {
    return this.db
      .selectFrom('ops_delivery_reports')
      .selectAll()
      .where('project_id', '=', project_id)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async logSpecialistActivity(params: {
    specialist: string
    activity: string
    identifier?: string
    level?: 'info' | 'warn' | 'error' | 'debug'
    orderId?: string | null
    taskUuid?: string | null
    details?: Record<string, unknown>
  }): Promise<void> {
    const detailsPayload = {
      identifier: params.identifier ?? null,
      ...(params.details ?? {}),
    };

    await this.db
      .insertInto('operation_logs')
      .values({
        source: `specialist.${params.specialist}`,
        operation: params.activity,
        level: params.level ?? 'info',
        order_id: params.orderId ?? null,
        task_uuid: params.taskUuid ?? null,
        details: JSON.stringify(detailsPayload),
      })
      .execute();
  }

  async getSpecialistActivity(params: {
    specialist: string
    identifier?: string
    limit?: number
  }): Promise<Array<{
    timestamp: string
    activity: string
    level: string
    details: Record<string, unknown>
  }>> {
    const limit = params.limit ?? 25;

    const rows = await this.db
      .selectFrom('operation_logs')
      .select(['operation_logs.operation as activity', 'operation_logs.level as level', 'operation_logs.details as details', 'operation_logs.created_at as createdAt'])
      .where('operation_logs.source', '=', `specialist.${params.specialist}`)
      .orderBy('operation_logs.created_at', 'desc')
      .limit(limit)
      .execute();

    return rows
      .map((row) => {
        let parsed: Record<string, unknown> = {};
        if (row.details) {
          try {
            parsed = JSON.parse(row.details as unknown as string) as Record<string, unknown>;
          } catch (error) {
            parsed = { raw: row.details };
          }
        }

        if (params.identifier && parsed.identifier !== params.identifier) {
          return null;
        }

        const createdAt = (row as Record<string, unknown>).createdAt;
        let timestamp: string;
        if (typeof createdAt === 'number') {
          timestamp = new Date(createdAt).toISOString();
        } else if (typeof createdAt === 'string') {
          timestamp = new Date(createdAt).toISOString();
        } else {
          timestamp = new Date().toISOString();
        }

        const activity = (row as Record<string, unknown>).activity;
        const level = (row as Record<string, unknown>).level;

        return {
          timestamp,
          activity: typeof activity === 'string' && activity.length > 0 ? activity : 'unknown',
          level: typeof level === 'string' && level.length > 0 ? level : 'info',
          details: parsed,
        };
      })
      .filter((entry): entry is { timestamp: string; activity: string; level: string; details: Record<string, unknown> } => entry !== null);
  }
}
