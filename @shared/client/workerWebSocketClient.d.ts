/**
 * TypeScript definitions for WorkerWebSocketClient
 */

export interface WebSocketClientOptions {
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  requestTimeout?: number
}

export interface WebSocketMessage {
  id?: number
  type: string
  data?: any
  timestamp?: number
  success?: boolean
  error?: string
}

export interface RequestMessage extends WebSocketMessage {
  type: 'request'
  request_type: string
}

export interface ResponseMessage extends WebSocketMessage {
  type: 'response'
  id: number
  success: boolean
  data?: any
  error?: string
}

export interface EventMessage extends WebSocketMessage {
  type: 'event' | 'log' | 'metrics'
}

export interface LogMessage extends EventMessage {
  type: 'log'
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  message: string
  source?: string
  timestamp: number
}

export interface MetricsMessage extends EventMessage {
  type: 'metrics'
  metrics: {
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
}

export interface ConnectionStatus {
  connected: boolean
  connecting: boolean
  reconnectAttempts: number
  url: string
}

export interface HealthStatus {
  healthy: boolean
  timestamp: string
  uptime: string
  orchestrator: {
    connected: boolean
    error?: string
  }
  metrics: any
}

export type EventHandler<T = any> = (data: T) => void
export type UnsubscribeFunction = () => void

export declare class WorkerWebSocketClient {
  constructor(url: string, options?: WebSocketClientOptions)
  
  // Connection management
  connect(): Promise<void>
  disconnect(): void
  getStatus(): ConnectionStatus
  
  // Request-response pattern
  request<T = any>(type: string, data?: any, timeout?: number): Promise<T>
  send(message: WebSocketMessage | string): void
  
  // Event subscription
  subscribe<T = any>(eventType: string, handler: EventHandler<T>): UnsubscribeFunction
  unsubscribe(eventType: string, handler?: EventHandler): void
  
  // Connection events
  on(event: 'connect', handler: () => void): void
  on(event: 'disconnect', handler: (event: CloseEvent) => void): void
  on(event: 'error', handler: (error: Event) => void): void
  on(event: 'reconnecting', handler: (attempt: number) => void): void
  on(event: 'message', handler: EventHandler<WebSocketMessage>): void
  on(event: 'pong', handler: EventHandler<WebSocketMessage>): void
  
  off(event: string, handler: EventHandler): void
  emit(event: string, data?: any): void
  
  // Convenience methods
  executeCommand(command: string): Promise<{ output: string }>
  getMetrics(): Promise<MetricsMessage['metrics']>
  getHealth(): Promise<HealthStatus>
  
  // Subscription helpers
  subscribeLogs(handler: EventHandler<LogMessage>): UnsubscribeFunction
  subscribeMetrics(handler: EventHandler<MetricsMessage>): UnsubscribeFunction
  subscribeEvents(handler: EventHandler<EventMessage>): UnsubscribeFunction
  
  // Connection state callbacks
  onConnect?: () => void
  onDisconnect?: (event: CloseEvent) => void
  onError?: (error: Event) => void
  onReconnecting?: (attempt: number) => void
}

export default WorkerWebSocketClient
