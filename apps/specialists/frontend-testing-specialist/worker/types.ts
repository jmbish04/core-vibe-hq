export interface Env {
  // Browser bindings for Cloudflare
  BROWSER: Fetcher;

  // Orchestrator service binding
  ORCHESTRATOR: Fetcher;

  // Environment variables
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ZONE_ID?: string;

  // Test configuration
  TEST_BASE_URL?: string;
  TEST_ENVIRONMENT?: 'local' | 'cloudflare' | 'production';
  PLAYWRIGHT_PROJECT?: string;
  PUPPETEER_EXECUTABLE_PATH?: string;

  // KV for storing test configurations
  TEST_CONFIGS: KVNamespace;

  // Durable Objects for test coordination
  TEST_COORDINATOR: DurableObjectNamespace;
}

// Test framework types
export type TestFramework = 'playwright' | 'puppeteer';

export type TestEnvironment = 'local' | 'cloudflare' | 'production';

export type TestType = 'smoke' | 'integration' | 'e2e' | 'visual-regression';

// Configuration interfaces
export interface PlaywrightConfig {
  framework: 'playwright';
  browser: 'chromium' | 'firefox' | 'webkit' | 'all';
  headless: boolean;
  viewport?: { width: number; height: number };
  baseURL?: string;
  timeout?: number;
  retries?: number;
  workers?: number;
  screenshot?: 'on' | 'off' | 'only-on-failure';
  video?: 'on' | 'off' | 'retain-on-failure';
  trace?: 'on' | 'off' | 'retain-on-failure';
}

export interface PuppeteerConfig {
  framework: 'puppeteer';
  browser: 'chromium' | 'firefox';
  headless: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  timeout?: number;
  slowMo?: number;
  devtools?: boolean;
  args?: string[];
}

export type TestConfig = PlaywrightConfig | PuppeteerConfig;

// Test execution interfaces
export interface TestExecutionRequest {
  framework: TestFramework;
  environment: TestEnvironment;
  testType: TestType;
  config: TestConfig;
  targetUrl?: string;
  testFiles?: string[];
  cloudflareWorkerName?: string;
  cloudflareZoneId?: string;
}

export interface TestExecutionResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  framework: TestFramework;
  environment: TestEnvironment;
  testType: TestType;
  startTime: string;
  endTime?: string;
  duration?: number;
  results?: TestResult[];
  artifacts?: TestArtifact[];
  error?: string;
}

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
  trace?: string;
}

export interface TestArtifact {
  name: string;
  type: 'screenshot' | 'video' | 'trace' | 'log';
  url: string;
  size?: number;
}

// Configuration generation interfaces
export interface ConfigGenerationRequest {
  framework: TestFramework;
  environment: TestEnvironment;
  projectType: 'react' | 'vue' | 'angular' | 'vanilla' | 'next' | 'nuxt';
  targetUrl?: string;
  cloudflareWorkerName?: string;
  customOptions?: Record<string, any>;
}

export interface ConfigGenerationResponse {
  config: TestConfig;
  configFile: string;
  setupInstructions: string[];
  testExamples: string[];
}
