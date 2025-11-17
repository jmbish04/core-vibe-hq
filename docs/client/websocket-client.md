# Worker WebSocket Client Library

A comprehensive client-side JavaScript library providing standardized 2-way communication between frontends and Cloudflare Workers via WebSocket API. Designed for the core-vibe-hq ecosystem with built-in support for diagnostics, real-time monitoring, and request-response patterns.

## 🚀 Features

- **🔌 Standardized WebSocket API** - Consistent interface across all workers
- **🔄 Auto-Reconnection** - Automatic reconnection with exponential backoff
- **📡 Request-Response Pattern** - Promise-based API for async operations
- **📊 Real-time Events** - Subscribe to logs, metrics, and worker events
- **💓 Heartbeat Management** - Keep connections alive automatically
- **🎯 TypeScript Support** - Full type definitions included
- **🛡️ Error Handling** - Comprehensive error handling and recovery
- **📱 Multi-Platform** - Works in browsers, Node.js, and service workers

## 📦 Installation

### Option 1: Direct Include (Recommended)
```html
<!-- Minified version for production -->
<script src="/@shared/client/workerWebSocketClient.min.js"></script>

<!-- Development version with full source -->
<script src="/@shared/client/workerWebSocketClient.js"></script>
```

### Option 2: Module Import
```javascript
// ES6 modules
import WorkerWebSocketClient from '@shared/client/workerWebSocketClient.js'

// CommonJS
const WorkerWebSocketClient = require('@shared/client/workerWebSocketClient.js')
```

### Option 3: TypeScript
```typescript
import WorkerWebSocketClient from '@shared/client/workerWebSocketClient'
// Type definitions are automatically included
```

## 🎯 Quick Start

### Basic Connection
```javascript
// Create client instance
const client = new WorkerWebSocketClient('ws://localhost:8788/ws')

// Connect to worker
await client.connect()

// Execute a command
const result = await client.executeCommand('status')
console.log(result.output)

// Disconnect when done
client.disconnect()
```

### With Configuration
```javascript
const client = new WorkerWebSocketClient('ws://localhost:8788/ws', {
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  requestTimeout: 10000
})
```

## 📋 API Reference

### Constructor
```javascript
new WorkerWebSocketClient(url, options)
```

**Parameters:**
- `url` (string): WebSocket URL (e.g., 'ws://localhost:8788/ws')
- `options` (object, optional): Configuration options

**Options:**
```javascript
{
  autoReconnect: true,           // Enable automatic reconnection
  reconnectInterval: 5000,       // Delay between reconnection attempts (ms)
  maxReconnectAttempts: 10,      // Maximum reconnection attempts
  heartbeatInterval: 30000,      // Heartbeat interval (ms)
  requestTimeout: 10000          // Request timeout (ms)
}
```

### Connection Methods

#### `connect()`
Establish WebSocket connection.
```javascript
await client.connect()
```

#### `disconnect()`
Close WebSocket connection and disable auto-reconnection.
```javascript
client.disconnect()
```

#### `getStatus()`
Get current connection status.
```javascript
const status = client.getStatus()
// Returns: { connected: boolean, connecting: boolean, reconnectAttempts: number, url: string }
```

### Request-Response Methods

#### `request(type, data, timeout)`
Send a request and wait for response.
```javascript
const result = await client.request('get_metrics', { detailed: true }, 5000)
```

#### `send(message)`
Send a one-way message (no response expected).
```javascript
client.send({ type: 'notification', message: 'Hello Worker!' })
```

### Convenience Methods

#### `executeCommand(command)`
Execute a diagnostic command.
```javascript
const result = await client.executeCommand('ping orchestrator')
console.log(result.output)
```

#### `getMetrics()`
Get current worker metrics.
```javascript
const metrics = await client.getMetrics()
console.log(metrics.uptime, metrics.totalProcessed)
```

#### `getHealth()`
Get worker health status.
```javascript
const health = await client.getHealth()
console.log(health.healthy, health.orchestrator.connected)
```

### Event Subscription

#### `subscribe(eventType, handler)`
Subscribe to events of a specific type.
```javascript
const unsubscribe = client.subscribe('log', (logMessage) => {
  console.log(`[${logMessage.level}] ${logMessage.message}`)
})

// Unsubscribe when done
unsubscribe()
```

#### `subscribeLogs(handler)`
Subscribe to real-time log messages.
```javascript
const unsubscribe = client.subscribeLogs((log) => {
  console.log(`[${log.level.toUpperCase()}] ${log.message}`)
})
```

#### `subscribeMetrics(handler)`
Subscribe to metrics updates.
```javascript
const unsubscribe = client.subscribeMetrics((metricsMessage) => {
  updateDashboard(metricsMessage.metrics)
})
```

