/**
 * Unified storage manager that routes all operations through orchestrator RPC
 * 
 * CRITICAL: This version routes ALL database operations to orchestrator via HTTP,
 * removing all local SQLite database operations. All data is stored centrally
 * in orchestrator's D1 database with worker/container identification.
 */

import { createHash } from 'crypto';
import { 
  SimpleError,
  StoredError,
  ProcessInfo,
  StoredLog,
  LogLevel,
  ErrorSummary,
  ErrorStoreOptions,
  LogStoreOptions,
  LogFilter,
  LogCursor,
  LogRetrievalResponse,
  Result,
  ERROR_HASH_ALGORITHM,
  DEFAULT_STORAGE_OPTIONS,
  DEFAULT_LOG_STORE_OPTIONS
} from './types.js';
import { OrchestratorClient, OrchestratorClientConfig } from './orchestrator-client.js';

export interface ProcessLog {
  readonly instanceId: string;
  readonly processId: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly stream: 'stdout' | 'stderr';
  readonly source?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Unified storage manager - routes all operations through orchestrator
 * NO LOCAL SQLITE DATABASES - all data stored in orchestrator D1
 */
export class StorageManager {
  private orchestratorClient: OrchestratorClient;
  private errorStorage: ErrorStorage;
  private logStorage: LogStorage;
  private options: {
    error: Required<ErrorStoreOptions>;
    log: Required<LogStoreOptions>;
  };

  constructor(
    config?: OrchestratorClientConfig | Record<string, string | undefined>,
    options: { error?: ErrorStoreOptions; log?: LogStoreOptions } = {}
  ) {
    // Initialize orchestrator client
    if (config && 'orchestratorUrl' in config) {
      // Direct config object
      this.orchestratorClient = new OrchestratorClient(config);
    } else {
      // Environment variables (for Bun/Docker containers)
      this.orchestratorClient = OrchestratorClient.fromEnv(config || process.env as Record<string, string | undefined>);
    }

    this.options = {
      error: { ...DEFAULT_STORAGE_OPTIONS, ...options.error } as Required<ErrorStoreOptions>,
      log: { ...DEFAULT_LOG_STORE_OPTIONS, ...options.log } as Required<LogStoreOptions>
    };

    this.errorStorage = new ErrorStorage(this.orchestratorClient, this.options.error);
    this.logStorage = new LogStorage(this.orchestratorClient, this.options.log);

    this.setupMaintenanceTasks();
  }

  private setupMaintenanceTasks(): void {
    // Maintenance tasks can be handled by orchestrator
    // No local cleanup needed since we don't store data locally
  }

  private toError(error: unknown, defaultMessage = 'Unknown error'): Error {
    return error instanceof Error ? error : new Error(String(error) || defaultMessage);
  }

  /**
   * Wrapper for retry operations
   */
  private retryOperation<T>(operation: () => Promise<Result<T>>, maxRetries: number = 3): Promise<Result<T>> {
    return new Promise(async (resolve) => {
      let attempt = 0;
      let lastResult: Result<T> = await operation();

      while (!lastResult.success && attempt < maxRetries - 1) {
        attempt += 1;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        lastResult = await operation();
      }

      resolve(lastResult);
    });
  }

  private async wrapRetryOperation<T>(operation: () => Promise<Result<T>>): Promise<Result<T>> {
    try {
      return await this.retryOperation(operation);
    } catch (error) {
      return { success: false, error: this.toError(error) };
    }
  }

  public async storeProcessInfo(processInfo: ProcessInfo): Promise<Result<boolean>> {
    try {
      const result = await this.orchestratorClient.upsertProcess({
        instanceId: processInfo.instanceId,
        processId: processInfo.pid?.toString(),
        command: processInfo.command,
        args: processInfo.args as string[],
        cwd: processInfo.cwd,
        status: processInfo.status || 'running',
        restartCount: processInfo.restartCount,
        startTime: processInfo.startTime?.getTime(),
        endTime: processInfo.endTime?.getTime(),
        exitCode: processInfo.exitCode,
        lastError: processInfo.lastError,
        env: processInfo.env as Record<string, string>,
      });

      if (!result.success) {
        return { success: false, error: new Error(result.error || 'Failed to store process info') };
      }

      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: this.toError(error) };
    }
  }

