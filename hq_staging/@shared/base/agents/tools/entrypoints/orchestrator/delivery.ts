/**
 * @shared/base/agents/tools/entrypoints/orchestrator/delivery.ts
 * 
 * Tool for interacting with Delivery orchestrator entrypoint
 * Provides methods for deployment operations:
 * - deployWorker: Deploy a new Cloudflare Worker
 * - deployPages: Deploy a Cloudflare Pages project
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface DeployWorkerParams {
    serviceName: string
    script: string
    bindings: Array<{ type: string; name: string; value: string }>
    orderId?: string
}

export interface DeployWorkerResponse {
    ok: boolean
    worker_url?: string
    error?: string
}

export interface DeployPagesParams {
    projectName: string
    commitHash: string
    orderId?: string
}

export interface DeployPagesResponse {
    ok: boolean
    pages_url?: string
    error?: string
}

export class Delivery extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_DELIVERY', 'Delivery', context)
    }

    /**
     * Deploy a new Cloudflare Worker
     */
    async deployWorker(params: DeployWorkerParams): Promise<ToolResult<DeployWorkerResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['serviceName', 'script', 'bindings'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<DeployWorkerResponse>('deployWorker', params as unknown as Record<string, unknown>)
        this.logToolExecution('deployWorker', params, result)
        return result
    }

    /**
     * Deploy a Cloudflare Pages project
     */
    async deployPages(params: DeployPagesParams): Promise<ToolResult<DeployPagesResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['projectName', 'commitHash'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<DeployPagesResponse>('deployPages', params as unknown as Record<string, unknown>)
        this.logToolExecution('deployPages', params, result)
        return result
    }
}

