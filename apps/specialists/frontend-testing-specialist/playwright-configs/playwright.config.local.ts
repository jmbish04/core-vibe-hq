import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for local development testing
 * Use this configuration when running tests against localhost
 */
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  retries: 0,
  workers: 1,

  // Use local development server
  use: {
    baseURL: 'http://localhost:3000',
    headless: false, // Show browser for debugging
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
    ...devices['Desktop Chrome'],
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://localhost:3000',
      },
    },
  ],

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Global setup and teardown
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});