  public storeError(instanceId: string, processId: string, error: SimpleError): Promise<Result<boolean>> {
    return this.wrapRetryOperation(() => this.errorStorage.storeError(instanceId, processId, error));
  }

  public getErrors(instanceId: string): Promise<Result<StoredError[]>> {
    return this.errorStorage.getErrors(instanceId);
  }

  public getErrorSummary(instanceId: string): Promise<Result<ErrorSummary>> {
    return this.errorStorage.getErrorSummary(instanceId);
  }

  public clearErrors(instanceId: string): Promise<Result<{ clearedCount: number }>> {
    return this.errorStorage.clearErrors(instanceId);
  }

  public storeLogs(logs: ProcessLog[]): Promise<Result<number[]>> {
    return this.logStorage.storeLogs(logs);
  }

  public getLogs(filter: LogFilter = {}): Promise<Result<LogRetrievalResponse>> {
    return this.logStorage.getLogs(filter);
  }

  public clearLogs(instanceId: string): Promise<Result<{ clearedCount: number }>> {
    return this.logStorage.clearLogs(instanceId);
  }

  public getLogStats(instanceId: string): Promise<Result<{
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByStream: Record<'stdout' | 'stderr', number>;
    oldestLog?: Date;
    newestLog?: Date;
  }>> {
    return this.logStorage.getLogStats(instanceId);
  }

  public transaction<T>(operation: () => T): T {
    // Transactions are handled by orchestrator
    // For compatibility, just execute the operation
    return operation();
  }

  /**
   * Close - no cleanup needed since we don't have local databases
   */
  public close(): void {
    // No local databases to close
    // Orchestrator handles all persistence
  }
}

class ErrorStorage {
  private client: OrchestratorClient;
  private options: Required<ErrorStoreOptions>;

