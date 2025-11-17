/**
 * AI Provider Clarification API Routes
 * 
 * Provides HTTP endpoints for AI provider clarification requests:
 * - POST /api/ai-provider/clarify - Request clarification from orchestrator
 */

import { Hono } from 'hono'
import type { Env } from '../../types'
import { AiProviderClarificationAgent } from '../../agents/AiProviderClarificationAgent'

const app = new Hono<{ Bindings: Env }>()

// Create AiProviderClarificationAgent instance helper
function getClarificationAgent(env: Env): AiProviderClarificationAgent {
  const logger = {
    info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data),
    warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data),
    error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data),
    debug: (msg: string, data?: unknown) => console.debug(`[DEBUG] ${msg}`, data),
  } as any

  return new AiProviderClarificationAgent(env, logger)
}

/**
 * POST /api/ai-provider/clarify
 * Request clarification from orchestrator agent
 * 
 * This endpoint is called by AI providers (e.g., codex-cli) when they need
 * clarification about order requirements, placeholder conflicts, or missing information.
 */
app.post('/clarify', async (c) => {
  try {
    const body = await c.req.json()
    const { order_id, provider_name, question, context } = body
    
    if (!order_id || !provider_name || !question) {
      return c.json({ 
        error: 'Missing required fields: order_id, provider_name, question' 
      }, 400)
    }
    
    const agent = getClarificationAgent(c.env)
    const result = await agent.handleClarificationRequest({
      order_id,
      provider_name,
      question,
      context,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      ok: true,
      response: result.response,
      solution: result.solution,
      hil_triggered: result.hil_triggered,
      hil_request_id: result.hil_request_id,
    })
  } catch (error: any) {
    console.error('AI provider clarification failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

export const aiProviderRoutes = app

