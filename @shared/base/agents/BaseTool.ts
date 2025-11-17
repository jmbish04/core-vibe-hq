/**
 * @shared/base/agents/BaseTool.ts
 * 
 * Base Tool Class - Shared across all workers
 * Provides common functionality for tools that interact with orchestrator entrypoints:
 * - Type-safe RPC method calls
 * - Error handling and retries
 * - Logging
 * - Parameter validation
 * 
 * Usage:
 * - Tools extend BaseTool and implement specific orchestrator entrypoint methods
 * - Tools can be used by agents to interact with orchestrator services
 * - Works in both orchestrator (direct access) and apps workers (via service bindings)
 */

import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface ToolResult<T = unknown> {
    success: boolean
    data?: T
    error?: string
    metadata?: Record<string, unknown>
}

export interface ToolContext {
    projectId?: string
    userId?: string
    sessionId?: string
    conversationId?: string
}

/**
 * Base Tool class that provides common functionality for orchestrator entrypoint tools
 * 
 * Tools are wrappers around orchestrator RPC entrypoints that provide:
 * - Type-safe method calls
 * - Error handling
 * - Retry logic
 * - Parameter validation
 * - Logging
 */
export abstract class BaseTool {
    protected env: CoreEnv | BaseEnv
    protected context: ToolContext
    protected bindingName: string
    protected entrypointName: string

    constructor(
        env: CoreEnv | BaseEnv,
        bindingName: string,
        entrypointName: string,
        context: ToolContext = {}
    ) {
        this.env = env
        this.bindingName = bindingName
        this.entrypointName = entrypointName
        this.context = context
    }

    /**
     * Get the orchestrator entrypoint binding
     * For apps workers: Uses service binding (e.g., ORCHESTRATOR_GITHUB)
     * For orchestrator: May have direct access or use self-binding
     */
    protected getEntrypoint(): any {
        const binding = (this.env as any)[this.bindingName]
        
        if (!binding) {
            throw new Error(
                `Entrypoint binding '${this.bindingName}' not found. ` +
                `Ensure the service binding is configured in wrangler.jsonc`
            )
        }

        return binding
    }

    /**
     * Execute an RPC method call with error handling and retries
     */
    protected async executeRpc<T>(
        methodName: string,
        params: Record<string, unknown> = {},
        options: {
            retries?: number
            retryDelay?: number
            timeout?: number
        } = {}
    ): Promise<ToolResult<T>> {
        const { retries = 3, retryDelay = 1000, timeout = 30000 } = options

        let lastError: Error | null = null

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const entrypoint = this.getEntrypoint()
                
                if (!entrypoint[methodName]) {
                    throw new Error(
                        `Method '${methodName}' not found on entrypoint '${this.entrypointName}'`
                    )
                }

                // Add context to params if available
                // Cast params to Record<string, unknown> to allow any object type
                const enrichedParams: Record<string, unknown> = {
                    ...(params as Record<string, unknown>),
                    ...(this.context.projectId && { order_id: this.context.projectId }),
                    ...(this.context.conversationId && { task_uuid: this.context.conversationId }),
                }

                // Execute with timeout
                const result = await Promise.race([
                    entrypoint[methodName](enrichedParams),
                    new Promise<T>((_, reject) =>
                        setTimeout(() => reject(new Error('RPC call timeout')), timeout)
                    ),
                ])

                return {
                    success: true,
                    data: result,
                    metadata: {
                        attempt: attempt + 1,
                        method: methodName,
                        entrypoint: this.entrypointName,
                    },
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                // Don't retry on certain errors
                if (
                    lastError.message.includes('not found') ||
                    lastError.message.includes('not configured') ||
                    attempt === retries
                ) {
                    break
                }

                // Wait before retry
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
                }
            }
        }

        return {
            success: false,
            error: lastError?.message || 'Unknown error',
            metadata: {
                attempts: retries + 1,
                method: methodName,
                entrypoint: this.entrypointName,
            },
        }
    }

    /**
     * Validate required parameters
     */
    protected validateParams<P extends Record<string, unknown>>(
        params: P,
        required: string[]
    ): { valid: boolean; missing: string[] } {
        const missing = required.filter((key) => !(key in params) || params[key as keyof P] === undefined)

        return {
            valid: missing.length === 0,
            missing,
        }
    }

    /**
     * Log tool execution (for debugging/monitoring)
     */
    protected logToolExecution(
        methodName: string,
        params: Record<string, unknown> | Record<string, any>,
        result: ToolResult
    ): void {
        if (result.success) {
            console.debug(
                `[${this.constructor.name}] ${methodName} succeeded`,
                {
                    params: this.sanitizeParams(params),
                    metadata: result.metadata,
                }
            )
        } else {
            console.error(
                `[${this.constructor.name}] ${methodName} failed`,
                {
                    params: this.sanitizeParams(params),
                    error: result.error,
                    metadata: result.metadata,
                }
            )
        }
    }

    /**
     * Sanitize parameters for logging (remove sensitive data)
     */
    protected sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
        const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'auth']
        const sanitized = { ...params }

        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '***REDACTED***'
            }
        }

        return sanitized
    }

    /**
     * Set tool context (for adding project/session info to calls)
     */
    setContext(context: ToolContext): void {
        this.context = { ...this.context, ...context }
    }

    /**
     * Get current tool context
     */
    getContext(): ToolContext {
        return { ...this.context }
    }
}

