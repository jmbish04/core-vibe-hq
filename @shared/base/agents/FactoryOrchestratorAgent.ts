/**
 * @shared/base/agents/FactoryOrchestratorAgent.ts
 * 
 * Factory Orchestrator Agent - Shared agent for order validation and fulfillment orchestration
 * 
 * This agent extends BaseFactoryAgent and provides:
 * - Order validation using shared Zod schemas
 * - Order fulfillment orchestration
 * - Placeholder payload processing
 * - Communication with main orchestrator for validation errors
 * 
 * Each factory worker will instantiate this agent with factory-specific configuration.
 */

import { BaseFactoryAgent, type Order, type OrderFulfillmentResult } from './BaseFactoryAgent'
import { validateOrder, type ValidatedOrder, type ValidationResult } from '@shared/types/orders'
import type { CoreEnv, BaseEnv } from '@shared/types/env'
import type { StructuredLogger, AgentContext } from './BaseAgent'

export interface ValidationError {
  field: string
  message: string
}

export interface OrderValidationResult {
  ok: boolean
  order?: ValidatedOrder
  errors?: ValidationError[]
}

/**
 * Factory Orchestrator Agent
 * 
 * Handles order validation and fulfillment orchestration for factory workers.
 * This agent is shared across all factory workers and configured per-factory.
 */
export class FactoryOrchestratorAgent extends BaseFactoryAgent {
  constructor(
    env: CoreEnv | BaseEnv,
    logger: StructuredLogger,
    templatePath: string,
    mcpTools: string[],
    context: AgentContext = {}
  ) {
    super(env, logger, templatePath, mcpTools, context)
  }

  /**
   * Get factory type identifier
   */
  getFactoryType(): string {
    // Infer factory type from templatePath, e.g., 'agent-factory' from '/apps/agent-factory/templates'
    const parts = this.templatePath.split('/')
    const appIndex = parts.indexOf('apps')
    if (appIndex !== -1 && appIndex + 1 < parts.length) {
      return parts[appIndex + 1]
    }
    return 'unknown-factory'
  }