  private errorResult<T>(error: unknown, defaultMessage: string): Result<T> {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(defaultMessage)
    };
  }

  private successResult<T>(data: T): Result<T> {
    return { success: true, data };
  }

  constructor(client: OrchestratorClient, options: Required<ErrorStoreOptions>) {
    this.client = client;
    this.options = options;
  }

  public async storeError(instanceId: string, processId: string, error: SimpleError): Promise<Result<boolean>> {
    try {
      const cleanedMessage = this.cleanMessageForHashing(error.message);
      
      const errorHash = createHash(ERROR_HASH_ALGORITHM)
        .update(cleanedMessage)
        .update(String(error.level))
        .digest('hex');

      const result = await this.client.storeError({
        instanceId,
        processId,
        errorHash,
        timestamp: error.timestamp,
        level: error.level,
        message: error.message,
        rawOutput: error.rawOutput,
      });

      if (!result.success) {
        return this.errorResult<boolean>(new Error(result.error), 'Failed to store error via orchestrator');
      }

      return this.successResult(true);
    } catch (error) {
      return this.errorResult<boolean>(error, 'Unknown error storing error');
    }
  }

  public async getErrors(instanceId: string): Promise<Result<StoredError[]>> {
    try {
      const result = await this.client.getErrors({ instanceId });

      if (!result.success || !result.data) {
        return this.errorResult<StoredError[]>(new Error(result.error), 'Failed to get errors from orchestrator');
      }

      // Map orchestrator response to StoredError format
      const errors: StoredError[] = result.data.data.map(err => ({
        id: err.id,
        instanceId: err.instanceId,
        processId: err.processId,
        errorHash: err.errorHash,
        timestamp: err.timestamp,
        level: err.level,
        message: err.message,
        rawOutput: err.rawOutput,
        occurrenceCount: err.occurrenceCount,
        createdAt: new Date(err.createdAt).toISOString(),
      }));

      return this.successResult(errors);
    } catch (error) {
      return this.errorResult<StoredError[]>(error, 'Unknown error retrieving errors');
    }
  }

  public async getErrorSummary(instanceId: string): Promise<Result<ErrorSummary>> {
    try {
      const errorsResult = await this.getErrors(instanceId);
      
      if (!errorsResult.success || !errorsResult.data) {
        return this.errorResult<ErrorSummary>(errorsResult.error, 'Failed to get errors for summary');
      }

      const errors = errorsResult.data;
      
      if (errors.length === 0) {
        return {
          success: true,
          data: {
            totalErrors: 0,
            errorsByLevel: {} as Record<number, number>,
            uniqueErrors: 0,
            repeatedErrors: 0,
            latestError: undefined,
            oldestError: undefined
          }
        };
      }

      const errorsByLevel = {} as Record<number, number>;
      const uniqueHashes = new Set<string>();
      let totalOccurrences = 0;
      
      for (const error of errors) {
        errorsByLevel[error.level] = (errorsByLevel[error.level] || 0) + error.occurrenceCount;
        uniqueHashes.add(error.errorHash);
        totalOccurrences += error.occurrenceCount;
      }

      const summary: ErrorSummary = {
        totalErrors: totalOccurrences,
        uniqueErrors: uniqueHashes.size,
        repeatedErrors: totalOccurrences - errors.length,
        errorsByLevel,
        latestError: new Date(errors[0].timestamp),
        oldestError: new Date(errors[errors.length - 1].timestamp)
      };

      return this.successResult(summary);
    } catch (error) {
      return this.errorResult<ErrorSummary>(error, 'Unknown error getting summary');
    }
  }

  public async clearErrors(instanceId: string): Promise<Result<{ clearedCount: number }>> {
    // Note: Orchestrator doesn't have a clearErrors endpoint yet
    // For now, return success with 0 cleared
    // TODO: Add clearErrors endpoint to orchestrator if needed
    return this.successResult({ clearedCount: 0 });
  }
  
  private cleanMessageForHashing(message: string): string {
    let cleaned = message;
    
    cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'TIMESTAMP');
    cleaned = cleaned.replace(/\b\d{13}\b/g, 'UNIX_TIME');
    cleaned = cleaned.replace(/:\d{4,5}\b/g, ':PORT');
    cleaned = cleaned.replace(/(:\d+):(\d+)/g, ':LINE:COL');
    cleaned = cleaned.replace(/\?v=[a-f0-9]+/g, '?v=HASH');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 500);
    }
    
    return cleaned;
  }

  public close(): void {
    // No cleanup needed
  }
}

class LogStorage {
  private client: OrchestratorClient;
  private options: Required<LogStoreOptions>;
  private sequenceCounter = 0;

  constructor(client: OrchestratorClient, options: Required<LogStoreOptions>) {
    this.client = client;
    this.options = options;
    // Initialize sequence counter from timestamp to avoid collisions
    this.sequenceCounter = Date.now();
  }

