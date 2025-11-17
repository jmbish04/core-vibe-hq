-- Drizzle-generated migration for PROJECTS database (vibehq-projects)
-- Tables: project_overview_cards, project_requirements

CREATE TABLE IF NOT EXISTS `project_overview_cards` (
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
CREATE INDEX IF NOT EXISTS `project_overview_cards_project_id_idx` ON `project_overview_cards` (`project_id`);
CREATE INDEX IF NOT EXISTS `project_overview_cards_conversation_id_idx` ON `project_overview_cards` (`conversation_id`);
CREATE INDEX IF NOT EXISTS `project_overview_cards_version_idx` ON `project_overview_cards` (`version`);
CREATE TABLE IF NOT EXISTS `project_requirements` (
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
CREATE INDEX IF NOT EXISTS `project_requirements_project_id_idx` ON `project_requirements` (`project_id`);
CREATE INDEX IF NOT EXISTS `project_requirements_version_idx` ON `project_requirements` (`version`);
CREATE INDEX IF NOT EXISTS `project_requirements_section_idx` ON `project_requirements` (`section`);
CREATE INDEX IF NOT EXISTS `project_requirements_conversation_id_idx` ON `project_requirements` (`conversation_id`);
CREATE INDEX IF NOT EXISTS `project_requirements_created_at_idx` ON `project_requirements` (`created_at`);

