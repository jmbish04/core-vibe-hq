/**
 * Order Init Agent
 * 
 * Orchestrator agent responsible for initiating factory orders.
 * 
 * Responsibilities:
 * - Validates template files exist in D1
 * - Retrieves placeholder mappings from template_placeholders table
 * - Generates mini-prompts for each placeholder using AI
 * - Creates order record and order_placeholder_mappings entries
 * - Returns validated order with placeholder payload JSON
 */

import { BaseAgent, type AgentContext, type StructuredLogger } from '@shared/base/agents/BaseAgent'
import { validateOrder, type Order, type PlaceholderPayload } from '@shared/types/orders'
import { createDatabaseService } from '../database/database'
import { templateFiles, templatePlaceholders, orderPlaceholderMappings } from '../database/ops/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Env } from '../types'

export interface InitiateOrderParams {
  factory: string
  templateName: string
  projectId?: string
  overallPrompt?: string
  aiProvider?: string
  metadata?: Record<string, unknown>
}

export interface InitiateOrderResponse {
  ok: boolean
  order?: Order
  error?: string
}

export class OrderInitAgent extends BaseAgent {
  // Orchestrator-specific: Direct database access
  private db: ReturnType<typeof createDatabaseService>

  constructor(env: Env, logger: StructuredLogger, context: AgentContext = {}) {
    super(env, logger, context)
    // Initialize database service for orchestrator-specific queries
    this.db = createDatabaseService(env)
  }

  /**
   * Initiate a new order with placeholder mappings
   * 
   * This method:
   * 1. Validates template files exist in D1
   * 2. Retrieves placeholder mappings from template_placeholders table
   * 3. Generates mini-prompts for each placeholder using AI
   * 4. Creates order record and order_placeholder_mappings entries
   * 5. Returns validated order with placeholder payload JSON
   */
  async initiateOrder(params: InitiateOrderParams): Promise<InitiateOrderResponse> {
    await this.logAction('initiate_order', 'info', { factory: params.factory, templateName: params.templateName })

    try {
      const { factory, templateName, projectId, overallPrompt, aiProvider, metadata } = params

      // Step 1: Validate template files exist in D1
      const templateFilesList = await this.db.ops
        .select()
        .from(templateFiles)
        .where(
          and(
            eq(templateFiles.factoryName, factory),
            eq(templateFiles.templateName, templateName),
            eq(templateFiles.isActive, true)
          )
        )
        .execute()

      if (templateFilesList.length === 0) {
        return {
          ok: false,
          error: `No active template files found for factory: ${factory}, template: ${templateName}`,
        }
      }

      // Step 2: Retrieve placeholder mappings for each template file
      const placeholderPayload: PlaceholderPayload = {}

      for (const templateFile of templateFilesList) {
        const placeholders = await this.db.ops
          .select()
          .from(templatePlaceholders)
          .where(
            and(
              eq(templatePlaceholders.templateFileId, templateFile.id),
              eq(templatePlaceholders.isActive, true)
            )
          )
          .execute()

        for (const placeholder of placeholders) {
          // Step 3: Generate mini-prompt using AI (or use default if available)
          let miniPrompt = placeholder.miniPrompt

          if (!miniPrompt && overallPrompt) {
            // Generate mini-prompt using AI based on overall prompt and placeholder context
            miniPrompt = await this.generateMiniPrompt(placeholder.placeholderId, overallPrompt, templateFile.filePath)
          }

          if (!miniPrompt) {
            miniPrompt = `Implement ${placeholder.placeholderId} based on order requirements`
          }

          // Add to placeholder payload
          placeholderPayload[placeholder.placeholderId] = {
            mini_prompt: miniPrompt,
            template_file_id: templateFile.id.toString(),
            placeholder_pattern: placeholder.placeholderPattern,
          }
        }
      }

      // Step 4: Create order ID
      const orderId = `ORD-${nanoid(8)}`

      // Step 5: Create order record (assuming orders table exists - this would be in DB_PROJECTS or DB_OPS)
      // For now, we'll create the order_placeholder_mappings entries
      // The actual order record creation would be handled by the Tasks entrypoint or similar

      // Step 6: Create order_placeholder_mappings entries
      const mappingEntries = []
      for (const templateFile of templateFilesList) {
        const placeholders = await this.db.ops
          .select()
          .from(templatePlaceholders)
          .where(
            and(
              eq(templatePlaceholders.templateFileId, templateFile.id),
              eq(templatePlaceholders.isActive, true)
            )
          )
          .execute()

        for (const placeholder of placeholders) {
          const payloadEntry = placeholderPayload[placeholder.placeholderId]
          if (payloadEntry) {
            mappingEntries.push({
              orderId,
              projectId: projectId || null,
              templateFileId: templateFile.id,
              placeholderId: placeholder.placeholderId,
              miniPrompt: payloadEntry.mini_prompt,
            })
          }
        }
      }

      // Batch insert order_placeholder_mappings
      if (mappingEntries.length > 0) {
        await this.db.ops
          .insert(orderPlaceholderMappings)
          .values(mappingEntries)
          .execute()
      }

      // Step 7: Create validated order object
      const order: Order = {
        id: orderId,
        factory,
        template_name: templateName,
        project_id: projectId,
        overall_prompt: overallPrompt,
        placeholder_payload: placeholderPayload,
        ai_provider: aiProvider,
        description: overallPrompt || `Order for ${factory} using template ${templateName}`,
        metadata: metadata || {},
      }

      // Validate the order
      const validation = validateOrder(order)
      if (!validation.ok) {
        return {
          ok: false,
          error: `Order validation failed: ${validation.errors?.join(', ')}`,
        }
      }

      await this.logAction('initiate_order', 'info', {
        order_id: orderId,
        factory,
        template_name: templateName,
        placeholders_count: Object.keys(placeholderPayload).length,
      })

      return {
        ok: true,
        order: validation.order!,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.logAction('initiate_order', 'error', {
        factory: params.factory,
        template_name: params.templateName,
        error: errorMessage,
      })

      return {
        ok: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Generate a mini-prompt for a placeholder using AI
   * 
   * This is a placeholder implementation - in production, this would use
   * the AI binding to generate context-aware mini-prompts
   */
  private async generateMiniPrompt(
    placeholderId: string,
    overallPrompt: string,
    filePath: string
  ): Promise<string> {
    // Placeholder implementation - would use AI binding in production
    // For now, return a basic prompt
    return `Implement ${placeholderId} in ${filePath} based on: ${overallPrompt.substring(0, 100)}...`
  }

  /**
   * Execute agent logic (required by BaseAgent)
   */
  async execute(input: unknown): Promise<unknown> {
    if (typeof input === 'object' && input !== null && 'factory' in input) {
      return this.initiateOrder(input as InitiateOrderParams)
    }
    throw new Error('Invalid input for OrderInitAgent.execute')
  }
}

