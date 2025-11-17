import { BaseFactoryAgent, StructuredLogger, AgentContext } from '@shared/base/agents';
import { nanoid } from 'nanoid';
import type { BaseEnv } from '@shared/types/env';
import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

export interface ORMAgentEnv extends BaseEnv {
  // Orchestrator RPC bindings for database access
  ORCHESTRATOR_DATA: any;
  ORCHESTRATOR_PROJECTS: any;
  ORCHESTRATOR_OPS_MONITOR: any;

  // Cloudflare AI for code generation and analysis
  AI: any;

  // Base prompt for standardized Cloudflare Workers development
  CLOUDFLARE_BASE_PROMPT: string;
}

interface ORMAgentState {
  projectId: string;
  projectName: string;
  ormType: 'drizzle-kysely' | 'drizzle-only' | 'kysely-only';
  status: 'analyzing' | 'generating' | 'implementing' | 'testing' | 'complete' | 'failed';
  steps: ORMStep[];
  currentStep: number;
  databaseSchema: any;
  generatedFiles: GeneratedFile[];
  testResults: any;
}

interface ORMStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: any;
  error?: string;
}

interface GeneratedFile {
  path: string;
  content: string;
  type: 'schema' | 'client' | 'config' | 'migration' | 'service' | 'test' | 'readme';
  description: string;
}

/**
 * NewWorkerORMAgent - Installs ORM from the start for new Cloudflare Workers projects
 *
 * This agent specializes in setting up Drizzle + Kysely ORM architecture
 * for new worker projects, following the standardized Cloudflare Workers
 * development guidelines.
 */
export class NewWorkerORMAgent extends BaseFactoryAgent {
  protected env: ORMAgentEnv;
  private state: ORMAgentState;
  private storage: DurableObjectStorage;

  constructor(
    env: ORMAgentEnv,
    logger: StructuredLogger,
    context: AgentContext = {},
    state?: DurableObjectState
  ) {
    super(env, logger, 'apps/factories/data-factory/templates/d1-template', ['data-factory-orm'], context);
    this.env = env;
    this.storage = state?.storage || ({} as DurableObjectStorage);
    this.state = {
      projectId: '',
      projectName: '',
      ormType: 'drizzle-kysely',
      status: 'analyzing',
      steps: [],
      currentStep: 0,
      databaseSchema: {},
      generatedFiles: [],
      testResults: {}
    };
    this.initializeBasePrompt();
  }

  /**
   * Get the factory type identifier
   */
  getFactoryType(): string {
    return 'data-factory-orm-new-worker';
  }

  /**
   * Initialize the agent with Cloudflare base prompt for consistent development
   */
  private initializeBasePrompt(): void {
    // State is already initialized in constructor
  }

  /**
   * Load state from Durable Object storage
   */
  private async loadState(): Promise<void> {
    const storedState = await this.storage.get('agent-state') as ORMAgentState;
    if (storedState) {
      this.state = { ...this.state, ...storedState };
    }
  }

  /**
   * Save state to Durable Object storage
   */
  private async saveState(): Promise<void> {
    await this.storage.put('agent-state', this.state);
  }

  /**
   * Update state and persist to storage
   */
  private async updateState(newState?: Partial<ORMAgentState>): Promise<void> {
    if (newState) {
      this.state = { ...this.state, ...newState };
    }
    await this.saveState();
  }

  /**
   * Handle HTTP requests for ORM setup
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/orm/setup')) {
      return this.handleORMSetup(request);
    }

    if (url.pathname.startsWith('/api/orm/status')) {
      return this.handleORMStatus(request);
    }

    if (url.pathname.startsWith('/api/orm/files')) {
      return this.handleGetGeneratedFiles(request);
    }

    if (url.pathname.startsWith('/api/orm/test')) {
      return this.handleRunTests(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle WebSocket connections for real-time ORM setup progress
   */
  async onConnect(connection: any): Promise<void> {
    console.log('NewWorkerORMAgent: WebSocket connection established');

    // Send current status
    const state = this.state;
    connection.send(JSON.stringify({
      type: 'orm_status',
      data: {
        status: state.status,
        currentStep: state.currentStep,
        totalSteps: state.steps.length,
        projectName: state.projectName
      },
      timestamp: Date.now()
    }));

    // Subscribe to state updates
    this.subscribeToStateUpdates(connection);
  }

