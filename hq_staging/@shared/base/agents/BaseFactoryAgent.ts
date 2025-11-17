/**
 * @shared/base/agents/BaseFactoryAgent.ts
 * 
 * Base Factory Agent - Specialized agent for factory automation
 * Extends BaseAgent with template management and order fulfillment capabilities
 * 
 * This agent is responsible for:
 * - Managing templates (listing, extracting placeholders, analyzing)
 * - Generating file creation plans from orders
 * - Fulfilling orders by scaffolding projects and filling placeholders
 */

import { BaseAgent, StructuredLogger, AgentContext } from './BaseAgent'
import type { CoreEnv, BaseEnv } from '@shared/types/env'

/**
 * Order interface - represents a factory order
 */
export interface Order {
  id: string
  description: string
  factory: string
  metadata?: Record<string, unknown>
}

/**
 * File creation plan structure
 */
export interface FileCreationPlan {
  skeleton_files: Array<{
    filepath: string
    content: string
  }>
  copy_files?: Array<{
    source: string
    dest: string
  }>
  specialized_module_path?: string
}

/**
 * Order fulfillment result
 */
export interface OrderFulfillmentResult {
  ok: boolean
  order_id: string
  files_created: string[]
  error?: string
}

/**
 * Template management task
 */
export interface TemplateManagementTask {
  action: 'list' | 'extract' | 'analyze'
  template_path?: string
  mcp_tool_name?: string
  query?: string
}

/**
 * Template management result
 */
export interface TemplateManagementResult {
  ok: boolean
  data?: unknown
  error?: string
}

/**
 * Base Factory Agent class
 * 
 * Provides template management and order fulfillment capabilities.
 * Factory-specific agents extend this class.
 */
export abstract class BaseFactoryAgent extends BaseAgent {
  protected templatePath: string
  protected mcpTools: string[]

  constructor(
    env: CoreEnv | BaseEnv,
    logger: StructuredLogger,
    templatePath: string,
    mcpTools: string[],
    context: AgentContext = {}
  ) {
    super(env, logger, context)
    this.templatePath = templatePath
    this.mcpTools = mcpTools
  }

  /**
   * Get the factory type identifier
   */
  abstract getFactoryType(): string

  /**
   * Execute subprocess command (for use in containers)
   * 
   * Note: In Workers runtime, this will need to be implemented differently
   * (e.g., via service bindings or sandbox SDK). For containers, this can
   * use Node.js child_process.
   */
  protected async execCommand(
    command: string,
    args: string[] = []
  ): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
    // This is a placeholder - in containers, implement using child_process
    // In Workers runtime, this would need to use service bindings or sandbox SDK
    await this.logAction('exec_command', 'info', { command, args })
    
