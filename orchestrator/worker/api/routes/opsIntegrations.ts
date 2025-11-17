/**
 * Ops & Integrations API Routes
 *
 * Unified router for operations integrations including GitHub webhooks
 * and operations scanning.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../../types/appenv';
import type { Env } from '../../types';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { DB } from '../../db/schema';
import { DeliveryReportService } from '../../services/ops/deliveryReportService';
import { OpsMonitorService } from '../../services/ops/opsMonitorService';

interface EnvWithOverrides extends Env {
  __deliveryReportService?: DeliveryReportService;
  __opsMonitorService?: OpsMonitorService;
}

// GitHub webhook payload schema
const GitHubWebhookSchema = z.object({
  action: z.string(),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  }).optional(),
  pull_request: z.any().optional(),
  issue: z.any().optional(),
});

/**
 * Setup ops & integrations routes
 */
export function setupOpsIntegrationsRoutes(app: Hono<AppEnv>): void {
  /**
   * POST /api/integrations/github/webhook
   *
   * Handle GitHub webhook events
   */
  app.post('/api/integrations/github/webhook', async (c) => {
    try {
      const signature = c.req.header('x-hub-signature-256');
      if (!signature) {
        return c.json({ error: 'Missing webhook signature' }, 400);
      }

      const payload = await c.req.text();

      // Verify webhook signature (simplified for now)
      const isValid = await verifyGitHubSignature(payload, signature, c.env as EnvWithOverrides);
      if (!isValid) {
        return c.json({ error: 'Invalid webhook signature' }, 401);
      }

      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (jsonError) {
        return c.json({ error: 'Invalid webhook payload: malformed JSON' }, 400);
      }

      const event = GitHubWebhookSchema.parse(parsedPayload);

      // Handle different event types
      await handleGitHubEvent(event, c.env as EnvWithOverrides);

      return c.json({ status: 'ok' });
    } catch (error) {
      console.error('Error processing GitHub webhook:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Invalid webhook payload',
          details: error.errors,
        }, 400);
      }

      return c.json({ error: 'Failed to process webhook' }, 500);
    }
  });

  /**
   * POST /api/ops/scan
   *
   * Trigger operations scanning
   */
  app.post('/api/ops/scan', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const scanType = body.type || 'incremental';

      if (!['full', 'incremental'].includes(scanType)) {
        return c.json({ error: 'Invalid scan type' }, 400);
      }

      // Trigger ops scan (simplified - would call OpsMonitorService)
      const result = await triggerOpsScan(scanType, c.env as EnvWithOverrides);

      return c.json({
        scanId: result.scanId,
        type: result.scope,
        status: result.status,
        processedLogs: result.processedLogs,
        issuesFiled: result.issuesFiled,
        completedAt: result.completedAt,
        findings: result.findings,
        message: `Operations scan (${result.scope}) ${result.status}`,
      });
    } catch (error) {
      console.error('Error triggering ops scan:', error);
      return c.json({ error: 'Failed to trigger operations scan' }, 500);
    }
  });
}

/**
 * Verify GitHub webhook signature
 */
async function verifyGitHubSignature(payload: string, signature: string, env: EnvWithOverrides): Promise<boolean> {
  // Get webhook secret from environment
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET not configured');
    return false;
  }

  // Simplified signature verification
  // In production, use crypto.timingSafeEqual for secure comparison
  const crypto = await import('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

/**
 * Handle GitHub webhook events
 */
async function handleGitHubEvent(event: z.infer<typeof GitHubWebhookSchema>, env: EnvWithOverrides): Promise<void> {
  console.log('Processing GitHub event:', event.action);

  // Handle different event types
  switch (event.action) {
    case 'opened':
    case 'synchronize':
      if (event.pull_request) {
        await handlePullRequestEvent(event, env);
      }
      break;

    case 'push':
      await handlePushEvent(event, env);
      break;

    case 'opened':
    case 'edited':
    case 'closed':
      if (event.issue) {
        await handleIssueEvent(event, env);
      }
      break;

    default:
      console.log('Unhandled GitHub event type:', event.action);
  }
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(event: any, env: EnvWithOverrides): Promise<void> {
  const pr = event.pull_request;
  console.log(`Processing PR ${pr.number} in ${event.repository?.full_name}`);

  await usingDeliveryReportService(env, (service) =>
    service.triggerReportGeneration({
      patchId: `pr-${pr.number}`,
      destination: 'github-pr-processing',
      status: 'pending',
      metadata: {
        repository: event.repository?.full_name,
        pullRequest: pr.number,
        action: event.action,
      },
    }),
  );
}

/**
 * Handle push events
 */
async function handlePushEvent(event: any, env: EnvWithOverrides): Promise<void> {
  console.log(`Processing push to ${event.repository?.full_name}`);

  await usingDeliveryReportService(env, (service) =>
    service.triggerReportGeneration({
      patchId: `push-${Date.now()}`,
      destination: 'github-push-processing',
      status: 'pending',
      metadata: {
        repository: event.repository?.full_name,
        ref: event.ref,
        commits: event.commits?.length || 0,
      },
    }),
  );
}

/**
 * Handle issue events
 */
async function handleIssueEvent(event: any, env: EnvWithOverrides): Promise<void> {
  const issue = event.issue;
  console.log(`Processing issue ${issue.number} in ${event.repository?.full_name}`);

  await usingDeliveryReportService(env, (service) =>
    service.triggerReportGeneration({
      patchId: `issue-${issue.number}`,
      destination: 'github-issue-processing',
      status: 'pending',
      metadata: {
        repository: event.repository?.full_name,
        issue: issue.number,
        action: event.action,
      },
    }),
  );
}

/**
 * Trigger operations scan
 */
async function triggerOpsScan(scanType: string, env: EnvWithOverrides) {
  return usingOpsMonitorService(env, (service) => service.runScan({ scope: scanType }));
}

async function usingDeliveryReportService<T>(env: EnvWithOverrides, handler: (service: DeliveryReportService) => Promise<T>): Promise<T> {
  if (env.__deliveryReportService) {
    return handler(env.__deliveryReportService);
  }
  return usingOpsDb(env, (db) => handler(new DeliveryReportService(db)));
}

async function usingOpsMonitorService<T>(env: EnvWithOverrides, handler: (service: OpsMonitorService) => Promise<T>): Promise<T> {
  if (env.__opsMonitorService) {
    return handler(env.__opsMonitorService);
  }
  return usingOpsDb(env, (db) => handler(new OpsMonitorService(db)));
}

async function usingOpsDb<T>(env: EnvWithOverrides, handler: (db: Kysely<DB>) => Promise<T>): Promise<T> {
  if ((env as any).__opsDb) {
    return handler((env as any).__opsDb);
  }
  const db = new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB_OPS }) });
  try {
    return await handler(db);
  } finally {
    await db.destroy();
  }
}
