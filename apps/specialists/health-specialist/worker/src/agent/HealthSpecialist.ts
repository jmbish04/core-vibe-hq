import { BaseAgent, StructuredLogger, AgentContext } from '@shared/base/agents';
import { nanoid } from 'nanoid';
import { AiService } from '../services/aiService';
import { OrchestratorHealthClient, type HealthDatabaseClient } from '../services/healthDatabaseClient';
import type { TestProfile, TestResult, HealthSummary } from '../services/healthTypes';
import type { BaseEnv } from '@shared/types/env';
import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

export interface HealthSpecialistEnv extends BaseEnv {
  AI: any;
  // Orchestrator RPC bindings
  ORCHESTRATOR_HEALTH: any;
  // WebSocket and other bindings
  HEALTH_WEBSOCKET?: DurableObject;
}

export interface HealthTest {
  id: string;
  profile: TestProfile;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: TestResult;
  logs: string[];
}

export interface HealthRun {
  id: string;
  tests: HealthTest[];
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  summary?: HealthSummary;
}

interface HealthSpecialistState {
  activeRuns: Map<string, HealthRun>;
  cronInterval?: number;
  lastCronRun?: number;
  websocketConnections: Set<any>;
}

export class HealthSpecialist extends BaseAgent {
  protected env: HealthSpecialistEnv;
  private dbClient: HealthDatabaseClient;
  private aiService: AiService;
  private state: HealthSpecialistState;
  private storage: DurableObjectStorage;

  constructor(
    env: HealthSpecialistEnv,
    logger: StructuredLogger,
    context: AgentContext = {}
  ) {
    super(env, logger, context);
    this.env = env;
    this.storage = (this as any).storage || ({} as DurableObjectStorage);
    this.dbClient = new OrchestratorHealthClient(env.ORCHESTRATOR_HEALTH);
    this.aiService = new AiService(env, this.dbClient);

    this.state = {
      activeRuns: new Map(),
      websocketConnections: new Set()
    };
  }

  /**
   * Initialize the health specialist with D1-backed test system
   */
  async onStart(): Promise<void> {
    this.logger.info('HealthSpecialist: Initializing health monitoring system');

    // Load state from storage
    await this.loadState();

    // Ensure default test profiles exist in D1
    await this.ensureDefaultTestProfiles();

    // Start cron-based health monitoring
    await this.startCronMonitoring();

    // Start background health monitoring
    await this.startBackgroundMonitoring();
  }

  private async loadState(): Promise<void> {
    const storedState = await this.storage.get('health-specialist-state') as Partial<HealthSpecialistState>;
    if (storedState) {
      this.state = { ...this.state, ...storedState };
      // Reconstruct Map from stored data
      this.state.activeRuns = new Map(storedState.activeRuns || []);
    }
  }

  private async saveState(): Promise<void> {
    const stateToSave = {
      ...this.state,
      activeRuns: Array.from(this.state.activeRuns.entries())
    };
    await this.storage.put('health-specialist-state', stateToSave);
  }

  /**
   * Generate new worker health setup - creates D1 schema and default tests
   */
  async generateNewWorkerHealth(params: {
    projectId: string;
    projectName: string;
    baseUrl: string;
  }): Promise<any> {
    this.logger.info('HealthSpecialist: Setting up health monitoring for new worker', { projectId: params.projectId });

    try {
      // Generate D1 schema for test definitions and results
      const schema = await this.generateD1Schema();

      // Generate default test profiles
      const testProfiles = await this.generateDefaultTests(params);

      // Generate test runner with AI analysis
      const testRunner = await this.generateTestRunner();

      // Generate OpenAPI documentation
      const openApiDocs = await this.generateHealthOpenApi(params);

      return {
        success: true,
        schema,
        testProfiles,
        testRunner,
        openApiDocs
      };
    } catch (error) {
      this.logger.error('Failed to generate worker health setup', { error, projectId: params.projectId });
      throw error;
    }
  }

