-- Drizzle-generated migration for OPS database (vibehq-ops)
-- Tables: container_settings, factories, followups, operation_logs, ops_conflict_resolutions, ops_delivery_reports, ops_orders

CREATE TABLE IF NOT EXISTS `container_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_name` text NOT NULL,
	`dockerfile_path` text NOT NULL,
	`json` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS `container_settings_factory_name_unique` ON `container_settings` (`factory_name`);
CREATE INDEX IF NOT EXISTS `container_settings_factory_name_idx` ON `container_settings` (`factory_name`);
CREATE TABLE IF NOT EXISTS `factories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`repo_owner` text NOT NULL,
	`repo_name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
	`active` integer DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS `factories_name_unique` ON `factories` (`name`);
CREATE INDEX IF NOT EXISTS `factories_name_idx` ON `factories` (`name`);
CREATE INDEX IF NOT EXISTS `factories_active_idx` ON `factories` (`active`);
CREATE TABLE IF NOT EXISTS `followups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text,
	`task_uuid` text,
	`type` text NOT NULL,
	`impact_level` integer DEFAULT 1,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text,
	`data` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	`resolved_at` integer
);
CREATE INDEX IF NOT EXISTS `followups_order_id_idx` ON `followups` (`order_id`);
CREATE INDEX IF NOT EXISTS `followups_task_uuid_idx` ON `followups` (`task_uuid`);
CREATE INDEX IF NOT EXISTS `followups_status_idx` ON `followups` (`status`);
CREATE INDEX IF NOT EXISTS `followups_type_idx` ON `followups` (`type`);
CREATE INDEX IF NOT EXISTS `followups_created_at_idx` ON `followups` (`created_at`);
CREATE TABLE IF NOT EXISTS `operation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`order_id` text,
	`task_uuid` text,
	`operation` text NOT NULL,
	`level` text NOT NULL,
	`details` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS `operation_logs_source_idx` ON `operation_logs` (`source`);
CREATE INDEX IF NOT EXISTS `operation_logs_order_id_idx` ON `operation_logs` (`order_id`);
CREATE INDEX IF NOT EXISTS `operation_logs_task_uuid_idx` ON `operation_logs` (`task_uuid`);
CREATE INDEX IF NOT EXISTS `operation_logs_operation_idx` ON `operation_logs` (`operation`);
CREATE INDEX IF NOT EXISTS `operation_logs_level_idx` ON `operation_logs` (`level`);
CREATE INDEX IF NOT EXISTS `operation_logs_created_at_idx` ON `operation_logs` (`created_at`);
CREATE TABLE IF NOT EXISTS `ops_conflict_resolutions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo` text NOT NULL,
	`pr_number` integer NOT NULL,
	`base_branch` text NOT NULL,
	`head_branch` text NOT NULL,
	`files_resolved` integer DEFAULT 0,
	`conflicts_kept_both` integer DEFAULT 0,
	`conflicts_deleted` integer DEFAULT 0,
	`decision_log` text,
	`resolution_branch` text,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`resolved_at` integer
);
CREATE INDEX IF NOT EXISTS `ops_conflict_resolutions_repo_pr_idx` ON `ops_conflict_resolutions` (`repo`,`pr_number`);
CREATE INDEX IF NOT EXISTS `ops_conflict_resolutions_status_idx` ON `ops_conflict_resolutions` (`status`);
CREATE INDEX IF NOT EXISTS `ops_conflict_resolutions_created_at_idx` ON `ops_conflict_resolutions` (`created_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `ops_conflict_resolutions_repo_pr_branch_unique` ON `ops_conflict_resolutions` (`repo`,`pr_number`,`head_branch`);
CREATE TABLE IF NOT EXISTS `ops_delivery_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`phase` text,
	`compliance_score` real DEFAULT 0,
	`summary` text,
	`issues` text,
	`recommendations` text,
	`original_order_spec` text,
	`final_code_diff` text,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`completed_at` integer,
	`version` text DEFAULT '1.0'
);
CREATE INDEX IF NOT EXISTS `ops_delivery_reports_project_id_idx` ON `ops_delivery_reports` (`project_id`);
CREATE INDEX IF NOT EXISTS `ops_delivery_reports_status_idx` ON `ops_delivery_reports` (`status`);
CREATE INDEX IF NOT EXISTS `ops_delivery_reports_created_at_idx` ON `ops_delivery_reports` (`created_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `ops_delivery_reports_project_phase_version_unique` ON `ops_delivery_reports` (`project_id`,`phase`,`version`);
CREATE TABLE IF NOT EXISTS `ops_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_type` text NOT NULL,
	`order_payload` text NOT NULL,
	`status` text DEFAULT 'pending',
	`assigned_specialist` text,
	`result` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`processed_at` integer,
	`completed_at` integer
);
CREATE INDEX IF NOT EXISTS `ops_orders_type_status_idx` ON `ops_orders` (`order_type`,`status`);
CREATE INDEX IF NOT EXISTS `ops_orders_created_at_idx` ON `ops_orders` (`created_at`);
