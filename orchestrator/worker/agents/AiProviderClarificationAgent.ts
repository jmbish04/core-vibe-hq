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

import { BaseAgent, type AgentContext, type StructuredLogger } from '@shared/base/agents/BaseAgent';
import { createDatabaseService } from '../database/database';
import {
  aiProviderConversations,
  hilRequests,
  orderPlaceholderMappings,
  templateFiles,
} from '../database/ops/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Env } from '../types';

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
  private db: ReturnType<typeof createDatabaseService>;

  // Complexity thresholds
  private readonly COMPLEXITY_THRESHOLD = 8; // 1-10 scale
  private readonly CONFIDENCE_THRESHOLD = 0.7; // 0-1 scale
  private readonly MAX_UNRESOLVED_QUESTIONS = 3;

  constructor(env: Env, logger: StructuredLogger, context: AgentContext = {}) {
    super(env, logger, context);
    // Initialize database service for orchestrator-specific queries
    this.db = createDatabaseService(env);
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
    });

    try {
      const { order_id, provider_name, question, context } = params;
      const conversationId = nanoid(12);

      // Step 1: Look up order placeholder mappings
      const orderMappings = await this.db.ops
        .select()
        .from(orderPlaceholderMappings)
        .where(eq(orderPlaceholderMappings.orderId, order_id))
        .execute();

      if (orderMappings.length === 0) {
        return {
          ok: false,
          error: `No placeholder mappings found for order: ${order_id}`,
        };
      }

      // Step 2: Get template file and placeholder context
      const templateFileIds = [...new Set(orderMappings.map(m => m.templateFileId))];
      const templateFilesList = await this.db.ops
        .select()
        .from(templateFiles)
        .where(
          and(
            eq(templateFiles.id, templateFileIds[0]), // Simplified - would need IN query for multiple
            eq(templateFiles.isActive, true),
          ),
        )
        .execute();

      // Step 3: Use AI to analyze question vs order requirements
      const aiResponse = await this.analyzeQuestion(question, orderMappings, templateFilesList, context);

      // Step 4: Evaluate complexity to determine if HIL needed
      const complexityEval = await this.evaluateComplexity({
        question,
        response: aiResponse,
        order_id,
        conversation_id: conversationId,
        unresolved_questions_count: 0, // Would be calculated from conversation history
      });

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
        .execute();

      // Step 6: Trigger HIL if needed
      let hilRequestId: number | undefined;
      if (complexityEval.needs_hil) {
        const hilRequest = await this.triggerHIL(order_id, conversationId, question, {
          order_mappings: orderMappings,
          template_files: templateFilesList,
          complexity_eval: complexityEval,
          ...context,
        }, complexityEval);
        hilRequestId = hilRequest.id;
      }

      await this.logAction('handle_clarification_request', 'info', {
        order_id,
        conversation_id: conversationId,
        hil_triggered: complexityEval.needs_hil,
      });

      return {
        ok: true,
        response: aiResponse,
        solution: complexityEval.needs_hil ? undefined : aiResponse,
        hil_triggered: complexityEval.needs_hil,
        hil_request_id: hilRequestId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logAction('handle_clarification_request', 'error', {
        order_id: params.order_id,
        error: errorMessage,
      });

      return {
        ok: false,
        error: errorMessage,
      };
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
    _templateFiles: any[],
    _context?: Record<string, unknown>,
  ): Promise<string> {
    // Placeholder implementation - would use AI binding
    // For now, return a basic response
    const placeholderContext = orderMappings
      .map(m => `${m.placeholderId}: ${m.miniPrompt}`)
      .join('\n');

    return `Based on the order requirements and placeholder context:\n${placeholderContext}\n\nQuestion: ${question}\n\nResponse: Please refer to the mini-prompts associated with each placeholder in the order.`;
  }

  /**
   * Evaluate complexity to determine if HIL is needed
   *
   * Uses AI-powered analysis with comprehensive context to determine:
   * - Question complexity and ambiguity
   * - Available context quality
   * - Previous conversation patterns
   * - Order and template specificity
   */
  async evaluateComplexity(params: {
    question: string
    response: string
    order_id: string
    conversation_id: string
    unresolved_questions_count: number
  }): Promise<ComplexityEvaluation> {
    try {
      // Get comprehensive context for analysis
      const context = await this.gatherAnalysisContext(params);

      // Use AI to evaluate complexity with full context
      const aiAnalysis = await this.analyzeComplexityWithAI(params.question, context);

      const { complexityScore, confidence, needsHIL, reason } = aiAnalysis;

      // Additional heuristic checks
      const heuristicTriggers = this.checkHeuristicTriggers(params, context);

      // Combine AI analysis with heuristics
      const finalNeedsHIL = needsHIL || heuristicTriggers.needsHIL;
      const finalConfidence = Math.min(confidence, heuristicTriggers.confidence);
      const finalReason = needsHIL ? reason : heuristicTriggers.reason || reason;

      return {
        needs_hil: finalNeedsHIL,
        confidence: finalConfidence,
        complexity_score: complexityScore,
        reason: finalReason,
      };
    } catch (error) {
      // Fallback to heuristic-based analysis if AI fails
      console.warn('AI complexity analysis failed, falling back to heuristics:', error);
      return this.evaluateComplexityHeuristic(params);
    }
  }

  /**
   * Gather comprehensive context for complexity analysis
   */
  private async gatherAnalysisContext(params: {
    question: string
    order_id: string
    conversation_id: string
  }) {
    const { order_id, conversation_id } = params;

    // Get order details and mappings
    const orderMappings = await this.db.ops
      .select()
      .from(orderPlaceholderMappings)
      .where(eq(orderPlaceholderMappings.orderId, order_id))
      .execute();

    // Get template files referenced in the order
    const templateIds = [...new Set(orderMappings.map(m => m.templateId))];
    const templateFiles = await this.db.ops
      .select()
      .from(templateFiles)
      .where(sql`id IN (${sql.join(templateIds, sql`, `)})`)
      .execute();

    // Get previous conversations for this order
    const previousConversations = await this.db.ops
      .select()
      .from(aiProviderConversations)
      .where(eq(aiProviderConversations.orderId, order_id))
      .where(sql`${aiProviderConversations.conversationId} != ${conversation_id}`)
      .orderBy(aiProviderConversations.createdAt, 'desc')
      .limit(5)
      .execute();

    // Check for similar questions
    const similarQuestions = await this.findSimilarQuestions(params.question, order_id);

    return {
      orderMappings,
      templateFiles,
      previousConversations,
      similarQuestions,
    };
  }

  /**
   * Use AI to analyze question complexity with full context
   */
  private async analyzeComplexityWithAI(
    question: string,
    context: any
  ): Promise<{
    complexityScore: number;
    confidence: number;
    needsHIL: boolean;
    reason?: string;
  }> {
    const prompt = `Analyze this AI provider clarification question for complexity and determine if human intervention is needed.

QUESTION: "${question}"

CONTEXT:
- Order has ${context.orderMappings.length} placeholder mappings
- ${context.templateFiles.length} template files referenced
- ${context.previousConversations.length} previous conversations for this order
- ${context.similarQuestions.length} similar questions asked before

TEMPLATE PLACEHOLDERS:
${context.orderMappings.map((m: any) => `- ${m.placeholderId}: ${m.miniPrompt?.substring(0, 100)}...`).join('\n')}

PREVIOUS CONVERSATIONS:
${context.previousConversations.slice(0, 3).map((c: any) => `- ${c.providerName}: "${c.question?.substring(0, 80)}..." -> ${c.status}`).join('\n')}

SIMILAR QUESTIONS:
${context.similarQuestions.map((q: any) => `- "${q.question?.substring(0, 80)}..." (${q.status})`).join('\n')}

Evaluate:
1. Question clarity and specificity (1-10)
2. Context availability in order (1-10)
3. Whether this requires human judgment vs algorithmic resolution
4. Confidence in automated response (0-1)

Respond with JSON:
{
  "complexity_score": number (1-10),
  "confidence": number (0-1),
  "needs_human_intervention": boolean,
  "reason": "brief explanation if intervention needed"
}`;

    const aiResponse = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 500,
    });

    try {
      const analysis = JSON.parse(aiResponse.response || '{}');
      return {
        complexityScore: Math.max(1, Math.min(10, analysis.complexity_score || 5)),
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        needsHIL: analysis.needs_human_intervention || false,
        reason: analysis.reason,
      };
    } catch (parseError) {
      console.warn('Failed to parse AI complexity analysis:', parseError);
      return {
        complexityScore: 5,
        confidence: 0.5,
        needsHIL: false,
      };
    }
  }

  /**
   * Check heuristic triggers as fallback/backup
   */
  private checkHeuristicTriggers(
    params: { question: string; unresolved_questions_count: number },
    context: any
  ): { needsHIL: boolean; confidence: number; reason?: string } {
    const { question, unresolved_questions_count } = params;

    let needsHIL = false;
    let confidence = 0.9;
    let reason: string | undefined;

    // Check unresolved question threshold
    if (unresolved_questions_count > this.MAX_UNRESOLVED_QUESTIONS) {
      needsHIL = true;
      confidence = 0.3;
      reason = `Too many unresolved questions (${unresolved_questions_count})`;
    }

    // Check for similar unresolved questions
    const unresolvedSimilar = context.similarQuestions.filter((q: any) => q.status !== 'resolved');
    if (unresolvedSimilar.length > 2) {
      needsHIL = true;
      confidence = Math.min(confidence, 0.4);
      reason = `Multiple similar unresolved questions (${unresolvedSimilar.length})`;
    }

    // High-complexity keywords
    const highComplexityKeywords = ['conflict', 'contradiction', 'inconsistent', 'missing', 'error', 'fail'];
    const keywordMatches = highComplexityKeywords.filter(k =>
      question.toLowerCase().includes(k)
    );
    if (keywordMatches.length > 1) {
      needsHIL = true;
      confidence = Math.min(confidence, 0.6);
      reason = `Multiple complexity indicators: ${keywordMatches.join(', ')}`;
    }

    return { needsHIL, confidence, reason };
  }

  /**
   * Find similar questions in conversation history
   */
  private async findSimilarQuestions(question: string, orderId: string): Promise<any[]> {
    // Simple similarity check - could be enhanced with embeddings
    const allConversations = await this.db.ops
      .select()
      .from(aiProviderConversations)
      .where(eq(aiProviderConversations.orderId, orderId))
      .execute();

    const similar = allConversations.filter(conv => {
      if (!conv.question) return false;
      const similarity = this.calculateTextSimilarity(question, conv.question);
      return similarity > 0.6; // 60% similarity threshold
    });

    return similar;
  }

  /**
   * Simple text similarity calculation
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * Fallback heuristic-based complexity evaluation
   */
  private evaluateComplexityHeuristic(params: {
    question: string
    unresolved_questions_count: number
  }): ComplexityEvaluation {
    const { question, unresolved_questions_count } = params;

    // Enhanced heuristics compared to original
    let complexityScore = 3; // Start lower

    // Length-based complexity
    if (question.length > 200) complexityScore += 1;
    if (question.length > 500) complexityScore += 2;

    // Keyword-based complexity
    const complexityKeywords = {
      high: ['conflict', 'contradiction', 'inconsistent', 'error', 'fail', 'missing', 'not found'],
      medium: ['unclear', 'confusing', 'unsure', 'different', 'alternative', 'choose'],
      low: ['what', 'how', 'where', 'when', 'which']
    };

    complexityScore += complexityKeywords.high.filter(k => question.toLowerCase().includes(k)).length * 2;
    complexityScore += complexityKeywords.medium.filter(k => question.toLowerCase().includes(k)).length * 1;

    // Question type analysis
    if (question.includes('?') && question.split('?').length > 2) {
      complexityScore += 1; // Multiple questions
    }

    const needsHil = unresolved_questions_count > this.MAX_UNRESOLVED_QUESTIONS ||
                    complexityScore > this.COMPLEXITY_THRESHOLD;

    const confidence = complexityScore > this.COMPLEXITY_THRESHOLD ? 0.4 : 0.8;

    return {
      needs_hil: needsHil,
      confidence,
      complexity_score: Math.min(10, complexityScore),
      reason: needsHil ? `Heuristic complexity score ${complexityScore} exceeds threshold` : undefined,
    };
  }

  /**
   * Trigger Human-in-the-Loop process with enhanced context
   */
  async triggerHIL(
    orderId: string,
    conversationId: string,
    question: string,
    context: Record<string, unknown>,
    complexityEval?: ComplexityEvaluation,
  ): Promise<{ id: number; automatedResponse?: string }> {
    await this.logAction('trigger_hil', 'info', {
      order_id: orderId,
      conversation_id: conversationId,
      complexity_score: complexityEval?.complexity_score,
      confidence: complexityEval?.confidence,
      reason: complexityEval?.reason,
    });

    // Gather comprehensive context for HIL request
    const enhancedContext = await this.buildHILContext(orderId, conversationId, question, context);

    // Use HilOps to create HIL request with automated response checking
    const hilOps = this.env.ORCHESTRATOR_HEALTH;
    if (!hilOps) {
      throw new Error('ORCHESTRATOR_HEALTH binding not available');
    }

    const hilResult = await hilOps.createHilRequest({
      order_id: orderId,
      conversation_id: conversationId,
      question,
      context: enhancedContext,
    });

    if (!hilResult.ok) {
      throw new Error(`Failed to create HIL request: ${hilResult.error}`);
    }

    // If we got an automated response, update the conversation status to resolved
    if (hilResult.automated_response) {
      await this.db.ops
        .update(aiProviderConversations)
        .set({
          status: 'resolved',
          solution: hilResult.automated_response,
          hilTriggered: true,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(aiProviderConversations.conversationId, conversationId))
        .execute();

      await this.logAction('automated_hil_resolution', 'info', {
        order_id: orderId,
        conversation_id: conversationId,
        automated_response_length: hilResult.automated_response.length,
      });
    } else {
      // Manual HIL required - update conversation status
      await this.db.ops
        .update(aiProviderConversations)
        .set({
          status: 'escalated',
          hilTriggered: true,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(aiProviderConversations.conversationId, conversationId))
        .execute();
    }

    return {
      id: hilResult.request!.id,
      automatedResponse: hilResult.automated_response
    };
  }

  /**
   * Build comprehensive context for HIL request
   */
  private async buildHILContext(
    orderId: string,
    conversationId: string,
    question: string,
    originalContext: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Get order mappings and template details
    const orderMappings = await this.db.ops
      .select()
      .from(orderPlaceholderMappings)
      .where(eq(orderPlaceholderMappings.orderId, orderId))
      .execute();

    // Get template file information
    const templateIds = [...new Set(orderMappings.map(m => m.templateId))];
    const templateFiles = await this.db.ops
      .select()
      .from(templateFiles)
      .where(sql`id IN (${sql.join(templateIds, sql`, `)})`)
      .execute();

    // Get recent conversation history
    const recentConversations = await this.db.ops
      .select()
      .from(aiProviderConversations)
      .where(eq(aiProviderConversations.orderId, orderId))
      .orderBy(aiProviderConversations.createdAt, 'desc')
      .limit(10)
      .execute();

    // Find similar questions
    const similarQuestions = await this.findSimilarQuestions(question, orderId);

    // Get order details (if available)
    const orderDetails = await this.getOrderDetails(orderId);

    return {
      ...originalContext,
      timestamp: new Date().toISOString(),
      order: {
        id: orderId,
        mappings: orderMappings.map(m => ({
          placeholderId: m.placeholderId,
          miniPrompt: m.miniPrompt,
          templateId: m.templateId,
        })),
        templates: templateFiles.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })),
        details: orderDetails,
      },
      conversationHistory: recentConversations.map(c => ({
        id: c.conversationId,
        provider: c.providerName,
        question: c.question,
        response: c.response,
        solution: c.solution,
        status: c.status,
        createdAt: c.createdAt,
        hilTriggered: c.hilTriggered,
      })),
      similarQuestions: similarQuestions.map(q => ({
        question: q.question,
        status: q.status,
        createdAt: q.createdAt,
      })),
      analysis: {
        questionLength: question.length,
        wordCount: question.split(/\s+/).length,
        hasMultipleQuestions: (question.match(/\?/g) || []).length > 1,
        containsTechnicalTerms: this.detectTechnicalTerms(question),
        similarQuestionCount: similarQuestions.length,
      },
    };
  }

  /**
   * Get order details for context
   */
  private async getOrderDetails(orderId: string): Promise<Record<string, unknown> | null> {
    try {
      // This would depend on your orders table structure
      // For now, return basic info
      return {
        id: orderId,
        type: 'unknown', // Could be enhanced with actual order data
      };
    } catch (error) {
      console.warn('Failed to get order details:', error);
      return null;
    }
  }

  /**
   * Detect technical terms in question
   */
  private detectTechnicalTerms(question: string): string[] {
    const technicalTerms = [
      'api', 'endpoint', 'database', 'schema', 'migration',
      'authentication', 'authorization', 'token', 'jwt',
      'docker', 'container', 'kubernetes', 'cloudflare',
      'typescript', 'javascript', 'react', 'node', 'npm',
      'sql', 'query', 'table', 'column', 'index',
      'git', 'branch', 'merge', 'commit', 'pull request',
      'ci/cd', 'pipeline', 'deployment', 'environment',
    ];

    const foundTerms = technicalTerms.filter(term =>
      question.toLowerCase().includes(term)
    );

    return foundTerms;
  }

  /**
   * Execute agent logic (required by BaseAgent)
   */
  async execute(input: unknown): Promise<unknown> {
    if (typeof input === 'object' && input !== null && 'order_id' in input && 'question' in input) {
      return this.handleClarificationRequest(input as ClarificationRequest);
    }
    throw new Error('Invalid input for AiProviderClarificationAgent.execute');
  }
}
