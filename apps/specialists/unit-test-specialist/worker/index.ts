import { Hono } from 'hono';
import { Env } from './types';
import { TestRunner, TestSuiteKind } from './services/TestRunner';
import { ResultRecorder } from './services/ResultRecorder';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', async (c) => {
  const recorder = new ResultRecorder(c.env);

  if (c.req.query('fresh') === 'true') {
    const suite = (c.req.query('suite') as TestSuiteKind | undefined) ?? 'smoke';
    const runId = crypto.randomUUID();
    const runner = new TestRunner(c.env);
    const result = await runner.run({ suite, runId, previewBaseUrl: c.env.PREVIEW_BASE_URL });
    await recorder.record(result, { trigger: 'on_demand', suite, requestedBy: c.req.header('cf-access-identity') ?? null });
    return c.json({ status: 'completed', run: result });
  }

  const latest = await recorder.fetchLatest();
  return new Response(latest.body, {
    status: latest.status,
    headers: latest.headers,
  });
});

app.post('/run', async (c) => {
  const payload = await c.req.json<{ suite?: TestSuiteKind; requestedBy?: string }>().catch(() => ({}));
  const suite = payload?.suite ?? 'full';
  const runId = crypto.randomUUID();

  const runner = new TestRunner(c.env);
  const recorder = new ResultRecorder(c.env);

  const result = await runner.run({ suite, runId, previewBaseUrl: c.env.PREVIEW_BASE_URL });
  await recorder.record(result, { trigger: 'on_demand', suite, requestedBy: payload?.requestedBy });

  return c.json({ status: 'completed', runId: result.runId, result });
});

app.get('/report/:runId', async (c) => {
  const latest = await new ResultRecorder(c.env).fetchLatest();
  return new Response(latest.body, {
    status: latest.status,
    headers: latest.headers,
  });
});

app.get('/', (c) => c.json({ service: 'unit-test-specialist', status: 'ok' }));

export default app;

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (event, env, ctx) => {
  const runId = crypto.randomUUID();
  const suite: TestSuiteKind = event.cron === '0 3 * * *' ? 'full' : 'smoke';
  const runner = new TestRunner(env);
  const recorder = new ResultRecorder(env);

  const result = await runner.run({ suite, runId, previewBaseUrl: env.PREVIEW_BASE_URL });
  await recorder.record(result, { trigger: 'cron', suite });
};
