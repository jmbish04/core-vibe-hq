/**
 * Shared Worker Health Check Library
 * 
 * Provides comprehensive health checking capabilities for downstream workers
 * including unit tests, performance tests, integration tests, and system metrics.
 * 
 * This library is used by all downstream workers to perform standardized
 * health checks when requested by the orchestrator.
 */

export interface HealthCheckOptions {
  include_unit_tests: boolean
  include_performance_tests: boolean
  include_integration_tests: boolean
  timeout_ms?: number
}

export interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration_ms: number
  error?: string
  details?: any
}

export interface HealthCheckResult {
  overall_status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  health_score: number // 0.0 to 1.0
  uptime_seconds: number
  memory_usage_mb: number
  cpu_usage_percent: number
  response_time_ms: number
  orchestrator_connectivity: boolean
  external_api_connectivity: boolean
  database_connectivity: boolean
  unit_test_results: TestResult[]
  performance_test_results: TestResult[]
  integration_test_results: TestResult[]
  error_message?: string
  warnings: string[]
  raw_results: any
}

export interface WorkerHealthCheckEnv {
  WORKER_NAME: string
  WORKER_TYPE: string
  DEFAULT_MODEL?: string
  ORCHESTRATOR_LOGGING?: any
  ORCHESTRATOR_TASKS?: any
  ORCHESTRATOR_GITHUB?: any
  AI?: any
}

export class WorkerHealthCheck {
  private startTime: number
  private env: WorkerHealthCheckEnv
  private warnings: string[] = []

  constructor(env: WorkerHealthCheckEnv) {
    this.env = env
    this.startTime = Date.now()
  }

