import { setTimeout as delay } from 'node:timers/promises'

import {
  DEFAULT_ERROR_STORE_OPTIONS,
  DEFAULT_LOG_STORE_OPTIONS,
  ErrorFilter,
  ErrorStoreOptions,
  ErrorSummary,
  LogFilter,
  LogLevel,
  LogLine,
  LogRetrievalResponse,
  MonitoringEvent,
  MonitoringContext,
  Result,
  SimpleError,
  StoredError,
  StoredLog,
} from './types'
import {
  MonitoringTransport,
  TransportErrorRecord,
  TransportLogRecord,
  buildLogRecordsFromLines,
} from './transport'

export interface ProcessLog {
  readonly instanceId: string
  readonly processId: string
  readonly level: LogLevel
  readonly message: string
  readonly stream: 'stdout' | 'stderr'
  readonly timestamp: Date
  readonly source?: string
  readonly metadata?: Record<string, unknown>
}

export interface StorageManagerOptions {
  readonly error?: ErrorStoreOptions
  readonly log?: LogStoreOptions
  readonly flushIntervalMs?: number
  readonly maxBatchSize?: number
  readonly retryAttempts?: number
}

const DEFAULT_FLUSH_INTERVAL_MS = 1_000
const DEFAULT_MAX_BATCH_SIZE = 200
const DEFAULT_RETRY_ATTEMPTS = 3

export class StorageManager {
  private readonly transport: MonitoringTransport
  private readonly context: MonitoringContext
  private readonly options: Required<StorageManagerOptions>

  private readonly logQueue: TransportLogRecord[] = []
  private flushTimer?: NodeJS.Timeout
  private isClosed = false
  private flushInFlight = false

  constructor(transport: MonitoringTransport, context: MonitoringContext, options: StorageManagerOptions = {}) {
    this.transport = transport
    this.context = context
    this.options = {
      error: { ...DEFAULT_ERROR_STORE_OPTIONS, ...options.error },
      log: { ...DEFAULT_LOG_STORE_OPTIONS, ...options.log },
      flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      maxBatchSize: options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
      retryAttempts: options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
    }

    this.startFlushLoop()
  }

  public async storeError(instanceId: string, processId: string, error: SimpleError): Promise<Result<boolean>> {
    try {
      const payload: TransportErrorRecord = {
        instanceId,
        processId,
        error: error.message,
        level: error.level,
        metadata: { rawOutput: error.rawOutput },
        occurredAt: error.timestamp,
      }

      await this.retry(() => this.transport.recordError(payload, this.context))
      return { success: true, data: true }
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async storeLogs(logs: readonly ProcessLog[]): Promise<Result<number[]>> {
    try {
      const entries: TransportLogRecord[] = logs.map((log) => ({
        instanceId: log.instanceId,
        processId: log.processId,
        stream: log.stream,
        message: log.message,
        level: log.level,
        timestamp: log.timestamp.toISOString(),
        source: log.source,
        metadata: log.metadata,
      }))

      this.enqueueLogs(entries)
      return { success: true, data: entries.map((_entry, index) => index) }
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async storeLogLines(lines: readonly LogLine[], level: LogLevel = 'output'): Promise<Result<boolean>> {
    try {
      const entries = buildLogRecordsFromLines(lines, level)
      this.enqueueLogs(entries)
      return { success: true, data: true }
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async getErrors(filter: ErrorFilter): Promise<Result<readonly StoredError[]>> {
    try {
      return await this.transport.fetchErrors(filter, this.context)
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async getErrorSummary(filter: ErrorFilter): Promise<Result<ErrorSummary>> {
    try {
      return await this.transport.fetchErrorSummary(filter, this.context)
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async clearErrors(filter: ErrorFilter): Promise<Result<{ clearedCount: number }>> {
    try {
      return await this.transport.clearErrors(filter, this.context)
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async getLogs(filter: LogFilter): Promise<Result<LogRetrievalResponse>> {
    try {
      return await this.transport.fetchLogs(filter, this.context)
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async clearLogs(filter: LogFilter): Promise<Result<{ clearedCount: number }>> {
    try {
      return await this.transport.clearLogs(filter, this.context)
    } catch (err) {
      return { success: false, error: this.normalizeError(err) }
    }
  }

  public async recordEvent(event: MonitoringEvent): Promise<void> {
    await this.retry(() => this.transport.recordProcessEvent(event, this.context))
  }

  public async flush(): Promise<void> {
    if (this.flushInFlight) return
    if (this.logQueue.length === 0) return

    this.flushInFlight = true

    try {
      const batch = this.logQueue.splice(0, this.options.maxBatchSize)
      if (batch.length === 0) return
      await this.retry(() => this.transport.recordLogBatch(batch, this.context))
    } catch (error) {
      console.warn('[monitoring] failed to flush log batch', error)
    } finally {
      this.flushInFlight = false
      if (this.logQueue.length > 0 && !this.isClosed) {
        this.scheduleFlush()
      }
    }
  }

  public async close(): Promise<void> {
    this.isClosed = true
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    await this.flush()
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private enqueueLogs(entries: readonly TransportLogRecord[]): void {
    if (entries.length === 0) return
    this.logQueue.push(...entries)
    if (this.logQueue.length >= this.options.maxBatchSize) {
      void this.flush()
    } else {
      this.scheduleFlush()
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.isClosed) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      void this.flush()
    }, this.options.flushIntervalMs)
  }

  private startFlushLoop(): void {
    if (this.isClosed) return
    this.scheduleFlush()
  }

  private async retry(operation: () => Promise<void>): Promise<void> {
    let attempt = 0
    let lastError: unknown

    while (attempt < this.options.retryAttempts) {
      try {
        await operation()
        return
      } catch (error) {
        lastError = error
        attempt += 1
        if (attempt < this.options.retryAttempts) {
          await delay(100 * attempt)
        }
      }
    }

    throw this.normalizeError(lastError)
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error))
  }
}


