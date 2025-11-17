/**
 * Shared Diagnostics Handler for Workers
 * 
 * Provides health checks, metrics, WebSocket monitoring, and diagnostic commands
 * for all downstream workers in the core-vibe-hq ecosystem.
 */

import diagnosticsTemplate from '../templates/diagnostics.html'

export interface DiagnosticsMetrics {
  uptime: string
  memory: string
  cpu: string
  activeOps: number
  totalProcessed: number
  successRate: string
  avgResponse: string
  lastPing: string
  rpcCalls: number
  rpcErrors: number
  version: string
}

export interface DiagnosticsEnv {
  WORKER_NAME: string
  FACTORY_TYPE: string
  DEFAULT_MODEL: string
  ENVIRONMENT: string
  DIAGNOSTICS_ENABLED: string
  ORCHESTRATOR_LOGGING?: any
}

export class DiagnosticsHandler {
  private startTime: number
  private metrics: Partial<DiagnosticsMetrics>
  private websockets: Set<WebSocket>
  private operationCount: number
  private successCount: number
  private responseTimes: number[]
  private lastPingTime: string
  private rpcCallCount: number
  private rpcErrorCount: number

  constructor() {
    this.startTime = Date.now()
    this.metrics = {}
    this.websockets = new Set()
    this.operationCount = 0
    this.successCount = 0
    this.responseTimes = []
    this.lastPingTime = '--'
    this.rpcCallCount = 0
    this.rpcErrorCount = 0
  }

