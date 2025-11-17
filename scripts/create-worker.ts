#!/usr/bin/env tsx
/**
 * Worker Generator Script
 * 
 * Creates a new app/factory or ops-specialist worker with proper structure,
 * wrangler.jsonc based on shared config, and reusable components.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface WorkerConfig {
  name: string;
  type: 'factory' | 'specialist';
  port: number;
  description: string;
  vars?: Record<string, string>;
}

const WORKER_TYPES = {
  factory: {
    path: 'apps',
    basePort: 8788,
    wranglerRef: '../../@shared/base/wrangler.base.jsonc',
  },
  specialist: {
    path: 'apps/ops-specialists',
    basePort: 8792,
    wranglerRef: '../../../@shared/base/wrangler.base.jsonc',
  },
};

/**
 * Get next available port by scanning existing workers
 */
function getNextPort(type: 'factory' | 'specialist', basePort: number): number {
  const ports: number[] = [];
  
  // Scan factories
  if (existsSync('apps')) {
    try {
      const factories = readdirSync('apps', { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.endsWith('-factory'));
      
      for (const factory of factories) {
        const wranglerPath = join('apps', factory.name, 'wrangler.jsonc');
        if (existsSync(wranglerPath)) {
          try {
            const content = readFileSync(wranglerPath, 'utf-8');
            const match = content.match(/"port":\s*(\d+)/);
            if (match) {
              ports.push(parseInt(match[1], 10));
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Skip
    }
  }
  
  // Scan specialists
  if (existsSync('apps/ops-specialists')) {
    try {
      const specialists = readdirSync('apps/ops-specialists', { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.endsWith('-specialist'));
      
      for (const specialist of specialists) {
        const wranglerPath = join('apps/ops-specialists', specialist.name, 'wrangler.jsonc');
        if (existsSync(wranglerPath)) {
          try {
            const content = readFileSync(wranglerPath, 'utf-8');
            const match = content.match(/"port":\s*(\d+)/);
            if (match) {
              ports.push(parseInt(match[1], 10));
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Skip
    }
  }
  
  if (ports.length === 0) {
    return basePort;
  }
  
  // Find the highest port and increment
  const maxPort = Math.max(...ports);
  return maxPort + 1;
}

/**
 * Create wrangler.jsonc
 */
function createWranglerConfig(config: WorkerConfig, wranglerRef: string): string {
  const workerName = config.type === 'factory' 
    ? config.name.replace(/-factory$/, '')
    : config.name.replace(/-specialist$/, '');
  
  const kebabName = workerName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  const cloudflareName = config.type === 'specialist'
    ? `ops-${kebabName}`
    : kebabName;

  return `/**
 * ${config.description}
 * 
 * Extends the shared base configuration. All database operations
 * go through orchestrator service bindings.
 */
{
  "$ref": "${wranglerRef}",
  
  "name": "${cloudflareName}",
  "main": "worker/index.ts",
  
  // Development settings with unique port
  "dev": {
    "port": ${config.port},
    "local_protocol": "http"
  },
  
  // ${config.name} specific environment variables
  "vars": {
${Object.entries(config.vars || {}).map(([key, value]) => `    "${key}": "${value}"`).join(',\n')}
  }
}
`;
}

/**
 * Create worker/index.ts
 */
function createWorkerIndex(config: WorkerConfig): string {
  const className = config.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  
  return `import type { Env } from '@shared/types/env';

/**
 * ${config.description}
 * 
 * This worker extends the base functionality and communicates with
 * the orchestrator via service bindings (ORCHESTRATOR_*) for database access.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Implement your worker logic here
    // Access orchestrator services via env.ORCHESTRATOR_* bindings
    
    return new Response('${config.name} worker is running!', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
`;
}

/**
 * Create package.json
 */
function createPackageJson(config: WorkerConfig): string {
  const packageName = config.name.replace(/-/g, '-');
  
  return JSON.stringify({
    name: packageName,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'wrangler dev',
      deploy: 'wrangler deploy',
      typecheck: 'tsc --noEmit',
      lint: 'eslint .',
    },
    devDependencies: {
      '@cloudflare/workers-types': '^4.20251014.0',
      'typescript': '^5.9.3',
      'wrangler': 'latest',
    },
  }, null, 2);
}

/**
 * Create tsconfig.json
 */
function createTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      lib: ['ES2022'],
      moduleResolution: 'bundler',
      types: ['@cloudflare/workers-types'],
      resolveJsonModule: true,
      allowJs: true,
      checkJs: false,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['worker/**/*'],
    exclude: ['node_modules'],
  }, null, 2);
}

/**
 * Create GitHub Actions workflow
 */
function createDeployWorkflow(config: WorkerConfig, workerPath: string): string {
  const workflowName = config.name.replace(/-/g, ' ');
  const workflowFile = config.name.replace(/-/g, '-');
  
  return `name: Deploy ${workflowName}

on:
  push:
    branches:
      - main
    paths:
      - '${workerPath}/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ${workerPath}
        run: npm ci || bun install || echo "No package.json found, skipping install"

      - name: Build & Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: ${workerPath}
`;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npm run create-worker <type> <name> [options]');
    console.log('');
    console.log('Types:');
    console.log('  factory    - Create a new factory worker (apps/<name>-factory)');
    console.log('  specialist - Create a new ops specialist (apps/ops-specialists/<name>-specialist)');
    console.log('');
    console.log('Examples:');
    console.log('  npm run create-worker factory new-factory');
    console.log('  npm run create-worker specialist new-specialist');
    process.exit(1);
  }

  const type = args[0] as 'factory' | 'specialist';
  const name = args[1];

  if (type !== 'factory' && type !== 'specialist') {
    console.error(`❌ Invalid type: ${type}. Must be 'factory' or 'specialist'`);
    process.exit(1);
  }

  const config: WorkerConfig = {
    name: type === 'factory' ? `${name}-factory` : `${name}-specialist`,
    type,
    port: getNextPort(type, WORKER_TYPES[type].basePort),
    description: `${type === 'factory' ? 'Factory' : 'Ops Specialist'} Worker`,
    vars: {
      [`${type.toUpperCase()}_TYPE`]: name,
      'WORKER_NAME': `${name} ${type === 'factory' ? 'Factory' : 'Specialist'}`,
      'DIAGNOSTICS_ENABLED': 'true',
    },
  };

  const workerPath = join(WORKER_TYPES[type].path, config.name);
  
  if (existsSync(workerPath)) {
    console.error(`❌ Worker already exists at ${workerPath}`);
    process.exit(1);
  }

  console.log(`🏗️  Creating ${type}: ${config.name}...`);

  // Create directory structure
  mkdirSync(join(workerPath, 'worker'), { recursive: true });

  // Create wrangler.jsonc
  writeFileSync(
    join(workerPath, 'wrangler.jsonc'),
    createWranglerConfig(config, WORKER_TYPES[type].wranglerRef)
  );

  // Create worker/index.ts
  writeFileSync(
    join(workerPath, 'worker', 'index.ts'),
    createWorkerIndex(config)
  );

  // Create package.json
  writeFileSync(
    join(workerPath, 'package.json'),
    createPackageJson(config)
  );

  // Create tsconfig.json
  writeFileSync(
    join(workerPath, 'tsconfig.json'),
    createTsConfig()
  );

  // Create GitHub Actions workflow
  const workflowPath = join('.github', 'workflows', `deploy-${config.name.replace(/-/g, '-')}.yml`);
  mkdirSync(join('.github', 'workflows'), { recursive: true });
  writeFileSync(workflowPath, createDeployWorkflow(config, workerPath));

  console.log(`✅ Created ${config.name} at ${workerPath}`);
  console.log(`✅ Created deploy workflow at ${workflowPath}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. cd ${workerPath}`);
  console.log(`  2. npm install (or bun install)`);
  console.log(`  3. npm run dev`);
  console.log('');
  console.log('The worker is set up with:');
  console.log('  - Shared wrangler.base.jsonc configuration');
  console.log('  - BaseWorkerEntrypoint from @shared/base');
  console.log('  - Type definitions from @shared/types');
  console.log('  - Deploy workflow in .github/workflows/');
}

main().catch(console.error);

