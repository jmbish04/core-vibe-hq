#!/usr/bin/env bun
import { parseArgs } from 'node:util'

import {
  DEFAULT_MONITORING_OPTIONS,
  DEFAULT_CONTEXT,
  ErrorFilter,
  LogFilter,
  MonitoringContext,
  MonitoringOptions,
  ProcessInfo,
  ProcessRunnerConfig,
  Result,
  StreamType,
} from './types'
import { StorageManager } from './storage'
import { ProcessMonitor } from './process-monitor'
import { HttpMonitoringTransport, MonitoringTransport, NoopMonitoringTransport } from './transport'

interface CLIArgs {
  readonly values: Record<string, unknown>
  readonly positionals: readonly string[]
}

export interface CLIConfig {
  readonly transport?: MonitoringTransport
  readonly context?: MonitoringContext
}

const runners = new Map<string, ProcessRunner>()

class ProcessRunner {
  private readonly storage: StorageManager
  private readonly monitor: ProcessMonitor

  constructor(config: ProcessRunnerConfig, storage: StorageManager) {
    const processInfo: ProcessInfo = {
      id: `proc-${config.instanceId}-${Date.now()}`,
      instanceId: config.instanceId,
      command: config.command,
      args: [...config.args],
      cwd: config.cwd,
      restartCount: 0,
    }

    this.storage = storage
    this.monitor = new ProcessMonitor(processInfo, this.storage, config.monitoring)
  }

  async start(): Promise<Result<ProcessInfo>> {
    const startResult = await this.monitor.start()
    if (!startResult.success) {
      await this.storage.close()
      return { success: false, error: startResult.error ?? new Error('Failed to start process') }
    }
    return { success: true, data: this.monitor.getProcessInfo() }
  }

