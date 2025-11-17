import { BaseFactoryAgent, StructuredLogger, AgentContext } from '@shared/base/agents';
import { nanoid } from 'nanoid';
import type { BaseEnv } from '@shared/types/env';

interface RetrofitORMAgentEnv extends BaseEnv {
  // Orchestrator RPC bindings for database access
  ORCHESTRATOR_DATA: any;
  ORCHESTRATOR_PROJECTS: any;
  ORCHESTRATOR_OPS_MONITOR: any;

  // Cloudflare AI for code generation and analysis
  AI: any;

  // Base prompt for standardized Cloudflare Workers development
  CLOUDFLARE_BASE_PROMPT: string;
}

interface RetrofitORMAgentState {
  projectId: string;
  projectName: string;
  targetWorkerId: string;
  currentCodebase: any;
  analysis: RetrofitAnalysis;
  retrofitPlan: RetrofitStep[];
  status: 'analyzing' | 'planning' | 'executing' | 'testing' | 'complete';
  currentStep: number;
  generatedPatches: GeneratedPatch[];
  testResults: any;
}

interface RetrofitAnalysis {
  rawD1Queries: RawD1Query[];
  tablesUsed: string[];
  complexity: 'simple' | 'medium' | 'complex';
  migrationEffort: 'low' | 'medium' | 'high';
  recommendations: string[];
}

interface RawD1Query {
  file: string;
  line: number;
  method: 'prepare' | 'bind' | 'all' | 'run' | 'get';
  sql?: string;
  context: string;
}

interface RetrofitStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: any;
  error?: string;
}

interface GeneratedPatch {
  file: string;
  patch: string;
  description: string;
  type: 'schema' | 'client' | 'service' | 'config' | 'migration';
}

/**
 * RetrofitORMAgent - Retrofits existing Cloudflare Workers to use Drizzle + Kysely ORM
 *
 * This agent specializes in analyzing existing workers that use raw D1 queries
 * and converting them to use the standardized Drizzle + Kysely ORM architecture.
 */
export class RetrofitORMAgent extends BaseFactoryAgent {
  constructor(
    env: RetrofitORMAgentEnv,
    logger: StructuredLogger,
    context: AgentContext = {}
  ) {
    super(env, logger, 'apps/factories/data-factory/templates/d1-template', ['data-factory-retrofit'], context);
    this.initializeBasePrompt();
  }

  /**
   * Get the factory type identifier
   */
  getFactoryType(): string {
    return 'data-factory-orm-retrofit';
  }

  /**
   * Initialize the agent with Cloudflare base prompt for consistent development
   */
  private initializeBasePrompt(): void {
    // Load the Cloudflare base prompt from shared location
    this.setState({
      projectId: '',
      projectName: '',
      targetWorkerId: '',
      currentCodebase: {},
      analysis: {
        rawD1Queries: [],
        tablesUsed: [],
        complexity: 'simple',
        migrationEffort: 'low',
        recommendations: []
      },
      retrofitPlan: [],
      status: 'analyzing',
      currentStep: 0,
      generatedPatches: [],
      testResults: {}
    });
  }

  /**
   * Handle HTTP requests for ORM retrofit
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/retrofit/analyze')) {
      return this.handleRetrofitAnalysis(request);
    }

    if (url.pathname.startsWith('/api/retrofit/status')) {
      return this.handleRetrofitStatus(request);
    }

    if (url.pathname.startsWith('/api/retrofit/execute')) {
      return this.handleRetrofitExecution(request);
    }

    if (url.pathname.startsWith('/api/retrofit/patches')) {
      return this.handleGetGeneratedPatches(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle WebSocket connections for real-time retrofit progress
   */
  async onConnect(connection: any): Promise<void> {
    console.log('RetrofitORMAgent: WebSocket connection established');

    // Send current status
    const state = this.state;
    connection.send(JSON.stringify({
      type: 'retrofit_status',
      data: {
        status: state.status,
        currentStep: state.currentStep,
        totalSteps: state.retrofitPlan.length,
        projectName: state.projectName
      },
      timestamp: Date.now()
    }));

    // Subscribe to state updates
    this.subscribeToStateUpdates(connection);
  }