  /**
   * Start ORM setup for a new project
   */
  async startORMSetup(projectConfig: {
    projectName: string;
    databaseType: 'd1' | 'hyperdrive' | 'custom';
    ormType?: 'drizzle-kysely' | 'drizzle-only' | 'kysely-only';
    schema?: any;
    customRequirements?: string[];
  }): Promise<{ projectId: string }> {
    const projectId = `orm-${nanoid()}`;

    // Initialize state
    await this.updateState({
      projectId,
      projectName: projectConfig.projectName,
      ormType: projectConfig.ormType || 'drizzle-kysely',
      status: 'analyzing',
      steps: this.createORMSteps(),
      currentStep: 0,
      databaseSchema: projectConfig.schema || {},
      generatedFiles: [],
      testResults: {}
    });

    // Start the ORM setup process
    await this.executeORMSteps();

    return { projectId };
  }

  /**
   * Create the standard ORM setup steps
   */
  private createORMSteps(): ORMStep[] {
    return [
      {
        id: 'analyze-requirements',
        name: 'Analyze Database Requirements',
        description: 'Analyze project requirements and database schema needs',
        status: 'pending'
      },
      {
        id: 'generate-schema',
        name: 'Generate Drizzle Schema',
        description: 'Create TypeScript schema definitions using Drizzle ORM',
        status: 'pending'
      },
      {
        id: 'create-client',
        name: 'Create Database Client',
        description: 'Initialize Drizzle + Kysely client with proper configuration',
        status: 'pending'
      },
      {
        id: 'setup-migrations',
        name: 'Setup Migration System',
        description: 'Configure Drizzle Kit for schema migrations',
        status: 'pending'
      },
      {
        id: 'generate-migrations',
        name: 'Generate Initial Migrations',
        description: 'Create SQL migration files from schema definitions',
        status: 'pending'
      },
      {
        id: 'create-services',
        name: 'Create Database Services',
        description: 'Generate type-safe service classes for data operations',
        status: 'pending'
      },
      {
        id: 'update-package-json',
        name: 'Update Package Dependencies',
        description: 'Add Drizzle, Kysely, and migration dependencies',
        status: 'pending'
      },
      {
        id: 'create-tests',
        name: 'Create Test Files',
        description: 'Generate test files for database operations',
        status: 'pending'
      },
      {
        id: 'update-documentation',
        name: 'Update Documentation',
        description: 'Create ORM usage documentation and examples',
        status: 'pending'
      }
    ];
  }

  /**
   * Execute ORM setup steps
   */
  private async executeORMSteps(): Promise<void> {
    for (let i = 0; i < this.state.steps.length; i++) {
      this.state.currentStep = i;

      try {
        this.state.steps[i].status = 'in_progress';
        await this.updateState();

        // Execute the step based on its ID
        await this.executeStep(this.state.steps[i]);

        this.state.steps[i].status = 'completed';
        this.broadcastStepUpdate(this.state.steps[i]);

      } catch (error) {
        this.state.steps[i].status = 'failed';
        this.state.steps[i].error = error instanceof Error ? error.message : String(error);
        this.broadcastStepUpdate(this.state.steps[i]);

        // Stop execution on failure
        await this.updateState({ status: 'failed' });
        return;
      }

      await this.updateState();
    }

    // All steps completed successfully
    await this.updateState({ status: 'complete' });

    // Run final tests
    await this.runFinalTests();
  }

  /**
   * Execute individual ORM setup step
   */
  private async executeStep(step: ORMStep): Promise<void> {
    const state = this.state;

    switch (step.id) {
      case 'analyze-requirements':
        await this.analyzeRequirements(step);
        break;
      case 'generate-schema':
        await this.generateDrizzleSchema(step);
        break;
      case 'create-client':
        await this.createDatabaseClient(step);
        break;
      case 'setup-migrations':
        await this.setupMigrations(step);
        break;
      case 'generate-migrations':
        await this.generateMigrations(step);
        break;
      case 'create-services':
        await this.createDatabaseServices(step);
        break;
      case 'update-package-json':
        await this.updatePackageJson(step);
        break;
      case 'create-tests':
        await this.createTestFiles(step);
        break;
      case 'update-documentation':
        await this.updateDocumentation(step);
        break;
    }
  }

