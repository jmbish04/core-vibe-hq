# Documentation Overview

This directory contains all project documentation. Use this file as a table of contents to find the documentation you need.

## Core Documentation

### [Agent Instructions](./development/agent-instructions.md)
**Description**: **CRITICAL** - Rules and patterns for agent development, database architecture, service bindings, and code organization. **READ THIS FIRST** when developing new features. Contains rules about D1 access patterns, Drizzle/Kysely usage, documentation standards, and GitHub Actions workflow requirements.

### [Repository Structure Reference](./REPO_STRUCTURE_REFERENCE.md)
**Description**: Master reference for repository directory structure. Defines where shared code, factory templates, worker code, and migrations should be located. Critical for Task Master and code generation.

## Development

### [Container Migration Checklist](./development/CONTAINER_MIGRATION_CHECKLIST.md)
**Description**: Detailed migration checklist for copying Vibe SDK container infrastructure to @shared. Includes source→destination mapping, import path adjustments, schema updates for orchestrator D1, and verification steps.

### [Base Container Actor Implementation](./development/IMPLEMENT_BASE_CONTAINER_ACTOR.md)
**Description**: Implementation prompt for BaseContainerActor class that extends Cloudflare Actors framework. Includes lifecycle hooks, storage SQL helpers, alarms helper, and example migration for UserAppSandboxService.

### [Taskmaster Rules Setup](./development/TASKMASTER_RULES_SETUP.md)
**Description**: Guide for setting up and configuring Taskmaster rules for the project.

### [STAGING Patterns Adapted](./development/STAGING_PATTERNS_ADAPTED.md)
**Description**: Documentation of patterns adapted from STAGING folder during migration.

### [Production Status Report](./development/PRODUCTION_STATUS.md)
**Description**: **CRITICAL** - Comprehensive production readiness assessment, blockers, task status, and recommended next steps. Updated regularly to track progress toward production deployment.

### [PartyKit Production Readiness Plan](./development/PARTYKIT_PRODUCTION_READINESS_PLAN.md)
**Description**: **CRITICAL** - Master execution plan for wrapping up Vibecode and shipping to production with PartyKit real-time features. Includes TLDR explaining why we spec'd this out and what it delivers, immediate actions (dependency fixes, lint cleanup), implementation checkpoints (Scheduled Automation, AI Provider Enablement, Extended Services), PartyServer/Partysocket integration strategy, risks assessment, and human-in-the-loop considerations. Use this as the master execution guide for Codex and Cursor agents.

### [Testing Playbook](./development/testing-playbook.md)
**Description**: **CRITICAL** - Comprehensive testing strategies, backup plans, and recovery procedures for release hardening. Includes test execution checklists, blocker resolution (e.g., Rollup binary issues), CI/CD integration, and emergency procedures.

### [Continuous Improvement System](./development/continuous-improvement.md)
**Description**: Framework for systematic analysis of bug patterns, tracking fix metrics, and implementing preventive improvements. Includes automation scripts, improvement backlog management, and success measurement.

### [Improvement Backlog](./development/improvement-backlog.md)
**Description**: Prioritized list of identified improvement opportunities with status tracking, success metrics, and implementation timelines.

### [Release Hardening Report](./development/RELEASE_HARDENING_REPORT.md)
**Description**: **CRITICAL** - Final pre-production audit results covering testing infrastructure, D1 database isolation, ORM surface area, and remediation plans. Includes go/no-go recommendations and post-deployment roadmap.

### [Factory Orchestrator Tool](./development/factory-orchestrator-tool.md)
**Description**: Migration guide for the TypeScript-based factory orchestrator CLI. Covers available commands, usage examples, and integration details for factory agents and container environments.

### AI Integration

### [AI Integration Plan](./development/AI_INTEGRATION_PLAN.md)
**Description**: Comprehensive plan for integrating AI demos, packages, tools, and utilities into shared base worker. Includes load balancer for container lifecycle management, task queue system for orchestrator task assignment, database schema updates, and service binding requirements.

### [AI Integration Summary](./development/AI_INTEGRATION_SUMMARY.md)
**Description**: Quick reference summary of AI integration requirements, key components, and task updates.

### [Task 34 AI Update](./development/TASK_34_AI_UPDATE.md)
**Description**: Detailed update instructions for Task 34 migration script to include AI components, load balancer, and task queue integration.

## Architecture

### [Mission Control Integration Map](./architecture/mission-control-integration.md)
**Description**: Architecture and integration mapping for the Mission Control system.

### [Vibe SDK Explained](./architecture/vibesdk-explained.md)
**Description**: Explanation of the Vibe SDK architecture and components.

### [Vibe SDK Flow Analysis](./architecture/vibesdk-flow-analysis.html)
**Description**: HTML visualization of the Vibe SDK flow and architecture.

