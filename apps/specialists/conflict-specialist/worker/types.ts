/**
 * Conflict Specialist Types
 * Defines the data structures for conflict resolution operations
 */

export interface ConflictResolutionOrder {
  type: 'conflict-resolution';
  repo: string;
  base_branch: string;
  head_branch: string;
  pr_number: number;
  github_token?: string;
  project_id?: string;
}

export interface ConflictBlock {
  file: string;
  startLine: number;
  endLine: number;
  baseContent: string;
  headContent: string;
  conflictMarkers: {
    start: string;
    separator: string;
    end: string;
  };
}

export interface ConflictResolution {
  file: string;
  resolvedContent: string;
  strategy: 'keep-both' | 'prefer-base' | 'prefer-head' | 'merge-intelligent';
  conflictsResolved: number;
}

export interface ConflictResolutionResult {
  success: boolean;
  filesResolved: number;
  conflictsKeptBoth: number;
  conflictsDeleted: number;
  resolutionBranch: string;
  decisionLog: string;
  error?: string;
}

export interface ConflictResolutionRecord {
  id?: number;
  repo: string;
  pr_number: number;
  base_branch: string;
  head_branch: string;
  files_resolved: number;
  conflicts_kept_both: number;
  conflicts_deleted: number;
  decision_log: string;
  resolution_branch: string;
  status: 'pending' | 'resolved' | 'failed';
  created_at?: string;
  resolved_at?: string;
}