  async stop(): Promise<Result<boolean>> {
    try {
      await this.monitor.stop()
      await this.monitor.cleanup()
      return { success: true, data: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }

  getInfo(): ProcessInfo {
    return this.monitor.getProcessInfo()
  }
}

export async function runCLI(config: CLIConfig = {}): Promise<void> {
  const cliArgs = parseCLIArgs()
  const command = cliArgs.positionals[0]
  const subcommand = cliArgs.positionals[1]

  if (!command || cliArgs.values.help) {
    printHelp()
    return
  }

  const transport = config.transport ?? createTransport()
  const context = config.context ?? createContext(transport)

  switch (command) {
    case 'process':
      await handleProcessCommand(subcommand, cliArgs, transport, context)
      break
    case 'errors':
      await handleErrorCommand(subcommand, cliArgs, transport, context)
      break
    case 'logs':
      await handleLogCommand(subcommand, cliArgs, transport, context)
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function parseCLIArgs(): CLIArgs {
  return parseArgs({
    args: process.argv.slice(2),
    options: {
      'instance-id': { type: 'string', short: 'i' },
      cwd: { type: 'string', short: 'c' },
      port: { type: 'string', short: 'p' },
      'max-restarts': { type: 'string' },
      'restart-delay': { type: 'string' },
      'health-interval': { type: 'string' },
      'max-errors': { type: 'string' },
      'retention-days': { type: 'string' },
      'flush-interval': { type: 'string' },
      'max-logs': { type: 'string' },
      'retention-hours': { type: 'string' },
      'log-buffer': { type: 'string' },
      format: { type: 'string' },
      levels: { type: 'string' },
      streams: { type: 'string' },
      since: { type: 'string' },
      until: { type: 'string' },
      limit: { type: 'string' },
      offset: { type: 'string' },
      'min-level': { type: 'string' },
      'max-level': { type: 'string' },
      confirm: { type: 'boolean' },
      reset: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })
}

async function handleProcessCommand(subcommand: string | undefined, cliArgs: CLIArgs, transport: MonitoringTransport, context: MonitoringContext) {
  switch (subcommand) {
    case 'start':
      await handleProcessStart(cliArgs, transport, context)
      break
    case 'stop':
      await handleProcessStop(cliArgs)
      break
    case 'status':
      await handleProcessStatus(cliArgs)
      break
    default:
      console.error(`Unknown process subcommand: ${subcommand ?? '<none>'}`)
      process.exit(1)
  }
}

async function handleProcessStart(cliArgs: CLIArgs, transport: MonitoringTransport, context: MonitoringContext) {
  const remaining = cliArgs.positionals.slice(2)
  if (remaining.length === 0) {
    console.error('No command provided for process start')
    process.exit(1)
  }

  const instanceId = String(cliArgs.values['instance-id'] || process.env.INSTANCE_ID || `instance-${Date.now()}`)
  if (runners.has(instanceId)) {
    console.error(`Process ${instanceId} is already running`)
    process.exit(1)
  }

  const monitoring: MonitoringOptions = {
    autoRestart: true,
    maxRestarts: cliArgs.values['max-restarts'] ? Number(cliArgs.values['max-restarts']) : DEFAULT_MONITORING_OPTIONS.maxRestarts,
    restartDelay: cliArgs.values['restart-delay'] ? Number(cliArgs.values['restart-delay']) : DEFAULT_MONITORING_OPTIONS.restartDelay,
    healthCheckInterval: cliArgs.values['health-interval'] ? Number(cliArgs.values['health-interval']) : DEFAULT_MONITORING_OPTIONS.healthCheckInterval,
  }

  const storage = new StorageManager(transport, context, {
    error: {
      maxErrors: cliArgs.values['max-errors'] ? Number(cliArgs.values['max-errors']) : undefined,
      retentionDays: cliArgs.values['retention-days'] ? Number(cliArgs.values['retention-days']) : undefined,
    },
    log: {
      maxLogs: cliArgs.values['max-logs'] ? Number(cliArgs.values['max-logs']) : undefined,
      retentionHours: cliArgs.values['retention-hours'] ? Number(cliArgs.values['retention-hours']) : undefined,
      bufferSize: cliArgs.values['log-buffer'] ? Number(cliArgs.values['log-buffer']) : undefined,
    },
    flushIntervalMs: cliArgs.values['flush-interval'] ? Number(cliArgs.values['flush-interval']) : undefined,
  })

  const runner = new ProcessRunner(
    {
      instanceId,
      command: remaining[0],
      args: remaining.slice(1),
      cwd: (cliArgs.values.cwd as string | undefined) ?? process.cwd(),
      monitoring,
    },
    storage,
  )

  const startResult = await runner.start()
  if (!startResult.success) {
    console.error('Failed to start process:', startResult.error?.message ?? 'Unknown error')
    process.exit(1)
  }

  runners.set(instanceId, runner)
  console.log(JSON.stringify({ success: true, instanceId, pid: startResult.data.pid, cwd: startResult.data.cwd }, null, 2))

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`\nReceived ${signal}. Stopping process ${instanceId}...`)
    const res = await runner.stop()
    if (!res.success) {
      console.error('Failed to stop process cleanly:', res.error.message)
      process.exit(1)
    }
    runners.delete(instanceId)
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep process alive
  await new Promise(() => {})
}

async function handleProcessStop(cliArgs: CLIArgs) {
  const instanceId = String(cliArgs.values['instance-id'] ?? '')
  if (!instanceId) {
    console.error('--instance-id is required to stop a process')
    process.exit(1)
  }

  const runner = runners.get(instanceId)
  if (!runner) {
    console.error(`Process ${instanceId} is not running`)
    process.exit(1)
  }

  const result = await runner.stop()
  if (!result.success) {
    console.error('Failed to stop process:', result.error.message)
    process.exit(1)
  }

  runners.delete(instanceId)
  console.log(JSON.stringify({ success: true, instanceId }, null, 2))
}

async function handleProcessStatus(cliArgs: CLIArgs) {
  const instanceId = cliArgs.values['instance-id'] ? String(cliArgs.values['instance-id']) : undefined
  if (instanceId) {
    const runner = runners.get(instanceId)
    if (!runner) {
      console.error(`Process ${instanceId} is not running`)
      process.exit(1)
    }

    console.log(JSON.stringify({ success: true, process: runner.getInfo() }, null, 2))
  } else {
    const processes = Array.from(runners.entries()).map(([id, runner]) => ({
      instanceId: id,
      info: runner.getInfo(),
    }))
    console.log(JSON.stringify({ success: true, processes }, null, 2))
  }
}

async function handleErrorCommand(subcommand: string | undefined, cliArgs: CLIArgs, transport: MonitoringTransport, context: MonitoringContext) {
  const filter = buildErrorFilter(cliArgs)
  switch (subcommand) {
    case 'list': {
      const storage = new StorageManager(transport, context)
      const result = await storage.getErrors(filter)
      console.log(JSON.stringify(result, null, 2))
      await storage.close()
      break
    }
    case 'stats': {
      const storage = new StorageManager(transport, context)
      const result = await storage.getErrorSummary(filter)
      console.log(JSON.stringify(result, null, 2))
      await storage.close()
      break
    }
    case 'clear': {
      if (!cliArgs.values.confirm) {
        console.error('--confirm flag is required to clear errors')
        process.exit(1)
      }
      const storage = new StorageManager(transport, context)
      const result = await storage.clearErrors(filter)
      console.log(JSON.stringify(result, null, 2))
      await storage.close()
      break
    }
    default:
      console.error(`Unknown errors subcommand: ${subcommand ?? '<none>'}`)
      process.exit(1)
  }
}

async function handleLogCommand(subcommand: string | undefined, cliArgs: CLIArgs, transport: MonitoringTransport, context: MonitoringContext) {
  const filter = buildLogFilter(cliArgs)
  switch (subcommand) {
    case 'list':
    case 'get': {
      const storage = new StorageManager(transport, context)
      const result = await storage.getLogs(filter)
      console.log(JSON.stringify(result, null, 2))
      await storage.close()
      break
    }
    case 'clear': {
      if (!cliArgs.values.confirm) {
        console.error('--confirm flag is required to clear logs')
        process.exit(1)
      }
      const storage = new StorageManager(transport, context)
      const result = await storage.clearLogs(filter)
      console.log(JSON.stringify(result, null, 2))
      await storage.close()
      break
    }
    default:
      console.error(`Unknown logs subcommand: ${subcommand ?? '<none>'}`)
      process.exit(1)
  }
}

function buildErrorFilter(cliArgs: CLIArgs): ErrorFilter {
  const instanceId = cliArgs.values['instance-id'] ? String(cliArgs.values['instance-id']) : ''
  if (!instanceId) {
    console.error('--instance-id is required')
    process.exit(1)
  }

  return {
    instanceId,
    minLevel: cliArgs.values['min-level'] ? Number(cliArgs.values['min-level']) : undefined,
    maxLevel: cliArgs.values['max-level'] ? Number(cliArgs.values['max-level']) : undefined,
    since: cliArgs.values.since ? new Date(String(cliArgs.values.since)) : undefined,
    until: cliArgs.values.until ? new Date(String(cliArgs.values.until)) : undefined,
    limit: cliArgs.values.limit ? Number(cliArgs.values.limit) : undefined,
    offset: cliArgs.values.offset ? Number(cliArgs.values.offset) : undefined,
  }
}

function buildLogFilter(cliArgs: CLIArgs): LogFilter {
  const instanceId = cliArgs.values['instance-id'] ? String(cliArgs.values['instance-id']) : ''
  if (!instanceId) {
    console.error('--instance-id is required')
    process.exit(1)
  }

  return {
    instanceId,
    levels: cliArgs.values.levels ? String(cliArgs.values.levels).split(',') : undefined,
    streams: cliArgs.values.streams ? (String(cliArgs.values.streams).split(',') as StreamType[]) : undefined,
    since: cliArgs.values.since ? new Date(String(cliArgs.values.since)) : undefined,
    until: cliArgs.values.until ? new Date(String(cliArgs.values.until)) : undefined,
    limit: cliArgs.values.limit ? Number(cliArgs.values.limit) : undefined,
    offset: cliArgs.values.offset ? Number(cliArgs.values.offset) : undefined,
  }
}

function createTransport(): MonitoringTransport {
  try {
    return new HttpMonitoringTransport()
  } catch (error) {
    console.warn('Falling back to noop monitoring transport:', error)
    return new NoopMonitoringTransport()
  }
}

function createContext(transport: MonitoringTransport): MonitoringContext {
  return {
    ...DEFAULT_CONTEXT,
    transportName: transport.name,
  }
}

function printHelp(): void {
  console.log(`Unified Container Monitoring CLI\n\nCommands:\n  process start <cmd> [args]   Start and monitor a process\n  process stop --instance-id   Stop a monitored process\n  process status [--instance-id] Show process status\n  errors list --instance-id    List recent errors\n  errors stats --instance-id   Show error summary\n  errors clear --instance-id --confirm Clear stored errors\n  logs list --instance-id      List logs\n  logs clear --instance-id --confirm Clear logs\n`)
}

if (import.meta.main) {
  runCLI().catch((error) => {
    console.error('CLI failure:', error)
    process.exit(1)
  })
}


