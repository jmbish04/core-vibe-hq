/**
 * OrchestratorAgent - Main orchestration agent for multi-worker agentic system
 *
 * This agent combines:
 * - Task decomposition logic from agent-task-manager demo
 * - Agent-to-agent RPC from cloudflare/agents SDK
 * - Service binding integration for distributed workers
 *
 * It takes high-level natural language goals, breaks them down into tasks,
 * and dispatches those tasks to specialized factory workers via RPC.
 */

import { Agent, type AgentNamespace, routeAgentRequest, agentFetch } from 'agents';
import { generateObject } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';
import z from 'zod';

/**
 * Task schema for decomposed tasks
 */
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  factory: z.enum(['ui-factory', 'agent-factory', 'data-factory', 'services-factory']),
  priority: z.number().min(1).max(10).default(5),
  dependencies: z.array(z.string()).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Task decomposition result schema
 */
const TaskDecompositionSchema = z.object({
  tasks: z.array(TaskSchema),
  summary: z.string().describe('Summary of the overall plan'),
});

/**
 * Orchestrator state
 */
interface OrchestratorState {
        activeGoals: Array<{
            id: string;
            goal: string;
            tasks: Task[];
            status: 'planning' | 'executing' | 'completed' | 'failed';
            results: Array<{ taskId: string; result: unknown }>;
        }>;
}

/**
 * Environment interface for Orchestrator Worker
 */
export interface OrchestratorEnv {
        OrchestratorAgent: AgentNamespace<OrchestratorAgent>;
        UI_FACTORY: Fetcher; // Service binding to UI Factory Worker
        AGENT_FACTORY?: Fetcher; // Service binding to Agent Factory Worker
        DATA_FACTORY?: Fetcher; // Service binding to Data Factory Worker
        SERVICES_FACTORY?: Fetcher; // Service binding to Services Factory Worker
        AI: Ai;
}

/**
 * OrchestratorAgent - Main orchestration agent
 */
export class OrchestratorAgent extends Agent<OrchestratorEnv, OrchestratorState> {
  initialState: OrchestratorState = {
    activeGoals: [],
  };

