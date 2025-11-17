import { EventEmitter } from 'node:events'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'

import {
  MonitoringEvent,
  MonitoringOptions,
  ProcessInfo,
  ProcessRunnerConfig,
  ProcessState,
  SimpleError,
  StreamType,
  DEFAULT_MONITORING_OPTIONS,
} from './types'
import { StorageManager, ProcessLog } from './storage'

interface RestartState {
  attempts: number
  timer?: NodeJS.Timeout
}

export class ProcessMonitor extends EventEmitter {
  private readonly storage: StorageManager
  private readonly config: ProcessRunnerConfig
  private readonly options: Required<MonitoringOptions>

  private processInfo: ProcessInfo
  private child?: ChildProcessWithoutNullStreams
  private state: ProcessState = 'stopped'
  private restart: RestartState = { attempts: 0 }
  private lastActivity = new Date()
  private healthTimer?: NodeJS.Timeout

  constructor(processInfo: ProcessInfo, storage: StorageManager, monitoring: MonitoringOptions = {}) {
    super()
    this.processInfo = { ...processInfo }
    this.storage = storage
    this.config = {
      instanceId: processInfo.instanceId,
      command: processInfo.command,
      args: processInfo.args ?? [],
      cwd: processInfo.cwd,
      monitoring,
    }
    this.options = { ...DEFAULT_MONITORING_OPTIONS, ...monitoring }
    this.startHealthLoop()
  }

  public async start(): Promise<{ success: boolean; error?: Error }> {
    if (this.state === 'running') {
      return { success: false, error: new Error('Process is already running') }
    }

    try {
      this.state = 'starting'
      this.child = spawn(this.config.command, [...this.config.args], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: 'pipe',
        detached: false,
      })

      this.processInfo = {
        ...this.processInfo,
        pid: this.child.pid ?? undefined,
        startTime: new Date(),
        status: 'running',
        restartCount: this.processInfo.restartCount ?? 0,
      }
      this.state = 'running'
      this.lastActivity = new Date()
      this.restart.attempts = 0

      this.emitEvent({
        type: 'process_started',
        processId: this.processInfo.id,
        instanceId: this.processInfo.instanceId,
        pid: this.child.pid ?? undefined,
        command: this.config.command,
        timestamp: new Date(),
      })

      this.setupListeners()
      return { success: true }
    } catch (error) {
      this.state = 'stopped'
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }

  public async stop(): Promise<void> {
    this.state = 'stopping'

    if (this.restart.timer) {
      clearTimeout(this.restart.timer)
      this.restart.timer = undefined
    }

    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, this.options.killTimeout))
      if (!this.child?.killed) {
        this.child?.kill('SIGKILL')
      }
    }

    await this.storage.recordEvent({
      type: 'process_stopped',
      processId: this.processInfo.id,
      instanceId: this.processInfo.instanceId,
      exitCode: this.processInfo.exitCode,
      timestamp: new Date(),
    })

    this.state = 'stopped'
    this.child = undefined
  }

  public async cleanup(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = undefined
    }
    await this.storage.close()
  }

  public getProcessInfo(): ProcessInfo {
    return { ...this.processInfo, status: this.state }
  }

  private setupListeners(): void {
    if (!this.child) return

    this.child.stdout?.on('data', (data) => this.handleOutput(data, 'stdout'))
    this.child.stderr?.on('data', (data) => this.handleOutput(data, 'stderr'))

    this.child.on('exit', (code, signal) => this.onExit(code, signal))
    this.child.on('error', (error) => this.onError(error))
  }

  private handleOutput(buffer: Buffer, stream: StreamType): void {
    const content = buffer.toString('utf8')
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)

    if (lines.length === 0) {
      return
    }

    this.lastActivity = new Date()

    const logLines = lines.map((line) => ({
      content: line,
      timestamp: new Date(),
      stream,
      processId: this.processInfo.id,
      instanceId: this.processInfo.instanceId,
    }))

    void this.storage.storeLogLines(logLines)

    for (const line of lines) {
      this.maybeParseJsonError(line)
    }
  }

  private maybeParseJsonError(line: string): void {
    if (!line.startsWith('{')) return

    try {
      const parsed = JSON.parse(line)
      if (typeof parsed.level === 'number' && parsed.level >= 50) {
        const simpleError: SimpleError = {
          timestamp: parsed.time ? new Date(parsed.time).toISOString() : new Date().toISOString(),
          level: parsed.level,
          message: parsed.msg ?? 'Process error',
          rawOutput: line,
        }

        void this.storage.storeError(this.processInfo.instanceId, this.processInfo.id, simpleError)

        this.emitEvent({
          type: 'error_detected',
          processId: this.processInfo.id,
          instanceId: this.processInfo.instanceId,
          error: simpleError,
          timestamp: new Date(),
        })
      }
    } catch (error) {
      // Ignore JSON parse errors and treat as regular log output
    }
  }

  private onExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.processInfo = {
      ...this.processInfo,
      status: 'stopped',
      exitCode: code ?? undefined,
      endTime: new Date(),
    }

    this.emitEvent({
      type: 'process_stopped',
      processId: this.processInfo.id,
      instanceId: this.processInfo.instanceId,
      exitCode: code ?? undefined,
      reason: signal ? `Signal ${signal}` : undefined,
      timestamp: new Date(),
    })

    if (this.shouldRestart(code, signal)) {
      this.scheduleRestart()
    } else {
      this.state = 'stopped'
    }
  }

  private onError(error: Error): void {
    this.state = 'crashed'
    const simpleError: SimpleError = {
      timestamp: new Date().toISOString(),
      level: 60,
      message: error.message,
      rawOutput: error.stack ?? error.message,
    }

    void this.storage.storeError(this.processInfo.instanceId, this.processInfo.id, simpleError)

    this.emitEvent({
      type: 'process_error',
      processId: this.processInfo.id,
      instanceId: this.processInfo.instanceId,
      error: error.message,
      timestamp: new Date(),
    })
  }

  private shouldRestart(code: number | null, signal: NodeJS.Signals | null): boolean {
    if (!this.options.autoRestart) return false
    if (this.state === 'stopping') return false
    if (code === 0) return false
    if (this.restart.attempts >= (this.options.maxRestarts ?? 0)) return false

    return true
  }

  private scheduleRestart(): void {
    this.state = 'restarting'
    this.restart.attempts += 1

    this.emitEvent({
      type: 'process_crashed',
      processId: this.processInfo.id,
      instanceId: this.processInfo.instanceId,
      exitCode: this.processInfo.exitCode ?? null,
      signal: null,
      willRestart: true,
      timestamp: new Date(),
    })

    this.restart.timer = setTimeout(() => {
      void this.start()
    }, this.options.restartDelay ?? 1000)
  }

  private emitEvent(event: MonitoringEvent): void {
    void this.storage.recordEvent(event)
    this.emit(event.type, event)
  }

  private startHealthLoop(): void {
    if (!this.options.healthCheckInterval) return
    this.healthTimer = setInterval(() => {
      if (this.state !== 'running') return
      const now = Date.now()
      if (now - this.lastActivity.getTime() > this.options.healthCheckInterval) {
        this.emitEvent({
          type: 'health_check_failed',
          processId: this.processInfo.id,
          instanceId: this.processInfo.instanceId,
          lastActivity: this.lastActivity,
          timestamp: new Date(),
        })
      }
    }, this.options.healthCheckInterval)
  }
}


