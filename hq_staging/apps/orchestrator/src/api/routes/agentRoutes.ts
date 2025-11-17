/**
 * Agent API Routes
 * Handles agent interactions via HTTP and WebSocket
 */

import { Hono } from 'hono'
import { ProjectClarificationAgent } from '../../agents/project-clarification'
import type { Env } from '../../types'
import type { UserMessageInput } from '../../agents/project-clarification/types'

const app = new Hono<{ Bindings: Env }>()

/**
 * POST /api/agents/project-clarification/message
 * Process a user message and get agent response
 */
app.post('/project-clarification/message', async (c) => {
  try {
    const input: UserMessageInput = await c.req.json()
    
    // TODO: Get structured logger from context
    // For now, using console logger
    const logger = {
      info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data),
      warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data),
      error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data),
      debug: (msg: string, data?: unknown) => console.debug(`[DEBUG] ${msg}`, data),
    } as any

    const agent = new ProjectClarificationAgent(
      c.env,
      logger,
      {
        projectId: input.projectId,
        userId: input.userId,
        conversationId: input.conversationId,
      }
    )

    const response = await agent.execute(input)
    
    return c.json({
      success: true,
      data: response,
    })
  } catch (error: any) {
    console.error('Agent message processing failed:', error)
    return c.json({ 
      success: false,
      error: error.message || 'Internal server error' 
    }, 500)
  }
})

/**
 * GET /api/agents/project-clarification/card/:projectId
 * Get current project overview card
 */
app.get('/project-clarification/card/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const conversationId = c.req.query('conversationId')
    
    // TODO: Implement card retrieval
    return c.json({
      success: true,
      message: 'Card retrieval not yet implemented',
    })
  } catch (error: any) {
    console.error('Card retrieval failed:', error)
    return c.json({ 
      success: false,
      error: error.message || 'Internal server error' 
    }, 500)
  }
})

/**
 * WebSocket endpoint for real-time updates
 * TODO: Implement WebSocket handler
 * This will be integrated with the main WebSocket handler in app.ts
 */

export { app as agentRoutes }

