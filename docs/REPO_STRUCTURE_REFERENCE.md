# Repository Structure Master Reference

This document defines the canonical directory structure for the VibeHQ codebase. **All code generation, migrations, and file creation MUST follow this structure.**

## Core Directory Structure

```
core-vibe-hq/
├── @shared/                          # ⭐ SHARED CODE - Used by ALL workers
│   ├── base/                         # Base classes and configs
│   │   ├── agents/                   # Base agent classes
│   │   ├── workerEntrypoint.ts       # BaseWorkerEntrypoint class
│   │   └── wrangler.base.jsonc       # Base wrangler config for apps/ workers
│   ├── types/                        # Shared TypeScript types
│   ├── clients/                      # Shared client utilities
│   ├── handlers/                     # Shared request handlers
│   ├── health/                       # Health check utilities
│   ├── contracts/                    # Shared Zod schemas and contracts
│   ├── container/                    # Container monitoring system (from Vibe SDK)
│   ├── container-terminal/           # Terminal integration (from containers-demos)
│   ├── container-websocket/          # WebSocket integration (from containers-demos)
│   ├── container-load-balancer/      # Load balancer (from containers-demos)
│   ├── container-task-queue/         # Task queue system (from containers-demos)
│   ├── worker-base/                  # Worker base templates (from Vibe SDK)
│   │   └── ai/                       # AI demos and capabilities
│   ├── ai-packages/                  # AI provider packages
│   ├── ai-tools/                     # AI CLI tools
│   └── ai-utils/                     # AI utilities (fsm, etc.)
│
├── @shared/                          # ⭐ SHARED CODE - Used by ALL workers
│   ├── factory-templates/            # Factory initialization templates
│   │   ├── factory-base.Dockerfile   # Base Dockerfile for factories
│   │   ├── wrangler.partial.jsonc    # Partial wrangler config template
│   │   └── scripts/                  # Factory init scripts
│
├── orchestrator/                     # Orchestrator worker (root level, NOT in apps/)
│   ├── worker/                       # Orchestrator worker code
│   ├── migrations/                   # Database migrations (ONLY location)
│   └── wrangler.jsonc                # Orchestrator config (independent)
│
├── apps/                             # Independent Cloudflare Workers
│   ├── agent-factory/                # Agent generation worker
│   ├── data-factory/                # Data operations worker
│   ├── services-factory/             # External service proxy worker
│   ├── ui-factory/                   # UI/frontend worker
│   └── ops-specialists/              # Operational specialists
│
├── STAGING/                          # Reference implementations (to be migrated)
│   ├── vibesdk/                      # Vibe SDK reference
│   ├── ai/                           # AI demos reference
│   └── containers-demos/             # Container demos reference
│
└── docs/                             # Documentation (all docs here)
```

## Directory Purpose Definitions

### `@shared/` - Shared Code Library

**Purpose**: Code shared across ALL workers (orchestrator + apps/ workers)

**What goes here**:
- ✅ Base classes (`BaseWorkerEntrypoint`, `BaseAgent`)
- ✅ Shared TypeScript types
- ✅ Shared utilities and clients
- ✅ Container infrastructure (monitoring, terminal, WebSocket)
- ✅ Worker base templates
- ✅ AI packages, tools, and utilities
- ✅ Shared wrangler base config

**What does NOT go here**:
- ❌ Worker-specific code
- ❌ Orchestrator-specific code (use `orchestrator/` instead)

**Note**: Factory templates ARE in `@shared/` under `@shared/factory-templates/`

**Import pattern**: `import { ... } from '@shared/[module]/[file]'`

### `@shared/factory-templates/` - Factory Initialization Templates

**Purpose**: Templates and configs for INITIALIZING new factories

**What goes here**:
- ✅ `factory-base.Dockerfile` - Base Docker image for factories
- ✅ `wrangler.partial.jsonc` - Template wrangler config
- ✅ Factory initialization scripts
- ✅ Factory-specific documentation

**What does NOT go here**:
- ❌ Shared code used at runtime (use other `@shared/` subdirectories instead)
- ❌ Worker base classes (use `@shared/base/` instead)
- ❌ Container infrastructure (use `@shared/container/` instead)

