/**
 * Human-in-the-Loop (HIL) API Routes
 * 
 * Provides HTTP endpoints for HIL request management:
 * - GET /api/hil/requests - List HIL requests (with filters)
 * - GET /api/hil/requests/:id - Get HIL request details
 * - POST /api/hil/requests/:id/response - Submit human response
 * - PATCH /api/hil/requests/:id/status - Update HIL request status
 */

import { Hono } from 'hono'
import type { Env } from '../../types'
import { HilOps } from '../../entrypoints/HilOps'

const app = new Hono<{ Bindings: Env }>()

// Create HilOps instance helper
function getHilOps(env: Env, ctx: ExecutionContext): HilOps {
  return new HilOps(ctx, env)
}

/**
 * GET /api/hil/requests
 * List HIL requests (with optional filters)
 */
app.get('/requests', async (c) => {
  try {
    const orderId = c.req.query('order_id')
    const status = c.req.query('status')
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined
    
    const hilOps = getHilOps(c.env, c.executionCtx)
    const result = await hilOps.getHilRequests({
      order_id: orderId,
      status: status as any,
      limit,
      offset,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      data: result.requests,
      total: result.total,
    })
  } catch (error: any) {
    console.error('Get HIL requests failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * GET /api/hil/requests/:id
 * Get HIL request details
 */
app.get('/requests/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const hilOps = getHilOps(c.env, c.executionCtx)
    const result = await hilOps.getHilRequest({ id })
    
    if (!result.ok) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500)
    }
    
    return c.json({
      success: true,
      data: result.request,
    })
  } catch (error: any) {
    console.error('Get HIL request failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/hil/requests/:id/response
 * Submit human response to HIL request
 */
app.post('/requests/:id/response', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const { user_response } = body
    
    if (!user_response) {
      return c.json({ error: 'Missing required field: user_response' }, 400)
    }
    
    const hilOps = getHilOps(c.env, c.executionCtx)
    const result = await hilOps.submitHilResponse({
      id,
      user_response,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500)
    }
    
    return c.json({
      success: true,
      data: result.request,
    })
  } catch (error: any) {
    console.error('Submit HIL response failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * PATCH /api/hil/requests/:id/status
 * Update HIL request status
 */
app.patch('/requests/:id/status', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const { status } = body
    
    if (!status || !['pending', 'in_progress', 'resolved', 'cancelled'].includes(status)) {
      return c.json({ error: 'Invalid status. Must be: pending, in_progress, resolved, or cancelled' }, 400)
    }
    
    const hilOps = getHilOps(c.env, c.executionCtx)
    const result = await hilOps.updateHilStatus({
      id,
      status: status as any,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500)
    }
    
    return c.json({
      success: true,
      data: result.request,
    })
  } catch (error: any) {
    console.error('Update HIL status failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

export const hilRoutes = app

