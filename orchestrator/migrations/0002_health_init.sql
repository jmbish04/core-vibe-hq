-- Health Specialist Database Schema Migration
-- Initial migration for health monitoring system

-- Test Profiles Table - defines health tests and their metadata
CREATE TABLE test_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('unit', 'integration', 'performance', 'security', 'ai')),
  target TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  schedule TEXT DEFAULT 'daily' CHECK (schedule IN ('hourly', 'daily', 'weekly')),
  timeout_seconds INTEGER DEFAULT 300,
  retry_attempts INTEGER DEFAULT 3,
  config TEXT, -- JSON configuration
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Test Results Table - logs individual test runs and outcomes
CREATE TABLE test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_profile_id INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
  duration_ms INTEGER,
  error_message TEXT,
  output TEXT, -- JSON output
  metrics TEXT, -- JSON metrics
  environment TEXT DEFAULT 'production',
  triggered_by TEXT DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual', 'webhook')),
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (test_profile_id) REFERENCES test_profiles(id) ON DELETE CASCADE
);

-- AI Logs Table - tracks AI model usage and diagnostics
CREATE TABLE ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_result_id INTEGER,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt TEXT,
  response TEXT,
  tokens_used INTEGER,
  cost REAL,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT 1,
  error_message TEXT,
  reasoning TEXT, -- JSON reasoning
  metadata TEXT, -- JSON metadata
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (test_result_id) REFERENCES test_results(id) ON DELETE CASCADE
);

-- Health Summary Table - aggregated health status over time
CREATE TABLE health_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'critical')),
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  skipped_tests INTEGER DEFAULT 0,
  average_latency INTEGER,
  total_cost REAL,
  ai_usage_count INTEGER DEFAULT 0,
  issues TEXT, -- JSON issues
  recommendations TEXT, -- JSON recommendations
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX idx_test_profiles_category ON test_profiles(category);
CREATE INDEX idx_test_profiles_target ON test_profiles(target);
CREATE INDEX idx_test_profiles_enabled ON test_profiles(enabled);

CREATE INDEX idx_test_results_profile_id ON test_results(test_profile_id);
CREATE INDEX idx_test_results_run_id ON test_results(run_id);
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_test_results_created_at ON test_results(created_at);

CREATE INDEX idx_ai_logs_test_result_id ON ai_logs(test_result_id);
CREATE INDEX idx_ai_logs_model ON ai_logs(model);
CREATE INDEX idx_ai_logs_provider ON ai_logs(provider);
CREATE INDEX idx_ai_logs_created_at ON ai_logs(created_at);

CREATE INDEX idx_health_summaries_date ON health_summaries(date);
CREATE INDEX idx_health_summaries_status ON health_summaries(overall_status);

-- Insert default test profiles
INSERT INTO test_profiles (name, description, category, target, config) VALUES
('orchestrator-connectivity', 'Test connection to orchestrator services', 'integration', 'orchestrator', '{"endpoints": ["/api/status", "/api/health"]}' ),
('base-worker-health', 'Test base worker functionality', 'unit', 'base-worker', '{"components": ["auth", "database", "api"]}' ),
('agent-factory-response', 'Test AI agent generation', 'ai', 'agent-factory', '{"models": ["gpt-4", "claude-3"], "timeout": 60}' ),
('data-factory-queries', 'Test database operations', 'integration', 'data-factory', '{"operations": ["select", "insert", "update"]}' ),
('ui-factory-build', 'Test frontend build process', 'performance', 'ui-factory', '{"frameworks": ["react", "vue", "svelte"]}' ),
('services-factory-integration', 'Test external service connections', 'integration', 'services-factory', '{"services": ["stripe", "github", "slack"]}' ),
('specialists-activation', 'Test specialist worker activation', 'integration', 'specialists', '{"workers": ["conflict", "delivery", "unit-test"]}' ),
('websocket-connectivity', 'Test real-time communication', 'integration', 'websockets', '{"channels": ["terminal", "collaboration", "health"]}' ),
('container-health', 'Test container deployment and scaling', 'performance', 'containers', '{"max_instances": 100, "scaling_time": 30}' ),
('security-validation', 'Test security measures and authentication', 'security', 'security', '{"checks": ["auth", "rate-limiting", "encryption"]}' ),
('dependency-sync-check', 'Check package-lock.json synchronization with package.json', 'security', 'build-system', '{"check_lockfile_sync": true, "validate_dependencies": true}' ),
('github-repo-health', 'Analyze GitHub repository for common build issues', 'integration', 'github-repo', '{"checks": ["package_sync", "build_errors", "dependency_issues"]}' ),
('orchestrator-macro-health', 'Test orchestrator macro-level health (comms, PartyKit, RPC)', 'integration', 'orchestrator', '{"tests": ["communication", "websocket", "rpc", "build_health"]}' ),
('inter-worker-communication', 'Verify communication between all workers', 'communication', 'system', '{"workers": ["agent-factory", "data-factory", "ui-factory", "specialists"]}' ),
('websocket-connectivity', 'Test PartyKit WebSocket functionality', 'websocket', 'partykit', '{"endpoints": ["/ws/health", "/ws/terminal", "/ws/collaboration"]}' );
