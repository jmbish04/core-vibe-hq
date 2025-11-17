/**
 * Ops Specialist API routes for the orchestrator
 */

import { Hono } from 'hono'
import { OpsSpecialist } from '../../../../apps/ops-specialists/ops-specialist'
import type { Env } from '../../types'

const app = new Hono<{ Bindings: Env }>()

/**
 * POST /ops/resolve-conflict
 * Trigger conflict resolution for a specific repo/branch
 */
app.post('/resolve-conflict', async (c) => {
  try {
    const { repo, branch, conflictFiles } = await c.req.json()
    
    if (!repo || !branch || !Array.isArray(conflictFiles)) {
      return c.json({ error: 'Missing required fields: repo, branch, conflictFiles' }, 400)
    }

    await OpsSpecialist.resolveConflict(c.env, repo, branch, conflictFiles)
    
    return c.json({ 
      success: true, 
      message: `Conflict resolution initiated for ${repo}:${branch}` 
    })
  } catch (error: any) {
    console.error('Conflict resolution failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * GET /ops/report/:orderId
 * Generate and return delivery report for an order
 */
app.get('/report/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId')
    
    if (!orderId) {
      return c.json({ error: 'Order ID is required' }, 400)
    }

    const report = await OpsSpecialist.generateDeliveryReport(c.env, orderId)
    
    return c.json({
      success: true,
      report
    })
  } catch (error: any) {
    console.error('Report generation failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /ops/final-qa/:orderId
 * Run final QA for an order
 */
app.post('/final-qa/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId')
    
    if (!orderId) {
      return c.json({ error: 'Order ID is required' }, 400)
    }

    const result = await OpsSpecialist.finalQA(c.env, orderId)
    
    return c.json({
      success: true,
      qa_result: result
    })
  } catch (error: any) {
    console.error('Final QA failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

export { app as opsRoutes }
