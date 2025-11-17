CREATE TABLE `container_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_name` text NOT NULL,
	`dockerfile_path` text NOT NULL,
	`json` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `container_settings_factory_name_unique` ON `container_settings` (`factory_name`);--> statement-breakpoint
CREATE INDEX `container_settings_factory_name_idx` ON `container_settings` (`factory_name`);--> statement-breakpoint
CREATE TABLE `factories` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `factories_name_unique` ON `factories` (`name`);--> statement-breakpoint
CREATE INDEX `factories_name_idx` ON `factories` (`name`);--> statement-breakpoint
CREATE INDEX `factories_active_idx` ON `factories` (`active`);--> statement-breakpoint
CREATE TABLE `followups` (
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
--> statement-breakpoint
CREATE INDEX `followups_order_id_idx` ON `followups` (`order_id`);--> statement-breakpoint
CREATE INDEX `followups_task_uuid_idx` ON `followups` (`task_uuid`);--> statement-breakpoint
CREATE INDEX `followups_status_idx` ON `followups` (`status`);--> statement-breakpoint
CREATE INDEX `followups_type_idx` ON `followups` (`type`);--> statement-breakpoint
CREATE INDEX `followups_created_at_idx` ON `followups` (`created_at`);--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`order_id` text,
	`task_uuid` text,
	`operation` text NOT NULL,
	`level` text NOT NULL,
	`details` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `operation_logs_source_idx` ON `operation_logs` (`source`);--> statement-breakpoint
CREATE INDEX `operation_logs_order_id_idx` ON `operation_logs` (`order_id`);--> statement-breakpoint
CREATE INDEX `operation_logs_task_uuid_idx` ON `operation_logs` (`task_uuid`);--> statement-breakpoint
CREATE INDEX `operation_logs_operation_idx` ON `operation_logs` (`operation`);--> statement-breakpoint
CREATE INDEX `operation_logs_level_idx` ON `operation_logs` (`level`);--> statement-breakpoint
CREATE INDEX `operation_logs_created_at_idx` ON `operation_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `ops_conflict_resolutions` (
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
--> statement-breakpoint
CREATE INDEX `ops_conflict_resolutions_repo_pr_idx` ON `ops_conflict_resolutions` (`repo`,`pr_number`);--> statement-breakpoint
CREATE INDEX `ops_conflict_resolutions_status_idx` ON `ops_conflict_resolutions` (`status`);--> statement-breakpoint
CREATE INDEX `ops_conflict_resolutions_created_at_idx` ON `ops_conflict_resolutions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ops_conflict_resolutions_repo_pr_branch_unique` ON `ops_conflict_resolutions` (`repo`,`pr_number`,`head_branch`);--> statement-breakpoint
CREATE TABLE `ops_delivery_reports` (
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
--> statement-breakpoint
CREATE INDEX `ops_delivery_reports_project_id_idx` ON `ops_delivery_reports` (`project_id`);--> statement-breakpoint
CREATE INDEX `ops_delivery_reports_status_idx` ON `ops_delivery_reports` (`status`);--> statement-breakpoint
CREATE INDEX `ops_delivery_reports_created_at_idx` ON `ops_delivery_reports` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ops_delivery_reports_project_phase_version_unique` ON `ops_delivery_reports` (`project_id`,`phase`,`version`);--> statement-breakpoint
CREATE TABLE `ops_orders` (
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
--> statement-breakpoint
CREATE INDEX `ops_orders_type_status_idx` ON `ops_orders` (`order_type`,`status`);--> statement-breakpoint
CREATE INDEX `ops_orders_created_at_idx` ON `ops_orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `project_overview_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`sections` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `project_overview_cards_project_id_idx` ON `project_overview_cards` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_overview_cards_conversation_id_idx` ON `project_overview_cards` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `project_overview_cards_version_idx` ON `project_overview_cards` (`version`);--> statement-breakpoint
CREATE TABLE `project_requirements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`version` integer NOT NULL,
	`section` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`requirements` text,
	`metadata` text,
	`change_type` text,
	`change_reason` text,
	`agent_name` text DEFAULT 'project-clarification' NOT NULL,
	`conversation_id` text,
	`user_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `project_requirements_project_id_idx` ON `project_requirements` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_requirements_version_idx` ON `project_requirements` (`version`);--> statement-breakpoint
CREATE INDEX `project_requirements_section_idx` ON `project_requirements` (`section`);--> statement-breakpoint
CREATE INDEX `project_requirements_conversation_id_idx` ON `project_requirements` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `project_requirements_created_at_idx` ON `project_requirements` (`created_at`);--> statement-breakpoint
CREATE TABLE `conversation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`project_id` text,
	`user_id` text,
	`agent_name` text NOT NULL,
	`role` text NOT NULL,
	`message` text NOT NULL,
	`message_type` text DEFAULT 'text',
	`structured_data` text,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP,
	`websocket_sent` integer DEFAULT false
);
--> statement-breakpoint
CREATE INDEX `conversation_logs_conversation_id_idx` ON `conversation_logs` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `conversation_logs_project_id_idx` ON `conversation_logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `conversation_logs_user_id_idx` ON `conversation_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `conversation_logs_agent_name_idx` ON `conversation_logs` (`agent_name`);--> statement-breakpoint
CREATE INDEX `conversation_logs_timestamp_idx` ON `conversation_logs` (`timestamp`);--> statement-breakpoint
CREATE TABLE `health_check_schedules` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `health_check_schedules_name_unique` ON `health_check_schedules` (`name`);--> statement-breakpoint
CREATE INDEX `health_check_schedules_name_idx` ON `health_check_schedules` (`name`);--> statement-breakpoint
CREATE TABLE `health_checks` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `health_checks_health_check_uuid_unique` ON `health_checks` (`health_check_uuid`);--> statement-breakpoint
CREATE INDEX `health_checks_uuid_idx` ON `health_checks` (`health_check_uuid`);--> statement-breakpoint
CREATE INDEX `health_checks_trigger_idx` ON `health_checks` (`trigger_type`,`started_at`);--> statement-breakpoint
CREATE INDEX `health_checks_status_idx` ON `health_checks` (`status`);--> statement-breakpoint
CREATE INDEX `health_checks_created_at_idx` ON `health_checks` (`created_at`);--> statement-breakpoint
CREATE TABLE `worker_health_checks` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `worker_health_checks_worker_check_uuid_unique` ON `worker_health_checks` (`worker_check_uuid`);--> statement-breakpoint
CREATE INDEX `worker_health_checks_uuid_idx` ON `worker_health_checks` (`worker_check_uuid`);--> statement-breakpoint
CREATE INDEX `worker_health_checks_health_uuid_idx` ON `worker_health_checks` (`health_check_uuid`);--> statement-breakpoint
CREATE INDEX `worker_health_checks_worker_idx` ON `worker_health_checks` (`worker_name`,`worker_type`);--> statement-breakpoint
CREATE INDEX `worker_health_checks_status_idx` ON `worker_health_checks` (`status`);--> statement-breakpoint
CREATE INDEX `worker_health_checks_overall_status_idx` ON `worker_health_checks` (`overall_status`);--> statement-breakpoint
CREATE INDEX `worker_health_checks_requested_at_idx` ON `worker_health_checks` (`requested_at`);