  public async storeLog(log: ProcessLog): Promise<Result<number>> {
    try {
      const sequence = this.sequenceCounter++;
      const timestamp = new Date().toISOString();
      
      const result = await this.client.storeLog({
        instanceId: log.instanceId,
        processId: log.processId,
        sequence,
        timestamp,
        level: log.level,
        message: log.message,
        stream: log.stream,
        source: log.source,
        metadata: log.metadata,
      });

      if (!result.success) {
        return { 
          success: false, 
          error: new Error(result.error || 'Failed to store log via orchestrator')
        };
      }

      return { success: true, data: sequence };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error storing log') 
      };
    }
  }

  public async storeLogs(logs: ProcessLog[]): Promise<Result<number[]>> {
    try {
      if (logs.length === 0) {
        return { success: true, data: [] };
      }

      const timestamp = new Date().toISOString();
      const logEntries = logs.map(log => ({
        sequence: this.sequenceCounter++,
        timestamp,
        level: log.level,
        message: log.message,
        stream: log.stream,
        source: log.source,
        metadata: log.metadata,
      }));

      const result = await this.client.storeLogs({
        instanceId: logs[0].instanceId,
        processId: logs[0].processId,
        logs: logEntries,
      });

      if (!result.success) {
        return { 
          success: false, 
          error: new Error(result.error || 'Failed to store logs via orchestrator')
        };
      }

      return { success: true, data: logEntries.map(l => l.sequence) };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error storing logs') 
      };
    }
  }

  public async getLogs(filter: LogFilter = {}): Promise<Result<LogRetrievalResponse>> {
    try {
      const instanceId = filter.instanceId || '';
      const limit = filter.limit || 100;
      const offset = filter.offset || 0;

      const result = await this.client.getLogs({
        instanceId: instanceId || undefined,
        since: filter.since?.toISOString(),
        until: filter.until?.toISOString(),
        limit,
        offset,
        sortOrder: filter.sortOrder || 'desc',
      });

      if (!result.success || !result.data) {
        return { 
          success: false, 
          error: new Error(result.error || 'Failed to get logs from orchestrator')
        };
      }

      // Map orchestrator response to StoredLog format
      const logs: StoredLog[] = result.data.data.map(log => ({
        id: log.id,
        instanceId: log.instanceId,
        processId: log.processId,
        sequence: log.sequence,
        timestamp: log.timestamp,
        level: log.level as LogLevel,
        message: log.message,
        stream: log.stream as 'stdout' | 'stderr',
        source: log.source || undefined,
        metadata: log.metadata ? JSON.stringify(log.metadata) : null,
        createdAt: new Date(log.createdAt).toISOString(),
      }));

      const lastSequence = logs.length > 0 ? Math.max(...logs.map(l => l.sequence)) : 0;
      const cursor: LogCursor = {
        instanceId,
        lastSequence,
        lastRetrieved: new Date()
      };

      const hasMore = result.data.pagination.hasMore;
      const totalCount = result.data.pagination.total;

      return {
        success: true,
        data: {
          success: true,
          logs,
          cursor,
          hasMore,
          totalCount
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error retrieving logs') 
      };
    }
  }

  public async clearLogs(instanceId: string): Promise<Result<{ clearedCount: number }>> {
    // Note: Orchestrator doesn't have a clearLogs endpoint yet
    // For now, return success with 0 cleared
    // TODO: Add clearLogs endpoint to orchestrator if needed
    return { success: true, data: { clearedCount: 0 } };
  }

  public async getLogStats(instanceId: string): Promise<Result<{
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByStream: Record<'stdout' | 'stderr', number>;
    oldestLog?: Date;
    newestLog?: Date;
  }>> {
    try {
      const result = await this.client.getLogs({ instanceId, limit: 10000 });

      if (!result.success || !result.data) {
        return { 
          success: false, 
          error: new Error(result.error || 'Failed to get logs for stats')
        };
      }

      const logs = result.data.data;
      const logsByLevel: Record<string, number> = {};
      const logsByStream: Record<string, number> = {};
      let totalLogs = logs.length;
      let oldestLog: Date | undefined;
      let newestLog: Date | undefined;

      for (const log of logs) {
        const level = log.level as LogLevel;
        const stream = log.stream as 'stdout' | 'stderr';
        
        logsByLevel[level] = (logsByLevel[level] || 0) + 1;
        logsByStream[stream] = (logsByStream[stream] || 0) + 1;
        
        const timestamp = new Date(log.timestamp);
        if (!oldestLog || timestamp < oldestLog) oldestLog = timestamp;
        if (!newestLog || timestamp > newestLog) newestLog = timestamp;
      }

      return {
        success: true,
        data: {
          totalLogs,
          logsByLevel: logsByLevel as Record<LogLevel, number>,
          logsByStream: logsByStream as Record<'stdout' | 'stderr', number>,
          oldestLog,
          newestLog
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error getting log stats') 
      };
    }
  }

  public async cleanupOldLogs(): Promise<Result<number>> {
    // Cleanup is handled by orchestrator based on retention policies
    // No local cleanup needed
    return { success: true, data: 0 };
  }

  public close(): void {
    // No cleanup needed
  }
}
