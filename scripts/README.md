# Scripts Directory

This directory contains utility scripts for managing the core-vibe-hq project.

## Installation & Setup

### `install-all.sh`
Installs dependencies for all workers (orchestrator, factories, specialists).

```bash
npm run install:all
```

## Development

### `dev.sh`
Starts development server for a specific worker.

```bash
npm run dev <worker-name>
# Examples:
npm run dev orchestrator
npm run dev agent-factory
npm run dev conflict-specialist
```

### `run-problems.sh`
Runs comprehensive problem check (TypeScript, linting, Wrangler types) and logs to `problems.log`.

```bash
npm run problems
```

### `analyze-problems.ts`
Analyzes problems.log using AI to create a categorized checklist.

```bash
npm run analyze-problems
```

## Code Quality

### `types-all.sh`
Generates Wrangler types for all workers.

```bash
npm run types:all
```

### `typecheck-all.sh`
Runs TypeScript type checking for all workers.

```bash
npm run typecheck:all
```

### `lint-all.sh`
Runs linting for all workers.

```bash
npm run lint:all
```

## Deployment

### `deploy.sh`
Deploys worker(s) to Cloudflare.

```bash
# Deploy all workers
npm run deploy:all
# or
npm run deploy all

# Deploy specific worker
npm run deploy <worker-name>
# Examples:
npm run deploy orchestrator
npm run deploy agent-factory
npm run deploy conflict-specialist
```

## Maintenance

### `update-wrangler.sh`
Updates Wrangler version across all workers.

```bash
npm run update:wrangler
```

## Worker Generation

### `create-worker.ts`
Creates a new factory or specialist worker with proper structure.

```bash
# Create a new factory
npm run create-worker factory <name>
# Example:
npm run create-worker factory analytics

# Create a new specialist
npm run create-worker specialist <name>
# Example:
npm run create-worker specialist monitoring
```

**What it creates:**
- Worker directory structure (`apps/<name>-factory` or `apps/ops-specialists/<name>-specialist`)
- `wrangler.jsonc` based on shared config
- `worker/index.ts` with basic structure
- `package.json` with dependencies
- `tsconfig.json` for TypeScript
- GitHub Actions deploy workflow (`.github/workflows/deploy-<name>.yml`)

**Features:**
- Automatically uses `@shared/base/wrangler.base.jsonc`
- Sets up proper service bindings to orchestrator
- Assigns unique dev port
- Creates deploy workflow automatically

## Script Files

All scripts are executable and can be run directly:

```bash
bash scripts/<script-name>.sh
# or
tsx scripts/<script-name>.ts
```