**Usage**: These files are COPIED when creating a new factory, not imported

### `orchestrator/` - Orchestrator Worker

**Purpose**: The orchestrator worker (special, at root level)

**What goes here**:
- ✅ Orchestrator worker code
- ✅ Database schemas and migrations (ONLY location)
- ✅ Orchestrator-specific entrypoints
- ✅ Orchestrator wrangler config (independent, doesn't extend base)

**What does NOT go here**:
- ❌ Shared code (use `@shared/` instead)
- ❌ Factory templates (use `factory/shared/` instead)

### `apps/` - Independent Workers

**Purpose**: Individual Cloudflare Workers deployed separately

**What goes here**:
- ✅ Worker-specific code
- ✅ Worker-specific wrangler.jsonc (extends `@shared/base/wrangler.base.jsonc`)
- ✅ Worker-specific package.json
- ✅ Worker-specific Dockerfile (copied from `@shared/factory-templates/factory-base.Dockerfile`)

**What does NOT go here**:
- ❌ Shared code (use `@shared/` instead)
- ❌ Database migrations (use `orchestrator/migrations/` instead)
- ❌ Orchestrator code (use `orchestrator/` instead)

## Migration Rules

### When Migrating from STAGING

**Container Infrastructure** → `@shared/container/`, `@shared/container-terminal/`, etc.
**Worker Templates** → `@shared/worker-base/`
**AI Components** → `@shared/ai-packages/`, `@shared/worker-base/ai/`
**Frontend Components** → `@shared/frontend/` (if needed)

### When Creating New Shared Code

**Ask**: "Will this be used by multiple workers?"
- **Yes** → `@shared/[category]/`
- **No** → Worker-specific directory (`apps/[worker]/` or `orchestrator/`)

### When Creating Factory Templates

**Ask**: "Is this a template for initializing factories?"
- **Yes** → `@shared/factory-templates/`
- **No** → Other `@shared/` subdirectories (if shared) or worker-specific

## File Creation Rules for Task Master

### Rule 1: Shared Code
- **Location**: `@shared/[category]/[file]`
- **When**: Code used by 2+ workers
- **Examples**: Base classes, types, utilities, container infrastructure

### Rule 2: Factory Templates
- **Location**: `@shared/factory-templates/[file]`
- **When**: Templates for factory initialization
- **Examples**: Dockerfile template, wrangler.partial.jsonc

### Rule 3: Worker-Specific Code
- **Location**: `apps/[worker-name]/[file]` or `orchestrator/[file]`
- **When**: Code specific to one worker
- **Examples**: Worker entrypoint, worker-specific routes

### Rule 4: Database Migrations
- **Location**: `orchestrator/migrations/[file].sql`
- **When**: ANY database schema change
- **Rule**: ONLY location for migrations

### Rule 5: Documentation
- **Location**: `docs/[file].md`
- **When**: ANY documentation
- **Rule**: All docs in `docs/`, update `docs/OVERVIEW.md`

## Common Mistakes

1. ❌ **Creating `factory/shared/`** - Should be `@shared/factory-templates/`
2. ❌ **Creating `apps/shared/`** - Should be `@shared/`
3. ❌ **Creating migrations in `apps/`** - Should be `orchestrator/migrations/`
4. ❌ **Putting shared code outside `@shared/`** - All shared code goes in `@shared/`
5. ❌ **Putting factory templates outside `@shared/`** - Should be `@shared/factory-templates/`

## Quick Decision Tree

```
Is it shared code used by multiple workers?
├─ YES → @shared/[category]/
└─ NO → Is it a factory initialization template?
    ├─ YES → @shared/factory-templates/
    └─ NO → Is it orchestrator-specific?
        ├─ YES → orchestrator/
        └─ NO → apps/[worker-name]/
```

## Verification Checklist

Before creating a file, verify:
- [ ] Location matches purpose (shared vs template vs worker-specific)
- [ ] Import paths use `@shared/` for shared code
- [ ] Factory templates are in `@shared/factory-templates/`
- [ ] Migrations are in `orchestrator/migrations/`
- [ ] Documentation is in `docs/`

