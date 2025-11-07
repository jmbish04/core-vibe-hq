# Documentation Overview

This directory contains all project documentation. Use this file as a table of contents to find the documentation you need.

## Core Documentation

### [Agent Instructions](./development/agent-instructions.md)
**Description**: **CRITICAL** - Rules and patterns for agent development, database architecture, service bindings, and code organization. **READ THIS FIRST** when developing new features. Contains rules about D1 access patterns, Drizzle/Kysely usage, and documentation standards.

### [Database Migrations](./database/migrations.md)
**Description**: Database migration strategy, Drizzle ORM usage, migration workflow, and schema management. All migrations are consolidated in `orchestrator/migrations/` and generated automatically from Drizzle schemas.

## Monitoring & Health

### [Health Check System](./monitoring/health-check-system.md)
**Description**: Comprehensive guide to the health check system for monitoring worker status, unit tests, and system metrics.

### [Health Checks Overview](./monitoring/health-checks.md)
**Description**: Additional health check documentation and implementation details.

## Client & API

### [WebSocket Client](./client/websocket-client.md)
**Description**: Documentation for using the WebSocket client for real-time communication between workers and frontend.

### [Diagnostics](./client/diagnostics.md)
**Description**: Guide to the diagnostics system for worker monitoring and debugging.

## Integration & Architecture

### [Mission Control Integration Map](./architecture/mission-control-integration.md)
**Description**: Architecture and integration mapping for the Mission Control system.

### [Container Requirements](./CONTAINER_REQUIREMENTS.md)
**Description**: Comprehensive requirements for factory and specialist worker containers based on Vibe SDK infrastructure. Includes process monitoring, terminal integration (xterm.js), WebSocket communication, and container configuration specifications.

### [Container Migration Checklist](./CONTAINER_MIGRATION_CHECKLIST.md)
**Description**: Detailed migration checklist for copying Vibe SDK container infrastructure to @shared. Includes source→destination mapping, import path adjustments, schema updates for orchestrator D1, and verification steps.

### [Container Architecture Updates](./CONTAINER_ARCHITECTURE_UPDATES.md)
**Description**: Summary of all critical architecture updates and requirements. Includes monitoring system multi-API support, database architecture (orchestrator-only D1), service binding patterns, health checks, and task update summaries.

### [AI Integration Plan](./AI_INTEGRATION_PLAN.md)
**Description**: Comprehensive plan for integrating AI demos, packages, tools, and utilities into shared base worker. Includes load balancer for container lifecycle management, task queue system for orchestrator task assignment, database schema updates, and service binding requirements.

### [AI Integration Summary](./AI_INTEGRATION_SUMMARY.md)
**Description**: Quick reference summary of AI integration requirements, key components, and task updates.

### [Task 34 AI Update](./TASK_34_AI_UPDATE.md)
**Description**: Detailed update instructions for Task 34 migration script to include AI components, load balancer, and task queue integration.

### [Repository Structure Reference](./REPO_STRUCTURE_REFERENCE.md)
**Description**: Master reference for repository directory structure. Defines where shared code, factory templates, worker code, and migrations should be located. Critical for Task Master and code generation.

### [STAGING Migration Summary](./STAGING_MIGRATION_SUMMARY.md)
**Description**: Comprehensive summary of STAGING folder migration strategy. Includes file inventory grouped by source folder, Python migration script approach, continuous merge strategy, standardized AI task patterns, efficiency analysis, and three improvement options with ROI calculations.

## Adding New Documentation

When creating new documentation:

1. Create the markdown file in the appropriate category folder under `docs/`:
   - `docs/development/` - Development guides and instructions
   - `docs/database/` - Database-related documentation
   - `docs/architecture/` - Architecture and integration docs
   - `docs/monitoring/` - Monitoring, health checks, and observability
   - `docs/client/` - Client libraries and API documentation
2. Add an entry to this `OVERVIEW.md` file with:
   - **File**: `docs/category/filename.md`
   - **Description**: Brief description of what the document covers

**Do NOT**:
- Create documentation in subdirectories outside `docs/` (e.g., `orchestrator/migrations/README.md`)
- Move main `README.md` or `OVERVIEW.md` from docs root
- Create documentation outside the `docs/` folder

