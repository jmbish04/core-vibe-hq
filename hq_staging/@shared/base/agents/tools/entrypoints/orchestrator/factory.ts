/**
 * @shared/base/agents/tools/entrypoints/orchestrator/factory.ts
 * 
 * Tool for interacting with Factory orchestrator entrypoint
 * Provides methods for factory error reporting and remediation:
 * - reportAndRemediateErrors: Report factory errors and attempt remediation
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface FactoryErrorItem {
    order_id?: string
    factory: string
    file_path: string
    placeholder?: string
    task_uuid?: string
    error_code: 'FILE_NOT_FOUND' | 'PLACEHOLDER_NOT_FOUND' | 'INJECT_FAILED' | 'UNKNOWN'
    message: string
    context?: any
}

export interface ReportAndRemediateErrorsParams {
    errors: FactoryErrorItem[]
}

export interface RemediationResult {
    task_uuid?: string
    ok: boolean
    action: 'none' | 'blocked' | 'remediated' | 'error'
    note: string
}

export interface RemediationReportResponse {
    ok: boolean
    remediation: RemediationResult[]
}

export class Factory extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_FACTORY', 'Factory', context)
    }

    /**
     * Report factory errors and attempt remediation
     */
    async reportAndRemediateErrors(
        params: ReportAndRemediateErrorsParams
    ): Promise<ToolResult<RemediationReportResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['errors'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        if (!Array.isArray(params.errors) || params.errors.length === 0) {
            return {
                success: false,
                error: 'errors must be a non-empty array',
            }
        }

        const result = await this.executeRpc<RemediationReportResponse>(
            'reportAndRemediateErrors',
            params as unknown as Record<string, unknown>
        )
        this.logToolExecution('reportAndRemediateErrors', params, result)
        return result
    }
}

