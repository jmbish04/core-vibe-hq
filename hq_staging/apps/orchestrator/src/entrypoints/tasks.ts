/**
 * orchestrator/worker/entrypoints/tasks.ts
 * ------------------------------------------------------------
 * Manages the core business logic for orders and tasks. This
 * class handles creation, retrieval, status updates, and the
 * AI-powered "help" feature. It's the primary interface for
 * task-related data, interacting directly with D1 and the
 * Cloudflare Docs AI binding.
 *
 * Responsibilities:
 * - Create new `orders` and batch-create associated `tasks`.
 * - Retrieve task lists by `order_id` for factories.
 * - Get single task details by `uuid`.
 * - Update the `status` of a specific task.
 * - Provide AI-powered help for a task via the `/help` flow.
 * - Log all task operations to the `operation_logs` table.
 * ------------------------------------------------------------
 * (Kysely-enabled)
 */


import { nanoid } from 'nanoid'
import { Selectable } from 'kysely'
import type { CoreEnv } from '@shared/types/env'
import { TasksTable } from '@shared/types/db'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import {
  CreateOrderResponse,
  TasksForOrderResponse,
  TaskHelpResponse,
  UpdateTaskStatusResponse
} from './types'

interface TaskInstructionFile {
  file_path: string
  instructions: Record<string, string>
}

export class Tasks extends BaseWorkerEntrypoint<CoreEnv> {

  async createOrder(params: {
    factory: string
    files: TaskInstructionFile[]
  }): Promise<CreateOrderResponse> {
    const { factory, files } = params
    const orderId = `ORD-${nanoid(6)}`

    // Kysely uses a transaction
    await this.db.transaction().execute(async (trx) => {
      // 1. Insert Order
      await trx
        .insertInto('orders')
        .values({ id: orderId, factory })
        .execute()

      // 2. Prepare Task insertions
      let tasksCreated = 0
      const tasksToInsert = []
      for (const file of files) {
        for (const [placeholder, instruction] of Object.entries(file.instructions)) {
          tasksToInsert.push({
            uuid: nanoid(6).toUpperCase(),
            order_id: orderId,
            file_path: file.file_path,
            placeholder: placeholder,
            instruction: instruction,
          })
          tasksCreated++
        }
      }

      // 3. Batch Insert Tasks
      if (tasksToInsert.length > 0) {
        await trx
          .insertInto('tasks')
          .values(tasksToInsert)
          .execute()
      }

      // 4. Log operation
      await trx
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'task.createOrder',
          level: 'info',
          details: JSON.stringify({ factory, tasks_created: tasksCreated }),
          order_id: orderId,
        })
        .execute()
    })

    return { order_id: orderId }
  }

  async getTasksForOrder(params: { orderId: string }): Promise<TasksForOrderResponse> {
    const { orderId } = params
    
    // Kysely query
    const tasks = await this.db
      .selectFrom('tasks')
      .selectAll()
      .where('order_id', '=', orderId)
      .execute()

    return { order_id: orderId, tasks: tasks }
  }

  async getTask(params: { uuid: string }): Promise<Selectable<TasksTable>> {
    const { uuid } = params
    
    // Kysely query
    const task = await this.db
      .selectFrom('tasks')
      .selectAll()
      .where('uuid', '=', uuid)
      .executeTakeFirst() // Replaces .first()

    if (!task) {
      throw new Error(`Task not found: ${uuid}`)
    }
    return task
  }

  async updateTaskStatus(params: {
    uuid: string
    status: string
  }): Promise<UpdateTaskStatusResponse> {
    const { uuid, status } = params
    
    // Kysely query
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('tasks')
        .set({ status: status })
        .where('uuid', '=', uuid)
        .execute()

      await trx
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.rpc',
          operation: 'task.updateStatus',
          level: 'info',
          details: JSON.stringify({ status }),
          task_uuid: uuid,
        })
        .execute()
    })

    return { uuid, status }
  }

  async getTaskHelp(params: {
    uuid: string
    agent_name: string
    question: string
    error?: string
  }): Promise<TaskHelpResponse> {
    const { uuid, agent_name, question, error } = params
    
    const task = await this.getTask({ uuid }) // Uses Kysely query above

    const { results } = await this.env.cloudflare_docs.search({
      queries: [
        `+${(task as any).instruction} Cloudflare Workers ${question || ''} ${error || ''} --QDF=2`,
        `Cloudflare D1 ${question || ''}`,
        `Cloudflare AI Gateway ${question || ''}`,
        `Workers KV ${question || ''}`
      ]
    })
    const top = results?.[0]?.content?.slice(0, 400) || 'No relevant docs found.'

    const response = {
      uuid,
      agent_name,
      question,
      error,
      original_instruction: task.instruction,
      ai_guidance: top,
      summary: `Agent ${agent_name} asked about task ${uuid}. ...`,
    }

    // Kysely query
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.rpc',
        operation: 'task.getHelp',
        level: 'info',
        details: JSON.stringify({ question, error, agent: agent_name }),
        task_uuid: uuid,
      })
      .execute()

    return response
  }
}