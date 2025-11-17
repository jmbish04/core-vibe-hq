/**
 * orchestrator/worker/agents/CodingAgent.ts
 *
 * Orchestrator Coding Agent - Extends base CodingAgent with orchestrator-specific features
 * Provides MCP tools with access to orchestrator environment and services
 */

import { CodingAgent as BaseCodingAgent } from '@shared/base/agents/CodingAgent'
import type { OrchestratorEnv } from './OrchestratorAgent'

/**
 * Orchestrator Coding Agent with MCP Tools
 * Extends the base CodingAgent with orchestrator-specific environment access
 */
export class CodingAgent extends BaseCodingAgent {
  constructor(env: OrchestratorEnv) {
    super(env as any)
  }

  /**
   * Override init to add orchestrator-specific tools
   */
  async init() {
    // Call parent init first to set up base MCP tools
    await super.init()

    // Add orchestrator-specific tools here if needed
    console.log("[OrchestratorCodingAgent] Initialized with orchestrator environment access")
  }
}
