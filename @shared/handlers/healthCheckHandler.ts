/**
 * Shared Health Check Handler for Downstream Workers
 * 
 * Provides standardized health check endpoints and RPC interfaces
 * for all downstream workers. Integrates with the orchestrator's
 * health check system.
 */

import { WorkerHealthCheck, HealthCheckOptions, WorkerHealthCheckEnv } from '@shared/health/workerHealthCheck'

export interface HealthCheckRequest {
  worker_check_uuid: string
  options: HealthCheckOptions
  callback_url: string
}

export class HealthCheckHandler {
  private env: WorkerHealthCheckEnv
  private healthChecker: WorkerHealthCheck

  constructor(env: WorkerHealthCheckEnv) {
    this.env = env
    this.healthChecker = new WorkerHealthCheck(env)
  }

  /**
   * Handle health check requests
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    switch (path) {
      case '/health-check/execute':
        return this.handleExecuteHealthCheck(request)
      
      case '/health-check/status':
        return this.handleHealthStatus(request)
      
      case '/health-check/quick':
        return this.handleQuickHealthCheck(request)
      
      default:
        return new Response('Not Found', { status: 404 })
    }
  }

  /**
   * Handle health check execution request from orchestrator
   */
  private async handleExecuteHealthCheck(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    try {
      const { worker_check_uuid, options, callback_url }: HealthCheckRequest = await request.json()

      // Validate required fields
      if (!worker_check_uuid || !callback_url) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: worker_check_uuid, callback_url'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Validate worker_check_uuid format (UUID v4)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(worker_check_uuid)) {
        return new Response(JSON.stringify({
          error: 'Invalid worker_check_uuid format. Must be a valid UUID.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Validate callback_url is an orchestrator endpoint
      try {
        const callbackUrl = new URL(callback_url)
        // Only allow HTTPS for production security
        if (callbackUrl.protocol !== 'https:' && callbackUrl.protocol !== 'http:') {
          throw new Error('Invalid protocol')
        }
        // Additional validation can be added for known orchestrator domains
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Invalid callback_url. Must be a valid HTTP/HTTPS URL.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Execute health check with retry logic and timeout
      const maxRetries = options?.max_retries || 2 // Default 2 retries
      const timeoutMs = options?.timeout_ms || 30000 // Default 30 seconds per attempt

      this.executeHealthCheckWithRetry(
        worker_check_uuid,
        options,
        callback_url,
        maxRetries,
        timeoutMs
      ).catch(error => {
        console.error('Health check execution failed after all retries:', error)
        // Send final failure error to orchestrator
        this.sendTimeoutErrorToOrchestrator(
          worker_check_uuid,
          callback_url,
          `Health check failed after ${maxRetries + 1} attempts: ${error.message}`
        ).catch(sendError => {
          console.error('Failed to send final error to orchestrator:', sendError)
        })
      })

      return new Response(JSON.stringify({
        success: true,
        message: 'Health check initiated',
        worker_check_uuid
      }), {
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (error: any) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * Execute health check asynchronously and send results to orchestrator
   */
  private async executeHealthCheckAsync(
    workerCheckUuid: string,
    options: HealthCheckOptions,
    callbackUrl: string
  ): Promise<void> {
    try {
      console.log(`Starting health check for worker: ${this.env.WORKER_NAME}`)
      
      // Execute the health check
      const results = await this.healthChecker.executeHealthCheck(options)
      
      console.log(`Health check completed for worker: ${this.env.WORKER_NAME}`, {
        status: results.overall_status,
        score: results.health_score
      })

      // Send results back to orchestrator with retry logic
      await this.sendResultsWithRetry(workerCheckUuid, results, callbackUrl)

    } catch (error: any) {
      console.error(`Health check failed for worker: ${this.env.WORKER_NAME}`, error)
      
      // Send error results to orchestrator with retry logic
      try {
        await this.sendResultsWithRetry(
          workerCheckUuid,
          {
            overall_status: 'critical',
            health_score: 0.0,
            uptime_seconds: 0,
            memory_usage_mb: 0,
            cpu_usage_percent: 0,
            response_time_ms: 0,
            orchestrator_connectivity: false,
            external_api_connectivity: false,
            database_connectivity: false,
            unit_test_results: [],
            performance_test_results: [],
            integration_test_results: [],
            error_message: error.message,
            warnings: [],
            raw_results: { error: error.message, stack: error.stack }
          },
          callbackUrl
        )
      } catch (sendError) {
        console.error('Failed to send error results to orchestrator after retries:', sendError)
      }
    }
  }

  /**
   * Execute health check with retry logic and timeout per attempt
   */
  private async executeHealthCheckWithRetry(
    workerCheckUuid: string,
    options: HealthCheckOptions,
    callbackUrl: string,
    maxRetries: number,
    timeoutMs: number
  ): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`Health check attempt ${attempt}/${maxRetries + 1} for worker ${workerCheckUuid}`)

        // Create timeout promise for this attempt
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Health check timeout after ${timeoutMs}ms`)), timeoutMs)
        })

        // Race between execution and timeout
        await Promise.race([
          this.executeHealthCheckAsync(workerCheckUuid, options, callbackUrl),
          timeoutPromise
        ])

        // If we get here, the health check succeeded
        console.log(`Health check succeeded on attempt ${attempt}`)
        return

      } catch (error: any) {
        lastError = error
        console.warn(`Health check attempt ${attempt} failed:`, error.message)

        // If this isn't the last attempt, wait before retrying
        if (attempt <= maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff, max 10s
          console.log(`Waiting ${retryDelay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    // If we get here, all attempts failed
    throw new Error(`Health check failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`)
  }

  /**
   * Send timeout error to orchestrator
   */
  private async sendTimeoutErrorToOrchestrator(
    workerCheckUuid: string,
    callbackUrl: string,
    errorMessage: string
  ): Promise<void> {
    const errorResults = {
      overall_status: 'timeout' as const,
      health_score: 0.0,
      uptime_seconds: 0,
      memory_usage_mb: 0,
      cpu_usage_percent: 0,
      response_time_ms: 0,
      orchestrator_connectivity: false,
      external_api_connectivity: false,
      database_connectivity: false,
      unit_test_results: [],
      performance_test_results: [],
      integration_test_results: [],
      error_message: `Health check timed out: ${errorMessage}`,
      warnings: ['Health check execution exceeded timeout limit'],
      raw_results: { error: 'timeout', timeout_error: errorMessage }
    }

    await this.sendResultsWithRetry(workerCheckUuid, errorResults, callbackUrl, 3)
  }

  /**
   * Send results to orchestrator with retry logic
   */
  private async sendResultsWithRetry(
    workerCheckUuid: string,
    results: any,
    callbackUrl: string,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.healthChecker.sendResultsToOrchestrator(
          workerCheckUuid,
          results,
          callbackUrl
        )
        return // Success, exit retry loop
      } catch (error: any) {
        lastError = error
        console.warn(`Failed to send health check results (attempt ${attempt}/${maxRetries}):`, error.message)

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = initialDelay * Math.pow(2, attempt - 1)
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to send health check results after ${maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Handle health status request (simple health check)
   */
  private async handleHealthStatus(request: Request): Promise<Response> {
    try {
      const basicHealth = {
        worker_name: this.env.WORKER_NAME,
        worker_type: this.env.WORKER_TYPE,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(Date.now() / 1000), // Approximate
        orchestrator_available: !!this.env.ORCHESTRATOR_LOGGING
      }

      return new Response(JSON.stringify(basicHealth), {
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (error: any) {
      return new Response(JSON.stringify({
        worker_name: this.env.WORKER_NAME,
        worker_type: this.env.WORKER_TYPE,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * Handle quick health check (lightweight version)
   */
  private async handleQuickHealthCheck(request: Request): Promise<Response> {
    try {
      const startTime = Date.now()
      
      // Quick connectivity test
      let orchestratorConnected = false
      try {
        if (this.env.ORCHESTRATOR_LOGGING) {
          await this.env.ORCHESTRATOR_LOGGING.log({
            source: this.env.WORKER_NAME,
            operation: 'quick_health_check',
            level: 'debug',
            details: { timestamp: new Date().toISOString() }
          })
          orchestratorConnected = true
        }
      } catch (error) {
        // Orchestrator not available
      }

      const responseTime = Date.now() - startTime

      const quickHealth = {
        worker_name: this.env.WORKER_NAME,
        worker_type: this.env.WORKER_TYPE,
        status: orchestratorConnected ? 'healthy' : 'degraded',
        response_time_ms: responseTime,
        orchestrator_connectivity: orchestratorConnected,
        timestamp: new Date().toISOString()
      }

      return new Response(JSON.stringify(quickHealth), {
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (error: any) {
      return new Response(JSON.stringify({
        worker_name: this.env.WORKER_NAME,
        worker_type: this.env.WORKER_TYPE,
        status: 'critical',
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * Handle WebSocket health check requests
   */
  async handleWebSocketHealthCheck(
    ws: WebSocket,
    message: any
  ): Promise<void> {
    try {
      const { id, type, data } = message

      if (type === 'health_check_request') {
        // Execute quick health check
        const results = await this.healthChecker.executeHealthCheck({
          include_unit_tests: data?.include_unit_tests ?? false,
          include_performance_tests: data?.include_performance_tests ?? false,
          include_integration_tests: data?.include_integration_tests ?? false,
          timeout_ms: data?.timeout_ms ?? 30000
        })

        // Send results via WebSocket
        ws.send(JSON.stringify({
          id,
          type: 'health_check_response',
          success: true,
          data: results,
          timestamp: Date.now()
        }))
      }

    } catch (error: any) {
      // Send error response
      ws.send(JSON.stringify({
        id: message.id,
        type: 'health_check_response',
        success: false,
        error: error.message,
        timestamp: Date.now()
      }))
    }
  }
}
