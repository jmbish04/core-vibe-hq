/**
 * @shared/base/agents/tools/entrypoints/orchestrator/specialist.ts
 * 
 * Tool for interacting with Specialist orchestrator entrypoint
 * Provides methods for operations specialist tasks:
 * - Conflict resolution management
 * - Delivery report generation
 * - Ops order management
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface CreateConflictResolutionParams {
    repo: string
    pr_number: number
    base_branch: string
    head_branch: string
    decision_log?: string
    resolution_branch?: string
}

export interface ConflictResolutionResponse {
    id: number
    repo: string
    pr_number: number
    status: string
    created_at: string
}

export interface UpdateConflictResolutionParams {
    id: number
    files_resolved?: number
    conflicts_kept_both?: number
    conflicts_deleted?: number
    status?: string
    resolved_at?: string
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

export interface DeliveryReportResponse {
    id: number
    project_id: string
    status: string
    compliance_score: number
    created_at: string
}

export interface CreateOpsOrderParams {
    order_type: string
    order_payload: object
    assigned_specialist?: string
}

export interface OpsOrderResponse {
    id: number
    order_type: string
    status: string
    assigned_specialist: string | null
    created_at: string
}

export interface UpdateOpsOrderParams {
    id: number
    status?: string
    assigned_specialist?: string
    result?: object
    processed_at?: string
    completed_at?: string
}

export interface GetConflictResolutionsParams {
    repo: string
    pr_number?: number
}

export interface GetDeliveryReportsParams {
    project_id: string
}

export interface GetPendingOpsOrdersParams {
    order_type?: string
}

export class Specialist extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_OPS', 'Specialist', context)
    }

    /**
     * Create a conflict resolution record
     */
    async createConflictResolution(
        params: CreateConflictResolutionParams
    ): Promise<ToolResult<ConflictResolutionResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['repo', 'pr_number', 'base_branch', 'head_branch'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<ConflictResolutionResponse>(
            'createConflictResolution',
            params as unknown as Record<string, unknown>
        )
        this.logToolExecution('createConflictResolution', params, result)
        return result
    }

    /**
     * Update conflict resolution status
     */
    async updateConflictResolution(
        params: UpdateConflictResolutionParams
    ): Promise<ToolResult<void>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['id'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<void>('updateConflictResolution', params as unknown as Record<string, unknown>)
        this.logToolExecution('updateConflictResolution', params, result)
        return result
    }

    /**
     * Create a delivery report
     */
    async createDeliveryReport(
        params: CreateDeliveryReportParams
    ): Promise<ToolResult<DeliveryReportResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['project_id'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<DeliveryReportResponse>('createDeliveryReport', params as unknown as Record<string, unknown>)
        this.logToolExecution('createDeliveryReport', params, result)
        return result
    }

    /**
     * Create an ops order
     */
    async createOpsOrder(params: CreateOpsOrderParams): Promise<ToolResult<OpsOrderResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['order_type', 'order_payload'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<OpsOrderResponse>('createOpsOrder', params as unknown as Record<string, unknown>)
        this.logToolExecution('createOpsOrder', params, result)
        return result
    }

    /**
     * Update ops order status
     */
    async updateOpsOrder(params: UpdateOpsOrderParams): Promise<ToolResult<void>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['id'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<void>('updateOpsOrder', params as unknown as Record<string, unknown>)
        this.logToolExecution('updateOpsOrder', params, result)
        return result
    }

    /**
     * Get conflict resolutions
     */
    async getConflictResolutions(
        params: GetConflictResolutionsParams
    ): Promise<ToolResult<ConflictResolutionResponse[]>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['repo'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<ConflictResolutionResponse[]>(
            'getConflictResolutions',
            params as unknown as Record<string, unknown>
        )
        this.logToolExecution('getConflictResolutions', params, result)
        return result
    }

    /**
     * Get delivery reports
     */
    async getDeliveryReports(
        params: GetDeliveryReportsParams
    ): Promise<ToolResult<DeliveryReportResponse[]>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['project_id'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<DeliveryReportResponse[]>('getDeliveryReports', params as unknown as Record<string, unknown>)
        this.logToolExecution('getDeliveryReports', params, result)
        return result
    }

    /**
     * Get pending ops orders
     */
    async getPendingOpsOrders(
        params?: GetPendingOpsOrdersParams
    ): Promise<ToolResult<OpsOrderResponse[]>> {
        const result = await this.executeRpc<OpsOrderResponse[]>('getPendingOpsOrders', (params || {}) as unknown as Record<string, unknown>)
        this.logToolExecution('getPendingOpsOrders', params || {}, result)
        return result
    }
}

