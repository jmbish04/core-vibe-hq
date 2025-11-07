/**
 * WebSocket Client Usage Examples
 * 
 * This file demonstrates various ways to use the WorkerWebSocketClient
 * for 2-way communication between frontends and workers.
 */

// ============================================================================
// Example 1: Basic Connection and Command Execution
// ============================================================================

async function basicUsageExample() {
  // Create client instance
  const client = new WorkerWebSocketClient('ws://localhost:8788/ws', {
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5
  })

  try {
    // Connect to worker
    await client.connect()
    console.log('Connected to worker!')

    // Execute diagnostic commands
    const statusResult = await client.executeCommand('status')
    console.log('Status:', statusResult.output)

    const metricsResult = await client.executeCommand('metrics')
    console.log('Metrics:', metricsResult.output)

    // Test orchestrator connection
    const pingResult = await client.executeCommand('ping orchestrator')
    console.log('Ping result:', pingResult.output)

  } catch (error) {
    console.error('Connection failed:', error)
  }
}

// ============================================================================
// Example 2: Real-time Event Subscription
// ============================================================================

async function eventSubscriptionExample() {
  const client = new WorkerWebSocketClient('ws://localhost:8789/ws')
  
  await client.connect()

  // Subscribe to real-time logs
  const unsubscribeLogs = client.subscribeLogs((logMessage) => {
    console.log(`[${logMessage.level.toUpperCase()}] ${logMessage.message}`)
    
    // Update UI with log message
    const logElement = document.createElement('div')
    logElement.className = `log-${logMessage.level}`
    logElement.textContent = `[${new Date().toLocaleTimeString()}] ${logMessage.message}`
    document.getElementById('logs-container').appendChild(logElement)
  })

  // Subscribe to metrics updates
  const unsubscribeMetrics = client.subscribeMetrics((metricsMessage) => {
    const metrics = metricsMessage.metrics
    
    // Update dashboard
    document.getElementById('uptime').textContent = metrics.uptime
    document.getElementById('total-processed').textContent = metrics.totalProcessed
    document.getElementById('success-rate').textContent = metrics.successRate
  })

  // Subscribe to worker events
  const unsubscribeEvents = client.subscribeEvents((event) => {
    console.log('Worker event:', event)
    
    // Handle specific event types
    if (event.type === 'operation_started') {
      showNotification('Operation started', 'info')
    } else if (event.type === 'operation_completed') {
      showNotification('Operation completed', 'success')
    }
  })

  // Clean up subscriptions when done
  // unsubscribeLogs()
  // unsubscribeMetrics()
  // unsubscribeEvents()
}

// ============================================================================
// Example 3: Request-Response Pattern for Custom Operations
// ============================================================================

async function customOperationsExample() {
  const client = new WorkerWebSocketClient('ws://localhost:8790/ws')
  
  await client.connect()

  try {
    // Custom request to worker
    const processResult = await client.request('process_data', {
      type: 'user_input',
      data: { name: 'John', email: 'john@example.com' },
      options: { validate: true, transform: true }
    })
    
    console.log('Processing result:', processResult)

    // Get worker configuration
    const configResult = await client.request('get_config')
    console.log('Worker config:', configResult)

    // Update worker settings
    const updateResult = await client.request('update_settings', {
      maxConcurrentOps: 15,
      logLevel: 'debug'
    })
    
    console.log('Settings updated:', updateResult)

  } catch (error) {
    console.error('Request failed:', error)
  }
}

// ============================================================================
// Example 4: Connection State Management
// ============================================================================