  /**
   * Retrofit existing worker with health monitoring
   */
  async retrofitWorkerHealth(params: {
    projectId: string;
    projectName: string;
    baseUrl: string;
    existingApiSpec?: any;
  }): Promise<any> {
    this.logger.info('HealthSpecialist: Retrofitting health monitoring for existing worker', { projectId: params.projectId });

    try {
      // Analyze existing worker APIs
      const analysis = await this.analyzeExistingAPIs(params);

      // Generate appropriate health tests based on analysis
      const customTests = await this.generateCustomTests(analysis);

      // Update existing APIs to include health endpoints
      const updatedApis = await this.updateExistingApis(params);

      return {
        success: true,
        analysis,
        customTests,
        updatedApis
      };
    } catch (error) {
      this.logger.error('Failed to retrofit worker health', { error, projectId: params.projectId });
      throw error;
    }
  }

  private async generateD1Schema(): Promise<string> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['orm-policy'],
      {},
      [
        'Generate D1 schema SQL for health monitoring system.',
        'Include test_defs table with id, name, description, category, severity, is_active, error_map.',
        'Include test_results table with id, session_uuid, test_fk, started_at, finished_at, duration_ms, status, error_code, raw JSON, ai_human_readable_error_description, ai_prompt_to_fix_error.',
        'Include proper indexes for performance.',
        'Use SQLite-compatible syntax.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.1
    });

    return this.extractContent(response);
  }

  private async generateDefaultTests(params: any): Promise<any[]> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['testing-policy'],
      {
        projectName: params.projectName,
        baseUrl: params.baseUrl
      },
      [
        'Generate default health test definitions for a Cloudflare Worker.',
        'Include unit tests: API endpoint availability, response validation.',
        'Include integration tests: external API dependencies, database connectivity.',
        'Include performance tests: response times, memory usage.',
        'Include security tests: CORS, headers, input validation.',
        'Each test should have: name, description, category, severity, error_map with fixes.',
        'Return as JSON array of test definitions.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1
    });

    const content = this.extractContent(response);
    return JSON.parse(content);
  }

  private async generateTestRunner(): Promise<string> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['orm-policy', 'framework-policy'],
      {},
      [
        'Generate a comprehensive test runner using Kysely + Drizzle.',
        'Include parallel test execution with concurrency limits.',
        'For each test failure, call Workers AI to generate human-readable error description and fix suggestions.',
        'Attempt safe auto-remediation (cache warming, retry logic, feature flags).',
        'Store results in D1 with session tracking.',
        'Return complete TypeScript implementation.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.1
    });

    return this.extractContent(response);
  }

  private async generateHealthOpenApi(params: any): Promise<any> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['framework-policy'],
      {
        projectName: params.projectName,
        baseUrl: params.baseUrl
      },
      [
        'Generate OpenAPI 3.1.0 specification for health monitoring endpoints.',
        'Include /api/health, /api/tests/run, /api/tests/defs, /api/tests/session/:id.',
        'Include /ws for WebSocket health updates.',
        'Use operationId for ChatGPT Custom Actions compatibility.',
        'Include proper schemas for HealthResponse, TestSession, etc.',
        'Return as JSON OpenAPI specification.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1
    });

    const content = this.extractContent(response);
    return JSON.parse(content);
  }

  private async analyzeExistingAPIs(params: any): Promise<any> {
    if (!params.existingApiSpec) {
      // Try to fetch from the worker
      try {
        const response = await fetch(`${params.baseUrl}/openapi.json`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        this.logger.warn('Could not fetch existing API spec', { error });
      }
    }

    return params.existingApiSpec || {};
  }

  private async generateCustomTests(analysis: any): Promise<any[]> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['testing-policy'],
      { analysis: JSON.stringify(analysis) },
      [
        'Based on the existing API analysis, generate custom health tests.',
        'Test each endpoint for availability and correct responses.',
        'Test authentication and authorization if present.',
        'Test rate limits and error handling.',
        'Generate tests that validate the actual API behavior found in the analysis.',
        'Return as JSON array of custom test definitions.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1
    });

    const content = this.extractContent(response);
    return JSON.parse(content);
  }

  private async updateExistingApis(params: any): Promise<any> {
    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['framework-policy'],
      {
        projectName: params.projectName,
        baseUrl: params.baseUrl
      },
      [
        'Generate code to add health monitoring endpoints to existing worker.',
        'Add GET /api/health endpoint for health status.',
        'Add POST /api/tests/run endpoint to trigger tests.',
        'Add GET /api/tests/defs endpoint for test definitions.',
        'Add GET /api/tests/session/:id endpoint for test results.',
        'Add WebSocket support at /ws for real-time updates.',
        'Ensure compatibility with existing Hono router.',
        'Return complete code additions.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1
    });

    return this.extractContent(response);
  }

  /**
   * Start cron-based health monitoring (runs every 15 minutes)
   */
  private async startCronMonitoring(): Promise<void> {
    // This would be triggered by wrangler cron configuration
    // For now, we'll set up an interval for testing
    this.state.cronInterval = setInterval(async () => {
      await this.runScheduledHealthCheck();
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * Run scheduled health check with AI analysis and self-healing
   */
  private async runScheduledHealthCheck(): Promise<void> {
    const sessionId = nanoid();

    try {
      this.logger.info('Starting scheduled health check', { sessionId });

      // Run all active tests
      const results = await this.runAllTests(sessionId);

      // Analyze failures with AI and attempt self-healing
      await this.analyzeAndHeal(results, sessionId);

      // Update health summary
      await this.updateHealthSummary(results, sessionId);

      this.state.lastCronRun = Date.now();
      await this.saveState();

      this.logger.info('Scheduled health check completed', { sessionId, resultsCount: results.length });

    } catch (error) {
      this.logger.error('Scheduled health check failed', { error, sessionId });
    }
  }

  /**
   * Run all active tests with parallel execution and AI analysis
   */
  private async runAllTests(sessionId: string): Promise<any[]> {
    // Get active test profiles from D1
    const activeTests = await this.dbClient.getActiveTestProfiles();

    // Run tests in parallel with concurrency limit
    const concurrencyLimit = 5;
    const results: any[] = [];

    for (let i = 0; i < activeTests.length; i += concurrencyLimit) {
      const batch = activeTests.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(test => this.runSingleTest(test, sessionId));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Run a single test with timing and error handling
   */
  private async runSingleTest(testProfile: any, sessionId: string): Promise<any> {
    const startTime = Date.now();

    try {
      const result = await this.executeTest(testProfile);
      const endTime = Date.now();

      // Store result in D1
      await this.dbClient.saveTestResult({
        id: nanoid(),
        session_uuid: sessionId,
        test_fk: testProfile.id,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date(endTime).toISOString(),
        duration_ms: endTime - startTime,
        status: result.passed ? 'pass' : 'fail',
        error_code: result.errorCode,
        raw: JSON.stringify(result.raw || {}),
        ai_human_readable_error_description: null, // Will be filled by AI analysis
        ai_prompt_to_fix_error: null // Will be filled by AI analysis
      });

      return result;

    } catch (error) {
      const endTime = Date.now();

      // Store failed result
      await this.dbClient.saveTestResult({
        id: nanoid(),
        session_uuid: sessionId,
        test_fk: testProfile.id,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date(endTime).toISOString(),
        duration_ms: endTime - startTime,
        status: 'fail',
        error_code: 'TEST_EXECUTION_ERROR',
        raw: JSON.stringify({ error: error.message }),
        ai_human_readable_error_description: null,
        ai_prompt_to_fix_error: null
      });

      return { passed: false, errorCode: 'TEST_EXECUTION_ERROR', error: error.message };
    }
  }

  /**
   * Execute actual test logic
   */
  private async executeTest(testProfile: any): Promise<any> {
    // This would contain the actual test execution logic
    // For now, return a mock result
    return {
      passed: Math.random() > 0.3, // 70% pass rate for demo
      errorCode: null,
      raw: { message: 'Test executed successfully' }
    };
  }

  /**
   * Analyze test failures with AI and attempt self-healing
   */
  private async analyzeAndHeal(results: any[], sessionId: string): Promise<void> {
    const failures = results.filter(r => !r.passed);

    for (const failure of failures) {
      try {
        // Get AI analysis
        const aiAnalysis = await this.aiService.analyzeFailure(failure);

        // Update result with AI analysis
        await this.dbClient.updateTestResultWithAIAnalysis(
          failure.resultId,
          aiAnalysis.humanReadable,
          aiAnalysis.fixPrompt
        );

        // Attempt auto-healing if safe
        if (aiAnalysis.canAutoHeal) {
          await this.attemptSelfHealing(aiAnalysis, failure);
        }

      } catch (error) {
        this.logger.error('AI analysis failed', { error, testId: failure.testId });
      }
    }
  }

  /**
   * Attempt safe self-healing operations
   */
  private async attemptSelfHealing(aiAnalysis: any, failure: any): Promise<void> {
    try {
      // Only attempt safe operations like cache warming, retries, feature flags
      // Never attempt destructive operations

      if (aiAnalysis.healingStrategy === 'cache_warm') {
        await this.warmCache(failure);
      } else if (aiAnalysis.healingStrategy === 'retry') {
        await this.retryFailedOperation(failure);
      } else if (aiAnalysis.healingStrategy === 'feature_flag') {
        await this.toggleFeatureFlag(failure);
      }

      this.logger.info('Self-healing attempted', {
        strategy: aiAnalysis.healingStrategy,
        testId: failure.testId
      });

    } catch (error) {
      this.logger.error('Self-healing failed', { error, testId: failure.testId });
    }
  }

  private async warmCache(failure: any): Promise<void> {
    // Implement cache warming logic
  }

  private async retryFailedOperation(failure: any): Promise<void> {
    // Implement retry logic
  }

  private async toggleFeatureFlag(failure: any): Promise<void> {
    // Implement feature flag toggle
  }

  /**
   * Update overall health summary
   */
  private async updateHealthSummary(results: any[], sessionId: string): Promise<void> {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const summary = {
      session_uuid: sessionId,
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: failedTests,
      overall_status: failedTests === 0 ? 'healthy' : failedTests < 3 ? 'warning' : 'critical',
      average_latency: results.reduce((sum, r) => sum + (r.duration || 0), 0) / totalTests,
      created_at: new Date().toISOString()
    };

    await this.dbClient.saveHealthSummary(summary);
  }

  private extractContent(response: any): string {
    if (typeof response === 'string') return response;
    if (response?.response) return response.response;
    if (response?.result) return response.result;
    return '';
  }

  /**
   * Handle HTTP requests for health data
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/health/status')) {
      return this.handleHealthStatus(request);
    }

    if (url.pathname.startsWith('/api/health/results')) {
      return this.handleHealthResults(request);
    }

    if (url.pathname.startsWith('/api/health/run')) {
      return this.handleRunTests(request);
    }

    if (url.pathname.startsWith('/api/health/dashboard')) {
      return this.handleDashboardData(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle WebSocket connections for real-time health updates
   */
  async onConnect(connection: any): Promise<void> {
    console.log('HealthSpecialist: WebSocket connection established');

    // Send initial health status
    const status = await this.getCurrentHealthStatus();
    connection.send(JSON.stringify({
      type: 'health_status',
      data: status,
      timestamp: Date.now()
    }));

    // Subscribe to health updates
    this.subscribeToHealthUpdates(connection);
  }

  /**
   * Run daily health tests (called by cron)
   */
  async runDailyHealthCheck(): Promise<void> {
    console.log('HealthSpecialist: Starting daily health check');

    const runId = `daily-${nanoid()}`;
    const run: HealthRun = {
      id: runId,
      tests: [],
      status: 'running',
      startTime: Date.now()
    };

    this.activeRuns.set(runId, run);

    try {
      // Get all enabled test profiles
      const testProfiles = await this.dbClient.getTestProfiles();

      // Broadcast run start
      this.broadcastToWebSocket({
        type: 'run_started',
        runId,
        totalTests: testProfiles.length,
        timestamp: Date.now()
      });

      // Execute tests
      for (const profile of testProfiles) {
        const test = await this.executeTest(profile, runId);
        run.tests.push(test);

        // Broadcast test result
        this.broadcastToWebSocket({
          type: 'test_completed',
          runId,
          testId: test.id,
          status: test.status,
          duration: test.endTime ? test.endTime - (test.startTime || 0) : 0,
          timestamp: Date.now()
        });
      }

      // Generate health summary
      run.summary = await this.generateHealthSummary(run.tests, runId);
      run.status = 'completed';
      run.endTime = Date.now();

      // Save summary
      await this.dbClient.createHealthSummary(run.summary);

      // Broadcast completion
      this.broadcastToWebSocket({
        type: 'run_completed',
        runId,
        summary: run.summary,
        duration: run.endTime - run.startTime,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('HealthSpecialist: Daily health check failed:', error);
      run.status = 'failed';
      run.endTime = Date.now();

      this.broadcastToWebSocket({
        type: 'run_failed',
        runId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }

    // Clean up old runs
    this.cleanupOldRuns();
  }

  /**
   * Execute a single health test
   */
  private async executeTest(profile: TestProfile, runId: string): Promise<HealthTest> {
    const test: HealthTest = {
      id: nanoid(),
      profile,
      status: 'pending',
      logs: []
    };

    test.startTime = Date.now();
    test.status = 'running';

    try {
      // Create test result record
      const testResult = await this.dbClient.createTestResult({
        testProfileId: profile.id,
        runId,
        status: 'running',
        startedAt: test.startTime,
        triggeredBy: 'cron'
      });

      if (!testResult) {
        throw new Error('Failed to create test result record');
      }

      test.result = testResult as TestResult;

      // Execute the actual test based on category
      const result = await this.runTestByCategory(profile);

      // Update test result
      const endTime = Date.now();
      await this.dbClient.updateTestResult(testResult.id, {
        status: result.success ? 'passed' : 'failed',
        durationMs: endTime - test.startTime,
        completedAt: endTime,
        output: JSON.stringify(result.output),
        metrics: JSON.stringify(result.metrics),
        errorMessage: result.error
      });

      test.endTime = endTime;
      test.status = result.success ? 'completed' : 'failed';
      test.logs = result.logs;

      // Use AI to analyze results if test failed or for deeper insights
      if (!result.success || profile.category === 'ai') {
        await this.analyzeTestResultsWithAI(profile, result, testResult.id);
      }

    } catch (error) {
      console.error(`HealthSpecialist: Test ${profile.name} failed:`, error);

      test.status = 'failed';
      test.endTime = Date.now();
      test.logs.push(`Error: ${error instanceof Error ? error.message : String(error)}`);

      // Update test result with failure
      if (test.result) {
        await this.dbService.updateTestResult(test.result.id, {
          status: 'failed',
          durationMs: test.endTime - (test.startTime || 0),
          completedAt: test.endTime,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return test;
  }

  /**
   * Run test based on category
   */
  private async runTestByCategory(profile: TestProfile): Promise<{
    success: boolean;
    output: any;
    metrics: any;
    error?: string;
    logs: string[];
  }> {
    const logs: string[] = [`Starting ${profile.category} test: ${profile.name}`];

    try {
      switch (profile.category) {
        case 'unit':
          return await this.runUnitTest(profile, logs);
        case 'integration':
          return await this.runIntegrationTest(profile, logs);
        case 'performance':
          return await this.runPerformanceTest(profile, logs);
        case 'security':
          return await this.runSecurityTest(profile, logs);
        case 'ai':
          return await this.runAiTest(profile, logs);
        default:
          throw new Error(`Unknown test category: ${profile.category}`);
      }
    } catch (error) {
      logs.push(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        output: null,
        metrics: {},
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }

  /**
   * Run unit tests
   */
  private async runUnitTest(profile: TestProfile, logs: string[]): Promise<any> {
    // Implementation for unit tests
    logs.push('Running unit test checks...');

    // This would integrate with actual test runners
    // For now, simulate basic connectivity tests
    const success = await this.checkServiceConnectivity(profile.target);
    logs.push(`Unit test result: ${success ? 'PASSED' : 'FAILED'}`);

    return {
      success,
      output: { connectivity: success },
      metrics: { responseTime: Math.random() * 1000 },
      logs
    };
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTest(profile: TestProfile, logs: string[]): Promise<any> {
    logs.push('Running integration test checks...');

    const config = JSON.parse(profile.config || '{}');
    const endpoints = config.endpoints || [];

    const results = [];
    let success = true;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${profile.target}${endpoint}`, {
          timeout: profile.timeoutSeconds * 1000
        });

        const result = {
          endpoint,
          status: response.status,
          success: response.ok
        };

        results.push(result);
        logs.push(`Endpoint ${endpoint}: ${response.status}`);

        if (!response.ok) {
          success = false;
        }
      } catch (error) {
        results.push({
          endpoint,
          error: error instanceof Error ? error.message : String(error),
          success: false
        });
        logs.push(`Endpoint ${endpoint}: ERROR - ${error instanceof Error ? error.message : String(error)}`);
        success = false;
      }
    }

    return {
      success,
      output: { endpoints: results },
      metrics: {
        totalEndpoints: endpoints.length,
        successfulEndpoints: results.filter(r => r.success).length
      },
      logs
    };
  }

  /**
   * Run performance tests
   */
  private async runPerformanceTest(profile: TestProfile, logs: string[]): Promise<any> {
    logs.push('Running performance test checks...');

    const startTime = Date.now();
    const config = JSON.parse(profile.config || '{}');

    // Simulate performance testing
    const metrics = {
      responseTime: Math.random() * 2000 + 500,
      throughput: Math.random() * 1000 + 500,
      errorRate: Math.random() * 0.1
    };

    const duration = Date.now() - startTime;
    const success = metrics.errorRate < 0.05 && metrics.responseTime < 1500;

    logs.push(`Performance metrics: ${JSON.stringify(metrics)}`);

    return {
      success,
      output: { performance: metrics },
      metrics,
      logs
    };
  }

  /**
   * Run security tests
   */
  private async runSecurityTest(profile: TestProfile, logs: string[]): Promise<any> {
    logs.push('Running security test checks...');

    const config = JSON.parse(profile.config || '{}');
    const checks = config.checks || ['auth', 'rate-limiting', 'encryption'];

    const results = [];
    let success = true;

    for (const check of checks) {
      const result = await this.performSecurityCheck(check);
      results.push(result);
      logs.push(`Security check ${check}: ${result.passed ? 'PASSED' : 'FAILED'}`);

      if (!result.passed) {
        success = false;
      }
    }

    return {
      success,
      output: { security: results },
      metrics: {
        totalChecks: checks.length,
        passedChecks: results.filter(r => r.passed).length
      },
      logs
    };
  }

  /**
   * Run AI tests
   */
  private async runAiTest(profile: TestProfile, logs: string[]): Promise<any> {
    logs.push('Running AI test checks...');

    const config = JSON.parse(profile.config || '{}');
    const models = config.models || ['@cf/meta/llama-3.1-8b-instruct'];

    const results = [];
    let success = true;

    for (const model of models) {
      try {
        const aiResult = await this.aiService.runAiAndLog(
          `Test prompt for model validation: Please respond with "OK" if you can process this request.`,
          { model, maxTokens: 50 }
        );

        const result = {
          model,
          success: aiResult.success,
          latency: aiResult.result?.latency || 0,
          tokens: aiResult.result?.usage?.total_tokens || 0
        };

        results.push(result);
        logs.push(`AI model ${model}: ${aiResult.success ? 'PASSED' : 'FAILED'}`);

        if (!aiResult.success) {
          success = false;
        }
      } catch (error) {
        results.push({
          model,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        logs.push(`AI model ${model}: ERROR - ${error instanceof Error ? error.message : String(error)}`);
        success = false;
      }
    }

    return {
      success,
      output: { ai: results },
      metrics: {
        totalModels: models.length,
        successfulModels: results.filter(r => r.success).length
      },
      logs
    };
  }

  /**
   * Analyze test results with AI for deeper insights
   */
  private async analyzeTestResultsWithAI(
    profile: TestProfile,
    result: any,
    testResultId: number
  ): Promise<void> {
    try {
      const analysis = await this.aiService.validateSystemHealth(result, profile.category);

      if (analysis.success && analysis.suggestions) {
        // Log AI analysis as additional context
        await this.aiService.runAiAndLog(
          `Based on the test failure analysis, provide specific actionable recommendations for resolving the issues.`,
          {},
          testResultId,
          { previousAnalysis: analysis }
        );
      }
    } catch (error) {
      console.error('HealthSpecialist: AI analysis failed:', error);
    }
  }

  /**
   * Generate health summary from test results
   */
  private async generateHealthSummary(tests: HealthTest[], runId: string): Promise<HealthSummary> {
    const totalTests = tests.length;
    const passedTests = tests.filter(t => t.status === 'completed').length;
    const failedTests = tests.filter(t => t.status === 'failed').length;
    const skippedTests = tests.filter(t => t.status === 'pending').length;

    // Calculate overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (failedTests > totalTests * 0.3) {
      overallStatus = 'critical';
    } else if (failedTests > totalTests * 0.1) {
      overallStatus = 'degraded';
    }

    // Calculate average latency
    const latencies = tests
      .filter(t => t.endTime && t.startTime)
      .map(t => (t.endTime! - t.startTime!));
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    // Get AI usage stats for the run
    const aiStats = await this.aiService.getUsageStats(1); // Last 24 hours
    const totalCost = aiStats.reduce((sum, stat) => sum + Number(stat.totalCost || 0), 0);
    const aiUsageCount = aiStats.reduce((sum, stat) => sum + Number(stat.totalRequests || 0), 0);

    // Generate AI-powered insights
    const insights = await this.generateAiInsights(tests, overallStatus);

    return {
      date: new Date().toISOString().split('T')[0],
      overallStatus,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      averageLatency,
      totalCost,
      aiUsageCount,
      issues: JSON.stringify(insights.issues),
      recommendations: JSON.stringify(insights.recommendations)
    };
  }

  /**
   * Generate AI-powered insights for health summary
   */
  private async generateAiInsights(tests: HealthTest[], overallStatus: string): Promise<{
    issues: any[];
    recommendations: any[];
  }> {
    try {
      const failedTests = tests.filter(t => t.status === 'failed');
      const systemMetrics = {
        overallStatus,
        totalTests: tests.length,
        failedTests: failedTests.length,
        categories: tests.reduce((acc, t) => {
          acc[t.profile.category] = (acc[t.profile.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      const analysis = await this.aiService.generateTestRecommendations(failedTests, systemMetrics);

      return {
        issues: analysis.result?.analysis || [],
        recommendations: analysis.result?.recommendations || []
      };
    } catch (error) {
      console.error('HealthSpecialist: AI insights generation failed:', error);
      return { issues: [], recommendations: [] };
    }
  }

  /**
   * HTTP endpoint handlers
   */
  private async handleHealthStatus(request: Request): Promise<Response> {
    try {
      const status = await this.getCurrentHealthStatus();
      return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get health status' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleHealthResults(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const results = await this.dbService.getTestResultsWithProfiles(limit);

      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get health results' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleRunTests(request: Request): Promise<Response> {
    try {
      // Trigger manual test run
      const runId = await this.triggerManualTestRun();

      return new Response(JSON.stringify({ runId, status: 'started' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to start test run' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleDashboardData(request: Request): Promise<Response> {
    try {
      const data = await this.dbService.getHealthDashboardData();

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get dashboard data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get current health status
   */
  private async getCurrentHealthStatus() {
    const latest = await this.dbService.getLatestHealthSummary();

    if (!latest) {
      return {
        status: 'unknown',
        message: 'No health data available',
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: latest.overallStatus,
      tests: {
        total: latest.totalTests,
        passed: latest.passedTests,
        failed: latest.failedTests,
        skipped: latest.skippedTests
      },
      performance: {
        averageLatency: latest.averageLatency
      },
      ai: {
        totalCost: latest.totalCost,
        usageCount: latest.aiUsageCount
      },
      issues: JSON.parse(latest.issues || '[]'),
      recommendations: JSON.parse(latest.recommendations || '[]'),
      timestamp: latest.createdAt
    };
  }

  /**
   * Trigger manual test run
   */
  private async triggerManualTestRun(): Promise<string> {
    const runId = `manual-${nanoid()}`;
    // Implementation for manual test triggering
    // This would start a test run similar to the daily cron
    setTimeout(() => this.runDailyHealthCheck(), 1000); // Run in background
    return runId;
  }

  /**
   * Utility methods
   */
  private async ensureDefaultTestProfiles(): Promise<void> {
    // This would check and create default test profiles if they don't exist
    // Implementation would go here
  }

  private async startBackgroundMonitoring(): Promise<void> {
    // Set up background monitoring tasks
  }

  private async checkServiceConnectivity(target: string): Promise<boolean> {
    // Basic connectivity check
    try {
      // This would implement actual connectivity testing
      return Math.random() > 0.1; // Simulate 90% success rate
    } catch {
      return false;
    }
  }

  private async performSecurityCheck(check: string): Promise<{ passed: boolean; details?: any }> {
    // Implement security checks
    return { passed: Math.random() > 0.2 }; // Simulate security test
  }

  private broadcastToWebSocket(data: any): void {
    // Broadcast to WebSocket connections
    // Implementation would use the WebSocket broadcaster
  }

  private subscribeToHealthUpdates(connection: any): void {
    // Subscribe connection to health updates
  }

  private cleanupOldRuns(): void {
    // Clean up old completed runs from memory
    for (const [runId, run] of this.activeRuns) {
      if (run.status !== 'running' && run.endTime) {
        const age = Date.now() - run.endTime;
        if (age > 24 * 60 * 60 * 1000) { // Older than 24 hours
          this.activeRuns.delete(runId);
        }
      }
    }
  }
}
