/**
 * Orchestrator HTTP Client
 * 
 * Client for making HTTP requests to orchestrator container monitoring endpoints.
 * Used by container monitoring scripts to route all operations through orchestrator
 * instead of local SQLite databases.
 */

export interface OrchestratorClientConfig {
  orchestratorUrl: string; // Base URL of orchestrator (e.g., 'https://orchestrator.example.com' or 'http://localhost:8787')
  workerName: string; // Worker identifier (required)
  containerName?: string; // Container identifier (optional)
}

export class OrchestratorClient {
  private config: OrchestratorClientConfig;
  private baseUrl: string;

  constructor(config: OrchestratorClientConfig) {
    this.config = config;
    // Ensure base URL doesn't have trailing slash
    this.baseUrl = config.orchestratorUrl.replace(/\/$/, '');
  }

  /**
   * Create client from environment variables
   */
  static fromEnv(env: Record<string, string | undefined>): OrchestratorClient {
    const orchestratorUrl = env.ORCHESTRATOR_URL || env.ORCHESTRATOR_BASE_URL || 'http://localhost:8787';
    const workerName = env.WORKER_NAME || env.CF_WORKER_NAME || 'unknown-worker';
    const containerName = env.CONTAINER_NAME || env.CONTAINER_ID;

    return new OrchestratorClient({
      orchestratorUrl,
      workerName,
      containerName,
    });
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ========================================
  // ERROR OPERATIONS
  // ========================================

  /**
   * Store a container error
   */
  async storeError(params: {
    instanceId: string;
    processId: string;
    errorHash: string;
    timestamp: string;
    level: number;
    message: string;
    rawOutput: string;
  }): Promise<{ success: boolean; data?: { id: number; occurrenceCount: number }; error?: string }> {
    return this.request<{ id: number; occurrenceCount: number }>(
      '/api/monitoring/errors',
      'POST',
      {
        workerName: this.config.workerName,
        containerName: this.config.containerName,
        ...params,
      }
    );
  }

  /**
   * Get container errors
   */
  async getErrors(params: {
    instanceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    data?: {
      data: Array<{
        id: number;
        workerName: string;
        containerName: string | null;
        instanceId: string;
        processId: string;
        errorHash: string;
        timestamp: string;
        level: number;
        message: string;
        rawOutput: string;
        occurrenceCount: number;
        createdAt: number;
      }>;
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    error?: string;
  }> {
    const queryParams = new URLSearchParams();
    queryParams.set('workerName', this.config.workerName);
    if (this.config.containerName) {
      queryParams.set('containerName', this.config.containerName);
    }
    if (params.instanceId) {
      queryParams.set('instanceId', params.instanceId);
    }
    if (params.limit) {
      queryParams.set('limit', params.limit.toString());
    }
    if (params.offset) {
      queryParams.set('offset', params.offset.toString());
    }

    return this.request(`/api/monitoring/errors?${queryParams.toString()}`);
  }

  // ========================================
  // LOG OPERATIONS
  // ========================================

  /**
   * Store a single container log
   */
  async storeLog(params: {
    instanceId: string;
    processId: string;
    sequence: number;
    timestamp: string;
    level: string;
    message: string;
    stream: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; data?: { id: number }; error?: string }> {
    return this.request<{ id: number }>(
      '/api/monitoring/logs',
      'POST',
      {
        workerName: this.config.workerName,
        containerName: this.config.containerName,
        ...params,
      }
    );
  }

  /**
   * Store multiple container logs (batch)
   */
  async storeLogs(params: {
    instanceId: string;
    processId: string;
    logs: Array<{
      sequence: number;
      timestamp: string;
      level: string;
      message: string;
      stream: string;
      source?: string;
      metadata?: Record<string, unknown>;
    }>;
  }): Promise<{ success: boolean; data?: { count: number }; error?: string }> {
    return this.request<{ count: number }>(
      '/api/monitoring/logs',
      'POST',
      {
        workerName: this.config.workerName,
        containerName: this.config.containerName,
        ...params,
      }
    );
  }

  /**
   * Get container logs
   */
  async getLogs(params: {
    instanceId?: string;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data?: {
      data: Array<{
        id: number;
        workerName: string;
        containerName: string | null;
        instanceId: string;
        processId: string;
        sequence: number;
        timestamp: string;
        level: string;
        message: string;
        stream: string;
        source: string | null;
        metadata: Record<string, unknown> | null;
        createdAt: number;
      }>;
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    error?: string;
  }> {
    const queryParams = new URLSearchParams();
    queryParams.set('workerName', this.config.workerName);
    if (this.config.containerName) {
      queryParams.set('containerName', this.config.containerName);
    }
    if (params.instanceId) {
      queryParams.set('instanceId', params.instanceId);
    }
    if (params.since) {
      queryParams.set('since', params.since);
    }
    if (params.until) {
      queryParams.set('until', params.until);
    }
    if (params.limit) {
      queryParams.set('limit', params.limit.toString());
    }
    if (params.offset) {
      queryParams.set('offset', params.offset.toString());
    }
    if (params.sortOrder) {
      queryParams.set('sortOrder', params.sortOrder);
    }

    return this.request(`/api/monitoring/logs?${queryParams.toString()}`);
  }

  // ========================================
  // PROCESS OPERATIONS
  // ========================================

  /**
   * Create or update a container process
   */
  async upsertProcess(params: {
    instanceId: string;
    processId?: string;
    command: string;
    args?: string[];
    cwd: string;
    status: string;
    restartCount?: number;
    startTime?: number;
    endTime?: number;
    exitCode?: number;
    lastError?: string;
    env?: Record<string, string>;
  }): Promise<{ success: boolean; data?: { id: number }; error?: string }> {
    return this.request<{ id: number }>(
      '/api/monitoring/processes',
      'POST',
      {
        workerName: this.config.workerName,
        containerName: this.config.containerName,
        ...params,
      }
    );
  }

  /**
   * Get container process by instance ID
   */
  async getProcess(instanceId: string): Promise<{
    success: boolean;
    data?: {
      id: number;
      workerName: string;
      containerName: string | null;
      instanceId: string;
      processId: string | null;
      command: string;
      args: string[] | null;
      cwd: string;
      status: string;
      restartCount: number;
      startTime: number | null;
      endTime: number | null;
      exitCode: number | null;
      lastError: string | null;
      env: Record<string, string> | null;
      createdAt: number;
      updatedAt: number;
    };
    error?: string;
  }> {
    return this.request(`/api/monitoring/processes/${encodeURIComponent(instanceId)}`);
  }

  /**
   * Get container processes
   */
  async getProcesses(params: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    data?: {
      data: Array<{
        id: number;
        workerName: string;
        containerName: string | null;
        instanceId: string;
        processId: string | null;
        command: string;
        args: string[] | null;
        cwd: string;
        status: string;
        restartCount: number;
        startTime: number | null;
        endTime: number | null;
        exitCode: number | null;
        lastError: string | null;
        env: Record<string, string> | null;
        createdAt: number;
        updatedAt: number;
      }>;
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    error?: string;
  }> {
    const queryParams = new URLSearchParams();
    queryParams.set('workerName', this.config.workerName);
    if (this.config.containerName) {
      queryParams.set('containerName', this.config.containerName);
    }
    if (params.status) {
      queryParams.set('status', params.status);
    }
    if (params.limit) {
      queryParams.set('limit', params.limit.toString());
    }
    if (params.offset) {
      queryParams.set('offset', params.offset.toString());
    }

    return this.request(`/api/monitoring/processes?${queryParams.toString()}`);
  }
}


