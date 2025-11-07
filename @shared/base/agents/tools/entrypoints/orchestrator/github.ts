/**
 * @shared/base/agents/tools/entrypoints/orchestrator/github.ts
 * 
 * Tool for interacting with GitHub orchestrator entrypoint
 * Provides methods for GitHub operations:
 * - upsertFile: Create or update files in GitHub repository
 * - openPR: Open a pull request
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface UpsertFileParams {
    path: string
    content: string
    message: string
    sha?: string
    branch?: string
    order_id?: string
    task_uuid?: string
}

export interface UpsertFileResponse {
    ok: boolean
    sha?: string
    error?: string
}

export interface OpenPRParams {
    head: string
    base: string
    title: string
    body?: string
    order_id?: string
    task_uuid?: string
}

export interface OpenPRResponse {
    ok: boolean
    pr_number?: number
    url?: string
    error?: string
}

export class GitHub extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_GITHUB', 'GitHub', context)
    }

    /**
     * Upsert a file in the GitHub repository
     */
    async upsertFile(params: UpsertFileParams): Promise<ToolResult<UpsertFileResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['path', 'content', 'message'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<UpsertFileResponse>('upsertFile', params as unknown as Record<string, unknown>)
        this.logToolExecution('upsertFile', params, result)
        return result
    }

    /**
     * Open a pull request
     */
    async openPR(params: OpenPRParams): Promise<ToolResult<OpenPRResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['head', 'base', 'title'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<OpenPRResponse>('openPR', params as unknown as Record<string, unknown>)
        this.logToolExecution('openPR', params, result)
        return result
    }
}

