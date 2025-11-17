CREATE TABLE `container_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worker_name` text NOT NULL,
	`container_name` text,
	`instance_id` text NOT NULL,
	`process_id` text NOT NULL,
	`error_hash` text NOT NULL,
	`timestamp` text NOT NULL,
	`level` integer NOT NULL,
	`message` text NOT NULL,
	`raw_output` text NOT NULL,
	`occurrence_count` integer DEFAULT 1,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `container_errors_worker_container_idx` ON `container_errors` (`worker_name`,`container_name`);--> statement-breakpoint
CREATE INDEX `container_errors_instance_id_idx` ON `container_errors` (`instance_id`);--> statement-breakpoint
CREATE INDEX `container_errors_process_id_idx` ON `container_errors` (`process_id`);--> statement-breakpoint
CREATE INDEX `container_errors_error_hash_idx` ON `container_errors` (`error_hash`);--> statement-breakpoint
CREATE INDEX `container_errors_created_at_idx` ON `container_errors` (`created_at`);--> statement-breakpoint
CREATE TABLE `container_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worker_name` text NOT NULL,
	`container_name` text,
	`instance_id` text NOT NULL,
	`process_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`timestamp` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`stream` text NOT NULL,
	`source` text,
	`metadata` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `container_logs_worker_container_idx` ON `container_logs` (`worker_name`,`container_name`);--> statement-breakpoint
CREATE INDEX `container_logs_instance_id_idx` ON `container_logs` (`instance_id`);--> statement-breakpoint
CREATE INDEX `container_logs_process_id_idx` ON `container_logs` (`process_id`);--> statement-breakpoint
CREATE INDEX `container_logs_timestamp_idx` ON `container_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `container_logs_created_at_idx` ON `container_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `container_logs_instance_sequence_idx` ON `container_logs` (`instance_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `container_processes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worker_name` text NOT NULL,
	`container_name` text,
	`instance_id` text NOT NULL,
	`process_id` text,
	`command` text NOT NULL,
	`args` text,
	`cwd` text NOT NULL,
	`status` text DEFAULT 'starting' NOT NULL,
	`restart_count` integer DEFAULT 0,
	`start_time` integer,
	`end_time` integer,
	`exit_code` integer,
	`last_error` text,
	`env` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `container_processes_instance_id_unique` ON `container_processes` (`instance_id`);--> statement-breakpoint
CREATE INDEX `container_processes_worker_container_idx` ON `container_processes` (`worker_name`,`container_name`);--> statement-breakpoint
CREATE INDEX `container_processes_instance_id_idx` ON `container_processes` (`instance_id`);--> statement-breakpoint
CREATE INDEX `container_processes_status_idx` ON `container_processes` (`status`);--> statement-breakpoint
CREATE INDEX `container_processes_created_at_idx` ON `container_processes` (`created_at`);--> statement-breakpoint
CREATE INDEX `container_processes_updated_at_idx` ON `container_processes` (`updated_at`);