    // For now, return error - actual implementation depends on runtime
    return {
      ok: false,
      stdout: '',
      stderr: 'execCommand not implemented - requires container runtime or service binding',
      code: 1
    }
  }

  /**
   * Generate file creation plan from an order
   * 
   * This method:
   * 1. Extracts placeholders from templates using template-manager-tool
   * 2. Generates micro-prompts for each placeholder using AI
   * 3. Builds the complete file creation plan
   */
  async generateFileCreationPlan(order: Order): Promise<FileCreationPlan> {
    await this.logAction('generate_file_creation_plan', 'info', { order_id: order.id })

    try {
      // Step 1: Extract placeholders from templates
      const extractResult = await this.execCommand('template-manager', [
        'extract-placeholders',
        this.templatePath
      ])

      if (!extractResult.ok) {
        throw new Error(`Failed to extract placeholders: ${extractResult.stderr}`)
      }

      const placeholderData = JSON.parse(extractResult.stdout)
      if (!placeholderData.ok || !placeholderData.template_files) {
        throw new Error('Invalid placeholder data from template-manager-tool')
      }

      // Step 2: Generate micro-prompts for each placeholder using AI
      const skeletonFiles: Array<{ filepath: string; content: string }> = []

      for (const templateFile of placeholderData.template_files) {
        const filepath = templateFile.path.replace('.template', '')
        const microPrompts: string[] = []

        for (const placeholder of templateFile.placeholders) {
          // Generate micro-prompt using AI
          // Note: This requires AI inference - for now, create a basic prompt
          // In full implementation, this would use executeInference or similar
          const microPrompt = await this.generateMicroPrompt(placeholder, order)
          microPrompts.push(microPrompt)
        }

        // Combine all micro-prompts for this file
        const content = microPrompts.join('\n\n')
        skeletonFiles.push({ filepath, content })
      }

      // Step 3: Build file creation plan
      const plan: FileCreationPlan = {
        skeleton_files: skeletonFiles,
        copy_files: [],
        specialized_module_path: `factories.${this.getFactoryType().replace('-', '_')}_setup`
      }

      await this.logAction('generate_file_creation_plan', 'info', {
        order_id: order.id,
        files_count: skeletonFiles.length
      })

      return plan
    } catch (error) {
      await this.logAction('generate_file_creation_plan', 'error', {
        order_id: order.id,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Generate a micro-prompt for a specific placeholder
   * 
   * This is a placeholder - full implementation would use AI inference
   */
  protected async generateMicroPrompt(placeholder: string, order: Order): Promise<string> {
    // Placeholder implementation - would use AI inference in full version
    // For now, return a basic prompt
    return `Implement ${placeholder} based on order requirements: ${order.description}`
  }

  /**
   * Handle an order - main order fulfillment method
   * 
   * This method orchestrates the entire order fulfillment:
   * 1. Generates file creation plan
   * 2. Saves plan to file
   * 3. Executes Python scaffolder
   * 4. Invokes codex-cli to fill placeholders
   */
  async handleOrder(order: Order): Promise<OrderFulfillmentResult> {
    await this.logAction('handle_order', 'info', { order_id: order.id })

    try {
      // Step 1: Generate file creation plan
      const plan = await this.generateFileCreationPlan(order)

      // Step 2: Save plan to temporary file
      const planPath = `/tmp/file_creation_plan_${order.id}.json`
      const planJson = JSON.stringify(plan, null, 2)
      
      // Write plan file (in container, this would use fs.writeFileSync)
      // For now, we'll assume this is handled by the execCommand
      const writeResult = await this.execCommand('sh', [
        '-c',
        `echo '${planJson.replace(/'/g, "'\\''")}' > ${planPath}`
      ])

      if (!writeResult.ok) {
        throw new Error(`Failed to write plan file: ${writeResult.stderr}`)
      }

      // Step 3: Execute Python scaffolder
      const workspacePath = `/workspace/target_${order.id}`
      const scaffoldResult = await this.execCommand('setup_repo', [
        '--plan',
        planPath,
        '--workspace',
        workspacePath
      ])

      if (!scaffoldResult.ok) {
        throw new Error(`Failed to scaffold project: ${scaffoldResult.stderr}`)
      }

      // Step 4: Invoke codex-cli to fill placeholders
      // Note: The exact codex-cli command may vary
      const codexResult = await this.execCommand('codex-cli', [
        'fill-placeholders',
        '--workspace',
        workspacePath,
        '--plan',
        planPath
      ])

      if (!codexResult.ok) {
        // Log warning but don't fail - scaffolding succeeded
        await this.logAction('handle_order', 'warn', {
          order_id: order.id,
          warning: `Codex placeholder filling failed: ${codexResult.stderr}`
        })
      }

      // Collect created files
      const filesCreated: string[] = plan.skeleton_files.map(f => f.filepath)

      await this.logAction('handle_order', 'info', {
        order_id: order.id,
        files_created: filesCreated.length,
        status: 'completed'
      })

      return {
        ok: true,
        order_id: order.id,
        files_created: filesCreated
      }
    } catch (error) {
      await this.logAction('handle_order', 'error', {
        order_id: order.id,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        ok: false,
        order_id: order.id,
        files_created: [],
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Manage templates - perform template maintenance tasks
   * 
   * This method allows specialists to perform template management:
   * - List available templates
   * - Extract placeholders
   * - Analyze and improve templates using MCP tools
   */
  async manageTemplates(task: TemplateManagementTask): Promise<TemplateManagementResult> {
    await this.logAction('manage_templates', 'info', { action: task.action })

    try {
      let result: unknown

      switch (task.action) {
        case 'list': {
          const listResult = await this.execCommand('template-manager', [
            'list-templates',
            this.templatePath
          ])

          if (!listResult.ok) {
            throw new Error(`Failed to list templates: ${listResult.stderr}`)
          }

          result = JSON.parse(listResult.stdout)
          break
        }

        case 'extract': {
          const templatePath = task.template_path || this.templatePath
          const extractResult = await this.execCommand('template-manager', [
            'extract-placeholders',
            templatePath
          ])

          if (!extractResult.ok) {
            throw new Error(`Failed to extract placeholders: ${extractResult.stderr}`)
          }

          result = JSON.parse(extractResult.stdout)
          break
        }

        case 'analyze': {
          if (!task.template_path || !task.mcp_tool_name || !task.query) {
            throw new Error('Template path, MCP tool name, and query are required for analysis')
          }

          const analyzeResult = await this.execCommand('template-manager', [
            'analyze-improve',
            task.template_path,
            task.mcp_tool_name,
            task.query
          ])

          if (!analyzeResult.ok) {
            throw new Error(`Failed to analyze templates: ${analyzeResult.stderr}`)
          }

          result = JSON.parse(analyzeResult.stdout)
          break
        }

        default:
          throw new Error(`Unknown template management action: ${task.action}`)
      }

      await this.logAction('manage_templates', 'info', {
        action: task.action,
        status: 'completed'
      })

      return {
        ok: true,
        data: result
      }
    } catch (error) {
      await this.logAction('manage_templates', 'error', {
        action: task.action,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Execute agent logic (required by BaseAgent)
   */
  abstract execute(input: unknown): Promise<unknown>
}