  /**
   * Handle diagnostics requests
   */
  async handleRequest(request: Request, env: DiagnosticsEnv): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Check if diagnostics are enabled
    if (env.DIAGNOSTICS_ENABLED !== 'true') {
      return new Response('Diagnostics disabled', { status: 404 })
    }

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    switch (path) {
      case '/':
      case '/diagnostics':
        return this.serveDiagnosticsPage(env)
      
      case '/diagnostics/health':
        return this.handleHealthCheck(env)
      
      case '/diagnostics/metrics':
        return this.handleMetrics(env)
      
      case '/diagnostics/command':
        return this.handleCommand(request, env)
      
      case '/ws':
        return this.handleWebSocket(request)
      
      default:
        return new Response('Not Found', { status: 404 })
    }
  }

  /**
   * Serve the diagnostics HTML page
   */
  private serveDiagnosticsPage(env: DiagnosticsEnv): Response {
    const html = diagnosticsTemplate
      .replace(/\{\{WORKER_NAME\}\}/g, env.WORKER_NAME || 'Unknown Worker')
      .replace(/\{\{FACTORY_TYPE\}\}/g, env.FACTORY_TYPE || 'unknown')
      .replace(/\{\{DEFAULT_MODEL\}\}/g, env.DEFAULT_MODEL || 'not-set')
      .replace(/\{\{ENVIRONMENT\}\}/g, env.ENVIRONMENT || 'unknown')

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(env: DiagnosticsEnv): Promise<Response> {
    try {
      // Test orchestrator connection
      let orchestratorHealthy = true
      let orchestratorError = null

      try {
        if (env.ORCHESTRATOR_LOGGING) {
          await env.ORCHESTRATOR_LOGGING.log({
            source: env.WORKER_NAME || 'unknown',
            operation: 'health_check',
            level: 'debug',
            details: { timestamp: new Date().toISOString() }
          })
          this.lastPingTime = new Date().toLocaleTimeString()
        }
      } catch (error: any) {
        orchestratorHealthy = false
        orchestratorError = error.message
        this.rpcErrorCount++
      }

      const health = {
        healthy: orchestratorHealthy,
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        orchestrator: {
          connected: orchestratorHealthy,
          error: orchestratorError
        },
        metrics: this.getCurrentMetrics()
      }

      return new Response(JSON.stringify(health), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * Handle metrics requests
   */
  private handleMetrics(env: DiagnosticsEnv): Response {
    const metrics = this.getCurrentMetrics()
    return new Response(JSON.stringify(metrics), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  /**
   * Handle diagnostic command execution
   */
  private async handleCommand(request: Request, env: DiagnosticsEnv): Promise<Response> {
    try {
      const { command } = await request.json()
      const result = await this.executeCommand(command, env)
      
      return new Response(JSON.stringify({ output: result }), {
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
   * Handle WebSocket connections
   */
  private handleWebSocket(request: Request): Response {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    server.accept()
    this.websockets.add(server)

    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string)
        await this.handleWebSocketMessage(server, message)
      } catch (error: any) {
        this.sendWebSocketResponse(server, null, false, error.message)
      }
    })

    server.addEventListener('close', () => {
      this.websockets.delete(server)
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  /**
   * Handle incoming WebSocket messages with standardized API
   */
  private async handleWebSocketMessage(ws: WebSocket, message: any) {
    const { id, type, request_type, data, command } = message

    try {
      switch (type) {
        case 'ping':
          this.sendWebSocketMessage(ws, { type: 'pong', timestamp: Date.now() })
          break

        case 'request':
          await this.handleWebSocketRequest(ws, id, request_type, data)
          break

        case 'command':
          // Legacy support for direct command messages
          const result = await this.executeCommand(command || data?.command, {} as DiagnosticsEnv)
          this.sendWebSocketResponse(ws, id, true, { output: result })
          break

        case 'subscribe':
          // Handle subscription requests
          this.handleSubscription(ws, data?.eventType || data?.type)
          this.sendWebSocketResponse(ws, id, true, { subscribed: true })
          break

        default:
          this.sendWebSocketResponse(ws, id, false, `Unknown message type: ${type}`)
      }
    } catch (error: any) {
      this.sendWebSocketResponse(ws, id, false, error.message)
    }
  }

  /**
   * Handle WebSocket requests
   */
  private async handleWebSocketRequest(ws: WebSocket, id: number, requestType: string, data: any) {
    switch (requestType) {
      case 'command':
        const result = await this.executeCommand(data.command, {} as DiagnosticsEnv)
        this.sendWebSocketResponse(ws, id, true, { output: result })
        break

      case 'metrics':
        const metrics = this.getCurrentMetrics()
        this.sendWebSocketResponse(ws, id, true, metrics)
        break

      case 'health':
        const health = await this.getHealthData({} as DiagnosticsEnv)
        this.sendWebSocketResponse(ws, id, true, health)
        break

      case 'status':
        const status = {
          connected: true,
          uptime: this.getUptime(),
          metrics: this.getCurrentMetrics()
        }
        this.sendWebSocketResponse(ws, id, true, status)
        break

      default:
        this.sendWebSocketResponse(ws, id, false, `Unknown request type: ${requestType}`)
    }
  }

  /**
   * Handle subscription management
   */
  private handleSubscription(ws: WebSocket, eventType: string) {
    // Store subscription info (you might want to implement this based on your needs)
    // For now, we'll just acknowledge the subscription
    console.log(`WebSocket subscribed to: ${eventType}`)
  }

  /**
   * Send standardized WebSocket response
   */
  private sendWebSocketResponse(ws: WebSocket, id: number | null, success: boolean, data: any) {
    const response = {
      type: 'response',
      id,
      success,
      timestamp: Date.now(),
      ...(success ? { data } : { error: data })
    }
    this.sendWebSocketMessage(ws, response)
  }

  /**
   * Send WebSocket message
   */
  private sendWebSocketMessage(ws: WebSocket, message: any) {
    try {
      ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      this.websockets.delete(ws)
    }
  }

  /**
   * Get health data for WebSocket requests
   */
  private async getHealthData(env: DiagnosticsEnv) {
    try {
      let orchestratorHealthy = true
      let orchestratorError = null

      try {
        if (env.ORCHESTRATOR_LOGGING) {
          await env.ORCHESTRATOR_LOGGING.log({
            source: env.WORKER_NAME || 'unknown',
            operation: 'health_check_ws',
            level: 'debug',
            details: { timestamp: new Date().toISOString() }
          })
          this.lastPingTime = new Date().toLocaleTimeString()
        }
      } catch (error: any) {
        orchestratorHealthy = false
        orchestratorError = error.message
        this.rpcErrorCount++
      }

      return {
        healthy: orchestratorHealthy,
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        orchestrator: {
          connected: orchestratorHealthy,
          error: orchestratorError
        },
        metrics: this.getCurrentMetrics()
      }
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Execute diagnostic commands
   */
  private async executeCommand(command: string, env: DiagnosticsEnv): Promise<string> {
    const parts = command.toLowerCase().split(' ')
    const cmd = parts[0]

    switch (cmd) {
      case 'status':
        return `Worker: ${env.WORKER_NAME || 'Unknown'}\nStatus: Healthy\nUptime: ${this.getUptime()}`
      
      case 'metrics':
        const metrics = this.getCurrentMetrics()
        return Object.entries(metrics)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')
      
      case 'ping':
        if (parts[1] === 'orchestrator' && env.ORCHESTRATOR_LOGGING) {
          try {
            const start = Date.now()
            await env.ORCHESTRATOR_LOGGING.log({
              source: env.WORKER_NAME || 'unknown',
              operation: 'ping_test',
              level: 'debug',
              details: { timestamp: new Date().toISOString() }
            })
            const duration = Date.now() - start
            this.rpcCallCount++
            return `Orchestrator ping: ${duration}ms`
          } catch (error: any) {
            this.rpcErrorCount++
            return `Orchestrator ping failed: ${error.message}`
          }
        }
        return 'Usage: ping orchestrator'
      
      case 'clear':
        if (parts[1] === 'metrics') {
          this.resetMetrics()
          return 'Metrics cleared'
        }
        return 'Usage: clear metrics'
      
      case 'help':
        return 'Available commands:\n' +
               '  status - Show worker status\n' +
               '  metrics - Show current metrics\n' +
               '  ping orchestrator - Test orchestrator connection\n' +
               '  clear metrics - Reset metrics counters\n' +
               '  help - Show this help'
      
      default:
        return `Unknown command: ${command}\nType 'help' for available commands`
    }
  }

  /**
   * Get current metrics
   */
  private getCurrentMetrics(): DiagnosticsMetrics {
    const avgResponseTime = this.responseTimes.length > 0 
      ? (this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(2) + 'ms'
      : '--'

    const successRate = this.operationCount > 0 
      ? ((this.successCount / this.operationCount) * 100).toFixed(1) + '%'
      : '--'

    return {
      uptime: this.getUptime(),
      memory: this.getMemoryUsage(),
      cpu: '--', // CPU usage not available in Workers
      activeOps: 0, // Would need to be tracked by the worker
      totalProcessed: this.operationCount,
      successRate,
      avgResponse: avgResponseTime,
      lastPing: this.lastPingTime,
      rpcCalls: this.rpcCallCount,
      rpcErrors: this.rpcErrorCount,
      version: '1.0.0' // Could be injected from build
    }
  }

  /**
   * Get uptime string
   */
  private getUptime(): string {
    const uptimeMs = Date.now() - this.startTime
    const seconds = Math.floor(uptimeMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  /**
   * Get memory usage (approximate)
   */
  private getMemoryUsage(): string {
    // Workers don't expose memory usage, return placeholder
    return '--'
  }

  /**
   * Record operation metrics
   */
  recordOperation(success: boolean, responseTime: number) {
    this.operationCount++
    if (success) this.successCount++
    
    this.responseTimes.push(responseTime)
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift() // Keep only last 100 response times
    }
  }

  /**
   * Record RPC call
   */
  recordRPCCall(success: boolean) {
    this.rpcCallCount++
    if (!success) this.rpcErrorCount++
  }

  /**
   * Broadcast message to all connected WebSockets
   */
  broadcast(message: any) {
    const messageStr = JSON.stringify(message)
    for (const ws of this.websockets) {
      try {
        ws.send(messageStr)
      } catch (error) {
        // Remove failed WebSocket
        this.websockets.delete(ws)
      }
    }
  }

  /**
   * Reset metrics
   */
  private resetMetrics() {
    this.operationCount = 0
    this.successCount = 0
    this.responseTimes = []
    this.rpcCallCount = 0
    this.rpcErrorCount = 0
  }
}