#### `subscribeEvents(handler)`
Subscribe to worker events.
```javascript
const unsubscribe = client.subscribeEvents((event) => {
  if (event.type === 'operation_completed') {
    showNotification('Operation completed!')
  }
})
```

### Connection Events

#### Event Handlers
```javascript
client.onConnect = () => {
  console.log('Connected to worker')
}

client.onDisconnect = (event) => {
  console.log('Disconnected:', event.reason)
}

client.onReconnecting = (attempt) => {
  console.log(`Reconnection attempt ${attempt}`)
}

client.onError = (error) => {
  console.error('WebSocket error:', error)
}
```

#### Event Listeners
```javascript
client.on('connect', () => console.log('Connected'))
client.on('disconnect', (event) => console.log('Disconnected'))
client.on('error', (error) => console.error('Error:', error))
client.on('message', (message) => console.log('Message:', message))
```

## 🔄 Message Format

### Request Message
```javascript
{
  id: 123,                    // Unique request ID
  type: 'request',            // Message type
  request_type: 'command',    // Request type
  data: { command: 'status' }, // Request data
  timestamp: 1635789123456    // Timestamp
}
```

### Response Message
```javascript
{
  id: 123,                    // Matching request ID
  type: 'response',           // Message type
  success: true,              // Success flag
  data: { output: '...' },    // Response data (if success)
  error: 'Error message',     // Error message (if !success)
  timestamp: 1635789123456    // Timestamp
}
```

### Event Message
```javascript
{
  type: 'log',                // Event type: 'log', 'metrics', 'event'
  level: 'info',              // Log level (for log events)
  message: 'Operation started', // Event message
  timestamp: 1635789123456    // Timestamp
}
```

## 🎨 Usage Examples

### Example 1: Basic Diagnostics Dashboard
```javascript
async function createDashboard() {
  const client = new WorkerWebSocketClient('ws://localhost:8788/ws')
  
  // Set up connection handlers
  client.onConnect = () => {
    document.getElementById('status').textContent = 'Connected'
    document.getElementById('status').className = 'status-connected'
  }
  
  client.onDisconnect = () => {
    document.getElementById('status').textContent = 'Disconnected'
    document.getElementById('status').className = 'status-disconnected'
  }
  
  // Connect
  await client.connect()
  
  // Subscribe to real-time metrics
  client.subscribeMetrics((metricsMessage) => {
    const metrics = metricsMessage.metrics
    document.getElementById('uptime').textContent = metrics.uptime
    document.getElementById('processed').textContent = metrics.totalProcessed
    document.getElementById('success-rate').textContent = metrics.successRate
  })
  
  // Subscribe to logs
  client.subscribeLogs((log) => {
    const logElement = document.createElement('div')
    logElement.className = `log-${log.level}`
    logElement.textContent = `[${new Date().toLocaleTimeString()}] ${log.message}`
    document.getElementById('logs').appendChild(logElement)
  })
}
```

### Example 2: Multi-Worker Monitoring
```javascript
class WorkerMonitor {
  constructor() {
    this.workers = new Map()
  }
  
  async addWorker(name, port) {
    const client = new WorkerWebSocketClient(`ws://localhost:${port}/ws`)
    
    client.onConnect = () => this.updateStatus(name, 'connected')
    client.onDisconnect = () => this.updateStatus(name, 'disconnected')
    
    client.subscribeLogs((log) => {
      this.addToGlobalLog(name, log)
    })
    
    await client.connect()
    this.workers.set(name, client)
  }
  
  async broadcastCommand(command) {
    const results = new Map()
    
    for (const [name, client] of this.workers) {
      try {
        const result = await client.executeCommand(command)
        results.set(name, result)
      } catch (error) {
        results.set(name, { error: error.message })
      }
    }
    
    return results
  }
  
  updateStatus(workerName, status) {
    const element = document.getElementById(`${workerName}-status`)
    if (element) {
      element.textContent = status
      element.className = `status-${status}`
    }
  }
  
  addToGlobalLog(workerName, log) {
    const logEntry = `[${workerName}] [${log.level.toUpperCase()}] ${log.message}`
    console.log(logEntry)
  }
}

// Usage
const monitor = new WorkerMonitor()
await monitor.addWorker('agent-factory', 8788)
await monitor.addWorker('data-factory', 8789)

// Broadcast command to all workers
const results = await monitor.broadcastCommand('status')
console.log(results)
```

### Example 3: Custom Worker Integration
```javascript
class CustomWorkerClient {
  constructor(workerUrl) {
    this.client = new WorkerWebSocketClient(workerUrl)
    this.setupHandlers()
  }
  
