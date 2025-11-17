import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_PREVIEW_URL ?? 'http://127.0.0.1:8787';

async function goto(page: any, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
}

test.describe('Preview smoke tests', () => {
  test('home page renders', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveTitle(/vibe/i);
  });

  test('login page displays form', async ({ page }) => {
    await goto(page, '/login');
    await expect(page.locator('form')).toBeVisible();
  });
});