  /**
   * Start retrofit analysis for an existing worker
   */
  async startRetrofitAnalysis(workerConfig: {
    projectName: string;
    workerId: string;
    codebase: any; // Code analysis results
    currentORM?: 'raw-d1' | 'drizzle-only' | 'other';
  }): Promise<{ projectId: string }> {
    const projectId = `retrofit-${nanoid()}`;

    // Initialize state
    this.setState({
      ...this.state,
      projectId,
      projectName: workerConfig.projectName,
      targetWorkerId: workerConfig.workerId,
      currentCodebase: workerConfig.codebase,
      status: 'analyzing',
      retrofitPlan: [],
      currentStep: 0,
      generatedPatches: [],
      testResults: {}
    });

    // Start the analysis process
    await this.executeAnalysis();

    return { projectId };
  }

  /**
   * Analyze the existing codebase for raw D1 usage
   */
  private async executeAnalysis(): Promise<void> {
    const state = this.state;

    // Analyze codebase for raw D1 queries
    const analysis = await this.analyzeCodebaseForD1Usage(state.currentCodebase);

    // Generate retrofit plan based on analysis
    const retrofitPlan = this.generateRetrofitPlan(analysis);

    // Update state
    this.setState({
      ...state,
      analysis,
      retrofitPlan,
      status: 'planning'
    });
  }

  /**
   * Analyze codebase for raw D1 query usage
   */
  private async analyzeCodebaseForD1Usage(codebase: any): Promise<RetrofitAnalysis> {
    const analysis = await this.callAIWithBasePrompt(
      `Analyze the following Cloudflare Worker codebase for raw D1 database usage:

Codebase: ${JSON.stringify(codebase, null, 2)}

Identify:
1. All calls to env.DB.prepare(), .bind(), .all(), .run(), .get()
2. Inline SQL statements and their table/column references
3. Database schema inferred from the queries
4. Complexity level (simple/medium/complex)
5. Migration effort estimation

Provide a detailed analysis for ORM retrofit planning.`
    );

    // Parse the AI response into structured analysis
    return this.parseAnalysisResponse(analysis);
  }

  /**
   * Generate retrofit plan based on analysis
   */
  private generateRetrofitPlan(analysis: RetrofitAnalysis): RetrofitStep[] {
    const steps: RetrofitStep[] = [];

    if (analysis.rawD1Queries.length > 0) {
      steps.push({
        id: 'backup-current-code',
        name: 'Backup Current Code',
        description: 'Create backup of current implementation before modifications',
        status: 'pending'
      });

      steps.push({
        id: 'create-schema-from-analysis',
        name: 'Create Drizzle Schema',
        description: 'Generate Drizzle schema from analyzed database usage',
        status: 'pending'
      });

      steps.push({
        id: 'create-orm-client',
        name: 'Create ORM Client',
        description: 'Initialize Drizzle + Kysely client infrastructure',
        status: 'pending'
      });

      steps.push({
        id: 'retrofit-queries',
        name: 'Retrofit Database Queries',
        description: 'Replace raw D1 queries with ORM equivalents',
        status: 'pending'
      });

      steps.push({
        id: 'update-dependencies',
        name: 'Update Dependencies',
        description: 'Add Drizzle and Kysely dependencies to package.json',
        status: 'pending'
      });

      steps.push({
        id: 'generate-migrations',
        name: 'Generate Migrations',
        description: 'Create migration files for existing schema',
        status: 'pending'
      });

      steps.push({
        id: 'create-tests',
        name: 'Create Tests',
        description: 'Add tests for ORM functionality',
        status: 'pending'
      });

      steps.push({
        id: 'validate-retrofit',
        name: 'Validate Retrofit',
        description: 'Run tests to ensure retrofit maintains functionality',
        status: 'pending'
      });
    }

    return steps;
  }

  /**
   * Execute the retrofit plan
   */
  async executeRetrofitPlan(): Promise<void> {
    const state = this.state;

    for (let i = 0; i < state.retrofitPlan.length; i++) {
      const step = state.retrofitPlan[i];
      state.currentStep = i;

      try {
        step.status = 'in_progress';
        this.updateState();

        // Execute the step based on its ID
        await this.executeRetrofitStep(step);

        step.status = 'completed';
        this.broadcastStepUpdate(step);

      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        this.broadcastStepUpdate(step);

        // Stop execution on failure
        state.status = 'failed';
        this.updateState();
        return;
      }

      this.updateState();
    }

    // All steps completed successfully
    state.status = 'complete';
    this.updateState();

    // Run final validation tests
    await this.runValidationTests();
  }

