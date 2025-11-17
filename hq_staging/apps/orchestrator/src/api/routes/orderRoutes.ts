/**
 * Order Management API Routes
 * 
 * Provides HTTP endpoints for order management:
 * - GET /api/orders/:orderId/placeholders - Get order placeholder mapping
 */

import { Hono } from 'hono'
import type { Env } from '../../types'
import { TemplateOps } from '../../entrypoints/TemplateOps'

const app = new Hono<{ Bindings: Env }>()

// Create TemplateOps instance helper
function getTemplateOps(env: Env, ctx: ExecutionContext): TemplateOps {
  return new TemplateOps(ctx, env)
}

/**
 * GET /api/orders/:orderId/placeholders
 * Get order placeholder mapping for an order
 */
app.get('/:orderId/placeholders', async (c) => {
  try {
    const orderId = c.req.param('orderId')
    
    const templateOps = getTemplateOps(c.env, c.executionCtx)
    const result = await templateOps.getOrderPlaceholderMapping({
      order_id: orderId,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      data: result.mappings,
    })
  } catch (error: any) {
    console.error('Get order placeholder mapping failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

export const orderRoutes = app

