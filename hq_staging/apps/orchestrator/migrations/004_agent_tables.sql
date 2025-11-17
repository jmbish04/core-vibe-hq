-- Agent & Project Management Tables
-- Supports versioned requirements, conversation logging, and project overview cards

-- Project Requirements (Versioned)
CREATE TABLE IF NOT EXISTS project_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    requirements TEXT, -- JSON array
    metadata TEXT, -- JSON object
    change_type TEXT, -- 'added', 'modified', 'removed'
    change_reason TEXT,
    agent_name TEXT NOT NULL DEFAULT 'project-clarification',
    conversation_id TEXT,
    user_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS project_requirements_project_id_idx ON project_requirements(project_id);
CREATE INDEX IF NOT EXISTS project_requirements_version_idx ON project_requirements(version);
CREATE INDEX IF NOT EXISTS project_requirements_section_idx ON project_requirements(section);
CREATE INDEX IF NOT EXISTS project_requirements_conversation_id_idx ON project_requirements(conversation_id);
CREATE INDEX IF NOT EXISTS project_requirements_created_at_idx ON project_requirements(created_at);

-- Conversation Logs
CREATE TABLE IF NOT EXISTS conversation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    project_id TEXT,
    user_id TEXT,
    agent_name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'agent'
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    structured_data TEXT, -- JSON object
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    websocket_sent INTEGER DEFAULT 0 -- boolean
);

CREATE INDEX IF NOT EXISTS conversation_logs_conversation_id_idx ON conversation_logs(conversation_id);
CREATE INDEX IF NOT EXISTS conversation_logs_project_id_idx ON conversation_logs(project_id);
CREATE INDEX IF NOT EXISTS conversation_logs_user_id_idx ON conversation_logs(user_id);
CREATE INDEX IF NOT EXISTS conversation_logs_agent_name_idx ON conversation_logs(agent_name);
CREATE INDEX IF NOT EXISTS conversation_logs_timestamp_idx ON conversation_logs(timestamp);

-- Project Overview Cards
CREATE TABLE IF NOT EXISTS project_overview_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sections TEXT NOT NULL, -- JSON array
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS project_overview_cards_project_id_idx ON project_overview_cards(project_id);
CREATE INDEX IF NOT EXISTS project_overview_cards_conversation_id_idx ON project_overview_cards(conversation_id);
CREATE INDEX IF NOT EXISTS project_overview_cards_version_idx ON project_overview_cards(version);

