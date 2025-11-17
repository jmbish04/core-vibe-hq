/**
 * UIFactoryAgent - Frontend Generation Agent for Cloudflare Workers
 *
 * This agent generates complete frontend applications including landing pages,
 * health dashboards, and API documentation for Cloudflare Workers. It can handle
 * both new worker creation and retrofitting existing workers with frontend components.
 *
 * Extends BaseFactoryAgent for consistent agent architecture and prompt management.
 */

import { BaseFactoryAgent, StructuredLogger, AgentContext } from '@shared/base/agents';
import { nanoid } from 'nanoid';
import type { BaseEnv } from '@shared/types/env';
import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

export interface UiFactoryEnv extends BaseEnv {
  ORCHESTRATOR_PROJECTS: any;
  ORCHESTRATOR_DATA: any;
  AI: any;
}

interface UiFactoryState {
  projectId: string;
  projectName: string;
  operationType: 'new-worker' | 'retrofit-worker' | 'add-frontend';
  status: 'analyzing' | 'generating-frontend' | 'creating-assets' | 'deploying' | 'complete' | 'failed';
  steps: UiFactoryStep[];
  currentStep: number;
  frontendType: 'landing-health' | 'landing-only' | 'health-only' | 'custom';
  baseUrl?: string;
  description?: string;
  generatedFiles: GeneratedFile[];
  deploymentResult?: any;
  error?: string;
}

interface UiFactoryStep {
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
  type: 'html' | 'css' | 'js' | 'json' | 'yaml';
  description: string;
}

export class UIFactoryAgent extends BaseFactoryAgent {
  protected env: UiFactoryEnv;
  private state: UiFactoryState;
  private storage: DurableObjectStorage;

  constructor(
    env: UiFactoryEnv,
    logger: StructuredLogger,
    context: AgentContext = {}
  ) {
    super(env, logger, 'apps/base/public', ['ui-factory'], context);
    this.env = env;
    this.storage = (this as any).storage || ({} as DurableObjectStorage);
    this.state = {
      projectId: '',
      projectName: '',
      operationType: 'new-worker',
      status: 'analyzing',
      steps: [],
      currentStep: 0,
      frontendType: 'landing-health',
      generatedFiles: []
    };
  }

  getFactoryType(): string {
    return 'ui-factory';
  }

