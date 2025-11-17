/**
 * AI Provider Clarification Agent
 * 
 * Orchestrator agent that handles clarification requests from AI providers
 * (e.g., codex-cli) during code generation.
 * 
 * Responsibilities:
 * - Receives questions from AI providers
 * - Looks up order, template files, placeholder maps from D1
 * - Uses AI to analyze question vs order requirements
 * - Returns clarification response
 * - Logs conversation to ai_provider_conversations table
 * - Evaluates complexity and triggers HIL if needed
 */

import { BaseAgent, type AgentContext, type StructuredLogger } from '@shared/base/agents/BaseAgent'
import { createDatabaseService } from '../database/database'
import { 
  aiProviderConversations, 
  hilRequests, 
  orderPlaceholderMappings,
  templateFiles,
  templatePlaceholders 
} from '../database/ops/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Env } from '../types'

export interface ClarificationRequest {
  order_id: string
  provider_name: string
  question: string
  context?: Record<string, unknown>
}

export interface ClarificationResponse {
  ok: boolean
  response?: string
  solution?: string
  hil_triggered?: boolean
  hil_request_id?: number
  error?: string
}

export interface ComplexityEvaluation {
  needs_hil: boolean
  confidence: number
  complexity_score: number
  reason?: string
}

export class AiProviderClarificationAgent extends BaseAgent {
  // Orchestrator-specific: Direct database access
  private db: ReturnType<typeof createDatabaseService>

  // Complexity thresholds
  private readonly COMPLEXITY_THRESHOLD = 8 // 1-10 scale
  private readonly CONFIDENCE_THRESHOLD = 0.7 // 0-1 scale
  private readonly MAX_UNRESOLVED_QUESTIONS = 3

  constructor(env: Env, logger: StructuredLogger, context: AgentContext = {}) {
    super(env, logger, context)
    // Initialize database service for orchestrator-specific queries
    this.db = createDatabaseService(env)
  }

