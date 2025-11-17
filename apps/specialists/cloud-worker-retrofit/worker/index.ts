import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, RetrofitAnalysisRequest, RetrofitPlanRequest, RetrofitStatusEntry } from './types';

const ANALYZE_SCHEMA = z.object({
  repoUrl: z.string().url().optional(),
  framework: z.string().optional(),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const PLAN_SCHEMA = ANALYZE_SCHEMA.extend({
  deploymentTarget: z.enum(['workers', 'pages', 'hybrid']).optional(),
  preferredAdapter: z.string().optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) =>
  c.json({
    service: c.env.WORKER_NAME ?? 'Cloud Worker Retrofit',
    status: 'online',
    documentation: 'https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/',
  }),
);

app.post('/analyze', async (c) => {
  const body = ANALYZE_SCHEMA.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: 'Invalid payload', issues: body.error.flatten() }, 400);
  }

  const payload: RetrofitAnalysisRequest = body.data;
  const retrofitId = crypto.randomUUID();

  const analysis = buildAnalysis(retrofitId, payload);

  await logSpecialistActivity(c.env, {
    specialist: 'cloud-worker-retrofit',
    activity: 'analysis',
    identifier: retrofitId,
    details: analysis,
  });

  return c.json({ retrofitId, analysis }, 200);
});

app.post('/retrofit', async (c) => {
  const body = PLAN_SCHEMA.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: 'Invalid payload', issues: body.error.flatten() }, 400);
  }

  const payload: RetrofitPlanRequest = body.data;
  const retrofitId = crypto.randomUUID();

  const plan = buildRetrofitPlan(retrofitId, payload);

  await logSpecialistActivity(c.env, {
    specialist: 'cloud-worker-retrofit',
    activity: 'retrofit-plan',
    identifier: retrofitId,
    details: plan,
  });

  return c.json({ retrofitId, plan }, 200);
});

app.get('/status/:retrofitId', async (c) => {
  const retrofitId = c.req.param('retrofitId');
  if (!retrofitId) {
    return c.json({ error: 'retrofitId required' }, 400);
  }

  const history = await fetchHistory(c.env, 'cloud-worker-retrofit', retrofitId, Number(c.req.query('limit') ?? '10'));

  return c.json({ retrofitId, history });
});

async function logSpecialistActivity(env: Env, input: {
  specialist: string;
  activity: string;
  identifier?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  details?: Record<string, unknown>;
}) {
  try {
    await env.ORCHESTRATOR.fetch('https://orchestrator/api/specialists/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialist: input.specialist,
        activity: input.activity,
        identifier: input.identifier,
        level: input.level ?? 'info',
        details: input.details ?? {},
      }),
    });
  } catch (error) {
    console.error('Failed to log specialist activity', error);
  }
}

async function fetchHistory(env: Env, specialist: string, identifier?: string, limit = 10): Promise<RetrofitStatusEntry[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (identifier) {
    params.set('identifier', identifier);
  }

  try {
    const response = await env.ORCHESTRATOR.fetch(
      `https://orchestrator/api/specialists/log/${encodeURIComponent(specialist)}?${params.toString()}`,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      throw new Error(`Unexpected response ${response.status}`);
    }

    const data = (await response.json()) as { logs: RetrofitStatusEntry[] };
    return data.logs ?? [];
  } catch (error) {
    console.error('Failed to fetch specialist history', error);
    return [];
  }
}

function buildAnalysis(retrofitId: string, payload: RetrofitAnalysisRequest) {
  const framework = payload.framework?.toLowerCase();

  const compatibilityNotes: string[] = [];
  if (!payload.buildCommand) {
    compatibilityNotes.push('Specify the build command discovered in your Vercel dashboard (for example `npm run build`).');
  }
  if (!payload.outputDirectory) {
    compatibilityNotes.push('Identify the output directory (for example `dist`, `build`, or `.vercel/output` for Next.js).');
  }
  if (framework?.includes('next')) {
    compatibilityNotes.push(
      'Next.js projects may require the Next-on-Pages adapter. Review https://developers.cloudflare.com/workers/framework-guides/nextjs/',
    );
  }

  return {
    retrofitId,
    detectedFramework: framework ?? 'unknown',
    recommendedGuide:
      'https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/',
    compatibilityMatrix:
      'https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#compatibility-matrix',
    actionItems: [
      'Generate a wrangler.jsonc with the proper assets directory and compatibility_date.',
      'Validate environment bindings (KV, D1, R2) and translate Vercel environment variables.',
      'Replace Node.js-specific APIs (`fs`, `path`, etc.) with Workers-compatible alternatives or bundles.',
      'Audit middleware, edge functions, or serverless functions for Cloudflare Worker semantics.',
    ],
    compatibilityNotes,
    providedContext: payload,
    recommendedNextAction: 'Request a full retrofit plan via POST /retrofit.',
  };
}

function buildRetrofitPlan(retrofitId: string, payload: RetrofitPlanRequest) {
  const deploymentTarget = payload.deploymentTarget ?? 'workers';
  const wranglerTemplate = buildWranglerTemplate(payload);
  const planSteps = [
    {
      title: 'Initialize Wrangler project',
      commands: ['npm install --save-dev wrangler', 'npx wrangler init --yes'],
    },
    {
      title: 'Map build output to Workers assets',
      commands: [`Ensure wrangler.jsonc assets.directory points to ${payload.outputDirectory ?? './dist'}.`],
    },
    {
      title: 'Translate environment variables',
      commands: ['Copy Vercel Environment Variables into Wrangler secrets or vars (wrangler secret put ...)'],
    },
    {
      title: 'Replace platform-specific APIs',
      commands: ['Swap Node.js APIs with Workers equivalents (fetch, KV, R2, Durable Objects).'],
    },
    {
      title: 'Configure CI/CD',
      commands: ['Use wrangler deploy in CI; optionally connect repository via Cloudflare Deployments.'],
    },
  ];

  return {
    retrofitId,
    deploymentTarget,
    planSteps,
    wranglerTemplate,
    references: [
      'https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/',
      'https://developers.cloudflare.com/workers/framework-guides/',
    ],
    riskChecklist: [
      'Verify streaming/edge routes map to Workers fetch handler.',
      'Ensure custom domains are configured after deployment.',
      'Confirm that SSR/ISR features have Cloudflare equivalents or alternate implementations.',
    ],
    providedContext: payload,
  };
}

function buildWranglerTemplate(payload: RetrofitPlanRequest) {
  const directory = payload.outputDirectory ?? './dist';
  const compatibilityDate = new Date().toISOString().slice(0, 10);

  return {
    file: 'wrangler.jsonc',
    contents: {
      name: payload.repoUrl ? deriveWorkerName(payload.repoUrl) : 'retrofit-worker',
      main: 'src/index.ts',
      compatibility_date: compatibilityDate,
      compatibility_flags: ['nodejs_compat'],
      assets: {
        directory,
        not_found_handling: 'single-page-application',
      },
      observability: {
        enabled: true,
        head_sampling_rate: 1,
      },
      vars: {
        SOURCE_PLATFORM: 'vercel',
        RETROFIT_ID: retrofitIdPrefix(),
      },
    },
  };
}

function deriveWorkerName(repoUrl: string): string {
  try {
    const parsed = new URL(repoUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const repoName = parts[parts.length - 1] ?? 'retrofit-worker';
    return repoName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  } catch (error) {
    console.warn('Failed to derive worker name from repo url', error);
    return 'retrofit-worker';
  }
}

function retrofitIdPrefix(): string {
  return `retrofit_${crypto.randomUUID().split('-')[0]}`;
}

export default app;
