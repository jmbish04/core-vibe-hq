import type {
  ConfigGenerationRequest,
  ConfigGenerationResponse,
  PlaywrightConfig,
  PuppeteerConfig,
  TestConfig
} from '../types';

/**
 * Service for generating Playwright and Puppeteer configurations
 * based on project type and environment requirements
 */
export class ConfigGenerator {
  /**
   * Generate a test configuration based on the request parameters
   */
  async generateConfig(request: ConfigGenerationRequest): Promise<ConfigGenerationResponse> {
    const { framework, environment, projectType, targetUrl, cloudflareWorkerName, customOptions } = request;

    let config: TestConfig;
    let configFile: string;
    let setupInstructions: string[];
    let testExamples: string[];

    if (framework === 'playwright') {
      ({ config, configFile, setupInstructions, testExamples } = this.generatePlaywrightConfig(
        environment,
        projectType,
        targetUrl,
        cloudflareWorkerName,
        customOptions
      ));
    } else {
      ({ config, configFile, setupInstructions, testExamples } = this.generatePuppeteerConfig(
        environment,
        projectType,
        targetUrl,
        customOptions
      ));
    }

    return {
      config,
      configFile,
      setupInstructions,
      testExamples
    };
  }

  private generatePlaywrightConfig(
    environment: string,
    projectType: string,
    targetUrl?: string,
    cloudflareWorkerName?: string,
    customOptions?: Record<string, any>
  ): Omit<ConfigGenerationResponse, 'config'> & { config: PlaywrightConfig } {
    const baseConfig: PlaywrightConfig = {
      framework: 'playwright',
      browser: 'chromium',
      headless: environment === 'cloudflare' || environment === 'production',
      viewport: { width: 1280, height: 720 },
      baseURL: targetUrl,
      timeout: 30000,
      retries: environment === 'production' ? 2 : 0,
      workers: environment === 'local' ? 1 : undefined,
      screenshot: 'only-on-failure',
      video: environment === 'production' ? 'retain-on-failure' : 'off',
      trace: environment === 'production' ? 'retain-on-failure' : 'off',
      ...customOptions
    };

    // Adjust config based on project type
    switch (projectType) {
      case 'react':
      case 'next':
        baseConfig.viewport = { width: 1920, height: 1080 }; // Larger viewport for modern web apps
        break;
      case 'vue':
      case 'nuxt':
        baseConfig.timeout = 45000; // Vue apps might need more time for hydration
        break;
      case 'angular':
        baseConfig.timeout = 60000; // Angular apps often need more time for compilation
        break;
    }

    // Environment-specific adjustments
    if (environment === 'cloudflare') {
      baseConfig.browser = 'chromium'; // Cloudflare only supports Chromium
      baseConfig.workers = 1; // Single worker in Cloudflare environment
      baseConfig.headless = true;
    }

    const configFile = this.generatePlaywrightConfigFile(baseConfig, environment, cloudflareWorkerName);
    const setupInstructions = this.generatePlaywrightSetupInstructions(environment, projectType);
    const testExamples = this.generatePlaywrightTestExamples(projectType, baseConfig);

    return {
      config: baseConfig,
      configFile,
      setupInstructions,
      testExamples
    };
  }

  private generatePuppeteerConfig(
    environment: string,
    projectType: string,
    _targetUrl?: string,
    customOptions?: Record<string, any>
  ): Omit<ConfigGenerationResponse, 'config'> & { config: PuppeteerConfig } {
    const baseConfig: PuppeteerConfig = {
      framework: 'puppeteer',
      browser: 'chromium',
      headless: environment === 'cloudflare' || environment === 'production',
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      timeout: 30000,
      slowMo: environment === 'local' ? 100 : 0,
      devtools: environment === 'local',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      ...customOptions
    };

    // Project-specific adjustments
    switch (projectType) {
      case 'react':
      case 'next':
        baseConfig.viewport = { width: 1920, height: 1080 };
        baseConfig.args?.push('--disable-web-security'); // For CORS-heavy React apps
        break;
      case 'vue':
      case 'nuxt':
        baseConfig.timeout = 45000;
        break;
      case 'angular':
        baseConfig.timeout = 60000;
        break;
    }

    // Environment-specific adjustments
    if (environment === 'cloudflare') {
      baseConfig.browser = 'chromium';
      baseConfig.headless = true;
      baseConfig.devtools = false;
    }

    const configFile = this.generatePuppeteerConfigFile(baseConfig, environment);
    const setupInstructions = this.generatePuppeteerSetupInstructions(environment, projectType);
    const testExamples = this.generatePuppeteerTestExamples(projectType, baseConfig);

    return {
      config: baseConfig,
      configFile,
      setupInstructions,
      testExamples
    };
  }

