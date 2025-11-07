/**
 * factory-init.ts
 * ------------------------------------------
 * VibeHQ Orchestrator Factory Bootstrapper
 * ------------------------------------------
 * Automates creation of new factory directories:
 *   - Copies shared Dockerfile + Wrangler partials
 *   - Injects dynamic vars (factory name, AI provider)
 *   - Commits and pushes to GitHub via GitHubClient
 * ------------------------------------------
 * 
 * This service works in both Worker and Node.js contexts:
 * - Worker: Uses GitHubClient to commit files via GitHub API
 * - Node.js CLI: Uses GitHubClient with GitHub token from env
 */

import type { CoreEnv } from '@shared/types/env'
import { GitHubClient } from '../../clients/githubClient'

export interface FactoryInitOptions {
  name: string              // e.g. "agent-factory"
  factory_type?: 'agent' | 'data' | 'services' | 'ui' | 'ops'
  aiProvider?: string        // e.g. "codex", "gemini", "claude"
  create_pr?: boolean        // whether to create a PR
  branch?: string            // optional branch name
  github?: boolean           // whether to commit to GitHub (default: true in Workers)
  order_id?: string
  task_uuid?: string
}

export interface FactoryInitResult {
  ok: boolean
  factory_name: string
  files_created: string[]
  branch?: string
  pr_url?: string
  error?: string
}

/**
 * Generate wrangler.jsonc content for a factory
 */
function generateWranglerConfig(factoryName: string, factoryType: string): string {
  return `/**
 * ${factoryName} Factory Worker Configuration
 * 
 * Extends the shared base configuration. All database operations
 * go through orchestrator service bindings.
 */
{
  "$ref": "../../@shared/base/wrangler.base.jsonc",
  
  "name": "${factoryName}",
  "main": "worker/index.ts",
  
  // Development settings with unique port
  "dev": {
    "port": 8788,
    "local_protocol": "http"
  },
  
  // ${factoryName} specific environment variables
  "vars": {
    "FACTORY_TYPE": "${factoryType}",
    "FACTORY_NAME": "${factoryName}",
    "AI_PROVIDER": "${factoryType === 'agent' ? 'codex' : 'codex'}",
    "WORKER_NAME": "${factoryName.charAt(0).toUpperCase() + factoryName.slice(1)} Factory",
    "DIAGNOSTICS_ENABLED": "true"
  }
}
`
}

/**
 * Generate worker/index.ts entrypoint
 */
function generateWorkerIndex(factoryName: string, factoryType: string): string {
  const className = factoryName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
  
  return `/**
 * ${factoryName} Factory Worker Entrypoint
 * 
 * This factory is responsible for ${factoryType} operations.
 * All database operations go through orchestrator service bindings.
 */

import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        factory: '${factoryName}',
        type: '${factoryType}',
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // Default response
    return new Response('${className} Factory is running', {
      headers: { 'Content-Type': 'text/plain' },
    })
  },
}
`
}

/**
 * Generate deploy workflow YAML
 */
function generateDeployWorkflow(factoryName: string): string {
  return `name: Deploy ${factoryName}

on:
  push:
    branches:
      - main
    paths:
      - 'apps/${factoryName}/**'
      - '.github/workflows/deploy-${factoryName}.yml'
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
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build & Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/${factoryName}
`
}

/**
 * Generate package.json
 */
function generatePackageJson(factoryName: string): string {
  return `{
  "name": "${factoryName}",
  "version": "1.0.0",
  "description": "${factoryName} factory worker",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {},
  "devDependencies": {}
}
`
}

/**
 * Generate README.md
 */
function generateReadme(factoryName: string, factoryType: string, aiProvider?: string): string {
  const displayName = factoryName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  
  return `# ${displayName}

${displayName} factory worker for VibeHQ ecosystem.

## Type

${factoryType}

${aiProvider ? `## AI Provider

${aiProvider}` : ''}

## Configuration

This factory uses the shared base configuration from \`@shared/base/wrangler.base.jsonc\` and extends it with factory-specific settings.

## Development

\`\`\`bash
npm run dev
\`\`\`

## Deployment

Deployment is handled automatically via GitHub Actions when changes are pushed to the \`main\` branch.

## Architecture

- All database operations go through orchestrator service bindings
- Factory communicates with orchestrator via RPC entrypoints
- Uses shared factory base Dockerfile for containerization
`
}

