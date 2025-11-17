/**
 * apps/ui-factory/worker/agents/UiFactoryAgent.ts
 * 
 * UI Factory Agent - Specialized agent for the ui-factory
 * Extends FactoryOrchestratorAgent with ui-factory-specific configuration
 * 
 * This agent uses FactoryOrchestratorAgent for order validation and fulfillment orchestration.
 */

import { FactoryOrchestratorAgent } from '@shared/base/agents/FactoryOrchestratorAgent'
import type { CoreEnv, BaseEnv } from '@shared/types/env'
import type { StructuredLogger, AgentContext } from '@shared/base/agents/BaseAgent'
import type { Order, OrderFulfillmentResult } from '@shared/base/agents/BaseFactoryAgent'

export class UiFactoryAgent extends FactoryOrchestratorAgent {
  constructor(
    env: CoreEnv | BaseEnv,
    logger: StructuredLogger,
    context: AgentContext = {}
  ) {
    super(
      env,
      logger,
      'apps/ui-factory/templates', // templatePath
      ['cloudflare-docs', 'shadcn-mcp', 'heroui-mcp'], // mcpTools
      context
    )
  }

  getFactoryType(): string {
    return 'ui-factory'
  }

  /**
   * Execute agent logic (required by BaseAgent)
   * Delegates to handleOrder for order processing
   */
  async execute(input: unknown): Promise<unknown> {
    if (typeof input === 'object' && input !== null && 'id' in input && 'factory' in input) {
      return this.handleOrder(input as Order)
    }
    await this.logAction('execute', 'info', { input })
    return { ok: true }
  }
}

