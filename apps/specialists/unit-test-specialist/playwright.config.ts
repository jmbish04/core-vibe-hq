import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

function getTestIgnorePatterns(): string[] {
  const isLive = process.env.PLAYWRIGHT_USE_LIVE === 'true';
  if (!isLive) return [];

  const templatesRoot = process.cwd();
  const entries = readdirSync(templatesRoot, { withFileTypes: true });
  const templateDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('-template'))
    .map((entry) => entry.name);

  const unpublishedTemplates: string[] = [];
  for (const templateDir of templateDirs) {
    const packageJsonPath = join(templatesRoot, templateDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const cloudflareConfig = packageJson.cloudflare;
        if (!cloudflareConfig || cloudflareConfig.publish !== true) {
          unpublishedTemplates.push(`**/${templateDir}.spec.ts`);
        }
      } catch (error) {
        unpublishedTemplates.push(`**/${templateDir}.spec.ts`);
      }
    } else {
      unpublishedTemplates.push(`**/${templateDir}.spec.ts`);
    }
  }

  return unpublishedTemplates;
}

export default defineConfig({
  testDir: './playwright-tests',
  fullyParallel: process.env.PLAYWRIGHT_USE_LIVE === 'true',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  testIgnore: getTestIgnorePatterns(),
  workers: process.env.PLAYWRIGHT_USE_LIVE === 'true' ? 4 : 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    actionTimeout: process.env.PLAYWRIGHT_USE_LIVE === 'true' ? 5_000 : 10_000,
    navigationTimeout: process.env.PLAYWRIGHT_USE_LIVE === 'true' ? 15_000 : 30_000,
  },
  timeout: process.env.PLAYWRIGHT_USE_LIVE === 'true' ? 30_000 : 60_000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