  /**
   * Execute individual retrofit step
   */
  private async executeRetrofitStep(step: RetrofitStep): Promise<void> {
    const state = this.state;

    switch (step.id) {
      case 'backup-current-code':
        await this.backupCurrentCode(step);
        break;
      case 'create-schema-from-analysis':
        await this.createSchemaFromAnalysis(step);
        break;
      case 'create-orm-client':
        await this.createORMClient(step);
        break;
      case 'retrofit-queries':
        await this.retrofitQueries(step);
        break;
      case 'update-dependencies':
        await this.updateDependencies(step);
        break;
      case 'generate-migrations':
        await this.generateMigrations(step);
        break;
      case 'create-tests':
        await this.createTests(step);
        break;
      case 'validate-retrofit':
        await this.validateRetrofit(step);
        break;
    }
  }

  /**
   * Create backup of current code
   */
  private async backupCurrentCode(step: RetrofitStep): Promise<void> {
    const backup = await this.callAIWithBasePrompt(
      `Create a backup plan for the current codebase before ORM retrofit:

Project: ${this.state.projectName}
Worker ID: ${this.state.targetWorkerId}
Current Code: ${JSON.stringify(this.state.currentCodebase, null, 2)}

Generate backup strategy and rollback plan for the retrofit process.`
    );

    step.output = backup;
  }

  /**
   * Create Drizzle schema from analysis
   */
  private async createSchemaFromAnalysis(step: RetrofitStep): Promise<void> {
    const schema = await this.callAIWithBasePrompt(
      `Generate Drizzle schema from database analysis:

Analysis: ${JSON.stringify(this.state.analysis, null, 2)}
Current Codebase: ${JSON.stringify(this.state.currentCodebase, null, 2)}

Create src/db/schema.ts with proper Drizzle table definitions that match the existing database usage.`
    );

    const patch: GeneratedPatch = {
      file: 'src/db/schema.ts',
      patch: schema,
      description: 'Drizzle schema generated from database analysis',
      type: 'schema'
    };

    this.state.generatedPatches.push(patch);
    step.output = patch;
  }

  /**
   * Create ORM client infrastructure
   */
  private async createORMClient(step: RetrofitStep): Promise<void> {
    const client = await this.callAIWithBasePrompt(
      `Generate Drizzle + Kysely client setup:

Project: ${this.state.projectName}
Schema: ${this.state.generatedPatches.find(p => p.type === 'schema')?.patch}

Create src/db/client.ts with proper client initialization following ORM policy.`
    );

    const patch: GeneratedPatch = {
      file: 'src/db/client.ts',
      patch: client,
      description: 'ORM client initialization',
      type: 'client'
    };

    this.state.generatedPatches.push(patch);
    step.output = patch;
  }

  /**
   * Retrofit existing queries
   */
  private async retrofitQueries(step: RetrofitStep): Promise<void> {
    const patches = await this.callAIWithBasePrompt(
      `Generate patches to retrofit raw D1 queries to ORM:

Analysis: ${JSON.stringify(this.state.analysis, null, 2)}
Current Codebase: ${JSON.stringify(this.state.currentCodebase, null, 2)}
Schema: ${this.state.generatedPatches.find(p => p.type === 'schema')?.patch}
Client: ${this.state.generatedPatches.find(p => p.type === 'client')?.patch}

Replace all env.DB.prepare/bind/all/run/get calls with appropriate Drizzle/Kysely equivalents.`
    );

    // Parse the patches response and add to generatedPatches
    const parsedPatches = this.parsePatchesResponse(patches);
    this.state.generatedPatches.push(...parsedPatches);
    step.output = parsedPatches;
  }

  /**
   * Update package.json dependencies
   */
  private async updateDependencies(step: RetrofitStep): Promise<void> {
    const packageUpdates = await this.callAIWithBasePrompt(
      `Generate package.json updates for ORM retrofit:

Current complexity: ${this.state.analysis.complexity}
Migration effort: ${this.state.analysis.migrationEffort}

Add Drizzle, Kysely, and related dependencies following ORM policy.`
    );

    const patch: GeneratedPatch = {
      file: 'package.json',
      patch: packageUpdates,
      description: 'Updated dependencies for ORM support',
      type: 'config'
    };

    this.state.generatedPatches.push(patch);
    step.output = patch;
  }

  /**
   * Generate migrations
   */
  private async generateMigrations(step: RetrofitStep): Promise<void> {
    const migrations = await this.callAIWithBasePrompt(
      `Generate migration files for existing schema:

Schema: ${this.state.generatedPatches.find(p => p.type === 'schema')?.patch}
Analysis: ${JSON.stringify(this.state.analysis, null, 2)}

Create migrations/0001_initial_schema.sql with proper SQL for existing tables.`
    );

    const patch: GeneratedPatch = {
      file: 'migrations/0001_initial_schema.sql',
      patch: migrations,
      description: 'Initial migration for existing schema',
      type: 'migration'
    };

    this.state.generatedPatches.push(patch);
    step.output = patch;
  }

