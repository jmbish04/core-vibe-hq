-- Mission Control Ops Layer Database Schema
-- Tracks conflict resolutions, delivery reports, and operational metrics
-- These tables are part of the shared orchestrator D1 database

-- Conflict Resolution Audit Table
CREATE TABLE IF NOT EXISTS ops_conflict_resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    base_branch TEXT NOT NULL,
    head_branch TEXT NOT NULL,
    files_resolved INTEGER DEFAULT 0,
    conflicts_kept_both INTEGER DEFAULT 0,
    conflicts_deleted INTEGER DEFAULT 0,
    decision_log TEXT,
    resolution_branch TEXT,
    status TEXT DEFAULT 'pending', -- pending, resolved, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    UNIQUE(repo, pr_number, head_branch)
);

CREATE INDEX IF NOT EXISTS idx_ops_conflict_resolutions_repo_pr ON ops_conflict_resolutions(repo, pr_number);
CREATE INDEX IF NOT EXISTS idx_ops_conflict_resolutions_status ON ops_conflict_resolutions(status);
CREATE INDEX IF NOT EXISTS idx_ops_conflict_resolutions_created ON ops_conflict_resolutions(created_at);

-- Delivery Report Table
CREATE TABLE IF NOT EXISTS ops_delivery_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    phase TEXT,
    compliance_score REAL DEFAULT 0.0, -- 0.0 to 1.0
    summary TEXT,
    issues JSON,
    recommendations JSON,
    original_order_spec TEXT,
    final_code_diff TEXT,
    status TEXT DEFAULT 'pending', -- pending, completed, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    version TEXT DEFAULT '1.0',
    UNIQUE(project_id, phase, version)
);

CREATE INDEX IF NOT EXISTS idx_ops_delivery_reports_project ON ops_delivery_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_ops_delivery_reports_status ON ops_delivery_reports(status);
CREATE INDEX IF NOT EXISTS idx_ops_delivery_reports_created ON ops_delivery_reports(created_at);

-- Ops Order Queue (for tracking orchestrator orders)
CREATE TABLE IF NOT EXISTS ops_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_type TEXT NOT NULL, -- conflict-resolution, delivery-report, rollback, etc.
    order_payload JSON NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    assigned_specialist TEXT,
    result JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_ops_orders_type_status ON ops_orders(order_type, status);
CREATE INDEX IF NOT EXISTS idx_ops_orders_created ON ops_orders(created_at);
