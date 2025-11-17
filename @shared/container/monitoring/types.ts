import { z } from 'zod'

/**
 * Shared type definitions for container monitoring tooling.
 *
 * These types are used by the CLI utilities that run inside the container as
 * well as the REST, WebSocket, and RPC layers that proxy monitoring data to the
 * orchestrator worker. The types are adapted from the Vibe SDK container code
 * but have been updated to remove all local filesystem / SQLite assumptions.
 */

// ---------------------------------------------------------------------------
// Primitive enums
// ---------------------------------------------------------------------------

export const StreamTypeSchema = z.enum(['stdout', 'stderr'])
export type StreamType = z.infer<typeof StreamTypeSchema>

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'output'])
export type LogLevel = z.infer<typeof LogLevelSchema>

export const ProcessStateSchema = z.enum([
  'starting',
  'running',
  'stopping',
  'stopped',
  'crashed',
  'restarting',
])
export type ProcessState = z.infer<typeof ProcessStateSchema>

// ---------------------------------------------------------------------------
// Error + Log types
// ---------------------------------------------------------------------------

export const SimpleErrorSchema = z.object({
  timestamp: z.string(),
  level: z.number(),
  message: z.string(),
  rawOutput: z.string(),
})
export type SimpleError = z.infer<typeof SimpleErrorSchema>

export interface LogLine {
  readonly content: string
  readonly timestamp: Date
  readonly stream: StreamType
  readonly processId: string
  readonly instanceId: string
}

const StoredEntityBaseSchema = z.object({
  id: z.string(),
  instanceId: z.string(),
  processId: z.string(),
  timestamp: z.string(),
  createdAt: z.string(),
})

export const StoredErrorSchema = StoredEntityBaseSchema.extend({
  errorHash: z.string(),
  occurrenceCount: z.number(),
  level: z.number(),
  message: z.string(),
  rawOutput: z.string(),
})
export type StoredError = z.infer<typeof StoredErrorSchema>

export const StoredLogSchema = StoredEntityBaseSchema.extend({
  level: LogLevelSchema,
  message: z.string(),
  stream: StreamTypeSchema,
  source: z.string().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  sequence: z.number(),
})
export type StoredLog = z.infer<typeof StoredLogSchema>

export interface LogRetrievalResponse {
  readonly success: boolean
  readonly logs: readonly StoredLog[]
  readonly cursor?: LogCursor
  readonly hasMore: boolean
  readonly error?: string
}

export interface ErrorSummary {
  readonly totalErrors: number
  readonly errorsByLevel: Record<number, number>
  readonly latestError?: string
  readonly oldestError?: string
  readonly uniqueErrors: number
  readonly repeatedErrors: number
}

// ---------------------------------------------------------------------------
// Monitoring configuration
// ---------------------------------------------------------------------------

export interface MonitoringOptions {
  readonly autoRestart?: boolean
  readonly maxRestarts?: number
  readonly restartDelay?: number
  readonly healthCheckInterval?: number
  readonly errorBufferSize?: number
  readonly enableMetrics?: boolean
  readonly env?: Record<string, string>
  readonly killTimeout?: number
}

export interface ProcessInfo {
  readonly id: string
  readonly instanceId: string
  readonly command: string
  readonly args?: readonly string[]
  readonly cwd: string
  readonly env?: Record<string, string>
  readonly restartCount: number
  pid?: number
  startTime?: Date
  status?: ProcessState
  endTime?: Date
  exitCode?: number
  lastError?: string
}

export interface ProcessRunnerConfig {
  readonly instanceId: string
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly monitoring?: MonitoringOptions
}

export interface ErrorStoreOptions {
  readonly maxErrors?: number
  readonly retentionDays?: number
}

export interface LogStoreOptions {
  readonly maxLogs?: number
  readonly retentionHours?: number
  readonly bufferSize?: number
}

export interface LogFilter {
  readonly instanceId: string
  readonly levels?: readonly LogLevel[]
  readonly streams?: readonly StreamType[]
  readonly since?: Date
  readonly until?: Date
  readonly limit?: number
  readonly offset?: number
  readonly includeMetadata?: boolean
  readonly afterSequence?: number
  readonly sortOrder?: 'asc' | 'desc'
}

export interface ErrorFilter {
  readonly instanceId: string
  readonly minLevel?: number
  readonly maxLevel?: number
  readonly since?: Date
  readonly until?: Date
  readonly limit?: number
  readonly offset?: number
  readonly sortOrder?: 'asc' | 'desc'
}

export interface LogCursor {
  readonly instanceId: string
  readonly lastSequence: number
  readonly lastRetrieved: Date
}

export type MonitoringEvent =
  | {
      type: 'process_started'
      processId: string
      instanceId: string
      pid?: number
      command?: string
      timestamp: Date
    }
  | {
      type: 'process_stopped'
      processId: string
      instanceId: string
      exitCode?: number | null
      reason?: string
      timestamp: Date
    }
  | {
      type: 'process_crashed'
      processId: string
      instanceId: string
      exitCode?: number | null
      signal?: string | null
      willRestart?: boolean
      timestamp: Date
    }
  | {
      type: 'process_error'
      processId: string
      instanceId: string
      error: string
      timestamp: Date
    }
  | {
      type: 'error_detected'
      processId: string
      instanceId: string
      error: SimpleError
      timestamp: Date
    }
  | {
      type: 'state_changed'
      processId: string
      instanceId: string
      oldState: ProcessState
      newState: ProcessState
      timestamp: Date
    }
  | {
      type: 'health_check_failed'
      processId: string
      instanceId: string
      lastActivity: Date
      timestamp: Date
    }

export interface ContainerIdentity {
  readonly workerName: string
  readonly containerName: string
  readonly environment?: string
}

export interface MonitoringContext {
  readonly identity: ContainerIdentity
  readonly transportName: string
}

export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E }

export const DEFAULT_MONITORING_OPTIONS: Required<MonitoringOptions> = {
  autoRestart: true,
  maxRestarts: 6,
  restartDelay: 1000,
  healthCheckInterval: 10000,
  errorBufferSize: 300,
  enableMetrics: false,
  env: {},
  killTimeout: 10000,
}

export const DEFAULT_ERROR_STORE_OPTIONS: Required<ErrorStoreOptions> = {
  maxErrors: 1000,
  retentionDays: 7,
}

export const DEFAULT_LOG_STORE_OPTIONS: Required<LogStoreOptions> = {
  maxLogs: 10000,
  retentionHours: 168,
  bufferSize: 1000,
}

export const DEFAULT_CONTEXT: MonitoringContext = {
  identity: {
    workerName: process.env.WORKER_NAME || 'unknown-worker',
    containerName: process.env.CONTAINER_NAME || 'unknown-container',
    environment: process.env.CONTAINER_ENV || 'docker',
  },
  transportName: 'noop',
}


