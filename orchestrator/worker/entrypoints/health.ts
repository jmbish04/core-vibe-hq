/**
 * orchestrator/worker/entrypoints/health.ts
 * (Kysely-enabled)
 * ------------------------------------------------------------
 * Manages system-wide health checks and unit testing across all workers.
 * Coordinates health check execution, collects results, and provides AI analysis.
 *
 * Responsibilities:
 * - Initiate on-demand and scheduled health checks
 * - Coordinate health check execution across all workers
 * - Collect and analyze health check results
 * - Provide AI-powered analysis and recommendations
 * - Store and retrieve health check history
 * - Manage health check schedules and configuration
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import {
  HealthChecksTable,
  WorkerHealthChecksTable,
  HealthCheckSchedulesTable,
} from '@shared/types/db';
import { Selectable } from 'kysely';

export interface InitiateHealthCheckParams {
  trigger_type: 'on_demand' | 'cron'
  trigger_source?: string
  timeout_minutes?: number
  include_unit_tests?: boolean
  include_performance_tests?: boolean
  include_integration_tests?: boolean
  worker_filters?: string[] // Specific workers to check
}

export interface WorkerHealthCheckResult {
  worker_check_uuid: string
  overall_status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  health_score: number
  uptime_seconds?: number
  memory_usage_mb?: number
  cpu_usage_percent?: number
  response_time_ms?: number
  orchestrator_connectivity: boolean
  external_api_connectivity: boolean
  database_connectivity: boolean
  unit_test_results?: TestResult[]
  performance_test_results?: TestResult[]
  integration_test_results?: TestResult[]
  error_message?: string
  warnings?: string[]
  raw_results?: any
}

export interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration_ms: number
  error?: string
  details?: any
}

export interface HealthCheckResponse {
  health_check_uuid: string
  status: string
  total_workers: number
  message: string
}

export interface HealthCheckStatusResponse {
  health_check_uuid: string
  status: string
  total_workers: number
  completed_workers: number
  passed_workers: number
  failed_workers: number
  overall_health_score: number
  ai_analysis?: string
  ai_recommendations?: string
  worker_results: Selectable<WorkerHealthChecksTable>[]
}

export interface HealthCheckHistoryResponse {
  health_checks: Selectable<HealthChecksTable>[]
  total_count: number
  page: number
  limit: number
}

export interface RecordWorkerTestResultParams {
  worker_name: string;
  worker_type: string;
  run_id: string;
  status: 'passed' | 'failed';
  trigger: 'cron' | 'on_demand' | 'package';
  suite: string;
  requested_by?: string | null;
  metrics: {
    total: number;
    passed: number;
    failed: number;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
  report: {
    previewUrl: string;
    viewport: string;
    artifacts: string[];
  };
  raw_results?: Record<string, unknown>;
}

export interface LatestWorkerTestResponse {
  worker_check_uuid: string;
  worker_name: string;
  status: string;
  overall_status: string | null;
  health_score: number | null;
  metrics: Record<string, unknown>;
  report: Record<string, unknown>;
  raw_results: Record<string, unknown> | null;
  completed_at: string | null;
}

interface WorkerTarget {
  name: string;
  type: string;
  url?: string;
  binding?: string;
}

export class Health extends BaseWorkerEntrypoint<CoreEnv> {

  private workerConfigCache?: WorkerTarget[];

  /**
   * Broadcast health check update via PartyServer
   */
  private async broadcastHealthCheckUpdate(
    type: 'start' | 'status' | 'worker-result' | 'complete',
    data: any,
  ): Promise<void> {
    try {
      const broadcastServer = this.env.HEALTH_CHECK_BROADCAST as DurableObjectNamespace;
      if (!broadcastServer) {
        console.warn('HEALTH_CHECK_BROADCAST binding not available');
        return;
      }

      const id = broadcastServer.idFromName('main');
      const stub = broadcastServer.get(id);

      await stub.fetch(new Request('http://localhost/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data }),
      }));
    } catch (error) {
      // Don't fail health check if broadcast fails
      console.error('Failed to broadcast health check update:', error);
    }
  }

  /**
   * Initiate a new health check across all or specified workers
   */
  async initiateHealthCheck(params: InitiateHealthCheckParams): Promise<HealthCheckResponse> {
    const healthCheckUuid = crypto.randomUUID();
    const timeoutAt = new Date(Date.now() + (params.timeout_minutes || 30) * 60 * 1000);

    const workerConfigs = this.getWorkerConfigs();
    if (!workerConfigs.length) {
      throw new Error('No worker health targets configured. Set HEALTH_WORKER_TARGETS or provide worker_filters.');
    }

    // Filter workers if specified
    const workersToCheck = params.worker_filters
      ? workerConfigs.filter(w => params.worker_filters!.includes(w.name) || params.worker_filters!.includes(w.type))
      : workerConfigs;

    // Create main health check record (use dbHealth for health tables)
    await this.dbHealth
      .insertInto('health_checks')
      .values({
        health_check_uuid: healthCheckUuid,
        trigger_type: params.trigger_type,
        trigger_source: params.trigger_source || null,
        total_workers: workersToCheck.length,
        timeout_at: timeoutAt.toISOString(),
      })
      .execute();

    // Create worker health check records
    const workerCheckPromises = workersToCheck.map(async (worker) => {
      const workerCheckUuid = crypto.randomUUID();

      await this.dbHealth
        .insertInto('worker_health_checks')
        .values({
          worker_check_uuid: workerCheckUuid,
          health_check_uuid: healthCheckUuid,
          worker_name: worker.name,
          worker_type: worker.type,
          worker_url: worker.url ?? (worker.binding ? `binding:${worker.binding}` : null),
        })
        .execute();

      // Initiate health check on worker (async)
      this.initiateWorkerHealthCheck(worker, workerCheckUuid, {
        include_unit_tests: params.include_unit_tests ?? true,
        include_performance_tests: params.include_performance_tests ?? true,
        include_integration_tests: params.include_integration_tests ?? true,
        timeout_ms: (params.timeout_minutes || 30) * 60 * 1000, // Convert minutes to milliseconds
        max_retries: 2, // Allow 2 retries (3 total attempts)
      }).catch(error => {
        console.error(`Failed to initiate health check for ${worker.name}:`, error);
        // Update worker record with error
        this.updateWorkerHealthCheck(workerCheckUuid, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        });
      });

      return workerCheckUuid;
    });

    await Promise.all(workerCheckPromises);

    // Log the health check initiation
    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.health_check',
        operation: 'initiate_health_check',
        level: 'info',
        details: JSON.stringify({
          health_check_uuid: healthCheckUuid,
          trigger_type: params.trigger_type,
          total_workers: workersToCheck.length,
        }),
        order_id: null,
        task_uuid: null,
      })
      .execute();

    // Broadcast health check start
    await this.broadcastHealthCheckUpdate('start', {
      health_check_uuid: healthCheckUuid,
      trigger_type: params.trigger_type,
      trigger_source: params.trigger_source || 'unknown',
    });

    return {
      health_check_uuid: healthCheckUuid,
      status: 'running',
      total_workers: workersToCheck.length,
      message: `Health check initiated for ${workersToCheck.length} workers`,
    };
  }

  /**
   * Initiate health check on a specific worker via RPC
   */
  private async initiateWorkerHealthCheck(
    worker: WorkerTarget,
    workerCheckUuid: string,
    options: {
      include_unit_tests: boolean
      include_performance_tests: boolean
      include_integration_tests: boolean
      timeout_ms: number
      max_retries: number
    },
  ) {
    // Update status to running
    await this.updateWorkerHealthCheck(workerCheckUuid, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_check_uuid: workerCheckUuid,
          options,
          callback_url: `${this.env.ORCHESTRATOR_BASE_URL || 'http://localhost:8787'}/health-check/result`,
        }),
      };

      let response: Response | undefined;

      if (worker.binding) {
        const service = (this.env as Record<string, any>)[worker.binding];
        if (!service || typeof service.fetch !== 'function') {
          throw new Error(`Service binding "${worker.binding}" is not available for worker ${worker.name}`);
        }
        response = await service.fetch(`https://${worker.binding}/health-check/execute`, requestInit);
      } else if (worker.url) {
        const targetUrl = `${worker.url.replace(/\/$/, '')}/health-check/execute`;
        response = await fetch(targetUrl, requestInit);
      } else {
        throw new Error(`Worker ${worker.name} is missing both url and binding configuration`);
      }

      // Make RPC call to worker's health check endpoint
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Health check initiated for ${worker.name}:`, result);

    } catch (error: any) {
      console.error(`Failed to initiate health check for ${worker.name}:`, error);

      // Update worker record with connection error
      await this.updateWorkerHealthCheck(workerCheckUuid, {
        status: 'failed',
        error_message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        orchestrator_connectivity: false,
        completed_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Receive health check results from a worker
   */
  async receiveHealthCheckResult(
    workerCheckUuid: string,
    results: WorkerHealthCheckResult,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify the worker check exists
      const workerCheck = await this.dbHealth
        .selectFrom('worker_health_checks')
        .selectAll()
        .where('worker_check_uuid', '=', workerCheckUuid)
        .executeTakeFirst();

      if (!workerCheck) {
        return { success: false, message: 'Worker check not found' };
      }

      // Calculate test totals
      const unitTestsTotal = results.unit_test_results?.length || 0;
      const unitTestsPassed = results.unit_test_results?.filter(t => t.status === 'passed').length || 0;
      const unitTestsFailed = unitTestsTotal - unitTestsPassed;

      const performanceTestsTotal = results.performance_test_results?.length || 0;
      const performanceTestsPassed = results.performance_test_results?.filter(t => t.status === 'passed').length || 0;
      const performanceTestsFailed = performanceTestsTotal - performanceTestsPassed;

      const integrationTestsTotal = results.integration_test_results?.length || 0;
      const integrationTestsPassed = results.integration_test_results?.filter(t => t.status === 'passed').length || 0;
      const integrationTestsFailed = integrationTestsTotal - integrationTestsPassed;

      // Update worker health check record
      await this.updateWorkerHealthCheck(workerCheckUuid, {
        status: 'completed',
        overall_status: results.overall_status,
        health_score: results.health_score,
        uptime_seconds: results.uptime_seconds,
        memory_usage_mb: results.memory_usage_mb,
        cpu_usage_percent: results.cpu_usage_percent,
        response_time_ms: results.response_time_ms,
        orchestrator_connectivity: results.orchestrator_connectivity,
        external_api_connectivity: results.external_api_connectivity,
        database_connectivity: results.database_connectivity,
        unit_tests_total: unitTestsTotal,
        unit_tests_passed: unitTestsPassed,
        unit_tests_failed: unitTestsFailed,
        unit_test_results: results.unit_test_results ? JSON.stringify(results.unit_test_results) : null,
        performance_tests_total: performanceTestsTotal,
        performance_tests_passed: performanceTestsPassed,
        performance_tests_failed: performanceTestsFailed,
        performance_test_results: results.performance_test_results ? JSON.stringify(results.performance_test_results) : null,
        integration_tests_total: integrationTestsTotal,
        integration_tests_passed: integrationTestsPassed,
        integration_tests_failed: integrationTestsFailed,
        integration_test_results: results.integration_test_results ? JSON.stringify(results.integration_test_results) : null,
        error_message: results.error_message,
        warnings: results.warnings ? JSON.stringify(results.warnings) : null,
        raw_results: results.raw_results ? JSON.stringify(results.raw_results) : null,
        completed_at: new Date().toISOString(),
      });

      // Generate AI analysis for this worker
      const aiAnalysis = await this.generateWorkerAIAnalysis(results);
      await this.updateWorkerHealthCheck(workerCheckUuid, {
        ai_worker_analysis: aiAnalysis.analysis,
        ai_worker_recommendations: aiAnalysis.recommendations,
      });

      // Broadcast worker result
      await this.broadcastHealthCheckUpdate('worker-result', {
        worker_name: workerCheck.worker_name,
        worker_check_uuid: workerCheckUuid,
        status: 'completed',
        overall_status: results.overall_status,
        health_score: results.health_score,
        error_message: results.error_message,
      });

      // Check if all workers in this health check are complete
      await this.checkHealthCheckCompletion(workerCheck.health_check_uuid);

      return { success: true, message: 'Health check results received and processed' };

    } catch (error: any) {
      console.error('Error processing health check result:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Check if health check is complete and generate overall analysis
   */
  private async checkHealthCheckCompletion(healthCheckUuid: string) {
    // Get all worker results for this health check
    const workerResults = await this.dbHealth
      .selectFrom('worker_health_checks')
      .selectAll()
      .where('health_check_uuid', '=', healthCheckUuid)
      .execute();

    const completedWorkers = workerResults.filter(w => w.status === 'completed' || w.status === 'failed');
    const totalWorkers = workerResults.length;

    // Update health check progress
    const passedWorkers = workerResults.filter(w =>
      w.overall_status === 'healthy' || w.overall_status === 'degraded',
    ).length;

    const failedWorkers = workerResults.filter(w =>
      w.overall_status === 'unhealthy' || w.overall_status === 'critical' || w.status === 'failed',
    ).length;

    const overallHealthScore = workerResults.length > 0
      ? workerResults.reduce((sum, w) => sum + (w.health_score || 0), 0) / workerResults.length
      : 0;

    await this.dbHealth
      .updateTable('health_checks')
      .set({
        completed_workers: completedWorkers.length,
        passed_workers: passedWorkers,
        failed_workers: failedWorkers,
        overall_health_score: overallHealthScore,
      })
      .where('health_check_uuid', '=', healthCheckUuid)
      .execute();

    // Broadcast status update
    const statusResponse = await this.getHealthCheckStatus(healthCheckUuid);
    if (statusResponse) {
      await this.broadcastHealthCheckUpdate('status', statusResponse);
    }

    // If all workers are complete, finalize the health check
    if (completedWorkers.length === totalWorkers) {
      const aiAnalysis = await this.generateOverallAIAnalysis(healthCheckUuid, workerResults);

      await this.db
        .updateTable('health_checks')
        .set({
          status: 'completed',
          completed_at: new Date().toISOString(),
          ai_analysis: aiAnalysis.analysis,
          ai_recommendations: aiAnalysis.recommendations,
        })
        .where('health_check_uuid', '=', healthCheckUuid)
        .execute();

      // Get final status and broadcast completion
      const finalStatus = await this.getHealthCheckStatus(healthCheckUuid);
      if (finalStatus) {
        await this.broadcastHealthCheckUpdate('complete', {
          health_check_uuid: healthCheckUuid,
          status: finalStatus,
        });
      }

      // Log completion
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'orchestrator.health_check',
          operation: 'health_check_completed',
          level: 'info',
          details: JSON.stringify({
            health_check_uuid: healthCheckUuid,
            total_workers: totalWorkers,
            passed_workers: passedWorkers,
            failed_workers: failedWorkers,
            overall_health_score: overallHealthScore,
          }),
          order_id: null,
          task_uuid: null,
        })
        .execute();
    }
  }

  /**
   * Get health check status and results
   */
  async getHealthCheckStatus(healthCheckUuid: string): Promise<HealthCheckStatusResponse | null> {
    const healthCheck = await this.dbHealth
      .selectFrom('health_checks')
      .selectAll()
      .where('health_check_uuid', '=', healthCheckUuid)
      .executeTakeFirst();

    if (!healthCheck) {
      return null;
    }

    const workerResults = await this.dbHealth
      .selectFrom('worker_health_checks')
      .selectAll()
      .where('health_check_uuid', '=', healthCheckUuid)
      .orderBy('worker_name', 'asc')
      .execute();

    return {
      health_check_uuid: healthCheck.health_check_uuid,
      status: healthCheck.status,
      total_workers: healthCheck.total_workers,
      completed_workers: healthCheck.completed_workers,
      passed_workers: healthCheck.passed_workers,
      failed_workers: healthCheck.failed_workers,
      overall_health_score: healthCheck.overall_health_score,
      ai_analysis: healthCheck.ai_analysis,
      ai_recommendations: healthCheck.ai_recommendations,
      worker_results: workerResults,
    };
  }

  /**
   * Get health check history with pagination
   */
  async getHealthCheckHistory(
    page: number = 1,
    limit: number = 20,
    triggerType?: string,
  ): Promise<HealthCheckHistoryResponse> {
    const offset = (page - 1) * limit;

    let query = this.db
      .selectFrom('health_checks')
      .selectAll();

    if (triggerType) {
      query = query.where('trigger_type', '=', triggerType);
    }

    const healthChecks = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    // Get total count
    let countQuery = this.db
      .selectFrom('health_checks')
      .select(({ fn }) => fn.count<number>('id').as('count'));

    if (triggerType) {
      countQuery = countQuery.where('trigger_type', '=', triggerType);
    }

    const { count } = await countQuery.executeTakeFirstOrThrow();

    return {
      health_checks: healthChecks,
      total_count: count,
      page,
      limit,
    };
  }

  /**
   * Update worker health check record
   */
  private async updateWorkerHealthCheck(workerCheckUuid: string, updates: Partial<WorkerHealthChecksTable>) {
    await this.dbHealth
      .updateTable('worker_health_checks')
      .set(updates)
      .where('worker_check_uuid', '=', workerCheckUuid)
      .execute();
  }

  /**
   * Generate AI analysis for individual worker results
   */
  private async generateWorkerAIAnalysis(results: WorkerHealthCheckResult): Promise<{
    analysis: string
    recommendations: string
  }> {
    try {
      const prompt = `Analyze the following worker health check results and provide insights:

