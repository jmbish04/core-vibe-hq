/**
 * Example Worker Implementation with Health Checks
 * 
 * This example shows how to integrate the shared health check system
 * into a downstream worker, including custom worker-specific tests.
 */

import { DiagnosticsHandler, DiagnosticsEnv } from '@shared/handlers/diagnosticsHandler'
import { HealthCheckHandler } from '@shared/handlers/healthCheckHandler'
import { WorkerHealthCheck, TestResult, WorkerHealthCheckEnv } from '@shared/health/workerHealthCheck'

// Example environment interface
interface ExampleWorkerEnv extends DiagnosticsEnv, WorkerHealthCheckEnv {
  // Orchestrator service bindings
  ORCHESTRATOR_GITHUB?: any
  ORCHESTRATOR_TASKS?: any
  ORCHESTRATOR_FACTORY?: any
  ORCHESTRATOR_DELIVERY?: any
  ORCHESTRATOR_LOGGING?: any
  ORCHESTRATOR_OPS?: any
  ORCHESTRATOR_HEALTH_CHECK?: any
  
  // Worker-specific config
  MAX_CONCURRENT_OPERATIONS?: string
  
  // Standard Cloudflare bindings
  AI?: any
  CF_VERSION_METADATA?: any
}

// Custom health checker with worker-specific tests
class ExampleWorkerHealthCheck extends WorkerHealthCheck {
  constructor(env: WorkerHealthCheckEnv) {
    super(env)
  }

  /**
   * Custom unit tests specific to this worker
   */
  protected async runWorkerSpecificUnitTests(): Promise<TestResult[]> {
    const tests: TestResult[] = []

    // Test worker-specific configuration
    tests.push(await this.runTest('Worker Configuration', async () => {
      const env = this.env as ExampleWorkerEnv
      
      if (!env.MAX_CONCURRENT_OPERATIONS) {
        throw new Error('MAX_CONCURRENT_OPERATIONS not configured')
      }

      const maxOps = parseInt(env.MAX_CONCURRENT_OPERATIONS)
      if (isNaN(maxOps) || maxOps <= 0) {
        throw new Error('Invalid MAX_CONCURRENT_OPERATIONS value')
      }

      return { max_concurrent_operations: maxOps }
    }))

    // Test factory-specific functionality
    tests.push(await this.runTest('Factory Operations', async () => {
      // Simulate factory operation
      const operation = {
        id: crypto.randomUUID(),
        type: 'test_operation',
        timestamp: new Date().toISOString()
      }

      // Validate operation structure
      if (!operation.id || !operation.type || !operation.timestamp) {
        throw new Error('Operation validation failed')
      }

      return operation
    }))

    // Test model configuration
    tests.push(await this.runTest('Model Configuration', async () => {
      const env = this.env as ExampleWorkerEnv
      
      if (!env.DEFAULT_MODEL) {
        throw new Error('DEFAULT_MODEL not configured')
      }

      // Validate model format
      if (!env.DEFAULT_MODEL.startsWith('@cf/')) {
        throw new Error('Invalid model format')
      }

      return { default_model: env.DEFAULT_MODEL }
    }))

    return tests
  }

  /**
   * Custom performance tests specific to this worker
   */
  protected async runWorkerSpecificPerformanceTests(): Promise<TestResult[]> {
    const tests: TestResult[] = []

    // Test concurrent operation handling
    tests.push(await this.runTest('Concurrent Operations', async () => {
      const env = this.env as ExampleWorkerEnv
      const maxOps = parseInt(env.MAX_CONCURRENT_OPERATIONS || '10')
      
      const startTime = Date.now()
      
      // Simulate concurrent operations
      const operations = Array.from({ length: Math.min(maxOps, 5) }, (_, i) => 
        this.simulateOperation(i)
      )
      
      const results = await Promise.all(operations)
      const duration = Date.now() - startTime
      
      if (duration > 1000) { // More than 1 second is concerning
        throw new Error(`Concurrent operations too slow: ${duration}ms`)
      }

      return {
        operations_count: results.length,
        total_duration_ms: duration,
        avg_duration_ms: duration / results.length,
        results
      }
    }))

    // Test memory usage under load
    tests.push(await this.runTest('Memory Usage Under Load', async () => {
      const startTime = Date.now()
      
      // Create multiple data structures to test memory handling
      const dataStructures = []
      for (let i = 0; i < 100; i++) {
        dataStructures.push({
          id: i,
          data: new Array(1000).fill(0).map((_, j) => ({ index: j, value: Math.random() })),
          timestamp: Date.now()
        })
      }
      
      const duration = Date.now() - startTime
      
      if (duration > 500) { // More than 500ms is concerning
        throw new Error(`Memory allocation under load too slow: ${duration}ms`)
      }

      return {
        structures_created: dataStructures.length,
        allocation_time_ms: duration,
        avg_allocation_ms: duration / dataStructures.length
      }
    }))

    return tests
  }

