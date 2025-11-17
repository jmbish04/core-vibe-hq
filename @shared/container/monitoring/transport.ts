import {
  ContainerIdentity,
  ErrorFilter,
  ErrorSummary,
  LogFilter,
  LogLine,
  LogRetrievalResponse,
  MonitoringContext,
  MonitoringEvent,
  StoredError,
  StoredLog,
  StreamType,
  Result,
} from './types'

export interface TransportErrorRecord {
  readonly instanceId: string
  readonly processId: string
  readonly error: string
  readonly level: number
  readonly metadata?: Record<string, unknown>
  readonly occurredAt: string
}

export interface TransportLogRecord {
  readonly instanceId: string
  readonly processId: string
  readonly stream: StreamType
  readonly message: string
  readonly level: string
  readonly timestamp: string
  readonly source?: string
  readonly metadata?: Record<string, unknown>
}

export interface MonitoringTransport {
  readonly name: string

  recordProcessEvent(event: MonitoringEvent, context: MonitoringContext): Promise<void>
  recordError(payload: TransportErrorRecord, context: MonitoringContext): Promise<void>
  recordLogBatch(entries: readonly TransportLogRecord[], context: MonitoringContext): Promise<void>

  fetchErrors(filter: ErrorFilter, context: MonitoringContext): Promise<Result<readonly StoredError[]>>
  fetchErrorSummary(filter: ErrorFilter, context: MonitoringContext): Promise<Result<ErrorSummary>>
  clearErrors(filter: ErrorFilter, context: MonitoringContext): Promise<Result<{ clearedCount: number }>>

  fetchLogs(filter: LogFilter, context: MonitoringContext): Promise<Result<LogRetrievalResponse>>
  clearLogs(filter: LogFilter, context: MonitoringContext): Promise<Result<{ clearedCount: number }>>
}

export interface HttpMonitoringTransportOptions {
  readonly baseUrl?: string
  readonly apiToken?: string
  readonly identity?: ContainerIdentity
  readonly fetchImpl?: typeof fetch
}

interface ApiRequestInit extends RequestInit {
  readonly headers: HeadersInit
}

const DEFAULT_HEADERS: Record<string, string> = {
  'content-type': 'application/json',
}

export class HttpMonitoringTransport implements MonitoringTransport {
  public readonly name = 'http'

  private readonly baseUrl: string
  private readonly apiToken?: string
  private readonly identity?: ContainerIdentity
  private readonly fetchImpl: typeof fetch

