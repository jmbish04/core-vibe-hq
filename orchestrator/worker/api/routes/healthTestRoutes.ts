import { Hono } from 'hono';
import { Health, RecordWorkerTestResultParams } from '../../entrypoints/health';
import type { Env } from '../../types';

const healthTestRoutes = new Hono<{ Bindings: Env }>();

healthTestRoutes.post('/:workerName', async (c) => {
  const workerName = c.req.param('workerName');
  const body = await c.req.json<Partial<RecordWorkerTestResultParams>>().catch(() => ({})) as Partial<RecordWorkerTestResultParams>;

  if (!body?.run_id || !body?.status || !body?.trigger || !body?.suite) {
    return c.json({ ok: false, error: 'run_id, status, trigger, and suite are required' }, 400);
  }

  const params: RecordWorkerTestResultParams = {
    worker_name: body.worker_name ?? workerName,
    worker_type: body.worker_type ?? 'unit-test-specialist',
    run_id: body.run_id,
    status: body.status,
    trigger: body.trigger,
    suite: body.suite,
    requested_by: body.requested_by ?? null,
    metrics: body.metrics ?? {
      total: body.raw_results && Array.isArray((body.raw_results as any).unit_test_results) ? (body.raw_results as any).unit_test_results.length : 0,
      passed: body.status === 'passed' ? 1 : 0,
      failed: body.status === 'failed' ? 1 : 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    },
    report: body.report ?? {
      previewUrl: body.raw_results && (body.raw_results as any).previewUrl ? (body.raw_results as any).previewUrl : '',
      viewport: 'unknown',
      artifacts: [],
    },
    raw_results: body.raw_results ?? null,
  };

  const health = new Health(c.executionCtx, c.env as Env);
  const result = await health.recordWorkerTestResult(params);
  return c.json({ ok: true, ...result });
});

healthTestRoutes.get('/:workerName/latest', async (c) => {
  const workerName = c.req.param('workerName');
  const health = new Health(c.executionCtx, c.env as Env);
  const latest = await health.getLatestWorkerTest(workerName);
  if (!latest) {
    return c.json({ ok: false, error: 'No runs recorded' }, 404);
  }
  return c.json({ ok: true, result: latest });
});

export { healthTestRoutes };