  /**
         * Main entry point: Process a natural language goal
         *
         * This method:
         * 1. Decomposes the goal into tasks (using TaskManagerAgent pattern)
         * 2. Routes each task to the appropriate factory via RPC
         * 3. Collects results and returns final confirmation
         *
         * @param goal - Natural language description of what to build
         * @returns Final result with all task outcomes
         */
  async processGoal(goal: string): Promise<{
            goalId: string;
            summary: string;
            tasks: Task[];
            results: Array<{ taskId: string; factory: string; result: unknown }>;
            status: 'completed' | 'partial' | 'failed';
        }> {
    const goalId = crypto.randomUUID();
    const workersai = createWorkersAI({ binding: this.env.AI });
    const aiModel = workersai('@cf/meta/llama-3.3-70b-instruct-fp8-fast');

    // Step 1: Decompose goal into tasks (TaskManagerAgent pattern)
    const { object: decomposition } = await generateObject({
      model: aiModel,
      schema: TaskDecompositionSchema,
      prompt: `
                    You are an intelligent orchestrator agent. Your job is to break down high-level goals into specific, actionable tasks.

                    Goal: "${goal}"

                    Break this goal down into a list of tasks. For each task:
                    - Assign it to the appropriate factory (ui-factory, agent-factory, data-factory, or services-factory)
                    - Provide a clear title and description
                    - Set a priority (1-10, where 10 is highest)
                    - Identify any dependencies (task IDs that must complete first)

                    Factory assignments:
                    - ui-factory: UI components, forms, pages, React components, HTML/CSS
                    - agent-factory: Cloudflare Workers, agents, serverless functions
                    - data-factory: Database schemas, data models, migrations
                    - services-factory: API endpoints, backend services, integrations

                    Return a JSON object with:
                    - tasks: Array of task objects
                    - summary: Brief summary of the overall plan
                `,
    });

    // Update state
    this.setState({
      activeGoals: [
        ...this.state.activeGoals,
        {
          id: goalId,
          goal,
          tasks: decomposition.tasks,
          status: 'executing',
          results: [],
        },
      ],
    });

    // Step 2: Execute tasks by routing to appropriate factories
    const results: Array<{ taskId: string; factory: string; result: unknown }> = [];

    // Sort tasks by priority and dependencies
    const sortedTasks = this.sortTasksByDependencies(decomposition.tasks);

    for (const task of sortedTasks) {
      try {
        let taskResult: unknown;

        // Route task to appropriate factory via RPC
        switch (task.factory) {
          case 'ui-factory':
            taskResult = await this.dispatchToUIFactory(task);
            break;
          case 'agent-factory':
            taskResult = await this.dispatchToAgentFactory(task);
            break;
          case 'data-factory':
            taskResult = await this.dispatchToDataFactory(task);
            break;
          case 'services-factory':
            taskResult = await this.dispatchToServicesFactory(task);
            break;
          default:
            throw new Error(`Unknown factory: ${task.factory}`);
        }

        results.push({
          taskId: task.id,
          factory: task.factory,
          result: taskResult,
        });
      } catch (error) {
        results.push({
          taskId: task.id,
          factory: task.factory,
          result: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    // Update state with results
    const goalIndex = this.state.activeGoals.findIndex((g) => g.id === goalId);
    if (goalIndex !== -1) {
      const updatedGoals = [...this.state.activeGoals];
      updatedGoals[goalIndex] = {
        ...updatedGoals[goalIndex],
        status: results.every((r) => !('error' in r)) ? 'completed' : 'partial',
        results: results.map((r) => ({ taskId: r.taskId, result: r.result })),
      };
      this.setState({ activeGoals: updatedGoals });
    }

    // Determine overall status
    const hasErrors = results.some((r) => 'error' in r);
    const allComplete = results.every((r) => !('error' in r));

    return {
      goalId,
      summary: decomposition.summary,
      tasks: decomposition.tasks,
      results,
      status: allComplete ? 'completed' : hasErrors ? 'failed' : 'partial',
    };
  }

  /**
         * Dispatch a task to UI Factory via RPC
         * Uses agentFetch to call the UIFactoryAgent.processTask method
         */
  private async dispatchToUIFactory(task: Task): Promise<unknown> {
    if (!this.env.UI_FACTORY) {
      throw new Error('UI_FACTORY service binding not available');
    }

    // Use agentFetch to call the UI Factory Agent
    // The service binding should expose the agent at the factory worker
    const response = await agentFetch(
      {
        agent: 'ui-factory-agent', // Agent name in UI Factory Worker
        name: 'default', // Instance name
        host: this.env.UI_FACTORY as any, // Service binding
      },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'processTask',
          args: [
            {
              task: task.title,
              description: task.description,
              requirements: [],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`UI Factory request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
         * Dispatch a task to Agent Factory via RPC
         */
  private async dispatchToAgentFactory(_task: Task): Promise<unknown> {
    if (!this.env.AGENT_FACTORY) {
      throw new Error('AGENT_FACTORY service binding not available');
    }

    // Similar pattern for agent factory
    // TODO: Implement when Agent Factory Agent is ready
    throw new Error('Agent Factory dispatch not yet implemented');
  }

  /**
         * Dispatch a task to Data Factory via RPC
         */
  private async dispatchToDataFactory(_task: Task): Promise<unknown> {
    if (!this.env.DATA_FACTORY) {
      throw new Error('DATA_FACTORY service binding not available');
    }

    // Similar pattern for data factory
    // TODO: Implement when Data Factory Agent is ready
    throw new Error('Data Factory dispatch not yet implemented');
  }

  /**
         * Dispatch a task to Services Factory via RPC
         */
  private async dispatchToServicesFactory(_task: Task): Promise<unknown> {
    if (!this.env.SERVICES_FACTORY) {
      throw new Error('SERVICES_FACTORY service binding not available');
    }

    // Similar pattern for services factory
    // TODO: Implement when Services Factory Agent is ready
    throw new Error('Services Factory dispatch not yet implemented');
  }

  /**
         * Sort tasks by dependencies (topological sort)
         */
  private sortTasksByDependencies(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: Task) => {
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected involving task: ${task.id}`);
      }
      if (visited.has(task.id)) {
        return;
      }

      visiting.add(task.id);

      // Visit dependencies first
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depTask = tasks.find((t) => t.id === depId);
          if (depTask) {
            visit(depTask);
          }
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    // Sort by priority first, then visit
    const prioritySorted = [...tasks].sort((a, b) => b.priority - a.priority);
    for (const task of prioritySorted) {
      if (!visited.has(task.id)) {
        visit(task);
      }
    }

    return sorted;
  }

  /**
         * Handle HTTP requests
         */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          agent: 'OrchestratorAgent',
          activeGoals: this.state.activeGoals.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  }
}

/**
 * Worker entrypoint - Routes requests to the agent
 */
export default {
  async fetch(request: Request, env: OrchestratorEnv): Promise<Response> {
    // Route agent requests (WebSocket/RPC)
    const agentResponse = await routeAgentRequest(request, env, { cors: true });
    if (agentResponse) {
      return agentResponse;
    }

    // Fallback for non-agent requests
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<OrchestratorEnv>;

