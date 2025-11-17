import { defineConfig, devices } from '@cloudflare/playwright';

/**
 * Playwright configuration for Cloudflare Workers testing
 * Use this configuration when running tests against deployed Cloudflare Workers
 */
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  retries: 2, // More retries for production testing
  workers: 1, // Cloudflare only supports 1 worker

  // Use Cloudflare Worker URL
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://your-app.workers.dev',
    headless: true, // Always headless in Cloudflare
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ...devices['Desktop Chrome'], // Only Chromium supported in Cloudflare
  },

  // Single project for Cloudflare (Chromium only)
  projects: [
    {
      name: 'cloudflare-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.TEST_BASE_URL || 'https://your-app.workers.dev',
        headless: true,
      },
    },
  ],

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/cloudflare-results.json' }],
  ],

  // Global setup for Cloudflare environment
  globalSetup: './tests/cloudflare-setup.ts',
});
