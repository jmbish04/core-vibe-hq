import { Env } from '../types';
import { TestRunResult } from './TestRunner';

export interface RecordOptions {
  trigger: 'cron' | 'on_demand' | 'package';
  requestedBy?: string;
  suite: string;
}

export class ResultRecorder {
  constructor(private readonly env: Env) {}

  async record(run: TestRunResult, options: RecordOptions): Promise<void> {
    const payload = {
      worker_name: 'ops-unit-test-specialist',
      worker_type: 'unit-test-specialist',
      run_id: run.runId,
      trigger: options.trigger,
      requested_by: options.requestedBy ?? null,
      suite: options.suite,
      status: run.status,
      metrics: run.metrics,
      report: run.report,
      raw_results: run.rawResults,
    };

    await this.env.ORCHESTRATOR.fetch('https://orchestrator/api/health/tests/ops-unit-test-specialist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async fetchLatest(): Promise<Response> {
    return await this.env.ORCHESTRATOR.fetch('https://orchestrator/api/health/tests/ops-unit-test-specialist/latest');
  }
}
