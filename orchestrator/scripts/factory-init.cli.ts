#!/usr/bin/env tsx
/**
 * CLI wrapper for factory initialization
 * 
 * Usage:
 *   npx tsx orchestrator/scripts/factory-init.cli.ts <factory-name> [provider] [--type agent|data|services|ui|ops] [--pr]
 * 
 * Example:
 *   npx tsx orchestrator/scripts/factory-init.cli.ts ai-lint-factory gemini --type agent --pr
 */

import { initFactory } from '../worker/services/factory/factory-init'

// Simple env loader for CLI (reads from process.env)
function createEnvFromProcessEnv(): {
  GITHUB_OWNER: string
  GITHUB_REPO: string
  GITHUB_API_KEY: string
  CORE_GITHUB_API?: string
} {
  const owner = process.env.GITHUB_OWNER || 'jmbish04'
  const repo = process.env.GITHUB_REPO || 'core-vibe-hq'
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_KEY || ''
  
  if (!token) {
    console.error('[ERROR] GITHUB_TOKEN or GITHUB_API_KEY environment variable is required')
    process.exit(1)
  }

  return {
    GITHUB_OWNER: owner,
    GITHUB_REPO: repo,
    GITHUB_API_KEY: token,
    CORE_GITHUB_API: process.env.CORE_GITHUB_API_URL,
  }
}

// Parse CLI arguments
function parseArgs(): {
  name: string
  provider: string
  factory_type: 'agent' | 'data' | 'services' | 'ui' | 'ops'
  create_pr: boolean
} {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error('Usage: npx tsx factory-init.cli.ts <factory-name> [provider] [--type agent|data|services|ui|ops] [--pr]')
    console.error('')
    console.error('Examples:')
    console.error('  npx tsx factory-init.cli.ts ai-lint-factory gemini')
    console.error('  npx tsx factory-init.cli.ts new-factory codex --type agent --pr')
    process.exit(1)
  }

  const name = args[0]
  let provider = 'codex'
  let factory_type: 'agent' | 'data' | 'services' | 'ui' | 'ops' = 'agent'
  let create_pr = false

  // Parse provider (second positional arg or --provider flag)
  if (args.length > 1 && !args[1].startsWith('--')) {
    provider = args[1]
  }

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      const type = args[i + 1] as 'agent' | 'data' | 'services' | 'ui' | 'ops'
      if (['agent', 'data', 'services', 'ui', 'ops'].includes(type)) {
        factory_type = type
      }
    }
    if (args[i] === '--pr' || args[i] === '--create-pr') {
      create_pr = true
    }
    if (args[i] === '--provider' && args[i + 1]) {
      provider = args[i + 1]
    }
  }

  return { name, provider, factory_type, create_pr }
}

async function main() {
  const { name, provider, factory_type, create_pr } = parseArgs()
  const env = createEnvFromProcessEnv()

  console.log(`[INFO] Initializing factory: ${name}`)
  console.log(`[INFO] Provider: ${provider}`)
  console.log(`[INFO] Type: ${factory_type}`)
  console.log(`[INFO] Create PR: ${create_pr}`)
  console.log('')

  const result = await initFactory({
    name,
    aiProvider: provider,
    factory_type,
    create_pr,
    github: true,
  }, env as any)

  if (result.ok) {
    console.log('')
    console.log(`[SUCCESS] Factory ${name} initialized successfully!`)
    console.log(`[INFO] Files created: ${result.files_created.length}`)
    if (result.branch) {
      console.log(`[INFO] Branch: ${result.branch}`)
    }
    if (result.pr_url) {
      console.log(`[INFO] PR: ${result.pr_url}`)
    }
  } else {
    console.error('')
    console.error(`[ERROR] Failed to initialize factory: ${result.error}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[FATAL]', error)
  process.exit(1)
})