  /**
   * Create tests for ORM functionality
   */
  private async createTests(step: RetrofitStep): Promise<void> {
    const tests = await this.callAIWithBasePrompt(
      `Generate tests for retrofitted ORM functionality:

Schema: ${this.state.generatedPatches.find(p => p.type === 'schema')?.patch}
Analysis: ${JSON.stringify(this.state.analysis, null, 2)}

Create tests that verify ORM queries work correctly and maintain existing functionality.`
    );

    const patch: GeneratedPatch = {
      file: 'src/tests/orm-retrofit.test.ts',
      patch: tests,
      description: 'Tests for ORM retrofit functionality',
      type: 'test'
    };

    this.state.generatedPatches.push(patch);
    step.output = patch;
  }

  /**
   * Validate retrofit maintains functionality
   */
  private async validateRetrofit(step: RetrofitStep): Promise<void> {
    const validation = await this.callAIWithBasePrompt(
      `Validate that the ORM retrofit maintains existing functionality:

Original Analysis: ${JSON.stringify(this.state.analysis, null, 2)}
Generated Patches: ${JSON.stringify(this.state.generatedPatches, null, 2)}

Verify that all original database operations are preserved with ORM equivalents.`
    );

    step.output = validation;
  }

  /**
   * Call AI with composed prompt from centralized repository
   */
  private async callAIWithBasePrompt(prompt: string): Promise<string> {
    // Build comprehensive prompt with Cloudflare base + ORM policy for retrofit
    const fullPrompt = this.buildAIPrompt('cloudflare-base', ['orm-policy'], {
      projectName: this.state.projectName,
      database: 'd1'
    }, [
      'You are performing an ORM retrofit operation. Focus on migrating from raw D1 queries to the Drizzle + Kysely hybrid standard.',
      prompt
    ]);

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: fullPrompt }],
      max_tokens: 2048,
      temperature: 0.1
    });

    return response.response;
  }

  /**
   * Run final validation tests
   */
  private async runValidationTests(): Promise<void> {
    this.state.status = 'testing';

    // Test generated patches compilation
    const testResults = await this.callAIWithBasePrompt(
      `Validate the retrofitted ORM implementation for ${this.state.projectName}:

Generated Patches:
${this.state.generatedPatches.map(p => `- ${p.file}: ${p.description}`).join('\n')}

Original Analysis:
${JSON.stringify(this.state.analysis, null, 2)}

Check for:
- TypeScript compilation errors
- ORM query correctness
- Schema compatibility
- Migration validity
- Functional equivalence

Provide validation results and any fixes needed.`
    );

    this.state.testResults = testResults;
    this.state.status = 'complete';
  }

  // HTTP endpoint handlers
  private async handleRetrofitAnalysis(request: Request): Promise<Response> {
    try {
      const config = await request.json();
      const result = await this.startRetrofitAnalysis(config);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleRetrofitStatus(request: Request): Promise<Response> {
    const state = this.state;
    return new Response(JSON.stringify({
      projectId: state.projectId,
      projectName: state.projectName,
      status: state.status,
      currentStep: state.currentStep,
      totalSteps: state.retrofitPlan.length,
      analysis: state.analysis,
      plan: state.retrofitPlan
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleRetrofitExecution(request: Request): Promise<Response> {
    try {
      await this.executeRetrofitPlan();
      return new Response(JSON.stringify({
        status: 'executed',
        patches: this.state.generatedPatches.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetGeneratedPatches(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      patches: this.state.generatedPatches
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Helper methods
  private parseAnalysisResponse(response: string): RetrofitAnalysis {
    // Parse AI response into structured analysis
    // This would extract raw D1 queries, tables, complexity, etc.
    return {
      rawD1Queries: [],
      tablesUsed: [],
      complexity: 'medium',
      migrationEffort: 'medium',
      recommendations: []
    };
  }

  private parsePatchesResponse(response: string): GeneratedPatch[] {
    // Parse AI response into structured patches
    // This would extract individual file patches
    return [];
  }

  // WebSocket helpers
  private broadcastStepUpdate(step: RetrofitStep): void {
    // Broadcast to all connected WebSocket clients
  }

  private subscribeToStateUpdates(connection: any): void {
    // Subscribe connection to state updates
  }

  private updateState(): void {
    // Update the agent state
  }
}
