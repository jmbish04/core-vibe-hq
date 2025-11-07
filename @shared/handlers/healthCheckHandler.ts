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

      if (!worker_check_uuid || !callback_url) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: worker_check_uuid, callback_url'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Execute health check asynchronously
      this.executeHealthCheckAsync(worker_check_uuid, options, callback_url)
        .catch(error => {
          console.error('Health check execution failed:', error)
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

      // Send results back to orchestrator
      await this.healthChecker.sendResultsToOrchestrator(
        workerCheckUuid,
        results,
        callbackUrl
      )

    } catch (error: any) {
      console.error(`Health check failed for worker: ${this.env.WORKER_NAME}`, error)
      
      // Send error results to orchestrator
      try {
        await this.healthChecker.sendResultsToOrchestrator(
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
        console.error('Failed to send error results to orchestrator:', sendError)
      }
    }
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