  setupHandlers() {
    this.client.onConnect = () => {
      this.onConnectionChange(true)
    }
    
    this.client.onDisconnect = () => {
      this.onConnectionChange(false)
    }
    
    // Subscribe to worker-specific events
    this.client.subscribeEvents((event) => {
      this.handleWorkerEvent(event)
    })
  }
  
  async initialize() {
    await this.client.connect()
    
    // Load initial data
    const config = await this.client.request('get_config')
    this.updateConfig(config)
    
    const health = await this.client.getHealth()
    this.updateHealthStatus(health)
  }
  
  async processData(data) {
    return await this.client.request('process', {
      type: 'user_data',
      payload: data,
      options: { validate: true }
    })
  }
  
  async updateSettings(settings) {
    return await this.client.request('update_settings', settings)
  }
  
  handleWorkerEvent(event) {
    switch (event.type) {
      case 'processing_started':
        this.showProcessingIndicator()
        break
      case 'processing_completed':
        this.hideProcessingIndicator()
        this.showResult(event.data)
        break
      case 'error_occurred':
        this.showError(event.error)
        break
    }
  }
  
  onConnectionChange(connected) {
    const features = document.querySelectorAll('.requires-connection')
    features.forEach(el => el.disabled = !connected)
  }
}
```

## 🔧 Worker-Side Implementation

To support the WebSocket client, your worker needs to handle the standardized message format:

```typescript
// In your worker's WebSocket handler
server.addEventListener('message', async (event) => {
  const message = JSON.parse(event.data)
  
  if (message.type === 'request') {
    const { id, request_type, data } = message
    
    try {
      let result
      
      switch (request_type) {
        case 'command':
          result = await executeCommand(data.command)
          break
        case 'metrics':
          result = await getMetrics()
          break
        case 'health':
          result = await getHealth()
          break
        default:
          throw new Error(`Unknown request type: ${request_type}`)
      }
      
      // Send success response
      server.send(JSON.stringify({
        id,
        type: 'response',
        success: true,
        data: result,
        timestamp: Date.now()
      }))
      
    } catch (error) {
      // Send error response
      server.send(JSON.stringify({
        id,
        type: 'response',
        success: false,
        error: error.message,
        timestamp: Date.now()
      }))
    }
  }
})
```

## 🛠️ Development

### Building the Minified Version
```bash
# Install terser for minification
npm install -g terser

# Minify the client
terser @shared/client/workerWebSocketClient.js \
  --compress --mangle \
  --output @shared/client/workerWebSocketClient.min.js
```

### Testing
```javascript
// Basic connection test
async function testConnection() {
  const client = new WorkerWebSocketClient('ws://localhost:8788/ws')
  
  try {
    await client.connect()
    console.log('✅ Connection successful')
    
    const result = await client.executeCommand('status')
    console.log('✅ Command execution successful:', result)
    
    client.disconnect()
    console.log('✅ Disconnection successful')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}
```

## 🚨 Error Handling

### Connection Errors
```javascript
client.onError = (error) => {
  console.error('WebSocket error:', error)
  
  // Handle specific error types
  if (error.code === 1006) {
    // Abnormal closure
    showNotification('Connection lost unexpectedly', 'error')
  }
}
```

### Request Timeouts
```javascript
try {
  const result = await client.request('slow_operation', {}, 30000) // 30s timeout
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Operation timed out')
  }
}
```

### Reconnection Handling
```javascript
client.onReconnecting = (attempt) => {
  if (attempt > 3) {
    showNotification('Having trouble reconnecting...', 'warning')
  }
  
  if (attempt >= client.options.maxReconnectAttempts) {
    showNotification('Failed to reconnect. Please refresh the page.', 'error')
  }
}
```

## 🔒 Security Considerations

1. **Origin Validation**: Ensure your worker validates WebSocket origins
2. **Authentication**: Implement authentication for sensitive operations
3. **Rate Limiting**: Protect against abuse with rate limiting
4. **Input Validation**: Validate all incoming messages and data
5. **HTTPS/WSS**: Use secure connections in production

## 📊 Performance Tips

1. **Connection Pooling**: Reuse connections when possible
2. **Message Batching**: Batch multiple operations when appropriate
3. **Subscription Management**: Unsubscribe from unused events
4. **Heartbeat Tuning**: Adjust heartbeat interval based on your needs
5. **Error Recovery**: Implement proper error recovery strategies

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add TypeScript definitions for new features
3. Update documentation for API changes
4. Test with multiple workers and scenarios
5. Consider backward compatibility

## 📄 License

This WebSocket client library is part of the core-vibe-hq ecosystem and follows the same licensing terms as the main project.