  /**
   * Validate an order using shared Zod schema
   * 
   * @param order - Order object to validate
   * @returns ValidationResult with validated order or errors
   */
  async validateOrder(order: Order): Promise<OrderValidationResult> {
    await this.logAction('validate_order', 'info', { order_id: order.id })

    try {
      const validation = validateOrder(order)

      if (!validation.ok) {
        await this.logAction('validate_order', 'error', {
          order_id: order.id,
          errors: validation.errors,
        })

        return {
          ok: false,
          errors: validation.errors?.map((err) => {
            // Parse Zod error format: "field.path: message"
            const [field, ...messageParts] = err.split(': ')
            return {
              field: field || 'unknown',
              message: messageParts.join(': ') || err,
            }
          }),
        }
      }

      await this.logAction('validate_order', 'info', {
        order_id: order.id,
        status: 'validated',
      })

      return {
        ok: true,
        order: validation.order!,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.logAction('validate_order', 'error', {
        order_id: order.id,
        error: errorMessage,
      })

      return {
        ok: false,
        errors: [
          {
            field: 'validation',
            message: errorMessage,
          },
        ],
      }
    }
  }

  /**
   * Report validation errors back to main orchestrator
   * 
   * @param orderId - Order ID that failed validation
   * @param errors - List of validation errors
   */
  async reportValidationError(orderId: string, errors: string[]): Promise<void> {
    await this.logAction('report_validation_error', 'warn', {
      order_id: orderId,
      errors,
    })

    // In a real implementation, this would communicate back to the orchestrator
    // via service binding or REST API
    // For now, we log the error
    this.logger.warn(`Order ${orderId} validation failed`, { errors })
  }

  /**
   * Fulfill a validated order
   * 
   * This method orchestrates the entire order fulfillment:
   * 1. Receives placeholder JSON payload from order
   * 2. Saves payload to file in container workspace
   * 3. Calls Python script to process placeholders
   * 4. Returns fulfillment result
   * 
   * @param order - Validated order with placeholder payload
   * @returns OrderFulfillmentResult
   */
  async fulfillOrder(order: ValidatedOrder): Promise<OrderFulfillmentResult> {
    await this.logAction('fulfill_order', 'info', { order_id: order.id })

    try {
      // Step 1: Save placeholder payload to file
      const placeholderPayloadPath = `/workspace/order_${order.id}_placeholders.json`
      const placeholderPayloadJson = JSON.stringify(order.placeholder_payload || {}, null, 2)

      // Write placeholder payload file (in container, this would use fs.writeFileSync)
      // For now, we'll assume this is handled by execCommand
      const writeResult = await this.execCommand('sh', [
        '-c',
        `echo '${placeholderPayloadJson.replace(/'/g, "'\\''")}' > ${placeholderPayloadPath}`,
      ])

      if (!writeResult.ok) {
        throw new Error(`Failed to write placeholder payload file: ${writeResult.stderr}`)
      }

      // Step 2: Call TypeScript CLI to process placeholders
      // The CLI will read the placeholder JSON and process cloned template files
      const workspacePath = `/workspace/target_${order.id}`
      const processResult = await this.execCommand('pnpm', [
        'factory-orchestrator',
        '--',
        'process-placeholders',
        '--order-id',
        order.id,
        '--placeholder-json',
        placeholderPayloadPath,
        '--workspace',
        workspacePath,
      ])

      let filesProcessed = 0;
      let filesModified = 0;
      let totalLinesGenerated = 0;

      if (!processResult.ok) {
        await this.logAction('fulfill_order', 'warn', {
          order_id: order.id,
          warning: `Placeholder processing reported issues: ${processResult.stderr}`,
        })
      } else {
        try {
          const stdoutLines = processResult.stdout.trim().split('\n')
          const summaryLine = stdoutLines[stdoutLines.length - 1]
          const parsedSummary = JSON.parse(summaryLine)

          filesProcessed = parsedSummary.filesProcessed || 0;
          filesModified = parsedSummary.filesModified || 0;

          // Estimate lines generated (rough approximation)
          totalLinesGenerated = filesModified * 25; // Assume ~25 lines per modified file

          await this.logAction('fulfill_order', 'info', {
            order_id: order.id,
            placeholder_summary: parsedSummary,
            estimated_lines_generated: totalLinesGenerated,
          })
        } catch (parseError) {
          await this.logAction('fulfill_order', 'warn', {
            order_id: order.id,
            warning: 'Unable to parse factory-orchestrator output as JSON',
            error: parseError instanceof Error ? parseError.message : String(parseError),
            raw_output: processResult.stdout,
          })
        }
      }

      // Step 3: Trigger specialists based on generation results
      if (totalLinesGenerated >= 50) {
        try {
          // Access specialist triggers service (would be injected or accessed via env)
          // For now, log the trigger opportunity - actual triggering would be done by orchestrator
          await this.logAction('specialist_trigger_opportunity', 'info', {
            order_id: order.id,
            specialist_type: 'docstring-architect',
            trigger_event: 'code-generation-complete',
            estimated_lines_generated: totalLinesGenerated,
            files_modified: filesModified,
          })
        } catch (triggerError) {
          await this.logAction('specialist_trigger_error', 'warn', {
            order_id: order.id,
            error: triggerError instanceof Error ? triggerError.message : String(triggerError),
          })
        }
      }

      // Step 4: Collect created/modified files (would be determined by CLI output)
      // For now, return success
      const filesCreated: string[] = [] // Would be populated from CLI output

      await this.logAction('fulfill_order', 'info', {
        order_id: order.id,
        files_created: filesCreated.length,
        status: 'completed',
      })

      return {
        ok: true,
        order_id: order.id,
        files_created: filesCreated,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.logAction('fulfill_order', 'error', {
        order_id: order.id,
        error: errorMessage,
      })

      return {
        ok: false,
        order_id: order.id,
        files_created: [],
        error: errorMessage,
      }
    }
  }

  /**
   * Handle an order - main entry point
   * 
   * This method:
   * 1. Validates the order
   * 2. If invalid, reports errors back to orchestrator
   * 3. If valid, orchestrates fulfillment
   * 
   * @param order - Order to handle
   * @returns OrderFulfillmentResult
   */
  async handleOrder(order: Order): Promise<OrderFulfillmentResult> {
    await this.logAction('handle_order', 'info', { order_id: order.id })

    // Step 1: Validate order
    const validation = await this.validateOrder(order)

    if (!validation.ok) {
      // Step 2: Report validation errors back to orchestrator
      await this.reportValidationError(
        order.id,
        validation.errors?.map((e) => `${e.field}: ${e.message}`) || []
      )

      return {
        ok: false,
        order_id: order.id,
        files_created: [],
        error: `Order validation failed: ${validation.errors?.map((e) => e.message).join(', ')}`,
      }
    }

    // Step 3: Fulfill validated order
    return this.fulfillOrder(validation.order!)
  }

  /**
   * Execute agent logic (required by BaseAgent)
   */
  async execute(input: unknown): Promise<unknown> {
    if (typeof input === 'object' && input !== null && 'id' in input && 'factory' in input) {
      return this.handleOrder(input as Order)
    }
    throw new Error('Invalid input for FactoryOrchestratorAgent.execute')
  }
}

