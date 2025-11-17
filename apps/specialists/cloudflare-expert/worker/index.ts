import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, CodeReviewRequest, ConsultRequest, OrderReviewRequest, SpecialistLogResponse } from './types';
import { MCPDocManager } from './services/mcpManager';

const docManager = new MCPDocManager();

const CONSULT_SCHEMA = z.object({
  question: z.string().min(1),
  context: z.string().optional(),
  links: z.array(z.string().url()).optional(),
});

const ORDER_REVIEW_SCHEMA = z.object({
  orderId: z.string(),
  summary: z.string().min(1),
  artifacts: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url().optional(),
        content: z.string().optional(),
      }),
    )
    .optional(),
  bindings: z.record(z.string()).optional(),
  checklist: z.array(z.string()).optional(),
});

const CODE_REVIEW_SCHEMA = z.object({
  snippet: z.string().min(1),
  filename: z.string().optional(),
  runtime: z.enum(['workers', 'pages', 'durable-object']).optional(),
  expectedBindings: z.array(z.string()).optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) =>
  c.json({
    service: c.env.WORKER_NAME ?? 'Cloudflare Expert Specialist',
    status: 'online',
    capabilities: ['consultation', 'task-review', 'code-peer-review'],
    documentation: 'https://developers.cloudflare.com/workers/get-started/prompting/',
  }),
);

app.post('/consult', async (c) => {
  const body = CONSULT_SCHEMA.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: 'Invalid payload', issues: body.error.flatten() }, 400);
  }

  const payload: ConsultRequest = body.data;
  const docSnippets = await docManager.searchDocs(payload.question);
  const consultation = buildConsultation(payload, docSnippets);
  const identifier = consultation.identifier;

  await logActivity(c.env, {
    specialist: 'cloudflare-expert',
    activity: 'consultation',
    identifier,
    details: consultation,
  });

  return c.json(consultation, 200);
});

app.post('/review/order', async (c) => {
  const body = ORDER_REVIEW_SCHEMA.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: 'Invalid payload', issues: body.error.flatten() }, 400);
  }

  const payload: OrderReviewRequest = body.data;
  const review = buildOrderReview(payload);

  await logActivity(c.env, {
    specialist: 'cloudflare-expert',
    activity: 'order-review',
    identifier: payload.orderId,
    details: review,
  });

  return c.json(review, 200);
});

app.post('/review/code', async (c) => {
  const body = CODE_REVIEW_SCHEMA.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: 'Invalid payload', issues: body.error.flatten() }, 400);
  }

  const payload: CodeReviewRequest = body.data;
  const review = buildCodeReview(payload);
  const identifier = `${payload.filename ?? 'snippet'}-${crypto.randomUUID().split('-')[0]}`;

  await logActivity(c.env, {
    specialist: 'cloudflare-expert',
    activity: 'code-review',
    identifier,
    details: review,
  });

  return c.json(review, 200);
});

app.get('/history/:specialist/:identifier?', async (c) => {
  const specialist = c.req.param('specialist');
  const identifier = c.req.param('identifier');
  const limit = Number(c.req.query('limit') ?? '10');

  const logs = await fetchHistory(c.env, specialist, identifier, limit);
  return c.json({ logs });
});