  /**
   * Execute comprehensive health check
   */
  async executeHealthCheck(options: HealthCheckOptions): Promise<HealthCheckResult> {
    const checkStartTime = Date.now()
    
    try {
      // Run all health checks in parallel where possible
      const [
        systemMetrics,
        connectivityResults,
        unitTestResults,
        performanceTestResults,
        integrationTestResults
      ] = await Promise.all([
        this.getSystemMetrics(),
        this.testConnectivity(),
        options.include_unit_tests ? this.runUnitTests() : Promise.resolve([]),
        options.include_performance_tests ? this.runPerformanceTests() : Promise.resolve([]),
        options.include_integration_tests ? this.runIntegrationTests() : Promise.resolve([])
      ])

      const responseTime = Date.now() - checkStartTime

      // Calculate overall health score
      const healthScore = this.calculateHealthScore({
        systemMetrics,
        connectivityResults,
        unitTestResults,
        performanceTestResults,
        integrationTestResults
      })

      // Determine overall status
      const overallStatus = this.determineOverallStatus(healthScore, {
        connectivityResults,
        unitTestResults,
        performanceTestResults,
        integrationTestResults
      })

      return {
        overall_status: overallStatus,
        health_score: healthScore,
        uptime_seconds: systemMetrics.uptime_seconds,
        memory_usage_mb: systemMetrics.memory_usage_mb,
        cpu_usage_percent: systemMetrics.cpu_usage_percent,
        response_time_ms: responseTime,
        orchestrator_connectivity: connectivityResults.orchestrator,
        external_api_connectivity: connectivityResults.external_api,
        database_connectivity: connectivityResults.database,
        unit_test_results: unitTestResults,
        performance_test_results: performanceTestResults,
        integration_test_results: integrationTestResults,
        warnings: this.warnings,
        raw_results: {
          system_metrics: systemMetrics,
          connectivity: connectivityResults,
          check_duration_ms: responseTime
        }
      }

    } catch (error: any) {
      return {
        overall_status: 'critical',
        health_score: 0.0,
        uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
        memory_usage_mb: 0,
        cpu_usage_percent: 0,
        response_time_ms: Date.now() - checkStartTime,
        orchestrator_connectivity: false,
        external_api_connectivity: false,
        database_connectivity: false,
        unit_test_results: [],
        performance_test_results: [],
        integration_test_results: [],
        error_message: error.message,
        warnings: this.warnings,
        raw_results: { error: error.message }
      }
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<{
    uptime_seconds: number
    memory_usage_mb: number
    cpu_usage_percent: number
  }> {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000)
    
    // Note: Cloudflare Workers don't expose memory/CPU metrics
    // These would need to be estimated or mocked
    return {
      uptime_seconds: uptimeSeconds,
      memory_usage_mb: 0, // Not available in Workers
      cpu_usage_percent: 0 // Not available in Workers
    }
  }

  /**
   * Test connectivity to various services
   */
  private async testConnectivity(): Promise<{
    orchestrator: boolean
    external_api: boolean
    database: boolean
  }> {
    const results = {
      orchestrator: false,
      external_api: false,
      database: false
    }

    // Test orchestrator connectivity
    try {
      if (this.env.ORCHESTRATOR_LOGGING) {
        await this.env.ORCHESTRATOR_LOGGING.log({
          source: this.env.WORKER_NAME,
          operation: 'health_check_connectivity_test',
          level: 'debug',
          details: { test: 'orchestrator_connectivity' }
        })
        results.orchestrator = true
      }
    } catch (error) {
      this.warnings.push('Orchestrator connectivity test failed')
    }

    // Test external API connectivity (example: Cloudflare AI)
    try {
      if (this.env.AI) {
        await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: 'ping' }]
        })
        results.external_api = true
      }
    } catch (error) {
      this.warnings.push('External API connectivity test failed')
    }

    // Test database connectivity (through orchestrator)
    try {
      if (this.env.ORCHESTRATOR_TASKS) {
        // Try to get task count as a simple database test
        await this.env.ORCHESTRATOR_TASKS.getTasksForOrder({ orderId: 'health-check-test' })
        results.database = true
      }
    } catch (error) {
      // This is expected to fail for non-existent order, but confirms DB connectivity
      if (error.message && !error.message.includes('not found')) {
        this.warnings.push('Database connectivity test failed')
      } else {
        results.database = true
      }
    }

    return results
  }

  /**
   * Run unit tests
   */
  private async runUnitTests(): Promise<TestResult[]> {
    const tests: TestResult[] = []

    // Basic functionality tests
    tests.push(await this.runTest('Environment Variables', async () => {
      if (!this.env.WORKER_NAME) throw new Error('WORKER_NAME not set')
      if (!this.env.WORKER_TYPE) throw new Error('WORKER_TYPE not set')
      return { worker_name: this.env.WORKER_NAME, worker_type: this.env.WORKER_TYPE }
    }))

    tests.push(await this.runTest('JSON Serialization', async () => {
      const testObj = { test: true, number: 42, array: [1, 2, 3] }
      const serialized = JSON.stringify(testObj)
      const deserialized = JSON.parse(serialized)
      if (JSON.stringify(testObj) !== JSON.stringify(deserialized)) {
        throw new Error('JSON serialization mismatch')
      }
      return deserialized
    }))

    tests.push(await this.runTest('Crypto Functions', async () => {
      const uuid = crypto.randomUUID()
      if (!uuid || uuid.length !== 36) {
        throw new Error('UUID generation failed')
      }
      return { uuid }
    }))

    tests.push(await this.runTest('Date/Time Functions', async () => {
      const now = new Date()
      const timestamp = now.toISOString()
      const parsed = new Date(timestamp)
      if (Math.abs(now.getTime() - parsed.getTime()) > 1000) {
        throw new Error('Date serialization issue')
      }
      return { timestamp, parsed: parsed.toISOString() }
    }))

    // Worker-specific tests
    tests.push(...await this.runWorkerSpecificUnitTests())

    return tests
  }

  /**
   * Run performance tests
   */
  private async runPerformanceTests(): Promise<TestResult[]> {
    const tests: TestResult[] = []

    tests.push(await this.runTest('Response Time Baseline', async () => {
      const iterations = 100
      const startTime = Date.now()
      
      for (let i = 0; i < iterations; i++) {
        JSON.stringify({ iteration: i, timestamp: Date.now() })
      }
      
      const duration = Date.now() - startTime
      const avgTime = duration / iterations
      
      if (avgTime > 1) { // More than 1ms average is concerning
        throw new Error(`Average operation time too high: ${avgTime.toFixed(2)}ms`)
      }
      
      return { iterations, total_duration_ms: duration, avg_time_ms: avgTime }
    }))

    tests.push(await this.runTest('Memory Allocation', async () => {
      const startTime = Date.now()
      const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: 'test'.repeat(10) }))
      const duration = Date.now() - startTime
      
      if (duration > 100) { // More than 100ms for allocation is concerning
        throw new Error(`Memory allocation too slow: ${duration}ms`)
      }
      
      return { array_size: largeArray.length, allocation_time_ms: duration }
    }))

    // Worker-specific performance tests
    tests.push(...await this.runWorkerSpecificPerformanceTests())

    return tests
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<TestResult[]> {
    const tests: TestResult[] = []

    tests.push(await this.runTest('Orchestrator Logging Integration', async () => {
      if (!this.env.ORCHESTRATOR_LOGGING) {
        throw new Error('Orchestrator logging not available')
      }

      const testMessage = `Health check integration test - ${Date.now()}`
      const result = await this.env.ORCHESTRATOR_LOGGING.log({
        source: this.env.WORKER_NAME,
        operation: 'integration_test',
        level: 'debug',
        details: { test_message: testMessage }
      })

      if (!result.ok) {
        throw new Error('Logging integration failed')
      }

      return { logged: true, message: testMessage }
    }))

    if (this.env.AI) {
      tests.push(await this.runTest('AI Integration', async () => {
        const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: 'Say "test successful" if you can read this.' }]
        })

        if (!response.response) {
          throw new Error('AI integration failed - no response')
        }

        return { ai_response: response.response.substring(0, 100) }
      }))
    }

    // Worker-specific integration tests
    tests.push(...await this.runWorkerSpecificIntegrationTests())

    return tests
  }

  /**
   * Run worker-specific unit tests (to be overridden by specific workers)
   */
  protected async runWorkerSpecificUnitTests(): Promise<TestResult[]> {
    // Default implementation - workers can override this
    return []
  }

  /**
   * Run worker-specific performance tests (to be overridden by specific workers)
   */
  protected async runWorkerSpecificPerformanceTests(): Promise<TestResult[]> {
    // Default implementation - workers can override this
    return []
  }

  /**
   * Run worker-specific integration tests (to be overridden by specific workers)
   */
  protected async runWorkerSpecificIntegrationTests(): Promise<TestResult[]> {
    // Default implementation - workers can override this
    return []
  }

  /**
   * Run a single test with error handling and timing
   */
  private async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      const result = await testFn()
      const duration = Date.now() - startTime
      
      return {
        name,
        status: 'passed',
        duration_ms: duration,
        details: result
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      return {
        name,
        status: 'failed',
        duration_ms: duration,
        error: error.message,
        details: { error_stack: error.stack }
      }
    }
  }

  /**
   * Calculate overall health score based on all test results
   */
  private calculateHealthScore(results: {
    systemMetrics: any
    connectivityResults: any
    unitTestResults: TestResult[]
    performanceTestResults: TestResult[]
    integrationTestResults: TestResult[]
  }): number {
    let score = 1.0
    let factors = 0

    // Connectivity score (40% weight)
    const connectivityScore = (
      (results.connectivityResults.orchestrator ? 1 : 0) +
      (results.connectivityResults.external_api ? 1 : 0) +
      (results.connectivityResults.database ? 1 : 0)
    ) / 3
    score = (score * factors + connectivityScore * 0.4) / (factors + 0.4)
    factors += 0.4

    // Unit tests score (30% weight)
    if (results.unitTestResults.length > 0) {
      const unitTestScore = results.unitTestResults.filter(t => t.status === 'passed').length / results.unitTestResults.length
      score = (score * factors + unitTestScore * 0.3) / (factors + 0.3)
      factors += 0.3
    }

    // Performance tests score (20% weight)
    if (results.performanceTestResults.length > 0) {
      const perfTestScore = results.performanceTestResults.filter(t => t.status === 'passed').length / results.performanceTestResults.length
      score = (score * factors + perfTestScore * 0.2) / (factors + 0.2)
      factors += 0.2
    }

    // Integration tests score (10% weight)
    if (results.integrationTestResults.length > 0) {
      const integrationScore = results.integrationTestResults.filter(t => t.status === 'passed').length / results.integrationTestResults.length
      score = (score * factors + integrationScore * 0.1) / (factors + 0.1)
      factors += 0.1
    }

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Determine overall status based on health score and critical issues
   */
  private determineOverallStatus(
    healthScore: number,
    results: {
      connectivityResults: any
      unitTestResults: TestResult[]
      performanceTestResults: TestResult[]
      integrationTestResults: TestResult[]
    }
  ): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    // Critical issues that override health score
    if (!results.connectivityResults.orchestrator) {
      return 'critical'
    }

    // Check for critical test failures
    const criticalFailures = [
      ...results.unitTestResults,
      ...results.performanceTestResults,
      ...results.integrationTestResults
    ].filter(t => t.status === 'failed' && t.name.toLowerCase().includes('critical'))

    if (criticalFailures.length > 0) {
      return 'critical'
    }

    // Determine status based on health score
    if (healthScore >= 0.9) return 'healthy'
    if (healthScore >= 0.7) return 'degraded'
    if (healthScore >= 0.4) return 'unhealthy'
    return 'critical'
  }

  /**
   * Send health check results back to orchestrator
   */
  async sendResultsToOrchestrator(
    workerCheckUuid: string,
    results: HealthCheckResult,
    callbackUrl: string
  ): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_check_uuid: workerCheckUuid,
          results
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      console.log('Health check results sent to orchestrator successfully')

    } catch (error) {
      console.error('Failed to send health check results to orchestrator:', error)
      throw error
    }
  }
}