  constructor(options: HttpMonitoringTransportOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.MONITORING_API_BASE_URL || 'http://127.0.0.1:8787'
    this.apiToken = options.apiToken || process.env.MONITORING_API_TOKEN
    this.identity = options.identity
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis)

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch implementation is required for HttpMonitoringTransport')
    }
  }

  async recordProcessEvent(event: MonitoringEvent, context: MonitoringContext): Promise<void> {
    await this.ensureVoid(this.post('/api/monitoring/events', { event, context }))
  }

  async recordError(payload: TransportErrorRecord, context: MonitoringContext): Promise<void> {
    await this.ensureVoid(this.post('/api/monitoring/errors', { error: payload, context }))
  }

  async recordLogBatch(entries: readonly TransportLogRecord[], context: MonitoringContext): Promise<void> {
    if (entries.length === 0) return
    await this.ensureVoid(this.post('/api/monitoring/logs/batch', { entries, context }))
  }

  async fetchErrors(filter: ErrorFilter, context: MonitoringContext): Promise<Result<readonly StoredError[]>> {
    return this.get('/api/monitoring/errors', filter, context)
  }

  async fetchErrorSummary(filter: ErrorFilter, context: MonitoringContext): Promise<Result<ErrorSummary>> {
    return this.get('/api/monitoring/errors/summary', filter, context)
  }

  async clearErrors(filter: ErrorFilter, context: MonitoringContext): Promise<Result<{ clearedCount: number }>> {
    return this.post('/api/monitoring/errors/clear', { filter, context })
  }

  async fetchLogs(filter: LogFilter, context: MonitoringContext): Promise<Result<LogRetrievalResponse>> {
    return this.get('/api/monitoring/logs', filter, context)
  }

  async clearLogs(filter: LogFilter, context: MonitoringContext): Promise<Result<{ clearedCount: number }>> {
    return this.post('/api/monitoring/logs/clear', { filter, context })
  }

  private async get<T>(path: string, params: Record<string, unknown>, context: MonitoringContext): Promise<Result<T>> {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue
      if (value instanceof Date) {
        query.append(key, value.toISOString())
      } else {
        query.append(key, String(value))
      }
    }

    const url = `${this.baseUrl}${path}${query.toString() ? `?${query.toString()}` : ''}`

    try {
      const response = await this.fetchImpl(url, this.buildInit('GET', undefined, context))
      if (!response.ok) {
        return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) }
      }

      const data = (await response.json()) as T
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }

  private async post<T>(path: string, body: unknown): Promise<Result<T>>
  private async post<T>(path: string, body: unknown, context?: MonitoringContext): Promise<Result<T>>
  private async post<T>(path: string, body: unknown, context?: MonitoringContext): Promise<Result<T>> {
    const url = `${this.baseUrl}${path}`

    try {
      const response = await this.fetchImpl(url, this.buildInit('POST', body, context))
      if (!response.ok) {
        return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) }
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = (await response.json()) as T
        return { success: true, data }
      }

      return { success: true, data: undefined as unknown as T }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }

  private buildInit(method: 'GET' | 'POST', body: unknown, context?: MonitoringContext): ApiRequestInit {
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
    }

    if (this.apiToken) {
      headers.authorization = `Bearer ${this.apiToken}`
    }

    const effectiveContext = context ?? { identity: this.identity ?? defaultIdentity(), transportName: this.name }

    headers['cf-container-worker'] = effectiveContext.identity.workerName
    headers['cf-container-name'] = effectiveContext.identity.containerName
    if (effectiveContext.identity.environment) {
      headers['cf-container-env'] = effectiveContext.identity.environment
    }

    return {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  }

  private async ensureVoid<T>(resultPromise: Promise<Result<T>>): Promise<void> {
    const result = await resultPromise
    if (!result.success) {
      throw result.error
    }
  }
}

export class NoopMonitoringTransport implements MonitoringTransport {
  public readonly name = 'noop'

  async recordProcessEvent(event: MonitoringEvent, _context: MonitoringContext): Promise<void> {
    console.debug('[monitoring][noop] event', event)
  }

  async recordError(payload: TransportErrorRecord, _context: MonitoringContext): Promise<void> {
    console.debug('[monitoring][noop] error', payload)
  }

  async recordLogBatch(entries: readonly TransportLogRecord[], _context: MonitoringContext): Promise<void> {
    if (entries.length > 0) {
      console.debug(`[monitoring][noop] log batch (${entries.length})`)
    }
  }

  async fetchErrors(_filter: ErrorFilter, _context: MonitoringContext): Promise<Result<readonly StoredError[]>> {
    return { success: true, data: [] }
  }

  async fetchErrorSummary(_filter: ErrorFilter, _context: MonitoringContext): Promise<Result<ErrorSummary>> {
    return {
      success: true,
      data: {
        totalErrors: 0,
        errorsByLevel: {},
        uniqueErrors: 0,
        repeatedErrors: 0,
      },
    }
  }

  async clearErrors(_filter: ErrorFilter, _context: MonitoringContext): Promise<Result<{ clearedCount: number }>> {
    return { success: true, data: { clearedCount: 0 } }
  }

  async fetchLogs(_filter: LogFilter, _context: MonitoringContext): Promise<Result<LogRetrievalResponse>> {
    return { success: true, data: { success: true, logs: [], hasMore: false } }
  }

  async clearLogs(_filter: LogFilter, _context: MonitoringContext): Promise<Result<{ clearedCount: number }>> {
    return { success: true, data: { clearedCount: 0 } }
  }
}

function defaultIdentity(): ContainerIdentity {
  return {
    workerName: process.env.WORKER_NAME || 'unknown-worker',
    containerName: process.env.CONTAINER_NAME || 'unknown-container',
    environment: process.env.CONTAINER_ENV || 'docker',
  }
}

export function buildLogRecordsFromLines(logs: readonly LogLine[], level: string = 'output'): readonly TransportLogRecord[] {
  return logs.map((line) => ({
    instanceId: line.instanceId,
    processId: line.processId,
    stream: line.stream,
    message: line.content,
    level,
    timestamp: line.timestamp.toISOString(),
  }))
}