function connectionManagementExample() {
  const client = new WorkerWebSocketClient('ws://localhost:8791/ws')

  // Set up connection event handlers
  client.onConnect = () => {
    console.log('✅ Connected to worker')
    updateConnectionStatus('connected')
    enableInteractiveFeatures()
  }

  client.onDisconnect = (event) => {
    console.log('❌ Disconnected from worker:', event.reason)
    updateConnectionStatus('disconnected')
    disableInteractiveFeatures()
  }

  client.onReconnecting = (attempt) => {
    console.log(`🔄 Reconnection attempt ${attempt}`)
    updateConnectionStatus('reconnecting', attempt)
  }

  client.onError = (error) => {
    console.error('❌ WebSocket error:', error)
    showErrorNotification('Connection error occurred')
  }

  // Connect with error handling
  client.connect().catch(error => {
    console.error('Failed to connect:', error)
    showErrorNotification('Failed to connect to worker')
  })

  // Manual connection control
  document.getElementById('connect-btn').onclick = () => client.connect()
  document.getElementById('disconnect-btn').onclick = () => client.disconnect()
  
  // Status monitoring
  setInterval(() => {
    const status = client.getStatus()
    console.log('Connection status:', status)
  }, 5000)
}

// ============================================================================
// Example 5: Multi-Worker Communication Dashboard
// ============================================================================

class MultiWorkerDashboard {
  constructor() {
    this.workers = new Map()
    this.setupWorkers()
  }

  async setupWorkers() {
    const workerConfigs = [
      { name: 'Agent Factory', port: 8788 },
      { name: 'Data Factory', port: 8789 },
      { name: 'Services Factory', port: 8790 },
      { name: 'UI Factory', port: 8791 }
    ]

    for (const config of workerConfigs) {
      await this.connectToWorker(config.name, config.port)
    }
  }

  async connectToWorker(name, port) {
    const client = new WorkerWebSocketClient(`ws://localhost:${port}/ws`, {
      autoReconnect: true,
      reconnectInterval: 2000
    })

    // Set up event handlers
    client.onConnect = () => {
      console.log(`${name} connected`)
      this.updateWorkerStatus(name, 'connected')
    }

    client.onDisconnect = () => {
      console.log(`${name} disconnected`)
      this.updateWorkerStatus(name, 'disconnected')
    }

    // Subscribe to logs from this worker
    client.subscribeLogs((log) => {
      this.addLogToGlobalFeed(name, log)
    })

    // Subscribe to metrics
    client.subscribeMetrics((metrics) => {
      this.updateWorkerMetrics(name, metrics.metrics)
    })

    try {
      await client.connect()
      this.workers.set(name, client)
    } catch (error) {
      console.error(`Failed to connect to ${name}:`, error)
    }
  }

  updateWorkerStatus(workerName, status) {
    const statusElement = document.getElementById(`${workerName.toLowerCase().replace(' ', '-')}-status`)
    if (statusElement) {
      statusElement.className = `status-indicator status-${status === 'connected' ? 'healthy' : 'error'}`
    }
  }

