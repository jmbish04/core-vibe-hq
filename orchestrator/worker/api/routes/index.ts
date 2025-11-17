import { setupAuthRoutes } from './authRoutes';
import { setupAppRoutes } from './appRoutes';
import { setupUserRoutes } from './userRoutes';
import { setupStatsRoutes } from './statsRoutes';
import { setupAnalyticsRoutes } from './analyticsRoutes';
import { setupSecretsRoutes } from './secretsRoutes';
import { setupModelConfigRoutes } from './modelConfigRoutes';
import { setupModelProviderRoutes } from './modelProviderRoutes';
import { setupGitHubExporterRoutes } from './githubExporterRoutes';
import { setupCodegenRoutes } from './codegenRoutes';
import { setupScreenshotRoutes } from './imagesRoutes';
import { setupSentryRoutes } from './sentryRoutes';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import type { Env } from '../../types';
import { setupStatusRoutes } from './statusRoutes';
import { healthTestRoutes } from './healthTestRoutes';
import { specialistLogRoutes } from './specialistLogRoutes';
import { opsRoutes } from './opsRoutes';
import { agentRoutes } from './agentRoutes';
import { factoryRoutes } from './factoryRoutes';
import { dockerfileAgentApi } from '../../agents/dockerfileSpecialist';
import { coordsApi } from './coordRoutes';
import { templateRoutes } from './templateRoutes';
import { hilRoutes } from './hilRoutes';
import { aiProviderRoutes } from './aiProviderRoutes';
import { orderRoutes } from './orderRoutes';
import { containerMonitoringRoutes } from './containerMonitoringRoutes';
import { setupWebSocketRoutes, websocketAuthMiddleware } from './websocket';
import { WebSocketHub } from '../../services/websocket';
import { setupPatchRoutes } from './patchRoutes';
import { setupCoreAnalyticsRoutes } from './coreAnalyticsRoutes';
import { setupOpsIntegrationsRoutes } from './opsIntegrations';
import { setupDeliveryReportRoutes } from './deliveryReports';
import { setupPatchEventsRoutes } from './patchEvents';
import { setupPatchLogsRoutes } from './patchLogs';
import { setupPatchStatsRoutes } from './patchStats';
import { setupPatchTrendsRoutes } from './patchTrends';
import { setupTerminalRoutes } from './terminalRoutes';
import { setupOpsBroadcastRoutes } from './opsBroadcastRoutes';
import { setupHealthBroadcastRoutes } from './healthBroadcastRoutes';
import { healthRoutes } from './healthRoutes';
import { HealthCheckHandler } from '@shared/handlers/healthCheckHandler';
import type { WorkerHealthCheckEnv } from '@shared/health/workerHealthCheck';

export function setupRoutes(app: Hono<AppEnv>): void {
  // Initialize WebSocket Hub
  const websocketHub = new WebSocketHub();

  // Sentry tunnel routes (public - no auth required)
  setupSentryRoutes(app);

  // Platform status routes (public)
  setupStatusRoutes(app);

  // Health summary & orchestration routes
  app.route('/api/health', healthRoutes);

  // Health test telemetry
  app.route('/api/health/tests', healthTestRoutes);

  // Specialist logging routes
  app.route('/api/specialists', specialistLogRoutes);

  // Ops Specialist routes
  app.route('/ops', opsRoutes);

  // Agent routes
  app.route('/api/agents', agentRoutes);

  // Factory management routes
  app.route('/api/factories', factoryRoutes);

  // Template management routes
  app.route('/api/templates', templateRoutes);

  // Order management routes
  app.route('/api/orders', orderRoutes);

  // Human-in-the-Loop (HIL) routes
  app.route('/api/hil', hilRoutes);

  // AI Provider clarification routes
  app.route('/api/ai-provider', aiProviderRoutes);

  // Dockerfile specialist routes
  app.route('/api/dockerfile', dockerfileAgentApi);
  app.route('/api/containers', dockerfileAgentApi);

  // Coordinate resolver routes
  app.route('/api/coords', coordsApi);

  // Authentication and user management routes
  setupAuthRoutes(app);

  // Codegen routes
  setupCodegenRoutes(app);

  // User dashboard and profile routes
  setupUserRoutes(app);

  // App management routes
  setupAppRoutes(app);

  // Stats routes
  setupStatsRoutes(app);

  // AI Gateway Analytics routes
  setupAnalyticsRoutes(app);

  // Secrets management routes
  setupSecretsRoutes(app);

  // Model configuration and provider keys routes
  setupModelConfigRoutes(app);

  // Model provider routes
  setupModelProviderRoutes(app);

  // GitHub Exporter routes
  setupGitHubExporterRoutes(app);

  // Screenshot serving routes (public)
  setupScreenshotRoutes(app);

  // Container monitoring routes
  app.route('/api/monitoring', containerMonitoringRoutes);

  // Patch routes
  setupPatchRoutes(app);

  // Core analytics routes
  setupCoreAnalyticsRoutes(app);

  // Delivery reports routes
  setupDeliveryReportRoutes(app);

  // Ops & integrations routes
  setupOpsIntegrationsRoutes(app);

  // Patch events routes
  setupPatchEventsRoutes(app, {
    db: app.env.DB_OPS,
    wsHub: websocketHub,
    d1Logger: new (await import('../../services/patch/d1Logger')).D1Logger(app.env.DB_OPS),
  });

  // Patch logs routes
  setupPatchLogsRoutes(app);

  // Patch stats routes
  setupPatchStatsRoutes(app);

  // Patch trends routes
  setupPatchTrendsRoutes(app);

  // WebSocket routes with authentication middleware
  app.use('/ws', websocketAuthMiddleware(websocketHub));
  setupWebSocketRoutes(app, websocketHub);

  // Terminal streaming routes (PartyServer)
  setupTerminalRoutes(app);

  // Ops monitor broadcast routes (PartyServer)
  setupOpsBroadcastRoutes(app);

  // Health check broadcast routes (PartyServer)
  setupHealthBroadcastRoutes(app);

  const forwardHealthCheck = async (c: any) => {
    const handler = new HealthCheckHandler(toWorkerHealthEnv(c.env as Env));
    return handler.handleRequest(c.req.raw);
  };

  app.post('/health-check/execute', forwardHealthCheck);
  app.get('/health-check/status', forwardHealthCheck);
  app.get('/health-check/quick', forwardHealthCheck);
}

function toWorkerHealthEnv(env: Env): WorkerHealthCheckEnv {
  const typedEnv = env as unknown as Record<string, any>;
  return {
    WORKER_NAME: env.WORKER_NAME ?? 'orchestrator',
    WORKER_TYPE: env.WORKER_TYPE ?? 'orchestrator',
    ORCHESTRATOR_LOGGING: typedEnv.ORCHESTRATOR_LOGGING,
    ORCHESTRATOR_TASKS: typedEnv.ORCHESTRATOR_TASKS,
    ORCHESTRATOR_GITHUB: typedEnv.ORCHESTRATOR_GITHUB,
    AI: env.AI,
  };
}
