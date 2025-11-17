import puppeteer from '@cloudflare/puppeteer';

/**
 * Puppeteer configuration for Cloudflare Workers testing
 * Use this configuration when running tests against deployed Cloudflare Workers
 */
export const puppeteerConfig = {
  headless: true, // Always headless in Cloudflare
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ],
  timeout: 30000,
  slowMo: 0, // No slow down in production
  devtools: false,
  defaultViewport: {
    width: 1280,
    height: 720,
  },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CloudflareTest/1.0',
};

export const getBrowserConfig = () => ({
  ...puppeteerConfig,
  // Cloudflare provides the browser via env.BROWSER binding
});

export const getPageConfig = () => ({
  viewport: puppeteerConfig.defaultViewport,
  userAgent: puppeteerConfig.userAgent,
});

// Helper function to create a new browser instance for Cloudflare
export async function createCloudflareBrowser(env: { BROWSER: Fetcher }) {
  const browser = await puppeteer.launch(env.BROWSER);
  return browser;
}

// Helper function to create a new page with default config for Cloudflare
export async function createCloudflarePage(browser: any) {
  const page = await browser.newPage();
  await page.setViewport(getPageConfig().viewport);
  await page.setUserAgent(getPageConfig().userAgent);
  return page;
}

// Environment-specific test runner
export class CloudflareTestRunner {
  constructor(private env: { BROWSER: Fetcher }) {}

  async runTest(testFunction: (page: any) => Promise<void>, targetUrl: string) {
    const browser = await createCloudflareBrowser(this.env);
    const page = await createCloudflarePage(browser);

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testFunction(page);
    } finally {
      await page.close();
      await browser.close();
    }
  }
}
