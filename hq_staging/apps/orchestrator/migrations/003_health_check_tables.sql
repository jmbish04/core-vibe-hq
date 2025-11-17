-- Health Check System Database Schema
-- Tracks orchestrator-initiated health checks and unit tests across all workers

-- Main health check instances table
CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    health_check_uuid TEXT UNIQUE NOT NULL,
    trigger_type TEXT NOT NULL, -- 'cron' or 'on_demand'
    trigger_source TEXT, -- user_id for on_demand, 'system' for cron
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'timeout'
    total_workers INTEGER DEFAULT 0,
    completed_workers INTEGER DEFAULT 0,
    passed_workers INTEGER DEFAULT 0,
    failed_workers INTEGER DEFAULT 0,
    overall_health_score REAL DEFAULT 0.0, -- 0.0 to 1.0
    ai_analysis TEXT, -- AI-generated analysis of results
    ai_recommendations TEXT, -- AI-generated recommendations
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    timeout_at DATETIME, -- When to consider this check timed out
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_checks_uuid ON health_checks(health_check_uuid);
CREATE INDEX IF NOT EXISTS idx_health_checks_trigger ON health_checks(trigger_type, started_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON health_checks(created_at);

-- Individual worker health check results table
CREATE TABLE IF NOT EXISTS worker_health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_check_uuid TEXT UNIQUE NOT NULL,
    health_check_uuid TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    worker_type TEXT NOT NULL, -- 'agent-factory', 'data-factory', etc.
    worker_url TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'timeout'
    
    -- Health check results
    overall_status TEXT, -- 'healthy', 'degraded', 'unhealthy', 'critical'
    health_score REAL DEFAULT 0.0, -- 0.0 to 1.0
    
    -- System metrics
    uptime_seconds INTEGER,
    memory_usage_mb REAL,
    cpu_usage_percent REAL,
    response_time_ms INTEGER,
    
    -- Connectivity tests
    orchestrator_connectivity BOOLEAN DEFAULT FALSE,
    external_api_connectivity BOOLEAN DEFAULT FALSE,
    database_connectivity BOOLEAN DEFAULT FALSE,
    
    -- Unit test results
    unit_tests_total INTEGER DEFAULT 0,
    unit_tests_passed INTEGER DEFAULT 0,
    unit_tests_failed INTEGER DEFAULT 0,
    unit_test_results TEXT, -- JSON array of test results
    
    -- Performance tests
    performance_tests_total INTEGER DEFAULT 0,
    performance_tests_passed INTEGER DEFAULT 0,
    performance_tests_failed INTEGER DEFAULT 0,
    performance_test_results TEXT, -- JSON array of performance results
    
    -- Integration tests
    integration_tests_total INTEGER DEFAULT 0,
    integration_tests_passed INTEGER DEFAULT 0,
    integration_tests_failed INTEGER DEFAULT 0,
    integration_test_results TEXT, -- JSON array of integration results
    
    -- Error details
    error_message TEXT,
    error_stack TEXT,
    warnings TEXT, -- JSON array of warnings
    
    -- Detailed results payload
    raw_results TEXT, -- Full JSON payload from worker
    
    -- AI analysis for this specific worker
    ai_worker_analysis TEXT,
    ai_worker_recommendations TEXT,
    
    -- Timestamps
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    
    FOREIGN KEY (health_check_uuid) REFERENCES health_checks(health_check_uuid)
);

CREATE INDEX IF NOT EXISTS idx_worker_health_checks_uuid ON worker_health_checks(worker_check_uuid);
CREATE INDEX IF NOT EXISTS idx_worker_health_checks_health_uuid ON worker_health_checks(health_check_uuid);
CREATE INDEX IF NOT EXISTS idx_worker_health_checks_worker ON worker_health_checks(worker_name, worker_type);
CREATE INDEX IF NOT EXISTS idx_worker_health_checks_status ON worker_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_worker_health_checks_overall_status ON worker_health_checks(overall_status);
CREATE INDEX IF NOT EXISTS idx_worker_health_checks_requested ON worker_health_checks(requested_at);

-- Health check schedule configuration table
CREATE TABLE IF NOT EXISTS health_check_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    cron_expression TEXT NOT NULL, -- e.g., '0 0 * * *' for daily at midnight
    enabled BOOLEAN DEFAULT TRUE,
    timeout_minutes INTEGER DEFAULT 30,
    include_unit_tests BOOLEAN DEFAULT TRUE,
    include_performance_tests BOOLEAN DEFAULT TRUE,
    include_integration_tests BOOLEAN DEFAULT TRUE,
    worker_filters TEXT, -- JSON array of worker names/types to include
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default daily health check schedule
INSERT OR IGNORE INTO health_check_schedules (name, cron_expression, timeout_minutes) 
VALUES ('daily_health_check', '0 2 * * *', 45); -- Daily at 2 AM with 45 minute timeout
