/**
 * Delivery Report Specialist Types
 */

export interface DeliveryReportOrder {
  type: 'delivery-report';
  project_id: string;
  phase?: string;
  original_order_spec: string;
  pr_commit_logs?: string[];
  factory_logs?: FactoryLog[];
}

export interface FactoryLog {
  factory_name: string;
  logs: string;
  pr_number?: number;
  commit_sha?: string;
}

export interface DeliveryReport {
  project_id: string;
  phase?: string;
  compliance_score: number; // 0.0 to 1.0
  summary: string;
  issues: DeliveryIssue[];
  recommendations: DeliveryRecommendation[];
  version: string;
}

export interface DeliveryIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'functional' | 'ui' | 'data' | 'security' | 'performance';
  description: string;
  affected_components?: string[];
}

export interface DeliveryRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  actionable: boolean;
}

export interface DeliveryReportRecord {
  id?: number;
  project_id: string;
  phase?: string;
  compliance_score: number;
  summary: string;
  issues: string; // JSON string
  recommendations: string; // JSON string
  original_order_spec: string;
  final_code_diff?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at?: string;
  completed_at?: string;
  version: string;
}

