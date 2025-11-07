-- Drizzle-generated migration for HEALTH database (vibehq-health-logs)
-- Tables: health_check_schedules, health_checks, worker_health_checks

CREATE TABLE IF NOT EXISTS `health_check_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`cron_expression` text NOT NULL,
	`enabled` integer DEFAULT true,
	`timeout_minutes` integer DEFAULT 30,
	`include_unit_tests` integer DEFAULT true,
	`include_performance_tests` integer DEFAULT true,
	`include_integration_tests` integer DEFAULT true,
	`worker_filters` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `health_check_schedules_name_unique` ON `health_check_schedules` (`name`);
CREATE INDEX IF NOT EXISTS `health_check_schedules_name_idx` ON `health_check_schedules` (`name`);
CREATE TABLE IF NOT EXISTS `health_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`health_check_uuid` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_source` text,
	`status` text DEFAULT 'running',
	`total_workers` integer DEFAULT 0,
	`completed_workers` integer DEFAULT 0,
	`passed_workers` integer DEFAULT 0,
	`failed_workers` integer DEFAULT 0,
	`overall_health_score` real DEFAULT 0,
	`ai_analysis` text,
	`ai_recommendations` text,
	`started_at` integer DEFAULT CURRENT_TIMESTAMP,
	`completed_at` integer,
	`timeout_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `health_checks_health_check_uuid_unique` ON `health_checks` (`health_check_uuid`);
CREATE INDEX IF NOT EXISTS `health_checks_uuid_idx` ON `health_checks` (`health_check_uuid`);
CREATE INDEX IF NOT EXISTS `health_checks_trigger_idx` ON `health_checks` (`trigger_type`,`started_at`);
CREATE INDEX IF NOT EXISTS `health_checks_status_idx` ON `health_checks` (`status`);
CREATE INDEX IF NOT EXISTS `health_checks_created_at_idx` ON `health_checks` (`created_at`);
CREATE TABLE IF NOT EXISTS `worker_health_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worker_check_uuid` text NOT NULL,
	`health_check_uuid` text NOT NULL,
	`worker_name` text NOT NULL,
	`worker_type` text NOT NULL,
	`worker_url` text,
	`status` text DEFAULT 'pending',
	`overall_status` text,
	`health_score` real DEFAULT 0,
	`uptime_seconds` integer,
	`memory_usage_mb` real,
	`cpu_usage_percent` real,
	`response_time_ms` integer,
	`orchestrator_connectivity` integer DEFAULT false,
	`external_api_connectivity` integer DEFAULT false,
	`database_connectivity` integer DEFAULT false,
	`unit_tests_total` integer DEFAULT 0,
	`unit_tests_passed` integer DEFAULT 0,
	`unit_tests_failed` integer DEFAULT 0,
	`unit_test_results` text,
	`performance_tests_total` integer DEFAULT 0,
	`performance_tests_passed` integer DEFAULT 0,
	`performance_tests_failed` integer DEFAULT 0,
	`performance_test_results` text,
	`integration_tests_total` integer DEFAULT 0,
	`integration_tests_passed` integer DEFAULT 0,
	`integration_tests_failed` integer DEFAULT 0,
	`integration_test_results` text,
	`error_message` text,
	`error_stack` text,
	`warnings` text,
	`raw_results` text,
	`ai_worker_analysis` text,
	`ai_worker_recommendations` text,
	`requested_at` integer DEFAULT CURRENT_TIMESTAMP,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`health_check_uuid`) REFERENCES `health_checks`(`health_check_uuid`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS `worker_health_checks_worker_check_uuid_unique` ON `worker_health_checks` (`worker_check_uuid`);
CREATE INDEX IF NOT EXISTS `worker_health_checks_uuid_idx` ON `worker_health_checks` (`worker_check_uuid`);
CREATE INDEX IF NOT EXISTS `worker_health_checks_health_uuid_idx` ON `worker_health_checks` (`health_check_uuid`);
CREATE INDEX IF NOT EXISTS `worker_health_checks_worker_idx` ON `worker_health_checks` (`worker_name`,`worker_type`);
CREATE INDEX IF NOT EXISTS `worker_health_checks_status_idx` ON `worker_health_checks` (`status`);
CREATE INDEX IF NOT EXISTS `worker_health_checks_overall_status_idx` ON `worker_health_checks` (`overall_status`);
CREATE INDEX IF NOT EXISTS `worker_health_checks_requested_at_idx` ON `worker_health_checks` (`requested_at`);

