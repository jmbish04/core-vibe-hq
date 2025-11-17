import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, ConfigGenerationRequest, TestExecutionRequest } from './types';
import { ConfigGenerator } from './services/ConfigGenerator';
import { TestExecutor } from './services/TestExecutor';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for web clients
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    service: 'frontend-testing-specialist',
    status: 'healthy',
    capabilities: ['playwright', 'puppeteer', 'config-generation', 'test-execution'],
    environments: ['local', 'cloudflare', 'production']
  });
});

// Generate test configuration
app.post('/config/generate', async (c) => {
  try {
    const request: ConfigGenerationRequest = await c.req.json();

    // Validate required fields
    if (!request.framework || !request.environment || !request.projectType) {
      return c.json({
        error: 'Missing required fields: framework, environment, projectType'
      }, 400);
    }

    const generator = new ConfigGenerator();
    const result = await generator.generateConfig(request);

    return c.json({
      success: true,
      config: result
    });
  } catch (error) {
    console.error('Config generation error:', error);
    return c.json({
      error: 'Failed to generate configuration',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Execute tests
app.post('/tests/execute', async (c) => {
  try {
    const request: TestExecutionRequest = await c.req.json();

    // Validate required fields
    if (!request.framework || !request.environment || !request.testType || !request.config) {
      return c.json({
        error: 'Missing required fields: framework, environment, testType, config'
      }, 400);
    }

    const executor = new TestExecutor(c.env);
    const result = await executor.executeTests(request);

    // Store results for later retrieval
    await executor.storeResults(result.id, result);

    return c.json({
      success: true,
      execution: result
    });
  } catch (error) {
    console.error('Test execution error:', error);
    return c.json({
      error: 'Failed to execute tests',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get test execution results
app.get('/tests/results/:executionId', async (c) => {
  try {
    const executionId = c.req.param('executionId');
    const executor = new TestExecutor(c.env);
    const results = await executor.getResults(executionId);

    if (!results) {
      return c.json({
        error: 'Test execution not found'
      }, 404);
    }

    return c.json({
      success: true,
      execution: results
    });
  } catch (error) {
    console.error('Results retrieval error:', error);
    return c.json({
      error: 'Failed to retrieve results',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get available test templates
app.get('/templates', (c) => {
  const templates = {
    playwright: {
      frameworks: ['react', 'vue', 'angular', 'next', 'nuxt', 'vanilla'],
      environments: ['local', 'cloudflare', 'production'],
      testTypes: ['smoke', 'integration', 'e2e', 'visual-regression']
    },
    puppeteer: {
      frameworks: ['react', 'vue', 'angular', 'vanilla'],
      environments: ['local', 'cloudflare', 'production'],
      testTypes: ['smoke', 'integration', 'e2e']
    }
  };

  return c.json({
    success: true,
    templates
  });
});

// Quick setup endpoint for common configurations
app.post('/setup/quick', async (c) => {
  try {
    const { projectType, environment = 'local', framework = 'playwright' } = await c.req.json();

    if (!projectType) {
      return c.json({
        error: 'projectType is required'
      }, 400);
    }

    const generator = new ConfigGenerator();
    const result = await generator.generateConfig({
      framework: framework as 'playwright' | 'puppeteer',
      environment: environment as 'local' | 'cloudflare' | 'production',
      projectType: projectType as any
    });

    return c.json({
      success: true,
      message: 'Configuration generated successfully',
      setup: result
    });
  } catch (error) {
    console.error('Quick setup error:', error);
    return c.json({
      error: 'Failed to generate quick setup',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Cloudflare-specific endpoint for running tests on live workers
app.post('/cloudflare/test', async (c) => {
  try {
    const { workerName, zoneId, framework = 'playwright', testType = 'smoke' } = await c.req.json();

    if (!workerName) {
      return c.json({
        error: 'workerName is required'
      }, 400);
    }

    // Construct the live worker URL
    const targetUrl = `https://${workerName}.${c.env.CLOUDFLARE_ZONE_ID || zoneId || 'workers.dev'}`;

    const executor = new TestExecutor(c.env);
    const result = await executor.executeTests({
      framework: framework as 'playwright' | 'puppeteer',
      environment: 'cloudflare',
      testType: testType as any,
      config: {
        framework: framework as any,
        browser: 'chromium',
        headless: true,
        timeout: 30000
      },
      targetUrl,
      cloudflareWorkerName: workerName,
      cloudflareZoneId: zoneId
    });

    // Store results
    await executor.storeResults(result.id, result);

    return c.json({
      success: true,
      message: `Tests executed on live Cloudflare Worker: ${workerName}`,
      execution: result
    });
  } catch (error) {
    console.error('Cloudflare test error:', error);
    return c.json({
      error: 'Failed to execute tests on Cloudflare Worker',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Local development endpoint
app.post('/local/test', async (c) => {
  try {
    const { port = 3000, framework = 'playwright', testType = 'smoke' } = await c.req.json();

    const targetUrl = `http://localhost:${port}`;

    const executor = new TestExecutor(c.env);
    const result = await executor.executeTests({
      framework: framework as 'playwright' | 'puppeteer',
      environment: 'local',
      testType: testType as any,
      config: {
        framework: framework as any,
        browser: 'chromium',
        headless: false,
        timeout: 30000
      },
      targetUrl
    });

    // Store results
    await executor.storeResults(result.id, result);

    return c.json({
      success: true,
      message: `Tests executed on local development server: ${targetUrl}`,
      execution: result,
      note: 'Local tests run in non-headless mode for debugging. Use Cloudflare environment for headless testing.'
    });
  } catch (error) {
    console.error('Local test error:', error);
    return c.json({
      error: 'Failed to execute local tests',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Status endpoint
app.get('/', (c) => {
  return c.json({
    service: 'frontend-testing-specialist',
    description: 'Specialist for configuring and running Playwright and Puppeteer tests on frontend applications',
    endpoints: {
      'GET /health': 'Health check and capabilities',
      'POST /config/generate': 'Generate test configuration',
      'POST /tests/execute': 'Execute tests with custom configuration',
      'GET /tests/results/:executionId': 'Get test execution results',
      'GET /templates': 'Get available test templates',
      'POST /setup/quick': 'Quick setup for common configurations',
      'POST /cloudflare/test': 'Run tests on live Cloudflare Worker',
      'POST /local/test': 'Run tests on local development server'
    },
    supported: {
      frameworks: ['playwright', 'puppeteer'],
      environments: ['local', 'cloudflare', 'production'],
      projectTypes: ['react', 'vue', 'angular', 'next', 'nuxt', 'vanilla']
    }
  });
});

export default app;