  /**
   * Custom integration tests specific to this worker
   */
  protected async runWorkerSpecificIntegrationTests(): Promise<TestResult[]> {
    const tests: TestResult[] = []

    // Test orchestrator task creation integration
    tests.push(await this.runTest('Orchestrator Task Integration', async () => {
      const env = this.env as ExampleWorkerEnv
      
      if (!env.ORCHESTRATOR_TASKS) {
        throw new Error('Orchestrator tasks service not available')
      }

      // Try to create a test task
      try {
        const result = await env.ORCHESTRATOR_TASKS.createOrder({
          factory: env.FACTORY_TYPE || 'test-factory',
          files: [{
            file_path: 'test.js',
            instructions: { test: 'Health check integration test' }
          }]
        })

        if (!result.order_id) {
          throw new Error('Task creation failed - no order ID returned')
        }

        return { order_created: true, order_id: result.order_id }

      } catch (error: any) {
        // Some errors are expected (like validation errors), but connection errors are not
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          throw error
        }
        
        // If it's a validation error, the integration is working
        return { order_created: false, validation_working: true, error: error.message }
      }
    }))

    // Test AI integration if available
    tests.push(await this.runTest('AI Service Integration', async () => {
      const env = this.env as ExampleWorkerEnv
      
      if (!env.AI) {
        throw new Error('AI service not available')
      }

      const response = await env.AI.run(env.DEFAULT_MODEL || '@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ 
          role: 'user', 
          content: 'Respond with exactly "HEALTH_CHECK_SUCCESS" if you can process this message.' 
        }]
      })

      if (!response.response) {
        throw new Error('AI integration failed - no response')
      }

      const isSuccessful = response.response.includes('HEALTH_CHECK_SUCCESS')
      
      return { 
        ai_response_received: true,
        response_contains_expected: isSuccessful,
        response_length: response.response.length,
        model_used: env.DEFAULT_MODEL
      }
    }))

    return tests
  }

  /**
   * Simulate a worker operation for testing
   */
  private async simulateOperation(id: number): Promise<any> {
    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
    
    return {
      operation_id: id,
      status: 'completed',
      duration_ms: Math.floor(Math.random() * 100),
      timestamp: Date.now()
    }
  }
}

export default {
  async fetch(request: Request, env: ExampleWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const startTime = Date.now()
    
    try {
      // Initialize handlers
      const diagnostics = new DiagnosticsHandler()
      const healthCheck = new HealthCheckHandler(env)
      
      // Handle health check routes
      if (url.pathname.startsWith('/health-check')) {
        return await healthCheck.handleRequest(request)
      }
      
      // Handle diagnostics routes
      if (url.pathname.startsWith('/diagnostics') || url.pathname === '/' || url.pathname === '/ws') {
        return await diagnostics.handleRequest(request, env)
      }
      
      // Handle main worker functionality
      const response = await handleWorkerRequest(request, env, diagnostics)
      
      // Record successful operation
      const responseTime = Date.now() - startTime
      diagnostics.recordOperation(true, responseTime)
      
      return response
      
    } catch (error: any) {
      // Record failed operation
      const responseTime = Date.now() - startTime
      diagnostics.recordOperation(false, responseTime)
      
      // Log error through orchestrator
      if (env.ORCHESTRATOR_LOGGING) {
        try {
          await env.ORCHESTRATOR_LOGGING.log({
            source: env.WORKER_NAME || 'unknown-worker',
            operation: 'request_error',
            level: 'error',
            details: {
              error: error.message,
              path: url.pathname,
              method: request.method
            }
          })
        } catch (rpcError) {
          console.error('Failed to log error to orchestrator:', rpcError)
        }
      }
      
      return new Response(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

/**
 * Handle main worker requests
 */
async function handleWorkerRequest(
  request: Request, 
  env: ExampleWorkerEnv, 
  diagnostics: DiagnosticsHandler
): Promise<Response> {
  const url = new URL(request.url)
  
  switch (url.pathname) {
    case '/api/health':
      return new Response(JSON.stringify({ 
        status: 'healthy',
        worker: env.WORKER_NAME,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    
    case '/api/process':
      return await handleProcessRequest(request, env, diagnostics)
    
    case '/api/status':
      return await handleStatusRequest(request, env, diagnostics)
    
    default:
      return new Response('Not Found', { status: 404 })
  }
}

/**
 * Handle process request
 */
async function handleProcessRequest(
  request: Request, 
  env: ExampleWorkerEnv, 
  diagnostics: DiagnosticsHandler
): Promise<Response> {
  try {
    const body = await request.json()
    
    // Log the operation start
    if (env.ORCHESTRATOR_LOGGING) {
      await env.ORCHESTRATOR_LOGGING.log({
        source: env.WORKER_NAME || 'unknown-worker',
        operation: 'process_request',
        level: 'info',
        details: { 
          requestId: body.id || 'unknown',
          type: body.type || 'unknown'
        }
      })
    }
    
    // Simulate processing work
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const result = {
      success: true,
      processed: body,
      timestamp: new Date().toISOString(),
      worker: env.WORKER_NAME
    }
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error: any) {
    throw error
  }
}

/**
 * Handle status request
 */
async function handleStatusRequest(
  request: Request, 
  env: ExampleWorkerEnv, 
  diagnostics: DiagnosticsHandler
): Promise<Response> {
  const status = {
    worker: env.WORKER_NAME,
    factory_type: env.FACTORY_TYPE,
    model: env.DEFAULT_MODEL,
    environment: env.ENVIRONMENT,
    diagnostics_enabled: env.DIAGNOSTICS_ENABLED === 'true',
    max_concurrent_operations: env.MAX_CONCURRENT_OPERATIONS,
    timestamp: new Date().toISOString()
  }
  
  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  })
}
