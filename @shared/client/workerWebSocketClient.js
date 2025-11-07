/**
 * Worker WebSocket Client Library
 * 
 * Provides standardized 2-way communication between frontends and workers
 * via WebSocket API. Supports request-response patterns, event streaming,
 * and automatic reconnection.
 * 
 * Usage:
 *   const client = new WorkerWebSocketClient('ws://localhost:8788/ws')
 *   await client.connect()
 *   const result = await client.request('ping', { target: 'orchestrator' })
 *   client.subscribe('logs', (log) => console.log(log))
 */

class WorkerWebSocketClient {
  constructor(url, options = {}) {
    this.url = url
    this.options = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      requestTimeout: 10000,
      ...options
    }
    
    this.ws = null
    this.isConnected = false
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.heartbeatTimer = null
    this.requestId = 0
    
    // Event handlers
    this.eventHandlers = new Map()
    this.pendingRequests = new Map()
    this.subscriptions = new Map()
    
    // Connection state callbacks
    this.onConnect = null
    this.onDisconnect = null
    this.onError = null
    this.onReconnecting = null
  }

  /**
   * Connect to the WebSocket server
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this.isConnecting = true
      
      try {
        this.ws = new WebSocket(this.url)
        
        this.ws.onopen = () => {
          this.isConnected = true
          this.isConnecting = false
          this.reconnectAttempts = 0
          
          this.startHeartbeat()
          this.emit('connect')
          
          if (this.onConnect) this.onConnect()
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
        
        this.ws.onclose = (event) => {
          this.handleDisconnect(event)
        }
        
        this.ws.onerror = (error) => {
          this.isConnecting = false
          this.emit('error', error)
          if (this.onError) this.onError(error)
          reject(error)
        }
        
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    this.options.autoReconnect = false
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.isConnected = false
    this.isConnecting = false
    
    // Reject all pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()
  }

  /**
   * Send a request and wait for response
   */
  async request(type, data = {}, timeout = null) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected')
    }

    const requestId = ++this.requestId
    const message = {
      id: requestId,
      type: 'request',
      request_type: type,
      data,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.options.requestTimeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Request timeout: ${type}`))
      }, timeoutMs)

      this.pendingRequests.set(requestId, {
        resolve: (data) => {
          clearTimeout(timer)
          resolve(data)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })

      this.send(message)
    })
  }

  /**
   * Send a one-way message (no response expected)
   */
  send(message) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected')
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
    this.ws.send(messageStr)
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType, handler) {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set())
    }
    this.subscriptions.get(eventType).add(handler)
    
    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(eventType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.subscriptions.delete(eventType)
        }
      }
    }
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType, handler = null) {
    if (handler) {
      const handlers = this.subscriptions.get(eventType)
      if (handlers) {
        handlers.delete(handler)
      }
    } else {
      this.subscriptions.delete(eventType)
    }
  }

  /**
   * Add event listener for connection events
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event).add(handler)
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data = null) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data)
      
      // Handle response to a request
      if (message.type === 'response' && message.id) {
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          this.pendingRequests.delete(message.id)
          if (message.success) {
            pending.resolve(message.data)
          } else {
            pending.reject(new Error(message.error || 'Request failed'))
          }
        }
        return
      }
      
      // Handle events/notifications
      if (message.type === 'event' || message.type === 'log' || message.type === 'metrics') {
        this.notifySubscribers(message.type, message)
        this.emit('message', message)
        return
      }
      
      // Handle heartbeat/pong
      if (message.type === 'pong') {
        this.emit('pong', message)
        return
      }
      
      // Handle other message types
      this.emit('message', message)
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, data)
      this.emit('error', error)
    }
  }

  /**
   * Notify subscribers of events
   */
  notifySubscribers(eventType, message) {
    const handlers = this.subscriptions.get(eventType)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message)
        } catch (error) {
          console.error(`Error in subscription handler for ${eventType}:`, error)
        }
      }
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(event) {
    this.isConnected = false
    this.stopHeartbeat()
    
    this.emit('disconnect', event)
    if (this.onDisconnect) this.onDisconnect(event)
    
    // Attempt reconnection if enabled
    if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++
      
      this.emit('reconnecting', this.reconnectAttempts)
      if (this.onReconnecting) this.onReconnecting(this.reconnectAttempts)
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect().catch(error => {
            console.error('Reconnection failed:', error)
          })
        }
      }, this.options.reconnectInterval)
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping', timestamp: Date.now() })
      }
    }, this.options.heartbeatInterval)
  }

  /**
   * Stop heartbeat timer
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url
    }
  }

  /**
   * Execute a diagnostic command
   */
  async executeCommand(command) {
    return this.request('command', { command })
  }

  /**
   * Get worker metrics
   */
  async getMetrics() {
    return this.request('metrics')
  }

  /**
   * Get worker health status
   */
  async getHealth() {
    return this.request('health')
  }

  /**
   * Subscribe to real-time logs
   */
  subscribeLogs(handler) {
    return this.subscribe('log', handler)
  }

  /**
   * Subscribe to metrics updates
   */
  subscribeMetrics(handler) {
    return this.subscribe('metrics', handler)
  }

  /**
   * Subscribe to worker events
   */
  subscribeEvents(handler) {
    return this.subscribe('event', handler)
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkerWebSocketClient
}

if (typeof window !== 'undefined') {
  window.WorkerWebSocketClient = WorkerWebSocketClient
}

if (typeof self !== 'undefined') {
  self.WorkerWebSocketClient = WorkerWebSocketClient
}