  /**
   * Generate frontend for new Cloudflare Worker
   */
  async generateNewWorkerFrontend(params: {
    projectId: string;
    projectName: string;
    baseUrl?: string;
    description?: string;
    frontendType?: 'landing-health' | 'landing-only' | 'health-only' | 'custom';
  }): Promise<any> {
    await this.initializeState({
      ...params,
      operationType: 'new-worker'
    });

    try {
      await this.generateLandingPage();
      await this.generateHealthDashboard();
      await this.generateSharedAssets();
      await this.generateApiDocs();

      await this.updateState({ status: 'complete' });
      return {
        success: true,
        files: this.state.generatedFiles,
        baseUrl: this.state.baseUrl
      };
    } catch (error) {
      await this.updateState({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Retrofit existing worker with frontend
   */
  async retrofitWorkerFrontend(params: {
    projectId: string;
    projectName: string;
    baseUrl: string;
    existingApiSpec?: any;
    frontendType?: 'landing-health' | 'landing-only' | 'health-only' | 'custom';
  }): Promise<any> {
    await this.initializeState({
      ...params,
      operationType: 'retrofit-worker'
    });

    try {
      // Analyze existing worker APIs
      await this.analyzeExistingAPIs();

      // Generate appropriate frontend
      if (this.state.frontendType.includes('landing')) {
        await this.generateLandingPage();
      }
      if (this.state.frontendType.includes('health')) {
        await this.generateHealthDashboard();
      }

      await this.generateSharedAssets();
      await this.generateApiDocs();

      await this.updateState({ status: 'complete' });
      return {
        success: true,
        files: this.state.generatedFiles,
        baseUrl: this.state.baseUrl
      };
    } catch (error) {
      await this.updateState({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async initializeState(params: Partial<UiFactoryState>): Promise<void> {
    this.state = {
      ...this.state,
      ...params,
      steps: [
        { id: 'analyze', name: 'Analyze Requirements', description: 'Analyze project requirements and existing APIs', status: 'pending' },
        { id: 'generate-landing', name: 'Generate Landing Page', description: 'Create cinematic landing page with Vibe Engineer aesthetic', status: 'pending' },
        { id: 'generate-health', name: 'Generate Health Dashboard', description: 'Create HeroUI health monitoring dashboard', status: 'pending' },
        { id: 'generate-assets', name: 'Generate Shared Assets', description: 'Create nav, styles, and client libraries', status: 'pending' },
        { id: 'generate-docs', name: 'Generate API Documentation', description: 'Create OpenAPI 3.1.0 documentation', status: 'pending' },
        { id: 'deploy', name: 'Deploy Frontend', description: 'Deploy generated frontend to worker', status: 'pending' }
      ],
      currentStep: 0
    };
    await this.saveState();
  }

  private async generateLandingPage(): Promise<void> {
    await this.updateStepStatus('generate-landing', 'in_progress');

    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['framework-policy'],
      {
        projectName: this.state.projectName,
        baseUrl: this.state.baseUrl,
        description: this.state.description
      },
      [
        'Generate a cinematic landing page (index.html) with Vibe Engineer aesthetic.',
        'Include hero section with gradients, scroll animations, narrative structure.',
        'Use Tailwind CSS (CDN), Inter font, indigo/emerald color palette.',
        'Include metrics bar, challenge/solution sections, use cases, roadmap.',
        'Add proper navigation integration and responsive design.',
        'Return the complete HTML file content.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1
    });

    const content = this.extractCodeFromResponse(response);

    this.state.generatedFiles.push({
      path: 'index.html',
      content,
      type: 'html',
      description: 'Cinematic landing page with Vibe Engineer aesthetic'
    });

    await this.updateStepStatus('generate-landing', 'completed');
  }

  private async generateHealthDashboard(): Promise<void> {
    await this.updateStepStatus('generate-health', 'in_progress');

    const prompt = this.buildAIPrompt(
      'cloudflare-base',
      ['framework-policy'],
      {
        projectName: this.state.projectName,
        baseUrl: this.state.baseUrl
      },
      [
        'Generate a health dashboard (health.html) using HeroUI components.',
        'Include real-time health metrics, test execution UI, results table.',
        'Use HeroUI cards, badges, progress components from CDN.',
        'Include WebSocket connection for live updates.',
        'Add test runner with status indicators and error tooltips.',
        'Return the complete HTML file content with inline JavaScript.'
      ]
    );

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1
    });

    const content = this.extractCodeFromResponse(response);

    this.state.generatedFiles.push({
      path: 'health.html',
      content,
      type: 'html',
      description: 'HeroUI health dashboard with real-time monitoring'
    });

    await this.updateStepStatus('generate-health', 'completed');
  }

  private async generateSharedAssets(): Promise<void> {
    await this.updateStepStatus('generate-assets', 'in_progress');

    // Copy shared assets from apps/base/public
    const sharedAssets = [
      { source: 'nav.html', description: 'Shared sticky navigation component' },
      { source: 'styles.css', description: 'Shared Tailwind styles and utilities' },
      { source: 'client.js', description: 'Standardized WebSocket + REST client library' }
    ];

    for (const asset of sharedAssets) {
      try {
        // In a real implementation, we'd copy from the template directory
        // For now, we'll generate placeholder content
        const content = await this.generateAssetContent(asset.source);
        this.state.generatedFiles.push({
          path: asset.source,
          content,
          type: asset.source.endsWith('.js') ? 'js' : asset.source.endsWith('.css') ? 'css' : 'html',
          description: asset.description
        });
      } catch (error) {
        this.logger.warn(`Failed to generate asset ${asset.source}`, { error });
      }
    }

    await this.updateStepStatus('generate-assets', 'completed');
  }

  private async generateApiDocs(): Promise<void> {
    await this.updateStepStatus('generate-docs', 'in_progress');

    // Generate OpenAPI 3.1.0 specification
    const openApiSpec = {
      openapi: '3.1.0',
      info: {
        title: `${this.state.projectName} API`,
        version: '1.0.0',
        description: `API documentation for ${this.state.projectName}`
      },
      servers: [{
        url: this.state.baseUrl || 'https://worker.workers.dev',
        description: 'Production server'
      }],
      paths: {
        '/health': {
          get: {
            summary: 'Get health status',
            responses: {
              200: {
                description: 'Health status',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/HealthResponse' }
                  }
                }
              }
            }
          }
        },
        '/api/tests/run': {
          post: {
            summary: 'Run health tests',
            responses: {
              200: {
                description: 'Test session started',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/TestSession' }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          HealthResponse: {
            type: 'object',
            properties: {
              uptime: { type: 'string' },
              totalRequests: { type: 'number' },
              testsPassing: { type: 'number' },
              totalTests: { type: 'number' }
            }
          },
          TestSession: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              status: { type: 'string' }
            }
          }
        }
      }
    };

    this.state.generatedFiles.push({
      path: 'openapi.json',
      content: JSON.stringify(openApiSpec, null, 2),
      type: 'json',
      description: 'OpenAPI 3.1.0 specification'
    });

    // Generate YAML version
    const yamlContent = await this.convertJsonToYaml(JSON.stringify(openApiSpec));
    this.state.generatedFiles.push({
      path: 'openapi.yaml',
      content: yamlContent,
      type: 'yaml',
      description: 'OpenAPI 3.1.0 specification in YAML format'
    });

    await this.updateStepStatus('generate-docs', 'completed');
  }

  private async analyzeExistingAPIs(): Promise<void> {
    await this.updateStepStatus('analyze', 'in_progress');

    if (this.state.operationType === 'retrofit-worker' && this.state.baseUrl) {
      try {
        // Try to fetch existing OpenAPI spec
        const response = await fetch(`${this.state.baseUrl}/openapi.json`);
        if (response.ok) {
          const existingSpec = await response.json();
          this.logger.info('Found existing OpenAPI spec', { spec: existingSpec.info });
        }
      } catch (error) {
        this.logger.warn('Could not fetch existing API spec', { error });
      }
    }

    await this.updateStepStatus('analyze', 'completed');
  }

  private async generateAssetContent(assetName: string): Promise<string> {
    // This would normally copy from the template directory
    // For now, return placeholder content
    switch (assetName) {
      case 'nav.html':
        return `<!-- Shared Navigation Component -->
<nav class="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center space-x-3">
        <a href="/" class="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div class="w-8 h-8 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <span class="text-white font-semibold text-lg">${this.state.projectName || 'Vibe Engineer'}</span>
        </a>
      </div>
      <div class="hidden md:flex items-center space-x-8">
        <a href="/" class="text-slate-300 hover:text-white transition-colors duration-200">Home</a>
        <a href="/health.html" class="text-slate-300 hover:text-emerald-400 transition-colors duration-200">Health</a>
        <a href="/openapi.json" class="text-slate-300 hover:text-indigo-400 transition-colors duration-200">API Docs</a>
      </div>
    </div>
  </div>
</nav>`;

      case 'styles.css':
        return `/* Shared Styles */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .glass-card { @apply bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700; }
  .fade-in-up { opacity: 0; transform: translateY(30px); animation: fadeInUp 0.6s ease-out forwards; }
}

@keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }`;

      case 'client.js':
        return `// Shared Client Library
class VibeClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || window.location.origin;
    this.eventListeners = new Map();
  }

  on(event, callback) { this.eventListeners.set(event, callback); }
  emit(event, data) { if (this.eventListeners.has(event)) this.eventListeners.get(event)(data); }

  async get(endpoint) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`);
    return response.json();
  }

  async post(endpoint, data) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

window.vibeClient = new VibeClient();`;

      default:
        return '';
    }
  }

  private async convertJsonToYaml(jsonString: string): Promise<string> {
    // Simple JSON to YAML conversion (in practice, you'd use a proper library)
    const obj = JSON.parse(jsonString);
    return JSON.stringify(obj, null, 2); // Placeholder - return JSON for now
  }

  private extractCodeFromResponse(response: any): string {
    if (typeof response === 'string') return response;
    if (response?.response) return response.response;
    if (response?.result) return response.result;
    return '';
  }

  private async updateStepStatus(stepId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed', error?: string): Promise<void> {
    const step = this.state.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (error) step.error = error;
    }
    await this.saveState();
  }

  private async loadState(): Promise<void> {
    const storedState = await this.storage.get('agent-state') as UiFactoryState;
    if (storedState) {
      this.state = { ...this.state, ...storedState };
    }
  }

  private async saveState(): Promise<void> {
    await this.storage.put('agent-state', this.state);
  }

  private async updateState(updates: Partial<UiFactoryState>): Promise<void> {
    this.state = { ...this.state, ...updates };
    await this.saveState();
  }
}

export default UIFactoryAgent;