Worker Status: ${results.overall_status}
Health Score: ${results.health_score}
Uptime: ${results.uptime_seconds} seconds
Memory Usage: ${results.memory_usage_mb} MB
Response Time: ${results.response_time_ms} ms

Connectivity:
- Orchestrator: ${results.orchestrator_connectivity}
- External APIs: ${results.external_api_connectivity}
- Database: ${results.database_connectivity}

Test Results:
- Unit Tests: ${results.unit_test_results?.length || 0} (${results.unit_test_results?.filter(t => t.status === 'passed').length || 0} passed)
- Performance Tests: ${results.performance_test_results?.length || 0} (${results.performance_test_results?.filter(t => t.status === 'passed').length || 0} passed)
- Integration Tests: ${results.integration_test_results?.length || 0} (${results.integration_test_results?.filter(t => t.status === 'passed').length || 0} passed)

${results.error_message ? `Error: ${results.error_message}` : ''}
${results.warnings?.length ? `Warnings: ${results.warnings.join(', ')}` : ''}

Provide a brief analysis of the worker's health and specific recommendations for improvement.`;

      const aiResponse = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
      });

      const response = aiResponse.response || 'AI analysis unavailable';

      // Split response into analysis and recommendations
      const sections = response.split(/recommendations?:?/i);
      const analysis = sections[0]?.trim() || response;
      const recommendations = sections[1]?.trim() || 'No specific recommendations provided';

      return { analysis, recommendations };

    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return {
        analysis: 'AI analysis failed to generate',
        recommendations: 'Manual review recommended',
      };
    }
  }

  /**
   * Generate overall AI analysis for completed health check
   */
  private async generateOverallAIAnalysis(
    healthCheckUuid: string,
    workerResults: Selectable<WorkerHealthChecksTable>[],
  ): Promise<{ analysis: string; recommendations: string }> {
    try {
      const healthyWorkers = workerResults.filter(w => w.overall_status === 'healthy').length;
      const degradedWorkers = workerResults.filter(w => w.overall_status === 'degraded').length;
      const unhealthyWorkers = workerResults.filter(w => w.overall_status === 'unhealthy').length;
      const criticalWorkers = workerResults.filter(w => w.overall_status === 'critical').length;
      const failedWorkers = workerResults.filter(w => w.status === 'failed').length;

      const avgHealthScore = workerResults.reduce((sum, w) => sum + (w.health_score || 0), 0) / workerResults.length;
      const avgResponseTime = workerResults.reduce((sum, w) => sum + (w.response_time_ms || 0), 0) / workerResults.length;

      const totalUnitTests = workerResults.reduce((sum, w) => sum + (w.unit_tests_total || 0), 0);
      const passedUnitTests = workerResults.reduce((sum, w) => sum + (w.unit_tests_passed || 0), 0);
      const unitTestPassRate = totalUnitTests > 0 ? (passedUnitTests / totalUnitTests) * 100 : 0;

      const connectivityIssues = workerResults.filter(w =>
        !w.orchestrator_connectivity || !w.external_api_connectivity || !w.database_connectivity,
      );

      const prompt = `Analyze the following system-wide health check results:

Overall Statistics:
- Total Workers: ${workerResults.length}
- Healthy: ${healthyWorkers}
- Degraded: ${degradedWorkers}
- Unhealthy: ${unhealthyWorkers}
- Critical: ${criticalWorkers}
- Failed: ${failedWorkers}

Performance Metrics:
- Average Health Score: ${avgHealthScore.toFixed(2)}
- Average Response Time: ${avgResponseTime.toFixed(0)}ms
- Unit Test Pass Rate: ${unitTestPassRate.toFixed(1)}%

Connectivity Issues: ${connectivityIssues.length} workers affected

${connectivityIssues.length > 0 ? `Workers with connectivity issues: ${connectivityIssues.map(w => w.worker_name).join(', ')}` : ''}

Provide an overall system health analysis and prioritized recommendations for the entire worker ecosystem.`;

      const aiResponse = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
      });

      const response = aiResponse.response || 'AI analysis unavailable';

      // Split response into analysis and recommendations
      const sections = response.split(/recommendations?:?/i);
      const analysis = sections[0]?.trim() || response;
      const recommendations = sections[1]?.trim() || 'No specific recommendations provided';

      return { analysis, recommendations };

    } catch (error) {
      console.error('Error generating overall AI analysis:', error);
      return {
        analysis: 'Overall AI analysis failed to generate',
        recommendations: 'Manual system review recommended',
      };
    }
  }

  async recordWorkerTestResult(params: RecordWorkerTestResultParams): Promise<{ health_check_uuid: string; worker_check_uuid: string }> {
    const healthCheckUuid = crypto.randomUUID();
    const workerCheckUuid = crypto.randomUUID();

    await this.dbHealth
      .insertInto('health_checks')
      .values({
        health_check_uuid: healthCheckUuid,
        trigger_type: params.trigger,
        trigger_source: params.requested_by || null,
        status: params.status === 'passed' ? 'completed' : 'failed',
        total_workers: 1,
        completed_workers: 1,
        passed_workers: params.status === 'passed' ? 1 : 0,
        failed_workers: params.status === 'failed' ? 1 : 0,
        overall_health_score: params.status === 'passed' ? 1 : 0,
      })
      .execute();

    await this.dbHealth
      .insertInto('worker_health_checks')
      .values({
        worker_check_uuid: workerCheckUuid,
        health_check_uuid: healthCheckUuid,
        worker_name: params.worker_name,
        worker_type: params.worker_type,
        status: params.status,
        overall_status: params.status === 'passed' ? 'healthy' : 'unhealthy',
        health_score: params.status === 'passed' ? 1 : 0,
        unit_tests_total: params.metrics.total,
        unit_tests_passed: params.metrics.passed,
        unit_tests_failed: params.metrics.failed,
        unit_test_results: JSON.stringify([{
          name: params.suite,
          status: params.status,
          duration_ms: params.metrics.durationMs,
        }]),
        raw_results: JSON.stringify({
          suite: params.suite,
          report: params.report,
          metrics: params.metrics,
          raw: params.raw_results ?? null,
        }),
        warnings: params.status === 'failed' ? JSON.stringify(['investigate failing run']) : null,
        completed_at: params.metrics.completedAt,
        started_at: params.metrics.startedAt,
        requested_at: params.metrics.startedAt,
        response_time_ms: params.metrics.durationMs,
        orchestrator_connectivity: true,
      })
      .execute();

    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'orchestrator.health_check',
        operation: 'unit_test_run_recorded',
        level: params.status === 'passed' ? 'info' : 'error',
        details: JSON.stringify({
          worker: params.worker_name,
          suite: params.suite,
          run_id: params.run_id,
          status: params.status,
        }),
        order_id: null,
        task_uuid: params.run_id,
      })
      .execute();

    return { health_check_uuid: healthCheckUuid, worker_check_uuid: workerCheckUuid };
  }

  async getLatestWorkerTest(workerName: string): Promise<LatestWorkerTestResponse | null> {
    const record = await this.dbHealth
      .selectFrom('worker_health_checks')
      .selectAll()
      .where('worker_name', '=', workerName)
      .orderBy('completed_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!record) {
      return null;
    }

    const raw = record.raw_results ? JSON.parse(record.raw_results) : null;

    return {
      worker_check_uuid: record.worker_check_uuid,
      worker_name: record.worker_name,
      status: record.status ?? 'unknown',
      overall_status: record.overall_status ?? null,
      health_score: record.health_score ?? null,
      metrics: raw?.metrics ?? {
        total: record.unit_tests_total ?? 0,
        passed: record.unit_tests_passed ?? 0,
        failed: record.unit_tests_failed ?? 0,
        response_time_ms: record.response_time_ms ?? 0,
      },
      report: raw?.report ?? {
        artifacts: [],
        unit_test_results: record.unit_test_results ? JSON.parse(record.unit_test_results) : [],
      },
      raw_results: raw,
      completed_at: record.completed_at ?? null,
    };
  }

  getConfiguredWorkers(): WorkerTarget[] {
    return this.getWorkerConfigs();
  }

  private getWorkerConfigs(): WorkerTarget[] {
    if (this.workerConfigCache) {
      return this.workerConfigCache;
    }

    const defaultConfigs: WorkerTarget[] = [
      { name: 'base-worker', type: 'application', url: 'http://localhost:8784' },
      { name: 'agent-factory', type: 'agent-factory', url: 'http://localhost:8788' },
      { name: 'data-factory', type: 'data-factory', url: 'http://localhost:8789' },
      { name: 'services-factory', type: 'services-factory', url: 'http://localhost:8790' },
      { name: 'ui-factory', type: 'ui-factory', url: 'http://localhost:8791' },
      { name: 'ops-conflict-specialist', type: 'conflict-specialist', url: 'http://localhost:8792' },
      { name: 'ops-delivery-report-specialist', type: 'delivery-report-specialist', url: 'http://localhost:8793' },
    ];

    const rawTargets = this.env.HEALTH_WORKER_TARGETS;
    if (!rawTargets) {
      this.workerConfigCache = defaultConfigs;
      return defaultConfigs;
    }

    try {
      const parsed = JSON.parse(rawTargets);
      if (Array.isArray(parsed)) {
        const sanitized = parsed
          .map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }
            const name = typeof entry.name === 'string' && entry.name.trim().length > 0
              ? entry.name.trim()
              : typeof entry.worker === 'string'
                ? entry.worker.trim()
                : null;
            const type = typeof entry.type === 'string' && entry.type.trim().length > 0
              ? entry.type.trim()
              : name;
            const url = typeof entry.url === 'string' && entry.url.trim().length > 0
              ? entry.url.trim()
              : undefined;
            const binding = typeof entry.binding === 'string' && entry.binding.trim().length > 0
              ? entry.binding.trim()
              : undefined;

            if (!name || !type || (!url && !binding)) {
              return null;
            }

            return { name, type, url, binding };
          })
          .filter((value): value is WorkerTarget => value !== null);

        if (sanitized.length > 0) {
          this.workerConfigCache = sanitized;
          return sanitized;
        }
      }

      console.warn('HEALTH_WORKER_TARGETS provided but no valid worker targets were parsed. Falling back to defaults.');
    } catch (error) {
      console.error('Failed to parse HEALTH_WORKER_TARGETS. Falling back to default worker configuration.', error);
    }

    this.workerConfigCache = defaultConfigs;
    return defaultConfigs;
  }
}
