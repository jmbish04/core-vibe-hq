/**
 * Example Worker Implementation with Diagnostics
 * 
 * This example shows how to integrate the shared diagnostics handler
 * into a downstream worker for health monitoring and debugging.
 */

import { DiagnosticsHandler, DiagnosticsEnv } from '@shared/handlers/diagnosticsHandler'

// Example environment interface extending DiagnosticsEnv
interface WorkerEnv extends DiagnosticsEnv {
  // Orchestrator service bindings
  ORCHESTRATOR_GITHUB?: any
  ORCHESTRATOR_TASKS?: any
  ORCHESTRATOR_FACTORY?: any
  ORCHESTRATOR_DELIVERY?: any
  ORCHESTRATOR_LOGGING?: any
  ORCHESTRATOR_OPS?: any
  
  // Worker-specific config
  MAX_CONCURRENT_OPERATIONS?: string
  
  // Standard Cloudflare bindings
  AI?: any
  CF_VERSION_METADATA?: any
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // Initialize diagnostics handler
    const diagnostics = new DiagnosticsHandler()
    
    const url = new URL(request.url)
    const startTime = Date.now()
    
    try {
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
          diagnostics.recordRPCCall(true)
        } catch (rpcError) {
          diagnostics.recordRPCCall(false)
          console.error('Failed to log error to orchestrator:', rpcError)
        }
      }
      
      // Broadcast error to WebSocket clients
      diagnostics.broadcast({
        type: 'log',
        level: 'error',
        message: `Request failed: ${error.message}`
      })
      
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
 * Handle main worker requests (implement your worker logic here)
 */
async function handleWorkerRequest(
  request: Request, 
  env: WorkerEnv, 
  diagnostics: DiagnosticsHandler
): Promise<Response> {
  const url = new URL(request.url)
  
  // Example API endpoints
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
 * Example process request handler
 */
async function handleProcessRequest(
  request: Request, 
  env: WorkerEnv, 
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
      diagnostics.recordRPCCall(true)
    }
    
    // Broadcast to WebSocket clients
    diagnostics.broadcast({
      type: 'log',
      level: 'info',
      message: `Processing request: ${body.type || 'unknown'}`
    })
    
    // Simulate processing work
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Example: Create a task through orchestrator
    let taskResult = null
    if (env.ORCHESTRATOR_TASKS) {
      try {
        taskResult = await env.ORCHESTRATOR_TASKS.createOrder({
          factory: env.FACTORY_TYPE || 'unknown',
          files: body.files || []
        })
        diagnostics.recordRPCCall(true)
      } catch (error: any) {
        diagnostics.recordRPCCall(false)
        throw new Error(`Failed to create task: ${error.message}`)
      }
    }
    
    const result = {
      success: true,
      processed: body,
      task: taskResult,
      timestamp: new Date().toISOString(),
      worker: env.WORKER_NAME
    }
    
    // Broadcast success
    diagnostics.broadcast({
      type: 'log',
      level: 'info',
      message: `Request processed successfully`
    })
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error: any) {
    // Broadcast error
    diagnostics.broadcast({
      type: 'log',
      level: 'error',
      message: `Processing failed: ${error.message}`
    })
    
    throw error // Re-throw to be handled by main error handler
  }
}

/**
 * Example status request handler
 */
async function handleStatusRequest(
  request: Request, 
  env: WorkerEnv, 
  diagnostics: DiagnosticsHandler
): Promise<Response> {
  // Test orchestrator connections
  const connections = {
    github: false,
    tasks: false,
    factory: false,
    delivery: false,
    logging: false,
    ops: false
  }
  
  // Test each orchestrator service
  if (env.ORCHESTRATOR_LOGGING) {
    try {
      await env.ORCHESTRATOR_LOGGING.log({
        source: env.WORKER_NAME || 'unknown-worker',
        operation: 'connection_test',
        level: 'debug',
        details: { test: 'logging' }
      })
      connections.logging = true
      diagnostics.recordRPCCall(true)
    } catch (error) {
      diagnostics.recordRPCCall(false)
    }
  }
  
  // Add more connection tests as needed...
  
  const status = {
    worker: env.WORKER_NAME,
    factory_type: env.FACTORY_TYPE,
    model: env.DEFAULT_MODEL,
    environment: env.ENVIRONMENT,
    diagnostics_enabled: env.DIAGNOSTICS_ENABLED === 'true',
    orchestrator_connections: connections,
    timestamp: new Date().toISOString()
  }
  
  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  })
}
