import { createLogger } from './logger';
import { SmartCodeGeneratorAgent } from './agents/core/smartGeneratorAgent';
import { isDispatcherAvailable } from './utils/dispatcherUtils';
import { createApp } from './app';
// import * as Sentry from '@sentry/cloudflare';
// import { sentryOptions } from './observability/sentry';
import { DORateLimitStore as BaseDORateLimitStore } from './services/rate-limit/DORateLimitStore';
import { getPreviewDomain } from './utils/urls';
import { proxyToAiGateway } from './services/aigateway-proxy/controller';
import { isOriginAllowed } from './config/security';
import { proxyToSandbox } from './services/sandbox/request-handler';
import { handleGitProtocolRequest, isGitProtocolRequest } from './api/handlers/git-protocol';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { DB } from './db/schema';
import { Health } from './entrypoints/health';

// Durable Object and Service exports
export { UserAppSandboxService, DeployerService } from './services/sandbox/sandboxSdkClient';

// export const CodeGeneratorAgent = Sentry.instrumentDurableObjectWithSentry(sentryOptions, SmartCodeGeneratorAgent);
// export const DORateLimitStore = Sentry.instrumentDurableObjectWithSentry(sentryOptions, BaseDORateLimitStore);
export const CodeGeneratorAgent = SmartCodeGeneratorAgent;
export const DORateLimitStore = BaseDORateLimitStore;
export { TerminalServer } from './durable-objects/terminal/TerminalServer';
export { OpsMonitorBroadcastServer } from './durable-objects/ops/OpsMonitorBroadcastServer';
export { HealthCheckBroadcastServer } from './durable-objects/health/HealthCheckBroadcastServer';

// Logger for the main application and handlers
const logger = createLogger('App');

function setOriginControl(env: Env, request: Request, currentHeaders: Headers): Headers {
  const origin = request.headers.get('Origin');

  if (origin && isOriginAllowed(env, origin)) {
    currentHeaders.set('Access-Control-Allow-Origin', origin);
  }
  return currentHeaders;
}

/**
 * Handles requests for user-deployed applications on subdomains.
 * It first attempts to proxy to a live development sandbox. If that fails,
 * it dispatches the request to a permanently deployed worker via namespaces.
 * This function will NOT fall back to the main worker.
 *
 * @param request The incoming Request object.
 * @param env The environment bindings.
 * @returns A Response object from the sandbox, the dispatched worker, or an error.
 */
async function handleUserAppRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { hostname } = url;
  logger.info(`Handling user app request for: ${hostname}`);

  // 1. Attempt to proxy to a live development sandbox.
  // proxyToSandbox doesn't consume the request body on a miss, so no clone is needed here.
  const sandboxResponse = await proxyToSandbox(request, env);
  if (sandboxResponse) {
    logger.info(`Serving response from sandbox for: ${hostname}`);
    // If it was a websocket upgrade, we need to return the response as is
    if (sandboxResponse.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      logger.info(`Serving websocket response from sandbox for: ${hostname}`);
      return sandboxResponse;
    }

    // Add headers to identify this as a sandbox response
    let headers = new Headers(sandboxResponse.headers);

    if (sandboxResponse.status === 500) {
      headers.set('X-Preview-Type', 'sandbox-error');
    } else {
      headers.set('X-Preview-Type', 'sandbox');
    }
    headers = setOriginControl(env, request, headers);
    headers.append('Vary', 'Origin');
    headers.set('Access-Control-Expose-Headers', 'X-Preview-Type');

    return new Response(sandboxResponse.body, {
      status: sandboxResponse.status,
      statusText: sandboxResponse.statusText,
      headers,
    });
  }

  // 2. If sandbox misses, attempt to dispatch to a deployed worker.
  logger.info(`Sandbox miss for ${hostname}, attempting dispatch to permanent worker.`);
  if (!isDispatcherAvailable(env)) {
    logger.warn(`Dispatcher not available, cannot serve: ${hostname}`);
    return new Response('This application is not currently available.', { status: 404 });
  }

  // Extract the app name (e.g., "xyz" from "xyz.build.cloudflare.dev").
  const appName = hostname.split('.')[0];
  const dispatcher = env['DISPATCHER'];

  try {
    const worker = dispatcher.get(appName);
    const dispatcherResponse = await worker.fetch(request);

    // Add headers to identify this as a dispatcher response
    let headers = new Headers(dispatcherResponse.headers);

    headers.set('X-Preview-Type', 'dispatcher');
    headers = setOriginControl(env, request, headers);
    headers.append('Vary', 'Origin');
    headers.set('Access-Control-Expose-Headers', 'X-Preview-Type');

    return new Response(dispatcherResponse.body, {
      status: dispatcherResponse.status,
      statusText: dispatcherResponse.statusText,
      headers,
    });
  } catch (error: any) {
    // This block catches errors if the binding doesn't exist or if worker.fetch() fails.
    logger.warn(`Error dispatching to worker '${appName}': ${error.message}`);
    return new Response('An error occurred while loading this application.', { status: 500 });
  }
}

