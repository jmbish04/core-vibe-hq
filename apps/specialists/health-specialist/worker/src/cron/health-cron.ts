import { AiService } from '../services/aiService';
import { OrchestratorHealthClient, type HealthDatabaseClient } from '../services/healthDatabaseClient';
import { HealthWebSocket } from '../ws/health';

export interface HealthCronEnv {
  AI: any;
  ORCHESTRATOR_HEALTH: any;
  HEALTH_WEBSOCKET?: DurableObject;
}

export class HealthCron {
  private dbClient: HealthDatabaseClient;
  private aiService: AiService;
  private websocket?: HealthWebSocket;

  constructor(private env: HealthCronEnv) {
    this.dbClient = new OrchestratorHealthClient(env.ORCHESTRATOR_HEALTH);
    this.aiService = new AiService(env, this.dbClient);
    this.websocket = env.HEALTH_WEBSOCKET?.get(env.HEALTH_WEBSOCKET.idFromName('health-ws'));
  }

  /**
   * Main cron handler - called daily by Cloudflare
   */
  async handleScheduled(event: ScheduledEvent): Promise<void> {
    console.log('HealthCron: Starting daily health check at', new Date().toISOString());

    const startTime = Date.now();
    const runId = `cron-${Date.now()}`;

    try {
      // Broadcast run start
      await this.broadcastToWebSocket({
        type: 'cron_started',
        runId,
        timestamp: startTime
      });

      // Run comprehensive health check
      const results = await this.runComprehensiveHealthCheck(runId);

      // Generate and save summary
      const summary = await this.generateHealthSummary(results, runId);
      await this.dbClient.createHealthSummary(summary);

      // Run AI analysis on results
      await this.runAiAnalysis(results, summary);

      // Broadcast completion
      const endTime = Date.now();
      await this.broadcastToWebSocket({
        type: 'cron_completed',
        runId,
        summary,
        duration: endTime - startTime,
        timestamp: endTime
      });

      console.log('HealthCron: Daily health check completed successfully');

    } catch (error) {
      console.error('HealthCron: Daily health check failed:', error);

      // Broadcast failure
      await this.broadcastToWebSocket({
        type: 'cron_failed',
        runId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });

      // Send alert (would integrate with alerting system)
      await this.sendAlert('Health Check Failed', {
        error: error instanceof Error ? error.message : String(error),
        runId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Run comprehensive health check across all systems
   */
  private async runComprehensiveHealthCheck(runId: string): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    // Get all enabled test profiles
    const testProfiles = await this.dbClient.getTestProfiles(true);

    console.log(`HealthCron: Running ${testProfiles.length} health checks`);

    // Run tests in parallel with concurrency control
    const concurrencyLimit = 5;
    const semaphore = new Semaphore(concurrencyLimit);

    const testPromises = testProfiles.map(async (profile) => {
      await semaphore.acquire();

      try {
        const result = await this.runTestForProfile(profile, runId);
        results.push(result);

        // Broadcast individual test result
        await this.broadcastToWebSocket({
          type: 'test_completed',
          runId,
          testId: result.testId,
          status: result.success ? 'passed' : 'failed',
          duration: result.duration,
          category: profile.category,
          timestamp: Date.now()
        });

        return result;
      } finally {
        semaphore.release();
      }
    });

    await Promise.allSettled(testPromises);

    // Sort results by category and name for consistent reporting
    results.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  /**
   * Run test for a specific profile
   */
  private async runTestForProfile(profile: any, runId: string): Promise<HealthCheckResult> {
    const testId = `${profile.id}-${Date.now()}`;
    const startTime = Date.now();

    console.log(`HealthCron: Running test ${profile.name} (${profile.category})`);

    try {
      // Create test result record
      const testResult = await this.dbClient.createTestResult({
        testProfileId: profile.id,
        runId,
        status: 'running',
        startedAt: startTime,
        triggeredBy: 'cron'
      });

      if (!testResult) {
        throw new Error('Failed to create test result record');
      }

      // Execute the test based on category
      const testOutput = await this.executeTestByCategory(profile);

      // Update test result
      const endTime = Date.now();
      const duration = endTime - startTime;

      await this.dbClient.updateTestResult(testResult.id, {
        status: testOutput.success ? 'passed' : 'failed',
        durationMs: duration,
        completedAt: endTime,
        output: JSON.stringify(testOutput.output),
        metrics: JSON.stringify(testOutput.metrics),
        errorMessage: testOutput.error
      });

      // Use AI to analyze failures or provide insights
      if (!testOutput.success) {
        await this.analyzeTestFailureWithAI(profile, testOutput, testResult.id);
      }

      return {
        testId,
        name: profile.name,
        category: profile.category,
        success: testOutput.success,
        duration,
        error: testOutput.error,
        output: testOutput.output,
        metrics: testOutput.metrics
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`HealthCron: Test ${profile.name} failed:`, error);

      return {
        testId,
        name: profile.name,
        category: profile.category,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
        output: null,
        metrics: {}
      };
    }
  }

  /**
   * Execute test based on category
   */
  private async executeTestByCategory(profile: any): Promise<TestOutput> {
    const config = JSON.parse(profile.config || '{}');

    switch (profile.category) {
      case 'unit':
        return await this.runUnitTests(config);
      case 'integration':
        return await this.runIntegrationTests(config);
      case 'performance':
        return await this.runPerformanceTests(config);
      case 'security':
        return await this.runSecurityTests(config);
      case 'ai':
        return await this.runAiTests(config);
      default:
        throw new Error(`Unknown test category: ${profile.category}`);
    }
  }

  /**
   * Run unit tests
   */
  private async runUnitTests(config: any): Promise<TestOutput> {
    // Simulate unit test execution
    const testFiles = config.files || ['**/*.test.ts', '**/*.spec.ts'];

    // In a real implementation, this would run actual unit tests
    const mockResults = {
      totalTests: Math.floor(Math.random() * 50) + 10,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0
    };

    // Simulate some test results
    mockResults.passedTests = Math.floor(mockResults.totalTests * 0.9);
    mockResults.failedTests = mockResults.totalTests - mockResults.passedTests;

    const success = mockResults.failedTests === 0;

    return {
      success,
      output: mockResults,
      metrics: {
        testCoverage: Math.random() * 20 + 80, // 80-100%
        executionTime: Math.random() * 5000 + 1000
      }
    };
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(config: any): Promise<TestOutput> {
    const endpoints = config.endpoints || [];
    const results = [];

    let success = true;
    let totalLatency = 0;

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'User-Agent': 'HealthCheck/1.0' },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        const latency = Date.now() - startTime;
        totalLatency += latency;

        const result = {
          endpoint,
          status: response.status,
          latency,
          success: response.ok
        };

        results.push(result);

        if (!response.ok) {
          success = false;
        }
      } catch (error) {
        results.push({
          endpoint,
          error: error instanceof Error ? error.message : String(error),
          success: false
        });
        success = false;
      }
    }

    return {
      success,
      output: { endpoints: results },
      metrics: {
        totalEndpoints: endpoints.length,
        successfulEndpoints: results.filter(r => r.success).length,
        averageLatency: totalLatency / endpoints.length
      }
    };
  }

  /**
   * Run performance tests
   */
  private async runPerformanceTests(config: any): Promise<TestOutput> {
    const metrics = {
      responseTime: Math.random() * 1000 + 200, // 200-1200ms
      throughput: Math.random() * 500 + 500, // 500-1000 req/sec
      errorRate: Math.random() * 0.05, // 0-5%
      memoryUsage: Math.random() * 200 + 300, // 300-500MB
      cpuUsage: Math.random() * 30 + 20 // 20-50%
    };

    const thresholds = config.thresholds || {
      maxResponseTime: 1000,
      maxErrorRate: 0.05,
      maxCpuUsage: 70,
      maxMemoryUsage: 600
    };

    const success = metrics.responseTime <= thresholds.maxResponseTime &&
                   metrics.errorRate <= thresholds.maxErrorRate &&
                   metrics.cpuUsage <= thresholds.maxCpuUsage &&
                   metrics.memoryUsage <= thresholds.maxMemoryUsage;

    return {
      success,
      output: metrics,
      metrics
    };
  }

  /**
   * Run security tests
   */
  private async runSecurityTests(config: any): Promise<TestOutput> {
    const checks = config.checks || ['auth', 'rate-limiting', 'encryption', 'headers'];
    const results = [];

    let success = true;

    for (const check of checks) {
      const result = await this.performSecurityCheck(check);
      results.push(result);

      if (!result.passed) {
        success = false;
      }
    }

    return {
      success,
      output: { securityChecks: results },
      metrics: {
        totalChecks: checks.length,
        passedChecks: results.filter(r => r.passed).length,
        failedChecks: results.filter(r => !r.passed).length
      }
    };
  }

  /**
   * Run AI tests
   */
  private async runAiTests(config: any): Promise<TestOutput> {
    const models = config.models || ['@cf/meta/llama-3.1-8b-instruct'];
    const results = [];

    let success = true;
    let totalTokens = 0;
    let totalLatency = 0;

    for (const model of models) {
      try {
        const aiResult = await this.aiService.runAiAndLog(
          'Perform a simple health check by responding with "HEALTH_CHECK_OK"',
          { model, maxTokens: 50 }
        );

        const result = {
          model,
          success: aiResult.success,
          tokens: aiResult.result?.usage?.total_tokens || 0,
          latency: aiResult.result?.latency || 0,
          response: aiResult.result?.response || ''
        };

        results.push(result);
        totalTokens += result.tokens;
        totalLatency += result.latency;

        if (!aiResult.success) {
          success = false;
        }
      } catch (error) {
        results.push({
          model,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        success = false;
      }
    }

    return {
      success,
      output: { aiTests: results },
      metrics: {
        totalModels: models.length,
        successfulModels: results.filter(r => r.success).length,
        totalTokens,
        averageLatency: totalLatency / models.length
      }
    };
  }

  /**
   * Analyze test failures with AI
   */
  private async analyzeTestFailureWithAI(profile: any, testOutput: TestOutput, testResultId: number): Promise<void> {
    try {
      await this.aiService.runAiAndLog(
        `Analyze this test failure and provide specific recommendations:
Test: ${profile.name}
Category: ${profile.category}
Error: ${testOutput.error}
Output: ${JSON.stringify(testOutput.output)}

Provide:
1. Root cause analysis
2. Specific fix recommendations
3. Prevention measures`,
        {},
        testResultId
      );
    } catch (error) {
      console.error('HealthCron: AI failure analysis failed:', error);
    }
  }

  /**
   * Generate health summary from test results
   */
  private async generateHealthSummary(results: HealthCheckResult[], runId: string): Promise<any> {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    // Calculate overall status
    let overallStatus = 'healthy';
    if (failedTests > totalTests * 0.3) {
      overallStatus = 'critical';
    } else if (failedTests > totalTests * 0.1) {
      overallStatus = 'degraded';
    }

    // Calculate average latency
    const latencies = results.map(r => r.duration);
    const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Get AI usage stats
    const aiStats = await this.aiService.getUsageStats(1);
    const totalCost = aiStats.reduce((sum, stat) => sum + Number(stat.totalCost || 0), 0);
    const aiUsageCount = aiStats.reduce((sum, stat) => sum + Number(stat.totalRequests || 0), 0);

    // Generate AI-powered insights
    const insights = await this.generateAiInsights(results, overallStatus);

    return {
      date: new Date().toISOString().split('T')[0],
      overallStatus,
      totalTests,
      passedTests,
      failedTests,
      skippedTests: 0,
      averageLatency,
      totalCost,
      aiUsageCount,
      issues: JSON.stringify(insights.issues),
      recommendations: JSON.stringify(insights.recommendations)
    };
  }

  /**
   * Generate AI insights for health summary
   */
  private async generateAiInsights(results: HealthCheckResult[], overallStatus: string): Promise<any> {
    const failedTests = results.filter(r => !r.success);

    if (failedTests.length === 0) {
      return {
        issues: [],
        recommendations: ['All systems operating normally']
      };
    }

    try {
      const analysis = await this.aiService.generateTestRecommendations(
        failedTests,
        {
          totalTests: results.length,
          failedTests: failedTests.length,
          overallStatus,
          categories: results.reduce((acc, r) => {
            acc[r.category] = (acc[r.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      );

      return {
        issues: analysis.result?.analysis || failedTests.map(t => `Test "${t.name}" failed: ${t.error}`),
        recommendations: analysis.result?.recommendations || ['Review failed test logs for details']
      };
    } catch (error) {
      console.error('HealthCron: AI insights generation failed:', error);
      return {
        issues: failedTests.map(t => `Test "${t.name}" failed: ${t.error}`),
        recommendations: ['Manual review of failed tests required']
      };
    }
  }

  /**
   * Run AI analysis on complete health check results
   */
  private async runAiAnalysis(results: HealthCheckResult[], summary: any): Promise<void> {
    try {
      const failedTests = results.filter(r => !r.success);

      if (failedTests.length > 0) {
        await this.aiService.runAiAndLog(
          `Analyze this health check summary and provide executive insights:
Status: ${summary.overallStatus}
Tests: ${summary.totalTests} total, ${summary.failedTests} failed
Failed Tests: ${failedTests.map(t => `${t.name} (${t.category})`).join(', ')}

Provide:
1. Executive summary of system health
2. Priority ranking of issues
3. Recommended immediate actions
4. Long-term improvement suggestions`,
          {}
        );
      }
    } catch (error) {
      console.error('HealthCron: AI analysis failed:', error);
    }
  }

  /**
   * Broadcast to WebSocket
   */
  private async broadcastToWebSocket(data: any): Promise<void> {
    if (this.websocket) {
      try {
        await this.websocket.broadcastHealthUpdate(data);
      } catch (error) {
        console.error('HealthCron: WebSocket broadcast failed:', error);
      }
    }
  }

  /**
   * Send alert (placeholder for alerting system)
   */
  private async sendAlert(title: string, details: any): Promise<void> {
    console.error(`ALERT: ${title}`, details);
    // In a real implementation, this would send alerts to Slack, email, etc.
  }

  /**
   * Perform security check
   */
  private async performSecurityCheck(check: string): Promise<{ passed: boolean; details?: any }> {
    // Mock security checks - in real implementation, these would be actual security tests
    switch (check) {
      case 'auth':
        return { passed: Math.random() > 0.1 };
      case 'rate-limiting':
        return { passed: Math.random() > 0.05 };
      case 'encryption':
        return { passed: Math.random() > 0.02 };
      case 'headers':
        return { passed: Math.random() > 0.1 };
      default:
        return { passed: false, details: `Unknown check: ${check}` };
    }
  }
}

// Semaphore for concurrency control
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }
}

interface HealthCheckResult {
  testId: string;
  name: string;
  category: string;
  success: boolean;
  duration: number;
  error?: string;
  output: any;
  metrics: any;
}

interface TestOutput {
  success: boolean;
  output: any;
  metrics: any;
  error?: string;
}
