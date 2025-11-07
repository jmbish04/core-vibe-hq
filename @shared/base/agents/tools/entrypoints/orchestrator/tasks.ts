/**
 * @shared/base/agents/tools/entrypoints/orchestrator/tasks.ts
 * 
 * Tool for interacting with Tasks orchestrator entrypoint
 * Provides methods for task and order operations:
 * - createOrder: Create a new order with tasks
 * - getTasksForOrder: Get all tasks for an order
 * - getTask: Get a single task by UUID
 * - updateTaskStatus: Update task status
 * - getTaskHelp: Get AI-powered help for a task
 */

import { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

export interface TaskInstructionFile {
    file_path: string
    instructions: Record<string, string>
}

export interface CreateOrderParams {
    factory: string
    files: TaskInstructionFile[]
}

export interface CreateOrderResponse {
    order_id: string
}

export interface GetTasksForOrderParams {
    orderId: string
}

export interface TasksForOrderResponse {
    order_id: string
    tasks: Array<{
        uuid: string
        order_id: string
        file_path: string
        placeholder: string
        instruction: string
        status: string
        created_at: string
        updated_at: string
    }>
}

export interface GetTaskParams {
    uuid: string
}

export interface TaskResponse {
    uuid: string
    order_id: string
    file_path: string
    placeholder: string
    instruction: string
    status: string
    created_at: string
    updated_at: string
}

export interface UpdateTaskStatusParams {
    uuid: string
    status: string
}

export interface UpdateTaskStatusResponse {
    uuid: string
    status: string
}

export interface GetTaskHelpParams {
    uuid: string
    agent_name: string
    question: string
    error?: string
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

export class Tasks extends BaseTool {
    constructor(env: CoreEnv | BaseEnv, context: ToolContext = {}) {
        super(env, 'ORCHESTRATOR_TASKS', 'Tasks', context)
    }

    /**
     * Create a new order with tasks
     */
    async createOrder(params: CreateOrderParams): Promise<ToolResult<CreateOrderResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['factory', 'files'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<CreateOrderResponse>('createOrder', params as unknown as Record<string, unknown>)
        this.logToolExecution('createOrder', params, result)
        return result
    }

    /**
     * Get all tasks for an order
     */
    async getTasksForOrder(params: GetTasksForOrderParams): Promise<ToolResult<TasksForOrderResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['orderId'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<TasksForOrderResponse>('getTasksForOrder', params as unknown as Record<string, unknown>)
        this.logToolExecution('getTasksForOrder', params, result)
        return result
    }

    /**
     * Get a single task by UUID
     */
    async getTask(params: GetTaskParams): Promise<ToolResult<TaskResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['uuid'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<TaskResponse>('getTask', params as unknown as Record<string, unknown>)
        this.logToolExecution('getTask', params, result)
        return result
    }

    /**
     * Update task status
     */
    async updateTaskStatus(params: UpdateTaskStatusParams): Promise<ToolResult<UpdateTaskStatusResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['uuid', 'status'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<UpdateTaskStatusResponse>('updateTaskStatus', params as unknown as Record<string, unknown>)
        this.logToolExecution('updateTaskStatus', params, result)
        return result
    }

    /**
     * Get AI-powered help for a task
     */
    async getTaskHelp(params: GetTaskHelpParams): Promise<ToolResult<TaskHelpResponse>> {
        const validation = this.validateParams(params as unknown as Record<string, unknown>, ['uuid', 'agent_name', 'question'])
        if (!validation.valid) {
            return {
                success: false,
                error: `Missing required parameters: ${validation.missing.join(', ')}`,
            }
        }

        const result = await this.executeRpc<TaskHelpResponse>('getTaskHelp', params as unknown as Record<string, unknown>)
        this.logToolExecution('getTaskHelp', params, result)
        return result
    }
}

