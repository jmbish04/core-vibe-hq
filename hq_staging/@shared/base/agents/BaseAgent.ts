/**
 * @shared/base/agents/BaseAgent.ts
 * 
 * Base Agent Class - Shared across all workers
 * Provides common functionality for all agents:
 * - Logging to D1 and observability (via orchestrator for apps workers)
 * - Error handling
 * - Conversation tracking
 * - WebSocket communication
 * 
 * Usage:
 * - Orchestrator: Uses direct DB access (pass env with DB binding)
 * - Apps Workers: Uses ORCHESTRATOR_LOGGING service binding (pass env with ORCHESTRATOR_LOGGING binding)
 */

import type { CoreEnv, BaseEnv } from '@shared/types/env'

// Structured logger interface
export interface StructuredLogger {
    info: (message: string, data?: unknown) => void
    warn: (message: string, data?: unknown) => void
    error: (message: string, data?: unknown) => void
    debug: (message: string, data?: unknown) => void
}

export interface AgentContext {
    projectId?: string
    userId?: string
    sessionId?: string
    conversationId?: string
}

export interface AgentAction {
    action: string
    details: Record<string, unknown>
    timestamp: Date
}

/**
 * Base Agent class that works in both orchestrator and apps workers
 * 
 * For orchestrator: Uses direct database access via createDatabaseService
 * For apps workers: Uses ORCHESTRATOR_LOGGING service binding
 */
export abstract class BaseAgent {
    protected env: CoreEnv | BaseEnv
    protected logger: StructuredLogger
    protected context: AgentContext
    protected isOrchestrator: boolean

    constructor(env: CoreEnv | BaseEnv, logger: StructuredLogger, context: AgentContext = {}) {
        this.env = env
        this.logger = logger
        this.context = context
        // Check if we have direct DB access (orchestrator) or need to use service bindings
        this.isOrchestrator = 'DB' in env && env.DB !== undefined
    }

    /**
     * Log an action to D1 and observability
     * 
     * This method ensures logs are sent to BOTH destinations:
     * 1. D1 Database (operation_logs table):
     *    - Orchestrator: Direct DB access via logToDatabaseDirect()
     *    - Apps workers: Via ORCHESTRATOR_LOGGING service binding → LoggingOps.log()
     * 2. Observability (Cloudflare Workers observability):
     *    - Via StructuredLogger (typically console.* methods)
     *    - Automatically captured by Cloudflare when observability.enabled = true in wrangler.jsonc
     * 
     * For orchestrator: Uses direct DB access
     * For apps workers: Uses ORCHESTRATOR_LOGGING service binding
     */
    protected async logAction(
        operation: string,
        level: 'info' | 'warn' | 'error' | 'debug',
        details: Record<string, unknown> = {}
    ): Promise<void> {
        try {
            // Step 1: Log to D1 database (operation_logs table)
            if (this.isOrchestrator) {
                // Orchestrator: Direct DB access
                await this.logToDatabaseDirect(operation, level, details)
            } else {
                // Apps workers: Use orchestrator service binding
                await this.logToDatabaseViaOrchestrator(operation, level, details)
            }

            // Step 2: Log to observability (Cloudflare Workers observability)
            // The StructuredLogger typically uses console.* methods which are automatically
            // captured by Cloudflare's observability system when enabled in wrangler.jsonc
            const logMessage = `[${this.constructor.name}] ${operation}`
            switch (level) {
                case 'error':
                    this.logger.error(logMessage, details)
                    break
                case 'warn':
                    this.logger.warn(logMessage, details)
                    break
                case 'debug':
                    this.logger.debug(logMessage, details)
                    break
                default:
                    this.logger.info(logMessage, details)
            }
        } catch (error) {
            // Fallback to console if logging fails
            console.error(`[${this.constructor.name}] Failed to log action:`, error)
        }
    }

    /**
     * Log to database directly (orchestrator only)
     * This method is called only when isOrchestrator is true
     */
    private async logToDatabaseDirect(
        operation: string,
        level: 'info' | 'warn' | 'error' | 'debug',
        details: Record<string, unknown>
    ): Promise<void> {
        // Import orchestrator database modules only when needed
        // This avoids circular dependencies and allows BaseAgent to work in apps workers
        // Path from @shared/agents/base/ to orchestrator/worker/database/
        try {
            const orchestratorDbModule = await import('../../../orchestrator/worker/database/database')
            const orchestratorOpsSchema = await import('../../../orchestrator/worker/database/ops/schema')
            
            const db = orchestratorDbModule.createDatabaseService(this.env as any)
            await db.ops.insert(orchestratorOpsSchema.operationLogs).values({
                source: this.constructor.name,
                orderId: this.context.projectId ?? null,
                taskUuid: this.context.conversationId ?? null,
                operation,
                level,
                details: {
                    ...details,
                    context: this.context,
                    timestamp: new Date().toISOString(),
                },
            })
        } catch (error) {
            // If import fails (e.g., in apps workers), fall back to console
            console.warn(`[${this.constructor.name}] Could not import orchestrator database modules:`, error)
            console.log(`[${this.constructor.name}] ${operation}`, details)
        }
    }

