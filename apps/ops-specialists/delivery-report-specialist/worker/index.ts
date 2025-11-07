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
    
    /* 
    // Initialize report generator
    const reportGenerator = new ReportGenerator(c.env.AI, c.env.DB);

    // Generate report
    const report = await reportGenerator.generateReport(order);

    // Determine version (increment if report exists)
    const existingReport = await c.env.DB.prepare(
      'SELECT version FROM ops_delivery_reports WHERE project_id = ? AND phase = ? ORDER BY version DESC LIMIT 1'
    ).bind(order.project_id, order.phase || null).first<{ version: string }>();

    let version = '1.0';
    if (existingReport) {
      const currentVersion = parseFloat(existingReport.version);
      version = (currentVersion + 0.1).toFixed(1);
    }

    // Save to D1
    const result = await c.env.DB.prepare(
      `INSERT INTO ops_delivery_reports 
       (project_id, phase, compliance_score, summary, issues, recommendations, 
        original_order_spec, status, completed_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      order.project_id,
      order.phase || null,
      report.compliance_score,
      report.summary,
      JSON.stringify(report.issues),
      JSON.stringify(report.recommendations),
      order.original_order_spec,
      'completed',
      new Date().toISOString(),
      version
    ).run();

    // Get the inserted record
    const reportId = result.meta.last_row_id;
    const savedReport = await c.env.DB.prepare(
      'SELECT * FROM ops_delivery_reports WHERE id = ?'
    ).bind(reportId).first<DeliveryReportRecord>();

    return c.json({
      success: true,
      report: { /*
        ...report,
        id: reportId,
        version,
        status: 'completed',
        created_at: savedReport?.created_at,
        completed_at: savedReport?.completed_at
      }
    });
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

