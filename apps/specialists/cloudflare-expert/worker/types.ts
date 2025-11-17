export interface Env {
  ORCHESTRATOR: Fetcher;
  WORKER_NAME?: string;
  SPECIALIST_TYPE?: string;
}

export interface ConsultRequest {
  question: string;
  context?: string;
  links?: string[];
}

export interface OrderReviewRequest {
  orderId: string;
  summary: string;
  artifacts?: Array<{ name: string; url?: string; content?: string }>;
  bindings?: Record<string, string>;
  checklist?: string[];
}

export interface CodeReviewRequest {
  snippet: string;
  filename?: string;
  runtime?: 'workers' | 'pages' | 'durable-object';
  expectedBindings?: string[];
}

export interface SpecialistLogResponse {
  logs: Array<{
    timestamp: string;
    activity: string;
    level: string;
    details: Record<string, unknown>;
  }>;
}