async function logActivity(env: Env, input: {
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

async function fetchHistory(env: Env, specialist: string, identifier?: string, limit = 10): Promise<SpecialistLogResponse['logs']> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (identifier) params.set('identifier', identifier);

  try {
    const response = await env.ORCHESTRATOR.fetch(
      `https://orchestrator/api/specialists/log/${encodeURIComponent(specialist)}?${params.toString()}`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as SpecialistLogResponse;
    return data.logs ?? [];
  } catch (error) {
    console.error('Failed to fetch specialist activity', error);
    return [];
  }
}

function buildConsultation(payload: ConsultRequest, docSnippets: string[]) {
  const identifier = `consult_${crypto.randomUUID().split('-')[0]}`;
  const documentation = buildDocumentationReferences(payload.question, docSnippets);

  const recommendations = [
    'Validate your wrangler.jsonc against the compatibility matrix and ensure compatibility_flags include `nodejs_compat`.',
    'Audit bindings (KV, D1, R2, Durable Objects) and ensure they are declared in both wrangler.jsonc and the Worker code.',
    'Use Workers AI or official SDKs when integrating AI providers, and never ship secrets inside source code.',
    'Run `wrangler deploy --dry-run` locally before connecting CI deployments.',
  ];

  return {
    identifier,
    summary: {
      question: payload.question,
      context: payload.context ?? null,
      diagnosticFocus: inferDiagnosticFocus(payload.question),
    },
    recommendations,
    documentation,
    followUpActions: [
      'Request a peer review via POST /review/code before final deployment.',
      'Log retrofit progress with /api/specialists/log for traceability.',
    ],
    timestamp: new Date().toISOString(),
  };
}

function buildOrderReview(payload: OrderReviewRequest) {
  const issues: string[] = [];
  const remediation: string[] = [];

  if (!payload.bindings || Object.keys(payload.bindings).length === 0) {
    issues.push('No Cloudflare bindings detected in order payload.');
    remediation.push('Document required bindings (KV, D1, R2, Durable Objects) and add them to wrangler.jsonc.');
  }

  if (!payload.checklist?.includes('wrangler.jsonc')) {
    remediation.push('Add a checklist item to verify wrangler.jsonc compatibility_date and flags.');
  }

  return {
    orderId: payload.orderId,
    summary: payload.summary,
    issues,
    remediation,
    advisories: [
      'Ensure all generated workers standardize `SERVICE_NAME`/`WORKER_NAME` to lowercase underscore format for logging.',
      'Provide integration tests or unit-test specialist hooks for generated workers to maintain pipeline consistency.',
    ],
    timestamp: new Date().toISOString(),
  };
}

function buildCodeReview(payload: CodeReviewRequest) {
  const issues: Array<{ title: string; description: string; recommendation: string }> = [];

  if (/require\(/.test(payload.snippet) || /module\.exports/.test(payload.snippet)) {
    issues.push({
      title: 'CommonJS detected',
      description: 'Workers require ES modules syntax.',
      recommendation: 'Refactor to `import`/`export` syntax and ensure wrangler.jsonc main uses TypeScript entry.',
    });
  }

  if (/process\.env/.test(payload.snippet)) {
    issues.push({
      title: 'process.env usage',
      description: 'Workers do not expose process.env. Use the `env` binding or `c.env` in Hono handlers.',
      recommendation: 'Replace `process.env.X` with `env.X` or `c.env.X`.',
    });
  }

  if (/fs\./.test(payload.snippet) || /path\./.test(payload.snippet)) {
    issues.push({
      title: 'Node.js standard library usage',
      description: 'Workers do not support fs/path.Consider R2, KV, or durable storage as alternatives.',
      recommendation: 'Remove Node.js stdlib usage or bundle assets during build.',
    });
  }

  if (!/export default/.test(payload.snippet) && !/export async function fetch/.test(payload.snippet)) {
    issues.push({
      title: 'Missing fetch handler',
      description: 'A Workers script must export a fetch handler or a default object with fetch.',
      recommendation: 'Export `export default { async fetch(request, env, ctx) { ... } }`.',
    });
  }

  const rating = issues.length === 0 ? 'pass' : 'needs-attention';

  return {
    rating,
    runtime: payload.runtime ?? 'workers',
    issues,
    recommendations: [
      'Run `wrangler deploy --dry-run` to ensure compatibility before merging.',
      'Ensure compatibility_date is aligned across all generated workers.',
      'Add unit-test specialist coverage so that pipelines catch regressions automatically.',
    ],
    timestamp: new Date().toISOString(),
  };
}

function buildDocumentationReferences(question: string, snippets: string[]) {
  const baseDocs = [
    {
      title: 'Cloudflare Workers Prompting Guide',
      url: 'https://developers.cloudflare.com/workers/get-started/prompting/',
      snippet: 'Structured prompts improve AI-generated Workers code quality.',
    },
    {
      title: 'Vercel to Cloudflare Workers migration',
      url: 'https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/',
      snippet: 'Step-by-step instructions for migrating Vercel projects to Workers.',
    },
  ];

  if (snippets.length === 0) {
    return baseDocs;
  }

  return [
    ...baseDocs,
    ...snippets.slice(0, 2).map((text, index) => ({
      title: `Doc snippet ${index + 1}`,
      url: 'https://developers.cloudflare.com/',
      snippet: text.slice(0, 500),
    })),
  ];
}

function inferDiagnosticFocus(question: string): string {
  const normalized = question.toLowerCase();
  if (normalized.includes('binding') || normalized.includes('env')) return 'bindings';
  if (normalized.includes('deploy') || normalized.includes('wrangler')) return 'deployment';
  if (normalized.includes('compatibility') || normalized.includes('node')) return 'platform-compatibility';
  return 'general';
}

export default app;