  private generatePlaywrightConfigFile(
    config: PlaywrightConfig,
    environment: string,
    cloudflareWorkerName?: string
  ): string {
    const isCloudflare = environment === 'cloudflare';

    return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: ${config.timeout},
  expect: {
    timeout: 5000,
  },
  retries: ${config.retries},
  ${config.workers ? `workers: ${config.workers},` : ''}
  ${isCloudflare ? `use: {
    baseURL: '${config.baseURL || 'https://' + (cloudflareWorkerName || 'your-worker') + '.your-domain.workers.dev'}',
    headless: ${config.headless},
    screenshot: '${config.screenshot}',
    video: '${config.video}',
    trace: '${config.trace}',
    viewport: { width: ${config.viewport?.width}, height: ${config.viewport?.height} },
    ...devices['Desktop Chrome'],
  },` : `projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: '${config.baseURL || 'http://localhost:3000'}',
        headless: ${config.headless},
        screenshot: '${config.screenshot}',
        video: '${config.video}',
        trace: '${config.trace}',
        viewport: { width: ${config.viewport?.width}, height: ${config.viewport?.height} },
      },
    },
    ${config.browser === 'all' ? `
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: '${config.baseURL || 'http://localhost:3000'}',
        headless: ${config.headless},
        screenshot: '${config.screenshot}',
        viewport: { width: ${config.viewport?.width}, height: ${config.viewport?.height} },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: '${config.baseURL || 'http://localhost:3000'}',
        headless: ${config.headless},
        screenshot: '${config.screenshot}',
        viewport: { width: ${config.viewport?.width}, height: ${config.viewport?.height} },
      },
    },` : ''}
  ],`}
  outputDir: 'test-results/',
});`;
  }

  private generatePuppeteerConfigFile(config: PuppeteerConfig, environment: string): string {
    const isCloudflare = environment === 'cloudflare';

    return `import puppeteer from '${isCloudflare ? '@cloudflare/puppeteer' : 'puppeteer'}';

export const puppeteerConfig = {
  headless: ${config.headless},
  ${config.args ? `args: ${JSON.stringify(config.args, null, 2)},` : ''}
  ${config.timeout ? `timeout: ${config.timeout},` : ''}
  ${config.slowMo ? `slowMo: ${config.slowMo},` : ''}
  ${config.devtools ? `devtools: ${config.devtools},` : ''}
  ${config.userAgent ? `userAgent: '${config.userAgent}',` : ''}
  defaultViewport: {
    width: ${config.viewport?.width || 1280},
    height: ${config.viewport?.height || 720},
  },
};

export const getBrowserConfig = () => ({
  ...puppeteerConfig,
  ${isCloudflare ? `// Cloudflare-specific configuration
  // Browser is provided via env.BROWSER binding` : `// Local development configuration
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,`}
});

export const getPageConfig = () => ({
  viewport: puppeteerConfig.defaultViewport,
  userAgent: puppeteerConfig.userAgent,
});`;
  }

  private generatePlaywrightSetupInstructions(environment: string, projectType: string): string[] {
    const instructions = [
      '1. Install Playwright dependencies:',
      '   npm install --save-dev @playwright/test',
      '   npx playwright install'
    ];

    if (environment === 'local') {
      instructions.push(
        '2. Create a tests/ directory in your project root',
        '3. Add test scripts to package.json:',
        '   "test:e2e": "playwright test"',
        '   "test:e2e:ui": "playwright test --ui"'
      );
    } else if (environment === 'cloudflare') {
      instructions.push(
        '2. Install Cloudflare Playwright:',
        '   npm install --save-dev @cloudflare/playwright',
        '3. Configure browser binding in wrangler.toml:',
        '   [browser]',
        '   binding = "BROWSER"'
      );
    }

    instructions.push(
      `4. Configure for ${projectType} framework`,
      '5. Run tests: npm run test:e2e'
    );

    return instructions;
  }

  private generatePuppeteerSetupInstructions(environment: string, projectType: string): string[] {
    const instructions = [
      '1. Install Puppeteer dependencies:',
      '   npm install puppeteer'
    ];

    if (environment === 'cloudflare') {
      instructions.push(
        '   npm install @cloudflare/puppeteer'
      );
    }

    instructions.push(
      '2. Create a tests/ directory for your test files',
      '3. Add test scripts to package.json:',
      '   "test:puppeteer": "node tests/run-tests.js"',
      `4. Configure for ${projectType} framework`,
      '5. Run tests: npm run test:puppeteer'
    );

    return instructions;
  }

  private generatePlaywrightTestExamples(projectType: string, _config: PlaywrightConfig): string[] {
    const examples = [
      `// Basic navigation test
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});`
    ];

    // Framework-specific examples
    switch (projectType) {
      case 'react':
        examples.push(`
// React component test
test('react app renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="app-root"]')).toBeVisible();
});`);
        break;
      case 'vue':
        examples.push(`
// Vue app test
test('vue app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
});`);
        break;
      case 'angular':
        examples.push(`
// Angular app test
test('angular app bootstraps', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('app-root')).toBeVisible();
});`);
        break;
    }

    return examples;
  }

  private generatePuppeteerTestExamples(_projectType: string, config: PuppeteerConfig): string[] {
    const isCloudflare = config.headless && !config.devtools;

    const examples = [
      `${isCloudflare ? `import { getBrowser, getPage } from '../config/puppeteer-config.js';

const runTests = async () => {
  const browser = await getBrowser();
  const page = await browser.newPage(getPage());` : `import puppeteer from 'puppeteer';
import { puppeteerConfig } from '../config/puppeteer-config.js';

const runTests = async () => {
  const browser = await puppeteer.launch(puppeteerConfig);
  const page = await browser.newPage();`}

  try {
    await page.goto('${config.headless ? 'https://your-app.workers.dev' : 'http://localhost:3000'}');
    const title = await page.title();
    console.log('Page title:', title);

    // Add your test assertions here
    const h1 = await page.$('h1');
    if (!h1) throw new Error('H1 element not found');

    console.log('✅ Basic navigation test passed');
  } finally {
    await browser.close();
  }
};

runTests().catch(console.error);`
    ];

    return examples;
  }
}
