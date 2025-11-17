CREATE TABLE `ai_provider_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`question` text NOT NULL,
	`response` text,
	`solution` text,
	`status` text DEFAULT 'open',
	`hil_triggered` integer DEFAULT false,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `ai_provider_conversations_order_id_idx` ON `ai_provider_conversations` (`order_id`);--> statement-breakpoint
CREATE INDEX `ai_provider_conversations_conversation_id_idx` ON `ai_provider_conversations` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `ai_provider_conversations_provider_name_idx` ON `ai_provider_conversations` (`provider_name`);--> statement-breakpoint
CREATE INDEX `ai_provider_conversations_status_idx` ON `ai_provider_conversations` (`status`);--> statement-breakpoint
CREATE INDEX `ai_provider_conversations_created_at_idx` ON `ai_provider_conversations` (`created_at`);--> statement-breakpoint
CREATE TABLE `hil_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`question` text NOT NULL,
	`context` text,
	`status` text DEFAULT 'pending',
	`user_response` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `hil_requests_order_id_idx` ON `hil_requests` (`order_id`);--> statement-breakpoint
CREATE INDEX `hil_requests_conversation_id_idx` ON `hil_requests` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `hil_requests_status_idx` ON `hil_requests` (`status`);--> statement-breakpoint
CREATE INDEX `hil_requests_created_at_idx` ON `hil_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `order_placeholder_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`project_id` text,
	`template_file_id` integer NOT NULL,
	`placeholder_id` text NOT NULL,
	`mini_prompt` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`template_file_id`) REFERENCES `template_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_placeholder_mappings_order_id_idx` ON `order_placeholder_mappings` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_placeholder_mappings_project_id_idx` ON `order_placeholder_mappings` (`project_id`);--> statement-breakpoint
CREATE INDEX `order_placeholder_mappings_template_file_id_idx` ON `order_placeholder_mappings` (`template_file_id`);--> statement-breakpoint
CREATE INDEX `order_placeholder_mappings_order_placeholder_idx` ON `order_placeholder_mappings` (`order_id`,`placeholder_id`);--> statement-breakpoint
CREATE INDEX `order_placeholder_mappings_created_at_idx` ON `order_placeholder_mappings` (`created_at`);--> statement-breakpoint
CREATE TABLE `template_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_name` text NOT NULL,
	`template_name` text NOT NULL,
	`file_path` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `template_files_factory_template_idx` ON `template_files` (`factory_name`,`template_name`);--> statement-breakpoint
CREATE INDEX `template_files_file_path_idx` ON `template_files` (`file_path`);--> statement-breakpoint
CREATE INDEX `template_files_is_active_idx` ON `template_files` (`is_active`);--> statement-breakpoint
CREATE INDEX `template_files_created_at_idx` ON `template_files` (`created_at`);--> statement-breakpoint
CREATE TABLE `template_placeholders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_file_id` integer NOT NULL,
	`placeholder_id` text NOT NULL,
	`placeholder_pattern` text NOT NULL,
	`mini_prompt` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`template_file_id`) REFERENCES `template_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `template_placeholders_template_file_id_idx` ON `template_placeholders` (`template_file_id`);--> statement-breakpoint
CREATE INDEX `template_placeholders_placeholder_id_idx` ON `template_placeholders` (`placeholder_id`);--> statement-breakpoint
CREATE INDEX `template_placeholders_is_active_idx` ON `template_placeholders` (`is_active`);--> statement-breakpoint
CREATE INDEX `template_placeholders_created_at_idx` ON `template_placeholders` (`created_at`);