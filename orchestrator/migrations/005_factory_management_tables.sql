-- Migration: Factory Management Tables
-- Adds Kysely schema tables for factory management

CREATE TABLE IF NOT EXISTS factories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS factories_name_idx ON factories(name);
CREATE INDEX IF NOT EXISTS factories_active_idx ON factories(active);

CREATE TABLE IF NOT EXISTS container_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factory_name TEXT NOT NULL UNIQUE,
  dockerfile_path TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS container_settings_factory_name_idx ON container_settings(factory_name);

-- Note: operation_logs table should already exist from previous migrations
-- This is just a note for reference




