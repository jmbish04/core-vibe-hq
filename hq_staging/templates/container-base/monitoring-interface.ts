/**
 * Unified Monitoring Interface
 * 
 * Provides a unified abstraction layer for container monitoring operations
 * that supports REST API, WebSocket API, and RPC entrypoint communication.
 * 
 * This interface ensures consistent data formats and error handling across
 * all communication modes, with automatic fallback mechanisms.
 */

import { StorageManager } from './storage.js';
import { ProcessMonitor } from './process-monitor.js';
import { OrchestratorClient } from './orchestrator-client.js';

export type MonitoringApiMode = 'rest' | 'websocket' | 'rpc';

export interface MonitoringConfig {
  mode?: MonitoringApiMode;
  orchestratorUrl: string;
  workerName: string;
  containerName?: string;
  storage: StorageManager;
}

export interface ProcessStatus {
  instanceId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'restarting';
  pid?: number;
  startTime?: Date;
  endTime?: Date;
  exitCode?: number;
  restartCount: number;
  lastError?: string;
}

export interface MonitoringResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Unified Monitoring Interface
 * 
 * Abstracts monitoring operations behind a common interface that supports
 * REST API, WebSocket API, and RPC entrypoint communication modes.
 */
export class UnifiedMonitoringInterface {
  private config: MonitoringConfig;
  private orchestratorClient: OrchestratorClient;
  private activeProcesses: Map<string, ProcessMonitor> = new Map();

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.orchestratorClient = OrchestratorClient.fromEnv({
      ORCHESTRATOR_URL: config.orchestratorUrl,
      WORKER_NAME: config.workerName,
      CONTAINER_NAME: config.containerName,
    });
  }

  /**
   * Start a process with monitoring
   */
  async startProcess(params: {
    instanceId: string;
    command: string;
    args?: string[];
    cwd?: string;
    port?: string;
    maxRestarts?: number;
    restartDelay?: number;
  }): Promise<MonitoringResponse<{ instanceId: string }>> {
    try {
      const processInfo = {
        id: params.instanceId,
        instanceId: params.instanceId,
        command: params.command,
        args: params.args || [],
        cwd: params.cwd || process.cwd(),
        status: 'starting' as const,
      };

      const monitor = new ProcessMonitor(processInfo, this.config.storage);
      this.activeProcesses.set(params.instanceId, monitor);

      const result = await monitor.start();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to start process',
          timestamp: new Date().toISOString(),
        };
      }

      // Store process info in orchestrator
      await this.config.storage.storeProcessInfo(result.data!);

      return {
        success: true,
        data: { instanceId: params.instanceId },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Stop a monitored process
   */
  async stopProcess(instanceId: string): Promise<MonitoringResponse<void>> {
    try {
      const monitor = this.activeProcesses.get(instanceId);
      if (!monitor) {
        return {
          success: false,
          error: `Process ${instanceId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

      const result = await monitor.stop();
      this.activeProcesses.delete(instanceId);

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to stop process',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get process status
   */
  async getProcessStatus(instanceId: string): Promise<MonitoringResponse<ProcessStatus>> {
    try {
      const monitor = this.activeProcesses.get(instanceId);
      if (!monitor) {
        // Try to get from orchestrator
        const processResult = await this.orchestratorClient.getProcess(instanceId);
        if (processResult.success && processResult.data) {
          const proc = processResult.data;
          return {
            success: true,
            data: {
              instanceId: proc.instanceId,
              status: proc.status as ProcessStatus['status'],
              pid: proc.processId ? parseInt(proc.processId) : undefined,
              startTime: proc.startTime ? new Date(proc.startTime) : undefined,
              endTime: proc.endTime ? new Date(proc.endTime) : undefined,
              exitCode: proc.exitCode ?? undefined,
              restartCount: proc.restartCount,
              lastError: proc.lastError ?? undefined,
            },
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: false,
          error: `Process ${instanceId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

      const processInfo = monitor.getProcessInfo();
      return {
        success: true,
        data: {
          instanceId: processInfo.instanceId,
          status: monitor.getState(),
          pid: processInfo.pid,
          startTime: processInfo.startTime,
          endTime: processInfo.endTime,
          exitCode: processInfo.exitCode,
          restartCount: processInfo.restartCount || 0,
          lastError: processInfo.lastError,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get errors for an instance
   */
  async getErrors(params: {
    instanceId: string;
    limit?: number;
    offset?: number;
  }): Promise<MonitoringResponse<Array<{
    id: number;
    timestamp: string;
    level: number;
    message: string;
    occurrenceCount: number;
  }>>> {
    try {
      const result = await this.config.storage.getErrors(params.instanceId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to get errors',
          timestamp: new Date().toISOString(),
        };
      }

      let errors = result.data || [];
      
      // Apply pagination
      if (params.offset) {
        errors = errors.slice(params.offset);
      }
      if (params.limit) {
        errors = errors.slice(0, params.limit);
      }

      return {
        success: true,
        data: errors.map(err => ({
          id: err.id,
          timestamp: err.timestamp,
          level: err.level,
          message: err.message,
          occurrenceCount: err.occurrenceCount,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get logs for an instance
   */
  async getLogs(params: {
    instanceId: string;
    limit?: number;
    offset?: number;
    since?: Date;
    until?: Date;
  }): Promise<MonitoringResponse<Array<{
    id: number;
    sequence: number;
    timestamp: string;
    level: string;
    message: string;
    stream: string;
  }>>> {
    try {
      const filter = {
        instanceId: params.instanceId,
        limit: params.limit,
        offset: params.offset,
        since: params.since,
        until: params.until,
      };

      const result = await this.config.storage.getLogs(filter);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to get logs',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result.data.logs.map(log => ({
          id: log.id,
          sequence: log.sequence,
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          stream: log.stream,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(instanceId: string): Promise<MonitoringResponse<{
    totalErrors: number;
    uniqueErrors: number;
    repeatedErrors: number;
    errorsByLevel: Record<number, number>;
    latestError?: Date;
    oldestError?: Date;
  }>> {
    try {
      const result = await this.config.storage.getErrorSummary(instanceId);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to get error stats',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(instanceId: string): Promise<MonitoringResponse<{
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByStream: Record<'stdout' | 'stderr', number>;
    oldestLog?: Date;
    newestLog?: Date;
  }>> {
    try {
      const result = await this.config.storage.getLogStats(instanceId);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to get log stats',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Cleanup - stop all processes and close connections
   */
  async cleanup(): Promise<void> {
    const stopPromises = Array.from(this.activeProcesses.values()).map(monitor => 
      monitor.stop().catch(err => console.error('Error stopping process:', err))
    );
    
    await Promise.all(stopPromises);
    this.activeProcesses.clear();
    this.config.storage.close();
  }
}