/**
 * Main Worker fetch handler with robust, secure routing.
 */
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // logger.info(`Received request: ${request.method} ${request.url}`);
    // --- Pre-flight Checks ---

    // 1. Critical configuration check: Ensure custom domain is set.
    const previewDomain = getPreviewDomain(env);
    if (!previewDomain || previewDomain.trim() === '') {
      logger.error('FATAL: env.CUSTOM_DOMAIN is not configured in wrangler.toml or the Cloudflare dashboard.');
      return new Response('Server configuration error: Application domain is not set.', { status: 500 });
    }

    const url = new URL(request.url);
    const { hostname, pathname } = url;

    if (pathname === '/health-check/result') {
      if (request.method.toUpperCase() === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        });
      }

      if (request.method.toUpperCase() === 'POST') {
        return handleWorkerHealthResult(request, env, ctx);
      }

      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Security: Immediately reject any requests made via an IP address.
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      return new Response('Access denied. Please use the assigned domain name.', { status: 403 });
    }

    // --- Domain-based Routing ---

    // Normalize hostnames for both local development (localhost) and production.
    const isMainDomainRequest =
                hostname === env.CUSTOM_DOMAIN || hostname === 'localhost';
    const isSubdomainRequest =
                hostname.endsWith(`.${previewDomain}`) ||
                (hostname.endsWith('.localhost') && hostname !== 'localhost');

    // Route 1: Main Platform Request (e.g., build.cloudflare.dev or localhost)
    if (isMainDomainRequest) {
      // Handle Git protocol endpoints directly
      // Route: /apps/:id.git/info/refs or /apps/:id.git/git-upload-pack
      if (isGitProtocolRequest(pathname)) {
        return handleGitProtocolRequest(request, env, ctx);
      }

      // Serve static assets for all non-API routes from the ASSETS binding.
      if (!pathname.startsWith('/api/')) {
        return env.ASSETS.fetch(request);
      }
      // AI Gateway proxy for generated apps
      if (pathname.startsWith('/api/proxy/openai')) {
        // Only handle requests from valid origins of the preview domain
        const origin = request.headers.get('Origin');
        const previewDomain = getPreviewDomain(env);

        logger.info(`Origin: ${origin}, Preview Domain: ${previewDomain}`);

        return proxyToAiGateway(request, env, ctx);
        // if (origin && origin.endsWith(`.${previewDomain}`)) {
        //     return proxyToAiGateway(request, env, ctx);
        // }
        // logger.warn(`Access denied. Invalid origin: ${origin}, preview domain: ${previewDomain}`);
        // return new Response('Access denied. Invalid origin.', { status: 403 });
      }
      // Handle all API requests with the main Hono application.
      logger.info(`Handling API request for: ${url}`);
      const app = createApp(env);
      return app.fetch(request, env, ctx);
    }

    // Route 2: User App Request (e.g., xyz.build.cloudflare.dev or test.localhost)
    if (isSubdomainRequest) {
      return handleUserAppRequest(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export default worker;

// Scheduled handler for cron jobs
export const scheduled = {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const startTime = Date.now();
    const cronExpression = event.cron;

    logger.info(`Running scheduled task: ${cronExpression}`, {
      cron: cronExpression,
      scheduledTime: new Date(event.scheduledTime).toISOString(),
      timestamp: new Date().toISOString(),
    });

    try {
      // Import services dynamically to avoid circular dependencies
      const { OpsMonitorService } = await import('./services/ops/opsMonitorService');
      const { getServerByName } = await import('../../third_party/partykit/packages/partyserver/src/index');
      const { OpsMonitorBroadcastServer } = await import('./durable-objects/ops/OpsMonitorBroadcastServer');

      const db = new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB_OPS }) });

      // Create broadcast callback for scheduled scans
      const broadcastCallback = async (scanResult: any) => {
        const broadcastStartTime = Date.now();
        try {
          const broadcastServer = await getServerByName(
            (env as any).OPS_MONITOR_BROADCAST as DurableObjectNamespace<OpsMonitorBroadcastServer>,
            'main'
          );

          await broadcastServer.fetch(
            new Request('http://dummy/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scanResult),
            })
          );

          const broadcastDuration = Date.now() - broadcastStartTime;
          logger.info('Scan result broadcast successful', {
            cron: cronExpression,
            scanId: scanResult.scanId,
            broadcastDuration,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const broadcastDuration = Date.now() - broadcastStartTime;
          logger.error('Failed to broadcast scan result from scheduled handler', {
            cron: cronExpression,
            error: error instanceof Error ? error.message : String(error),
            broadcastDuration,
            timestamp: new Date().toISOString(),
          });
          // Don't throw - broadcast failure shouldn't fail the scan
        }
      };

      const opsMonitor = new OpsMonitorService(db, broadcastCallback);
      let scanResult: any = null;
      let scanType: 'full' | 'incremental' | null = null;

      try {
        // Run different operations based on cron schedule
        if (event.cron === '0 2 * * *') {
          // Daily full scan at 2 AM
          scanType = 'full';
          logger.info('Running daily full operations scan', {
            cron: cronExpression,
            scanType,
            timestamp: new Date().toISOString(),
          });

          const scanStartTime = Date.now();
          scanResult = await opsMonitor.runScan({ scope: 'full' });
          const scanDuration = Date.now() - scanStartTime;

          logger.info('Daily full operations scan completed', {
            cron: cronExpression,
            scanId: scanResult.scanId,
            scanType,
            processedLogs: scanResult.processedLogs,
            issuesFiled: scanResult.issuesFiled,
            scanDuration,
            timestamp: new Date().toISOString(),
          });

        } else if (event.cron === '0 */4 * * *') {
          // Incremental scans every 4 hours
          scanType = 'incremental';
          logger.info('Running incremental operations scan', {
            cron: cronExpression,
            scanType,
            timestamp: new Date().toISOString(),
          });

          const scanStartTime = Date.now();
          scanResult = await opsMonitor.runScan({ scope: 'incremental' });
          const scanDuration = Date.now() - scanStartTime;

          logger.info('Incremental operations scan completed', {
            cron: cronExpression,
            scanId: scanResult.scanId,
            scanType,
            processedLogs: scanResult.processedLogs,
            issuesFiled: scanResult.issuesFiled,
            scanDuration,
            timestamp: new Date().toISOString(),
          });

        } else {
          logger.warn('Unhandled cron schedule - no scan executed', {
            cron: cronExpression,
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        await db.destroy();
      }

      const totalDuration = Date.now() - startTime;
      logger.info('Scheduled task completed successfully', {
        cron: cronExpression,
        scanType,
        scanId: scanResult?.scanId || null,
        totalDuration,
        processedLogs: scanResult?.processedLogs || 0,
        issuesFiled: scanResult?.issuesFiled || 0,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error('Error in scheduled task', {
        cron: cronExpression,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        totalDuration,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

// Wrap the entire worker with Sentry for comprehensive error monitoring.
// export default Sentry.withSentry(sentryOptions, worker);

async function handleWorkerHealthResult(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const payload = await request.json();
    const workerCheckUuid =
      typeof payload?.worker_check_uuid === 'string' ? payload.worker_check_uuid : undefined;
    const results = payload?.results;

    if (!workerCheckUuid || typeof results !== 'object' || results === null) {
      return new Response(JSON.stringify({ ok: false, error: 'worker_check_uuid and results are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const health = new Health(ctx, env);
    const outcome = await health.receiveHealthCheckResult(workerCheckUuid, results);

    return new Response(JSON.stringify({ ok: outcome.success, message: outcome.message }), {
      status: outcome.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    console.error('Failed to process health check result:', error);

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unable to process health check result payload',
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
