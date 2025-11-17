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
import { Hono } from "hono";
import { AppEnv } from "../../../packages/shared-types/src/api-types";
import { setupStatusRoutes } from './statusRoutes';
import { opsRoutes } from './opsRoutes';
import { agentRoutes } from './agentRoutes';
import { factoryRoutes } from './factoryRoutes';
import { dockerfileAgentApi } from '../../agents/dockerfileSpecialist';
import { coordsApi } from './coordRoutes';
import { templateRoutes } from './templateRoutes';
import { hilRoutes } from './hilRoutes';
import { aiProviderRoutes } from './aiProviderRoutes';
import { orderRoutes } from './orderRoutes';

export function setupRoutes(app: Hono<AppEnv>): void {
    // Health check route
    app.get('/api/health', (c) => {
        return c.json({ status: 'ok' });
    }); 
    
    // Sentry tunnel routes (public - no auth required)
    setupSentryRoutes(app);

    // Platform status routes (public)
    setupStatusRoutes(app);
    
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
}
