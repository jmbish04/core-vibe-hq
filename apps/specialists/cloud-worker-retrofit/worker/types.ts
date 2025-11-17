export interface Env {
  ORCHESTRATOR: Fetcher;
  WORKER_NAME?: string;
  SPECIALIST_TYPE?: string;
  DEFAULT_MODEL?: string;
}

export interface RetrofitAnalysisRequest {
  repoUrl?: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  notes?: string;
}

export interface RetrofitPlanRequest extends RetrofitAnalysisRequest {
  deploymentTarget?: 'workers' | 'pages' | 'hybrid';
  preferredAdapter?: string;
}

export interface RetrofitStatusEntry {
  timestamp: string;
  activity: string;
  level: string;
  details: Record<string, unknown>;
}
