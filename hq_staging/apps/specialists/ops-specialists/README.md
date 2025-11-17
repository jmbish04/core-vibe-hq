# Mission Control Ops Specialists

Automated operational specialists for Mission Control's distributed factory system.

## Overview

The Ops Layer provides automated conflict resolution, delivery verification, and operational reporting to maintain system stability and quality across parallel factory operations.

## Specialists

### 1. Conflict Specialist (`conflict-specialist/`)

**Purpose**: Automatically resolve Git merge conflicts between overlapping factory PRs.

**Features**:
- Detects merge conflicts in PRs
- Uses AI to intelligently resolve conflicts
- Preserves environment variables and configuration (keep-both strategy)
- Creates resolution branches and updates PRs
- Logs all resolutions to D1 for audit trail

**API Endpoints**:
- `POST /resolve` - Resolve conflicts for a PR
- `GET /status/:id` - Get status of a conflict resolution

**Usage**:
```json
POST /resolve
{
  "type": "conflict-resolution",
  "repo": "mission-control/ui-factory",
  "base_branch": "main",
  "head_branch": "feature/agent-factory-XYZ",
  "pr_number": 72,
  "github_token": "optional-override"
}
```

### 2. Delivery Report Specialist (`delivery-report-specialist/`)

**Purpose**: AI-powered verification that final system matches original specifications.

**Features**:
- Compares final merged code to original order requirements
- Evaluates functional, UI, and data compliance
- Generates structured reports with issues and recommendations
- Versioned reports for tracking over time
- Stores reports in D1 for UI display

**API Endpoints**:
- `POST /generate` - Generate delivery report
- `GET /report/:projectId` - Get latest report for project
- `GET /reports/:projectId` - Get all reports for project

**Usage**:
```json
POST /generate
{
  "type": "delivery-report",
  "project_id": "project-123",
  "phase": "v1.0",
  "original_order_spec": "Build a user dashboard...",
  "factory_logs": [
    {
      "factory_name": "agent-factory",
      "logs": "...",
      "pr_number": 72
    }
  ]
}
```

## Database Schema

See `migrations/001_ops_tables.sql` for the complete schema.

### Tables

- `ops_conflict_resolutions` - Audit trail of all conflict resolutions
- `ops_delivery_reports` - Versioned delivery verification reports
- `ops_orders` - Queue of operational orders from Orchestrator

## Database Setup

The ops tables are part of the shared `mission-control-data` D1 database. Run migrations:

```bash
# Apply ops migrations to shared DB
cd apps/ops-specialists
wrangler d1 migrations apply DB --remote
```

Or use the data-factory workflow which already handles migrations.

## Deployment

Each specialist is deployed as a separate Cloudflare Worker:

```bash
# Deploy Conflict Specialist
cd apps/ops-specialists/conflict-specialist
npm run deploy

# Deploy Delivery Report Specialist
cd apps/ops-specialists/delivery-report-specialist
npm run deploy
```

Or use the GitHub Actions workflow: `deploy-ops-specialists.yml`

**Note**: Both specialists use the same `DB` binding pointing to `mission-control-data` D1 instance.

## Configuration

### Required Bindings

Both specialists share the same D1 database:

**Conflict Specialist**:
- `DB` - Shared D1 database (mission-control-data) for conflict resolution logs
- `AI` - Cloudflare AI binding
- `GITHUB_TOKEN` - GitHub API token (can be passed in order)
- `ORCHESTRATOR` - Service binding to Orchestrator

**Delivery Report Specialist**:
- `DB` - Shared D1 database (mission-control-data) for reports and factory logs
- `AI` - Cloudflare AI binding
- `ORCHESTRATOR` - Service binding to Orchestrator

## Future Specialists

- **Rollback Specialist** - Reverts bad merges or failed builds
- **Metrics Specialist** - Summarizes repo activity & token usage
- **Test Specialist** - Auto-runs or regenerates tests
- **Security Specialist** - Scans generated code for credentials

## Architecture

```
Orchestrator
    │
    ├─→ Factories (Agent, UI, Data, Services)
    │
    └─→ Ops Specialists
           ├─→ Conflict Specialist
           ├─→ Delivery Report Specialist
           └─→ Future Specialists...
```

All operations are logged to D1 for full traceability and audit.

