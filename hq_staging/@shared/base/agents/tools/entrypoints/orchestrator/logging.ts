/**
 * @shared/base/agents/tools/entrypoints/orchestrator/logging.ts
 * 
 * Tool for interacting with Logging orchestrator entrypoint
 * Provides methods for logging operations:
 * - log: Generic fire-and-forget log sink
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface LogParams {
    source: string
    operation: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
    details?: object
    order_id?: string
    task_uuid?: string
}

export interface LogResponse {
    ok: boolean
    error?: string
}

export class Logging extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_LOGGING', 'Logging', context)
    }

    /**
     * Log a message to the operation_logs table
     */
    async log(params: LogParams): Promise<ToolResult<LogResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['source', 'operation', 'level'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<LogResponse>('log', params as unknown as Record<string, unknown>)
        this.logToolExecution('log', params, result)
        return result
    }
}

