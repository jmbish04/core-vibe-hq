/**
 * Delivery Report Specialist Worker
 * Generates AI-powered delivery verification reports
 */

import { Hono } from 'hono';
import { ReportGenerator } from './services/ReportGenerator';
import type { DeliveryReportOrder, DeliveryReportRecord } from './types';

export interface Env {
  // NOTE: DB binding removed - all database operations should go through orchestrator service bindings
  // TODO: Refactor to use ORCHESTRATOR_OPS or create new orchestrator entrypoint for delivery reports
  AI: any;
  ORCHESTRATOR: any;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /generate
 * Receives delivery report order from Orchestrator
 */
app.post('/generate', async (c) => {
  try {
    const order: DeliveryReportOrder = await c.req.json();

    // Validate order
    if (!order.project_id || !order.original_order_spec) {
      return c.json({ error: 'Invalid order: missing project_id or original_order_spec' }, 400);
    }

    // TODO: Refactor to use orchestrator service binding instead of direct DB access
    // For now, this will fail - need to create orchestrator entrypoint for database operations
    throw new Error('Database access must go through orchestrator service binding. Refactor needed.');
  } catch (error) {
    console.error('Delivery report generation failed:', error);
    
    // Log error to D1 if possible
    try {
      const order: DeliveryReportOrder = await c.req.json().catch(() => ({}));
      await c.env.DB.prepare(
        `INSERT INTO ops_delivery_reports 
         (project_id, phase, compliance_score, summary, issues, recommendations, 
          original_order_spec, status, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        order.project_id || 'unknown',
        order.phase || null,
        0.0,
        'Report generation failed',
        JSON.stringify([{
          severity: 'critical',
          category: 'system',
          description: error instanceof Error ? error.message : 'Unknown error'
        }]),
        JSON.stringify([]),
        order.original_order_spec || '',
        'failed',
        '1.0'
      ).run();
    } catch (dbError) {
      console.error('Failed to log error to D1:', dbError);
    }

    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * GET /report/:projectId
 * Get latest delivery report for a project
 */
app.get('/report/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const phase = c.req.query('phase');
  const version = c.req.query('version');

  let query = 'SELECT * FROM ops_delivery_reports WHERE project_id = ?';
  const binds: any[] = [projectId];

  if (phase) {
    query += ' AND phase = ?';
    binds.push(phase);
  }

  if (version) {
    query += ' AND version = ?';
    binds.push(version);
  }

  query += ' ORDER BY created_at DESC LIMIT 1';

  const result = await c.env.DB.prepare(query).bind(...binds).first<DeliveryReportRecord>();

  if (!result) {
    return c.json({ error: 'Report not found' }, 404);
  }

  // Parse JSON fields
  return c.json({
    ...result,
    issues: JSON.parse(result.issues || '[]'),
    recommendations: JSON.parse(result.recommendations || '[]')
  });
});

/**
 * GET /reports/:projectId
 * Get all delivery reports for a project
 */
app.get('/reports/:projectId', async (c) => {
  const projectId = c.req.param('projectId');

  const results = await c.env.DB.prepare(
    'SELECT id, project_id, phase, compliance_score, summary, status, version, created_at, completed_at FROM ops_delivery_reports WHERE project_id = ? ORDER BY created_at DESC'
  ).bind(projectId).all<DeliveryReportRecord>();

  return c.json({
    project_id: projectId,
    reports: results.results || []
  });
});

export default app;