  /**
   * Handle clarification request from AI provider
   * 
   * This method:
   * 1. Receives question from codex-cli (or other AI provider)
   * 2. Looks up order, template files, placeholder maps from D1
   * 3. Uses AI to analyze question vs order requirements
   * 4. Returns clarification response
   * 5. Logs conversation to ai_provider_conversations table
   */
  async handleClarificationRequest(params: ClarificationRequest): Promise<ClarificationResponse> {
    await this.logAction('handle_clarification_request', 'info', {
      order_id: params.order_id,
      provider_name: params.provider_name,
    })

    try {
      const { order_id, provider_name, question, context } = params
      const conversationId = nanoid(12)

      // Step 1: Look up order placeholder mappings
      const orderMappings = await this.db.ops
        .select()
        .from(orderPlaceholderMappings)
        .where(eq(orderPlaceholderMappings.orderId, order_id))
        .execute()

      if (orderMappings.length === 0) {
        return {
          ok: false,
          error: `No placeholder mappings found for order: ${order_id}`,
        }
      }

      // Step 2: Get template file and placeholder context
      const templateFileIds = [...new Set(orderMappings.map(m => m.templateFileId))]
      const templateFilesList = await this.db.ops
        .select()
        .from(templateFiles)
        .where(
          and(
            eq(templateFiles.id, templateFileIds[0]), // Simplified - would need IN query for multiple
            eq(templateFiles.isActive, true)
          )
        )
        .execute()

      // Step 3: Use AI to analyze question vs order requirements
      const aiResponse = await this.analyzeQuestion(question, orderMappings, templateFilesList, context)

      // Step 4: Evaluate complexity to determine if HIL needed
      const complexityEval = await this.evaluateComplexity({
        question,
        response: aiResponse,
        order_id,
        conversation_id: conversationId,
        unresolved_questions_count: 0, // Would be calculated from conversation history
      })

      // Step 5: Log conversation to ai_provider_conversations
      await this.db.ops
        .insert(aiProviderConversations)
        .values({
          orderId: order_id,
          conversationId,
          providerName: provider_name,
          question,
          response: aiResponse,
          status: complexityEval.needs_hil ? 'escalated' : 'resolved',
          hilTriggered: complexityEval.needs_hil,
        })
        .execute()

      // Step 6: Trigger HIL if needed
      let hilRequestId: number | undefined
      if (complexityEval.needs_hil) {
        const hilRequest = await this.triggerHIL(order_id, conversationId, question, {
          order_mappings: orderMappings,
          template_files: templateFilesList,
          complexity_eval: complexityEval,
          ...context,
        })
        hilRequestId = hilRequest.id
      }

      await this.logAction('handle_clarification_request', 'info', {
        order_id,
        conversation_id: conversationId,
        hil_triggered: complexityEval.needs_hil,
      })

      return {
        ok: true,
        response: aiResponse,
        solution: complexityEval.needs_hil ? undefined : aiResponse,
        hil_triggered: complexityEval.needs_hil,
        hil_request_id: hilRequestId,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.logAction('handle_clarification_request', 'error', {
        order_id: params.order_id,
        error: errorMessage,
      })

      return {
        ok: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Analyze question using AI
   * 
   * Placeholder implementation - would use AI binding in production
   */
  private async analyzeQuestion(
    question: string,
    orderMappings: any[],
    templateFiles: any[],
    context?: Record<string, unknown>
  ): Promise<string> {
    // Placeholder implementation - would use AI binding
    // For now, return a basic response
    const placeholderContext = orderMappings
      .map(m => `${m.placeholderId}: ${m.miniPrompt}`)
      .join('\n')

    return `Based on the order requirements and placeholder context:\n${placeholderContext}\n\nQuestion: ${question}\n\nResponse: Please refer to the mini-prompts associated with each placeholder in the order.`
  }

  /**
   * Evaluate complexity to determine if HIL is needed
   * 
   * Threshold logic:
   * - Number of unresolved questions > MAX_UNRESOLVED_QUESTIONS
   * - Confidence < CONFIDENCE_THRESHOLD
   * - Complexity score > COMPLEXITY_THRESHOLD
   */
  async evaluateComplexity(params: {
    question: string
    response: string
    order_id: string
    conversation_id: string
    unresolved_questions_count: number
  }): Promise<ComplexityEvaluation> {
    // Placeholder implementation - would use AI to evaluate complexity
    // For now, use simple heuristics

    const { question, unresolved_questions_count } = params

    // Simple complexity scoring based on question length and keywords
    let complexityScore = 5 // Default medium complexity
    if (question.length > 500) complexityScore += 2
    if (question.toLowerCase().includes('conflict') || question.toLowerCase().includes('contradict')) {
      complexityScore += 2
    }
    if (question.toLowerCase().includes('missing') || question.toLowerCase().includes('not found')) {
      complexityScore += 1
    }

    // Check thresholds
    const needsHil =
      unresolved_questions_count > this.MAX_UNRESOLVED_QUESTIONS ||
      complexityScore > this.COMPLEXITY_THRESHOLD

    // Confidence would be calculated by AI analysis
    const confidence = complexityScore > this.COMPLEXITY_THRESHOLD ? 0.5 : 0.9

    return {
      needs_hil: needsHil || confidence < this.CONFIDENCE_THRESHOLD,
      confidence,
      complexity_score: complexityScore,
      reason: needsHil
        ? `Complexity score ${complexityScore} exceeds threshold ${this.COMPLEXITY_THRESHOLD}`
        : undefined,
    }
  }

  /**
   * Trigger Human-in-the-Loop process
   */
  async triggerHIL(
    orderId: string,
    conversationId: string,
    question: string,
    context: Record<string, unknown>
  ): Promise<{ id: number }> {
    await this.logAction('trigger_hil', 'info', {
      order_id: orderId,
      conversation_id: conversationId,
    })

    // Insert HIL request
    const inserted = await this.db.ops
      .insert(hilRequests)
      .values({
        orderId,
        conversationId,
        question,
        context: JSON.stringify(context),
        status: 'pending',
      })
      .returning()
      .execute()

    // Update conversation status
    await this.db.ops
      .update(aiProviderConversations)
      .set({
        status: 'escalated',
        hilTriggered: true,
      })
      .where(eq(aiProviderConversations.conversationId, conversationId))
      .execute()

    return { id: inserted[0].id }
  }

  /**
   * Execute agent logic (required by BaseAgent)
   */
  async execute(input: unknown): Promise<unknown> {
    if (typeof input === 'object' && input !== null && 'order_id' in input && 'question' in input) {
      return this.handleClarificationRequest(input as ClarificationRequest)
    }
    throw new Error('Invalid input for AiProviderClarificationAgent.execute')
  }
}

