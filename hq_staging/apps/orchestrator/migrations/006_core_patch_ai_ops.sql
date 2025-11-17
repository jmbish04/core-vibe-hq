-- Core tables: patches, delivery, AI providers, ops logs

-- Patch Events
CREATE TABLE IF NOT EXISTS patch_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  patch_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata JSON
);
CREATE INDEX IF NOT EXISTS idx_patch_events_patch_id ON patch_events(patch_id);
CREATE INDEX IF NOT EXISTS idx_patch_events_created ON patch_events(created_at);
CREATE INDEX IF NOT EXISTS idx_patch_events_event_type ON patch_events(event_type);

-- Delivery Reports
CREATE TABLE IF NOT EXISTS delivery_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  patch_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  error TEXT,
  metadata JSON
);
CREATE INDEX IF NOT EXISTS idx_delivery_reports_patch ON delivery_reports(patch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reports_status ON delivery_reports(status);

-- AI Provider Assignments
CREATE TABLE IF NOT EXISTS ai_provider_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  patch_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  metadata JSON
);
CREATE INDEX IF NOT EXISTS idx_ai_assign_patch ON ai_provider_assignments(patch_id);
CREATE INDEX IF NOT EXISTS idx_ai_assign_provider ON ai_provider_assignments(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_assign_status ON ai_provider_assignments(status);

-- AI Provider Executions
CREATE TABLE IF NOT EXISTS ai_provider_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assignment_id INTEGER NOT NULL,
  started_at DATETIME,
  completed_at DATETIME,
  status TEXT NOT NULL,
  result JSON,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_exec_assignment ON ai_provider_executions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ai_exec_status ON ai_provider_executions(status);

-- AI Provider Configs
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  provider_id TEXT NOT NULL,
  config JSON NOT NULL,
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_config_provider_version ON ai_provider_configs(provider_id, version);
CREATE INDEX IF NOT EXISTS idx_ai_config_provider ON ai_provider_configs(provider_id);

-- Worker Logs
CREATE TABLE IF NOT EXISTS worker_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  worker_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSON
);
CREATE INDEX IF NOT EXISTS idx_worker_logs_worker ON worker_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_logs_level ON worker_logs(level);
CREATE INDEX IF NOT EXISTS idx_worker_logs_created ON worker_logs(created_at);

-- Build Logs
CREATE TABLE IF NOT EXISTS build_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  build_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSON
);
CREATE INDEX IF NOT EXISTS idx_build_logs_build ON build_logs(build_id);
CREATE INDEX IF NOT EXISTS idx_build_logs_stage ON build_logs(stage);
CREATE INDEX IF NOT EXISTS idx_build_logs_created ON build_logs(created_at);

-- Ops Issues
CREATE TABLE IF NOT EXISTS ops_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSON,
  resolved_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_ops_issues_status ON ops_issues(status);
CREATE INDEX IF NOT EXISTS idx_ops_issues_type ON ops_issues(type);
CREATE INDEX IF NOT EXISTS idx_ops_issues_severity ON ops_issues(severity);
CREATE INDEX IF NOT EXISTS idx_ops_issues_created ON ops_issues(created_at);

-- Ops Scans
CREATE TABLE IF NOT EXISTS ops_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scan_type TEXT NOT NULL,
  status TEXT NOT NULL,
  findings JSON,
  metadata JSON
);
CREATE INDEX IF NOT EXISTS idx_ops_scans_scan_type ON ops_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_ops_scans_status ON ops_scans(status);
CREATE INDEX IF NOT EXISTS idx_ops_scans_created ON ops_scans(created_at);

