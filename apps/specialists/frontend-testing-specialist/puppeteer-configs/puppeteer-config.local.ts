import puppeteer from 'puppeteer';

/**
 * Puppeteer configuration for local development testing
 * Use this configuration when running tests against localhost
 */
export const puppeteerConfig = {
  headless: false, // Show browser for debugging
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-web-security', // Allow CORS for local development
    '--user-data-dir=/tmp/puppeteer-user-data'
  ],
  timeout: 30000,
  slowMo: 100, // Slow down for debugging
  devtools: true,
  defaultViewport: {
    width: 1280,
    height: 720,
  },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LocalTest/1.0',
};

export const getBrowserConfig = () => ({
  ...puppeteerConfig,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
});

export const getPageConfig = () => ({
  viewport: puppeteerConfig.defaultViewport,
  userAgent: puppeteerConfig.userAgent,
});

// Helper function to create a new browser instance
export async function createLocalBrowser() {
  const browser = await puppeteer.launch(getBrowserConfig());
  return browser;
}

// Helper function to create a new page with default config
export async function createLocalPage(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport(getPageConfig().viewport);
  await page.setUserAgent(getPageConfig().userAgent);
  return page;
}
