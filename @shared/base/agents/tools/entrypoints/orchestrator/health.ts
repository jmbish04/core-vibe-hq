/**
 * @shared/base/agents/tools/entrypoints/orchestrator/health.ts
 * 
 * Tool for interacting with Health orchestrator entrypoint
 * Provides methods for health check operations:
 * - initiateHealthCheck: Start a new health check
 * - getHealthCheckStatus: Get status and results of a health check
 * - getHealthCheckHistory: Get history of health checks
 * - receiveHealthCheckResult: Receive results from a worker (internal)
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface InitiateHealthCheckParams {
    trigger_type: 'on_demand' | 'cron'
    trigger_source?: string
    timeout_minutes?: number
    include_unit_tests?: boolean
    include_performance_tests?: boolean
    include_integration_tests?: boolean
    worker_filters?: string[]
}

export interface HealthCheckResponse {
    health_check_uuid: string
    status: string
    total_workers: number
    message: string
}

export interface GetHealthCheckStatusParams {
    healthCheckUuid: string
}

export interface WorkerHealthCheckResult {
    worker_check_uuid: string
    overall_status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
    health_score: number
    uptime_seconds?: number
    memory_usage_mb?: number
    cpu_usage_percent?: number
    response_time_ms?: number
    orchestrator_connectivity: boolean
    external_api_connectivity: boolean
    database_connectivity: boolean
    unit_test_results?: TestResult[]
    performance_test_results?: TestResult[]
    integration_test_results?: TestResult[]
    error_message?: string
    warnings?: string[]
    raw_results?: any
}

export interface TestResult {
    name: string
    status: 'passed' | 'failed' | 'skipped'
    duration_ms: number
    error?: string
    details?: any
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
    worker_results: Array<{
        worker_check_uuid: string
        worker_name: string
        worker_type: string
        status: string
        overall_status: string | null
        health_score: number | null
        error_message: string | null
        created_at: string
        completed_at: string | null
    }>
}

export interface GetHealthCheckHistoryParams {
    page?: number
    limit?: number
    triggerType?: string
}

export interface HealthCheckHistoryResponse {
    health_checks: Array<{
        id: number
        health_check_uuid: string
        trigger_type: string
        trigger_source: string | null
        status: string
        total_workers: number
        completed_workers: number
        passed_workers: number
        failed_workers: number
        overall_health_score: number | null
        ai_analysis: string | null
        ai_recommendations: string | null
        created_at: string
        completed_at: string | null
        timeout_at: string
    }>
    total_count: number
    page: number
    limit: number
}

export interface ReceiveHealthCheckResultParams {
    workerCheckUuid: string
    results: WorkerHealthCheckResult
}

export interface ReceiveHealthCheckResultResponse {
    success: boolean
    message: string
}

export class Health extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_HEALTH_CHECK', 'Health', context)
    }

    /**
     * Initiate a new health check across all or specified workers
     */
    async initiateHealthCheck(
        params: InitiateHealthCheckParams
    ): Promise<ToolResult<HealthCheckResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['trigger_type'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<HealthCheckResponse>('initiateHealthCheck', params as unknown as Record<string, unknown>)
        this.logToolExecution('initiateHealthCheck', params, result)
        return result
    }

    /**
     * Get health check status and results
     */
    async getHealthCheckStatus(
        params: GetHealthCheckStatusParams
    ): Promise<ToolResult<HealthCheckStatusResponse | null>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['healthCheckUuid'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<HealthCheckStatusResponse | null>(
            'getHealthCheckStatus',
            params as unknown as Record<string, unknown>
        )
        this.logToolExecution('getHealthCheckStatus', params, result)
        return result
    }

    /**
     * Get health check history with pagination
     */
    async getHealthCheckHistory(
        params?: GetHealthCheckHistoryParams
    ): Promise<ToolResult<HealthCheckHistoryResponse>> {
        const result = await this.executeRpc<HealthCheckHistoryResponse>(
            'getHealthCheckHistory',
            (params || {}) as unknown as Record<string, unknown>
        )
        this.logToolExecution('getHealthCheckHistory', params || {}, result)
        return result
    }

    /**
     * Receive health check results from a worker (typically called by workers, not directly)
     */
    async receiveHealthCheckResult(
        params: ReceiveHealthCheckResultParams
    ): Promise<ToolResult<ReceiveHealthCheckResultResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['workerCheckUuid', 'results'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<ReceiveHealthCheckResultResponse>(
            'receiveHealthCheckResult',
            params as unknown as Record<string, unknown>
        )
        this.logToolExecution('receiveHealthCheckResult', params, result)
        return result
    }
}

