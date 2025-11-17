/**
 * orchestrator/worker/entrypoints/OpsMonitorOps.ts
 * ------------------------------------------------------------
 * Operations Monitoring RPC Entrypoint
 *
 * Exposes RPC methods for triggering ops scans, retrieving scan
 * history, and managing ops issues. Downstream workers can call
 * these methods through the ORCHESTRATOR_OPS_MONITOR service binding
 * instead of writing directly to the ops D1 database.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import {
  OpsMonitorService,
  OpsScanOptions,
  OpsScanResult,
  OpsScanRecord,
  OpsIssueRecord,
} from '../services/ops/opsMonitorService';
import { getServerByName } from '../../../../third_party/partykit/packages/partyserver/src/index';
import { OpsMonitorBroadcastServer } from '../durable-objects/ops/OpsMonitorBroadcastServer';
import type { OpsMonitorBroadcastEnv } from '../durable-objects/ops/OpsMonitorBroadcastServer';

interface ScanParams {
  scope?: OpsScanOptions['scope'];
  filters?: OpsScanOptions['filters'];
}

interface ResolveIssueParams {
  id: number;
  resolution: string;
}

interface ListParams {
  limit?: number;
}

interface OpsMonitorEnv extends CoreEnv {
  OPS_MONITOR_BROADCAST: DurableObjectNamespace<OpsMonitorBroadcastServer>;
}

export class OpsMonitorOps extends BaseWorkerEntrypoint<OpsMonitorEnv> {
  private readonly service: OpsMonitorService;

  constructor(ctx: ExecutionContext, env: OpsMonitorEnv) {
    super(ctx, env);
    
    // Create broadcast callback
    const broadcastCallback = async (scanResult: OpsScanResult) => {
      try {
        const broadcastServer = await getServerByName<OpsMonitorBroadcastEnv, OpsMonitorBroadcastServer>(
          env.OPS_MONITOR_BROADCAST as DurableObjectNamespace<OpsMonitorBroadcastServer>,
          'main' // Single broadcast channel for all ops scans
        );
        
        // Call HTTP endpoint to broadcast
        await broadcastServer.fetch(
          new Request('http://dummy/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scanResult),
          })
        );
      } catch (error) {
        console.error('Failed to broadcast scan result:', error);
        // Don't throw - broadcast failure shouldn't fail the scan
      }
    };
    
    this.service = new OpsMonitorService(this.dbOps, broadcastCallback);
  }

  /**
   * Trigger an operations scan using the shared OpsMonitorService.
   */
  async scan(params: ScanParams = {}): Promise<OpsScanResult> {
    return this.service.runScan({
      scope: params.scope,
      filters: params.filters,
    });
  }

  /**
   * Fetch recent scans for dashboards or diagnostics.
   */
  async getRecentScans(params: ListParams = {}): Promise<OpsScanRecord[]> {
    return this.service.getRecentScans(params.limit);
  }

  /**
   * Fetch unresolved issues identified by previous scans.
   */
  async getOpenIssues(params: ListParams = {}): Promise<OpsIssueRecord[]> {
    return this.service.getOpenIssues(params.limit);
  }

  /**
   * Resolve an issue and record a resolution summary.
   */
  async resolveIssue(params: ResolveIssueParams): Promise<{ success: true }> {
    if (!params.id || !params.resolution) {
      throw new Error('Both issue id and resolution text are required.');
    }

    await this.service.resolveIssue(params.id, params.resolution);
    return { success: true };
  }
}

export default OpsMonitorOps;