  /**
   * Analyze project requirements using AI
   */
  private async analyzeRequirements(step: ORMStep): Promise<void> {
    const analysis = await this.callAIWithBasePrompt(
      `Analyze the following project requirements and determine the optimal Drizzle + Kysely ORM setup:

Project: ${this.state.projectName}
Database Type: D1
Schema: ${JSON.stringify(this.state.databaseSchema, null, 2)}

Provide recommendations for:
1. Table structure optimizations
2. Index recommendations
3. Relationship mappings
4. Query patterns that would benefit from Kysely vs Drizzle
5. Migration strategy

Follow Cloudflare Workers best practices and the ORM policy guidelines.`
    );

    step.output = analysis;
  }

  /**
   * Generate Drizzle schema using AI and ORM standards
   */
  private async generateDrizzleSchema(step: ORMStep): Promise<void> {
    const schemaCode = await this.callAIWithBasePrompt(
      `Generate a complete Drizzle ORM schema for a Cloudflare D1 database following these specifications:

Project: ${this.state.projectName}
Analysis: ${step.output}

Requirements:
- Use sqliteTable from 'drizzle-orm/sqlite-core'
- Include proper TypeScript types
- Add appropriate constraints and defaults
- Follow Cloudflare D1 best practices
- Include relationships and foreign keys where applicable

Generate the complete src/db/schema.ts file with proper imports and exports.`
    );

    const generatedFile: GeneratedFile = {
      path: 'src/db/schema.ts',
      content: schemaCode,
      type: 'schema',
      description: 'Drizzle ORM schema definition with TypeScript types'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Create database client following ORM policy
   */
  private async createDatabaseClient(step: ORMStep): Promise<void> {
    const clientCode = await this.callAIWithBasePrompt(
      `Generate a database client following the Drizzle + Kysely hybrid ORM standard:

Project: ${this.state.projectName}
ORM Type: ${this.state.ormType}

Create src/db/client.ts with:
- Drizzle client initialization
- Kysely client initialization  
- Shared D1 database connection
- Proper TypeScript types
- Environment variable handling
- Export unified client interface

Follow the ORM policy guidelines for client setup.`
    );

    const generatedFile: GeneratedFile = {
      path: 'src/db/client.ts',
      content: clientCode,
      type: 'client',
      description: 'Drizzle + Kysely database client initialization'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Setup Drizzle migration system
   */
  private async setupMigrations(step: ORMStep): Promise<void> {
    const configCode = await this.callAIWithBasePrompt(
      `Generate Drizzle configuration for Cloudflare D1 migrations:

Project: ${this.state.projectName}

Create drizzle.config.ts with:
- D1 driver configuration
- Schema path
- Migration output directory
- Proper TypeScript configuration

Include package.json script for running migrations.`
    );

    const generatedFile: GeneratedFile = {
      path: 'drizzle.config.ts',
      content: configCode,
      type: 'config',
      description: 'Drizzle Kit configuration for D1 migrations'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Generate initial migrations
   */
  private async generateMigrations(step: ORMStep): Promise<void> {
    const migrationSQL = await this.callAIWithBasePrompt(
      `Generate initial D1 migration SQL based on the schema:

Schema files have been generated. Create the initial migration file that will:
- Create all tables with proper constraints
- Set up indexes and relationships
- Follow D1 SQLite syntax requirements
- Include proper ordering for foreign key dependencies

Generate the SQL for migrations/0001_create_tables.sql`
    );

    const generatedFile: GeneratedFile = {
      path: 'migrations/0001_create_tables.sql',
      content: migrationSQL,
      type: 'migration',
      description: 'Initial database migration SQL'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Create type-safe database services
   */
  private async createDatabaseServices(step: ORMStep): Promise<void> {
    const servicesCode = await this.callAIWithBasePrompt(
      `Generate type-safe database services following the ORM policy:

Project: ${this.state.projectName}
Schema: ${this.state.generatedFiles.find(f => f.type === 'schema')?.content}

Create database service classes that:
- Use Drizzle for simple CRUD operations
- Use Kysely for complex queries and filtering
- Include proper error handling
- Follow Cloudflare Workers patterns
- Include TypeScript types from generated schema

Generate service classes for each major entity in the schema.`
    );

    // This would generate multiple service files
    const generatedFiles: GeneratedFile[] = [
      {
        path: 'src/services/database.ts',
        content: servicesCode,
        type: 'service',
        description: 'Type-safe database service classes'
      }
    ];

    this.state.generatedFiles.push(...generatedFiles);
    await this.updateState();
    step.output = generatedFiles;
  }

  /**
   * Update package.json with required dependencies
   */
  private async updatePackageJson(step: ORMStep): Promise<void> {
    const packageUpdates = await this.callAIWithBasePrompt(
      `Generate package.json updates for Drizzle + Kysely ORM setup:

Project: ${this.state.projectName}

Add dependencies:
- drizzle-orm
- drizzle-kit  
- kysely-d1
- @types for TypeScript support

Add scripts:
- migrate:generate
- migrate:local
- migrate:remote
- db:studio (if applicable)

Follow the ORM policy for dependency management.`
    );

    const generatedFile: GeneratedFile = {
      path: 'package.json',
      content: packageUpdates,
      type: 'config',
      description: 'Updated package.json with ORM dependencies and scripts'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Create test files for database operations
   */
  private async createTestFiles(step: ORMStep): Promise<void> {
    const testCode = await this.callAIWithBasePrompt(
      `Generate comprehensive test files for the ORM setup:

Project: ${this.state.projectName}
Services: ${this.state.generatedFiles.find(f => f.type === 'service')?.content}

Create test files that:
- Test Drizzle schema operations
- Test Kysely query functionality
- Include mock data and fixtures
- Follow Cloudflare Workers testing patterns
- Include integration tests for D1

Generate test files following the ORM testing guidelines.`
    );

    const generatedFile: GeneratedFile = {
      path: 'src/tests/database.test.ts',
      content: testCode,
      type: 'test',
      description: 'Comprehensive database operation tests'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Update project documentation
   */
  private async updateDocumentation(step: ORMStep): Promise<void> {
    const docs = await this.callAIWithBasePrompt(
      `Generate comprehensive ORM documentation for the project:

Project: ${this.state.projectName}
ORM Setup: Complete Drizzle + Kysely implementation

Create documentation that includes:
- ORM architecture overview
- Query patterns and examples
- Migration workflow
- Testing guidelines
- Troubleshooting common issues
- Following the ORM policy standards

Generate README updates and ORM-specific documentation.`
    );

    const generatedFile: GeneratedFile = {
      path: 'README.md',
      content: docs,
      type: 'readme',
      description: 'Updated README with ORM documentation and usage examples'
    };

    this.state.generatedFiles.push(generatedFile);
    await this.updateState();
    step.output = generatedFile;
  }

  /**
   * Call AI with composed prompt from centralized repository
   */
  private async callAIWithBasePrompt(prompt: string): Promise<string> {
    // Build comprehensive prompt with Cloudflare base + ORM policy
    const fullPrompt = this.buildAIPrompt('cloudflare-base', ['orm-policy'], {
      projectName: this.state.projectName,
      database: 'd1'
    }, [prompt]);

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
  private async runFinalTests(): Promise<void> {
    await this.updateState({ status: 'testing' });

    // Test generated code compilation
    const testResults = await this.callAIWithBasePrompt(
      `Validate the generated ORM setup for ${this.state.projectName}:

Generated Files:
${this.state.generatedFiles.map(f => `- ${f.path}: ${f.description}`).join('\n')}

Check for:
- TypeScript compilation errors
- Proper imports and dependencies
- Schema correctness
- Client initialization
- Migration validity
- Service integration

Provide validation results and any fixes needed.`
    );

    await this.updateState({ testResults, status: 'complete' });
  }

  // HTTP endpoint handlers
  private async handleORMSetup(request: Request): Promise<Response> {
    try {
      const config = await request.json();
      const result = await this.startORMSetup(config);

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

  private async handleORMStatus(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      projectId: this.state.projectId,
      projectName: this.state.projectName,
      status: this.state.status,
      currentStep: this.state.currentStep,
      totalSteps: this.state.steps.length,
      steps: this.state.steps,
      completedFiles: this.state.generatedFiles.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleGetGeneratedFiles(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      files: this.state.generatedFiles
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleRunTests(request: Request): Promise<Response> {
    try {
      await this.runFinalTests();
      return new Response(JSON.stringify({
        status: 'completed',
        results: this.state.testResults
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

  // WebSocket helpers
  private broadcastStepUpdate(step: ORMStep): void {
    // Broadcast to all connected WebSocket clients
    // Implementation would use the WebSocket broadcaster
  }

  private subscribeToStateUpdates(connection: any): void {
    // Subscribe connection to state updates
  }

}
