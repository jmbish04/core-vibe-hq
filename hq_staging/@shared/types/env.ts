/**
 * @shared/types/env.ts
 * 
 * Shared environment type definitions for all Workers in the core-vibe-hq ecosystem.
 * These types define the bindings and environment variables available to Workers.
 */

import { D1Database, KVNamespace, R2Bucket, Ai } from '@cloudflare/workers-types'

// Base environment interface that all workers extend
export interface BaseEnv {
  // Common bindings
  AI: Ai
  CF_VERSION_METADATA: any
  API_RATE_LIMITER: any
  AUTH_RATE_LIMITER: any
  
  // Common environment variables
  ENVIRONMENT: string
  LOG_LEVEL: string
}

// Core environment for orchestrator and main services
export interface CoreEnv extends BaseEnv {
  // Database bindings - multiple D1 databases for different concerns
  DB_OPS: D1Database      // Operations, templates, rules, logs
  DB_PROJECTS: D1Database // Projects, PRDs, requirements, tasks
  DB_CHATS: D1Database    // Chat conversations and agent interactions
  DB_HEALTH: D1Database   // Health check results and monitoring data
  // Legacy DB binding for backwards compatibility (deprecated - use specific DB_* bindings)
  DB?: D1Database
  
  // Storage
  TEMPLATES_BUCKET: R2Bucket
  VibecoderStore: KVNamespace
  
  // Service bindings
  ORCHESTRATOR?: any
  AGENT_FACTORY?: any
  DATA_FACTORY?: any
  SERVICES_FACTORY?: any
  UI_FACTORY?: any
  OPS_SPECIALISTS?: any
  
  // Durable Objects
  CodeGenObject: DurableObjectNamespace
  Sandbox: DurableObjectNamespace
  DORateLimitStore: DurableObjectNamespace
  
  // Dispatch namespace
  DISPATCHER: any
  
  // Assets
  ASSETS?: any
  
  // AI/Docs bindings
  cloudflare_docs?: any
  
  // Environment variables
  TEMPLATES_REPOSITORY: string
  ALLOWED_EMAIL: string
  DISPATCH_NAMESPACE: string
  ENABLE_READ_REPLICAS: string
  CLOUDFLARE_AI_GATEWAY: string
  CUSTOM_DOMAIN: string
  MAX_SANDBOX_INSTANCES: string
  SANDBOX_INSTANCE_TYPE: string
  USE_CLOUDFLARE_IMAGES: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
  GITHUB_API_KEY: string
  CORE_GITHUB_API: string
  ORCHESTRATOR_BASE_URL?: string
}

// Environment for GitHub operations
export interface GitHubRemediationEnv extends BaseEnv {
  CORE_GITHUB_API: string
  GITHUB_API_KEY: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
}

// Environment for ops specialists
export interface OpsEnv extends BaseEnv {
  DB: D1Database
  OPS_QUEUE?: any
  OPS_LOG_LEVEL: string
  MAX_CONCURRENT_OPS: string
}

// Re-export for backwards compatibility
export type { CoreEnv as Env }