    /**
     * Log to database via orchestrator service binding (apps workers)
     */
    private async logToDatabaseViaOrchestrator(
        operation: string,
        level: 'info' | 'warn' | 'error' | 'debug',
        details: Record<string, unknown>
    ): Promise<void> {
        // Check if ORCHESTRATOR_LOGGING binding is available
        const loggingBinding = (this.env as any).ORCHESTRATOR_LOGGING
        
        if (!loggingBinding) {
            console.warn(`[${this.constructor.name}] ORCHESTRATOR_LOGGING binding not available, skipping database log`)
            return
        }

        try {
            // Call orchestrator Logging.log() method via RPC
            await loggingBinding.log({
                source: this.constructor.name,
                operation,
                level: level === 'debug' ? 'info' : level, // Map debug to info for Logging
                details: {
                    ...details,
                    context: this.context,
                    timestamp: new Date().toISOString(),
                },
                order_id: this.context.projectId,
                task_uuid: this.context.conversationId,
            })
        } catch (error) {
            console.error(`[${this.constructor.name}] Failed to log via orchestrator:`, error)
            throw error
        }
    }

    /**
     * Execute an agent action with automatic logging
     */
    protected async executeWithLogging<T>(
        operation: string,
        action: () => Promise<T>
    ): Promise<T> {
        await this.logAction(operation, 'info', { status: 'started' })
        
        try {
            const result = await action()
            await this.logAction(operation, 'info', { status: 'completed' })
            return result
        } catch (error) {
            await this.logAction(operation, 'error', {
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
            })
            throw error
        }
    }

    /**
     * Send WebSocket update to frontend
     * Override in subclasses for specific message types
     * 
     * For orchestrator: May have direct WebSocket access via environment
     * For apps workers: Uses ORCHESTRATOR_WEBSOCKET service binding if available
     * Falls back to logging to operation_logs if WebSocket broadcasting is not available
     */
    protected async sendWebSocketUpdate(
        message: Record<string, unknown>
    ): Promise<void> {
        try {
            // Check if WebSocket broadcasting is available via service binding
            const websocketBinding = (this.env as any).ORCHESTRATOR_WEBSOCKET
            
            if (websocketBinding) {
                // Apps workers: Use orchestrator WebSocket service binding
                try {
                    await websocketBinding.broadcast({
                        type: 'server_log',
                        source: this.constructor.name,
                        message: message,
                        timestamp: new Date().toISOString(),
                        context: this.context,
                    })
                    await this.logAction('websocket_update', 'info', { message, method: 'service_binding' })
                    return
                } catch (error) {
                    console.warn(`[${this.constructor.name}] Failed to broadcast via service binding:`, error)
                    // Fall through to logging
                }
            }

            // Check if direct WebSocket broadcasting is available (orchestrator with WebSocket manager)
            const websocketManager = (this.env as any).WEBSOCKET_MANAGER
            if (websocketManager && typeof websocketManager.broadcast === 'function') {
                try {
                    websocketManager.broadcast({
                        type: 'server_log',
                        source: this.constructor.name,
                        message: message,
                        timestamp: new Date().toISOString(),
                        context: this.context,
                    })
                    await this.logAction('websocket_update', 'info', { message, method: 'direct' })
                    return
                } catch (error) {
                    console.warn(`[${this.constructor.name}] Failed to broadcast via WebSocket manager:`, error)
                    // Fall through to logging
                }
            }

            // Fallback: Log to operation_logs (always available)
            // This ensures the update is recorded even if WebSocket broadcasting isn't available
            await this.logAction('websocket_update', 'info', { 
                message, 
                method: 'fallback_logging',
                note: 'WebSocket broadcasting not available, logged to operation_logs instead'
            })
        } catch (error) {
            // Final fallback: Just log to console
            console.error(`[${this.constructor.name}] Failed to send WebSocket update:`, error)
            await this.logAction('websocket_update', 'error', { 
                message, 
                error: error instanceof Error ? error.message : String(error)
            })
        }
    }

    /**
     * Abstract method: Execute agent logic
     */
    abstract execute(input: unknown): Promise<unknown>
}