/**
 * Initialize a new factory via GitHub API
 * Works in both Worker and Node.js contexts
 */
export async function initFactory(
  opts: FactoryInitOptions,
  env: CoreEnv
): Promise<FactoryInitResult> {
  const { 
    name, 
    factory_type = 'agent', 
    aiProvider = 'codex',
    create_pr = false, 
    branch,
    github = true,
    order_id,
    task_uuid
  } = opts

  const factoryName = name
  const factoryPath = `apps/${factoryName}`
  const branchName = branch || `factory/${factoryName}-init`
  const filesCreated: string[] = []

  try {
    const gh = new GitHubClient(env)

    // 1. Create branch if it doesn't exist
    if (github) {
      try {
        await gh.createBranch(
          env.GITHUB_OWNER,
          env.GITHUB_REPO,
          branchName,
          'main'
        )
      } catch (error) {
        // Branch might already exist, continue
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (!errorMessage.includes('already exists') && !errorMessage.includes('Reference already exists')) {
          throw error
        }
      }
    }

    // 2. Create wrangler.jsonc
    const wranglerContent = generateWranglerConfig(factoryName, factory_type)
    if (github) {
      await gh.upsertFile({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path: `${factoryPath}/wrangler.jsonc`,
        content: wranglerContent,
        message: `Initialize ${factoryName} factory with shared base config`,
        branch: branchName,
      })
    }
    filesCreated.push(`${factoryPath}/wrangler.jsonc`)

    // 3. Create worker/index.ts
    const workerIndexContent = generateWorkerIndex(factoryName, factory_type)
    if (github) {
      await gh.upsertFile({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path: `${factoryPath}/worker/index.ts`,
        content: workerIndexContent,
        message: `Add worker entrypoint for ${factoryName}`,
        branch: branchName,
      })
    }
    filesCreated.push(`${factoryPath}/worker/index.ts`)

    // 4. Create deploy workflow
    const workflowContent = generateDeployWorkflow(factoryName)
    if (github) {
      await gh.upsertFile({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path: `.github/workflows/deploy-${factoryName}.yml`,
        content: workflowContent,
        message: `Add deploy workflow for ${factoryName}`,
        branch: branchName,
      })
    }
    filesCreated.push(`.github/workflows/deploy-${factoryName}.yml`)

    // 5. Create package.json
    const packageJsonContent = generatePackageJson(factoryName)
    if (github) {
      await gh.upsertFile({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path: `${factoryPath}/package.json`,
        content: packageJsonContent,
        message: `Add package.json for ${factoryName}`,
        branch: branchName,
      })
    }
    filesCreated.push(`${factoryPath}/package.json`)

    // 6. Create README.md
    const readmeContent = generateReadme(factoryName, factory_type, aiProvider)
    if (github) {
      await gh.upsertFile({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        path: `${factoryPath}/README.md`,
        content: readmeContent,
        message: `Add README for ${factoryName}`,
        branch: branchName,
      })
    }
    filesCreated.push(`${factoryPath}/README.md`)

    // 7. Optionally create PR
    let prUrl: string | undefined
    if (github && create_pr) {
      const pr = await gh.openPR({
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        head: branchName,
        base: 'main',
        title: `Initialize ${factoryName} factory`,
        body: `This PR initializes the ${factoryName} factory with:\n\n` +
          `- Shared base Dockerfile configuration\n` +
          `- Wrangler config with orchestrator service bindings\n` +
          `- Worker entrypoint structure\n` +
          `- Deploy workflow\n` +
          `- AI Provider: ${aiProvider}\n` +
          `\nGenerated by orchestrator factory initialization system.`,
      })
      prUrl = pr.html_url
    }

    return {
      ok: true,
      factory_name: factoryName,
      files_created: filesCreated,
      branch: github ? branchName : undefined,
      pr_url: prUrl,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return {
      ok: false,
      factory_name: factoryName,
      files_created: filesCreated,
      error: errorMessage,
    }
  }
}