  updateWorkerMetrics(workerName, metrics) {
    const metricsContainer = document.getElementById(`${workerName.toLowerCase().replace(' ', '-')}-metrics`)
    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div>Uptime: ${metrics.uptime}</div>
        <div>Processed: ${metrics.totalProcessed}</div>
        <div>Success Rate: ${metrics.successRate}</div>
        <div>RPC Calls: ${metrics.rpcCalls}</div>
      `
    }
  }

  addLogToGlobalFeed(workerName, log) {
    const logFeed = document.getElementById('global-log-feed')
    if (logFeed) {
      const logEntry = document.createElement('div')
      logEntry.className = `log-entry log-${log.level}`
      logEntry.innerHTML = `
        <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
        <span class="log-worker">[${workerName}]</span>
        <span class="log-level">[${log.level.toUpperCase()}]</span>
        <span class="log-message">${log.message}</span>
      `
      logFeed.appendChild(logEntry)
      logFeed.scrollTop = logFeed.scrollHeight
    }
  }

  async broadcastCommand(command) {
    const results = new Map()
    
    for (const [workerName, client] of this.workers) {
      try {
        const result = await client.executeCommand(command)
        results.set(workerName, result)
      } catch (error) {
        results.set(workerName, { error: error.message })
      }
    }
    
    return results
  }

  async getHealthStatus() {
    const healthData = new Map()
    
    for (const [workerName, client] of this.workers) {
      try {
        const health = await client.getHealth()
        healthData.set(workerName, health)
      } catch (error) {
        healthData.set(workerName, { healthy: false, error: error.message })
      }
    }
    
    return healthData
  }
}

// ============================================================================
// Example 6: Custom Frontend Integration
// ============================================================================

class WorkerIntegration {
  constructor(workerUrl) {
    this.client = new WorkerWebSocketClient(workerUrl)
    this.setupEventHandlers()
  }

  async initialize() {
    await this.client.connect()
    
    // Set up real-time subscriptions
    this.client.subscribeLogs(this.handleLogMessage.bind(this))
    this.client.subscribeMetrics(this.handleMetricsUpdate.bind(this))
    this.client.subscribeEvents(this.handleWorkerEvent.bind(this))
    
    // Initial data load
    await this.loadInitialData()
  }

  setupEventHandlers() {
    this.client.onConnect = () => {
      this.showConnectionStatus('Connected', 'success')
      this.enableFeatures()
    }

    this.client.onDisconnect = () => {
      this.showConnectionStatus('Disconnected', 'error')
      this.disableFeatures()
    }

    this.client.onReconnecting = (attempt) => {
      this.showConnectionStatus(`Reconnecting (${attempt})`, 'warning')
    }
  }

  async loadInitialData() {
    try {
      // Get current metrics
      const metrics = await this.client.getMetrics()
      this.updateDashboard(metrics)

      // Get health status
      const health = await this.client.getHealth()
      this.updateHealthIndicators(health)

      // Get worker configuration
      const config = await this.client.request('get_config')
      this.updateConfigDisplay(config)

    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  handleLogMessage(log) {
    // Add to log viewer
    this.addToLogViewer(log)
    
    // Show notifications for important logs
    if (log.level === 'error' || log.level === 'critical') {
      this.showNotification(log.message, 'error')
    }
  }

  handleMetricsUpdate(metricsMessage) {
    this.updateDashboard(metricsMessage.metrics)
    
    // Check for performance issues
    const metrics = metricsMessage.metrics
    if (parseFloat(metrics.successRate) < 90) {
      this.showAlert('Low success rate detected', 'warning')
    }
  }

  handleWorkerEvent(event) {
    console.log('Worker event:', event)
    
    // Handle specific event types
    switch (event.type) {
      case 'operation_started':
        this.incrementActiveOperations()
        break
      case 'operation_completed':
        this.decrementActiveOperations()
        break
      case 'error_occurred':
        this.showNotification(event.message, 'error')
        break
    }
  }

  // UI update methods
  showConnectionStatus(status, type) {
    const statusElement = document.getElementById('connection-status')
    if (statusElement) {
      statusElement.textContent = status
      statusElement.className = `status-${type}`
    }
  }

  updateDashboard(metrics) {
    // Update various dashboard elements
    this.updateElement('uptime', metrics.uptime)
    this.updateElement('total-processed', metrics.totalProcessed)
    this.updateElement('success-rate', metrics.successRate)
    this.updateElement('avg-response', metrics.avgResponse)
  }

  updateElement(id, value) {
    const element = document.getElementById(id)
    if (element) {
      element.textContent = value
    }
  }

  // Feature control
  enableFeatures() {
    document.querySelectorAll('.requires-connection').forEach(el => {
      el.disabled = false
    })
  }

  disableFeatures() {
    document.querySelectorAll('.requires-connection').forEach(el => {
      el.disabled = true
    })
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div')
  notification.className = `notification notification-${type}`
  notification.textContent = message
  
  // Add to page
  document.body.appendChild(notification)
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove()
  }, 5000)
}

function updateConnectionStatus(status, extra = null) {
  const statusElement = document.getElementById('connection-status')
  if (statusElement) {
    statusElement.textContent = extra ? `${status} (${extra})` : status
    statusElement.className = `connection-${status}`
  }
}

function enableInteractiveFeatures() {
  document.querySelectorAll('.ws-dependent').forEach(el => {
    el.disabled = false
  })
}

function disableInteractiveFeatures() {
  document.querySelectorAll('.ws-dependent').forEach(el => {
    el.disabled = true
  })
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    basicUsageExample,
    eventSubscriptionExample,
    customOperationsExample,
    connectionManagementExample,
    MultiWorkerDashboard,
    WorkerIntegration
  }
}