### [Container Requirements](./architecture/CONTAINER_REQUIREMENTS.md)
**Description**: Comprehensive requirements for factory and specialist worker containers based on Vibe SDK infrastructure. Includes process monitoring, terminal integration (xterm.js), WebSocket communication, and container configuration specifications.

### [Container Architecture Updates](./architecture/CONTAINER_ARCHITECTURE_UPDATES.md)
**Description**: Summary of all critical architecture updates and requirements. Includes monitoring system multi-API support, database architecture (orchestrator-only D1), service binding patterns, health checks, and task update summaries.

### [Actors Framework Recommendations](./architecture/ACTORS_RECOMMENDATIONS.md)
**Description**: Recommendations for using Cloudflare Actors framework patterns beyond containers. Includes DORateLimitStore migration, CodeGeneratorAgent evaluation, task queue management, and WebSocket connection management. Prioritized by value and effort.

### [Agents SDK Migration Recommendations](./architecture/AGENTS_SDK_MIGRATION_RECOMMENDATIONS.md)
**Description**: Comprehensive analysis of migrating to Cloudflare's Agents SDK. Split by apps/base (vibesdk base template) and orchestrator worker. Includes migration patterns, benefits analysis, implementation priorities, and checklists for SimpleCodeGeneratorAgent, specialized agents (SandboxAgent, DebuggerAgent, DeploymentAgent), and new agent opportunities (AnalyticsAgent, GuardrailAgent, UserFeedbackAgent).

## Database

### [Database Migrations](./database/migrations.md)
**Description**: Database migration strategy, Drizzle ORM usage, migration workflow, and schema management. All migrations are consolidated in `orchestrator/migrations/` and generated automatically from Drizzle schemas.

## Migration

### [STAGING Migration Summary](./migration/STAGING_MIGRATION_SUMMARY.md)
**Description**: Comprehensive summary of STAGING folder migration strategy. Includes file inventory grouped by source folder, Python migration script approach, continuous merge strategy, standardized AI task patterns, efficiency analysis, and three improvement options with ROI calculations.

## Templates

### [Template Reorganization Plan](./templates/TEMPLATE_REORGANIZATION_PLAN.md)
**Description**: Original plan for reorganizing templates from STAGING and vibesdk-templates into factory-specific directories. Includes target structure, migration steps, and execution order.

### [Template Reorganization Summary](./templates/TEMPLATE_REORGANIZATION_SUMMARY.md)
**Description**: Complete summary of template reorganization. Includes final statistics (2,514 files organized), directory structure created, what was moved to each factory, Template CLI integration, and next steps.

### [Template CLI Integration](./templates/TEMPLATE_CLI_INTEGRATION.md)
**Description**: Guide for leveraging Cloudflare Templates CLI for template management. Includes available commands (lint, validate, generate lockfiles), integration strategies, usage examples, and CI/CD integration recommendations.

### [Template Reorganization Complete](./templates/TEMPLATE_REORGANIZATION_COMPLETE.md)
**Description**: Detailed completion report with statistics, what was moved, files created, and remaining items to add (vectorize, embeddings, RAG patterns, etc.).

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

## Orchestrator

### [GitHub Integration](./orchestrator/integrations/github.md)
**Description**: Documentation for GitHub integration in the orchestrator worker.

## Contracts

### [Contracts README](./contracts/README.md)
**Description**: Documentation for contract definitions and usage.

## Debriefs

### [Summary](./debriefs/summary.md)
**Description**: Project debrief summaries and retrospectives.

## Site Artifacts

### [Factory Architecture](./site_artifacts/factory_architecture.html)
**Description**: HTML visualization of factory architecture.

### [SaaS Landing](./site_artifacts/saas_landing.html)
**Description**: SaaS landing page artifacts.

### [System Architecture](./site_artifacts/system_architecture.html)
**Description**: HTML visualization of system architecture.

## Adding New Documentation

When creating new documentation:

1. Create the markdown file in the appropriate category folder under `docs/`:
   - `docs/development/` - Development guides, migration checklists, implementation guides, and tool setup
   - `docs/architecture/` - Architecture documentation, requirements, recommendations, and integration maps
   - `docs/database/` - Database-related documentation
   - `docs/migration/` - Migration-specific documentation and strategies
   - `docs/templates/` - Template management and reorganization documentation
   - `docs/monitoring/` - Monitoring, health checks, and observability
   - `docs/client/` - Client libraries and API documentation
   - `docs/orchestrator/` - Orchestrator-specific documentation
   - `docs/contracts/` - Contract definitions and usage
   - `docs/debriefs/` - Project debriefs and retrospectives
2. Add an entry to this `OVERVIEW.md` file with:
   - **File**: `docs/category/filename.md`
   - **Description**: Brief description of what the document covers

**Do NOT**:
- Create documentation in subdirectories outside `docs/` (e.g., `orchestrator/migrations/README.md`)
- Move main `README.md` or `OVERVIEW.md` from docs root
- Create documentation outside the `docs/` folder
