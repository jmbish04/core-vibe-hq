-- Drizzle-generated migration for CHAT database (vibehq-chat-logs)
-- Tables: conversation_logs

CREATE TABLE IF NOT EXISTS `conversation_logs` (
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
CREATE INDEX IF NOT EXISTS `conversation_logs_conversation_id_idx` ON `conversation_logs` (`conversation_id`);
CREATE INDEX IF NOT EXISTS `conversation_logs_project_id_idx` ON `conversation_logs` (`project_id`);
CREATE INDEX IF NOT EXISTS `conversation_logs_user_id_idx` ON `conversation_logs` (`user_id`);
CREATE INDEX IF NOT EXISTS `conversation_logs_agent_name_idx` ON `conversation_logs` (`agent_name`);
CREATE INDEX IF NOT EXISTS `conversation_logs_timestamp_idx` ON `conversation_logs` (`timestamp`);

