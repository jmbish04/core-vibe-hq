/**
 * Cloudflare Documentation Scraper
 *
 * Tools for scraping Cloudflare documentation, specifically:
 * 1. Fetching llms-full.txt files from Cloudflare docs
 * 2. Crawling referenced URLs and extracting content
 * 3. Loading worker prompts from live URLs
 *
 * These tools are designed to be used by orchestrator agents to:
 * - Load fresh documentation as system instructions
 * - Extract comprehensive context from Cloudflare docs
 * - Support AI assistants with up-to-date information
 */

export interface ScrapedContent {
    url: string
    content: string
    referencedUrls: string[]
    timestamp: string
}

export interface ScrapeResult {
    primaryContent: ScrapedContent
    referencedContents: ScrapedContent[]
    totalContent: string
}

/**
 * Extract URLs from text content
 * Looks for markdown links, plain URLs, and relative paths
 */
function extractUrls(content: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  // Extract markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const url = match[2];
    if (url.startsWith('http')) {
      urls.add(url);
    } else if (url.startsWith('/')) {
      urls.add(new URL(url, baseUrl).href);
    }
  }

  // Extract plain URLs
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  while ((match = urlRegex.exec(content)) !== null) {
    urls.add(match[0].replace(/[.,;:!?]+$/, ''));
  }

  // Extract relative paths that look like documentation URLs
  const relativePathRegex = /\/[a-z0-9-]+\/[a-z0-9-/]+/g;
  while ((match = relativePathRegex.exec(content)) !== null) {
    const path = match[0];
    if (path.includes('/') && path.split('/').length >= 2) {
      try {
        const fullUrl = new URL(path, baseUrl).href;
        if (fullUrl.includes('developers.cloudflare.com')) {
          urls.add(fullUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return Array.from(urls);
}

/**
 * Fetch content from a URL with retries and error handling
 */
async function fetchWithRetry(
  url: string,
  retries = 3,
  timeout = 30000,
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Cloudflare-Workers-Docs-Scraper/1.0',
          'Accept': 'text/plain, text/markdown, text/html, */*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404 && i < retries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle different content types
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return JSON.stringify(json, null, 2);
      } else {
        return await response.text();
      }
    } catch (error: any) {
      if (i === retries - 1) {
        throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${error.message}`);
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/**
 * Scrape llms-full.txt from Cloudflare docs
 *
 * @param bindingType - The Cloudflare binding/service type (e.g., 'agents', 'workflows', 'workers')
 * @param keywords - Optional keywords to search for in the content
 * @param maxDepth - Maximum depth for crawling referenced URLs (default: 2)
 * @returns Scraped content with all referenced URLs crawled
 */
export async function scrapeCloudflareDocs(
  bindingType: string,
  keywords?: string[],
  maxDepth = 2,
): Promise<ScrapeResult> {
  const baseUrl = `https://developers.cloudflare.com/${bindingType}/llms-full.txt`;

  // Fetch primary llms-full.txt
  const primaryContent = await fetchWithRetry(baseUrl);
  const referencedUrls = extractUrls(primaryContent, `https://developers.cloudflare.com/${bindingType}/`);

  const primary: ScrapedContent = {
    url: baseUrl,
    content: primaryContent,
    referencedUrls,
    timestamp: new Date().toISOString(),
  };

  // Filter URLs if keywords provided
  let urlsToCrawl = referencedUrls;
  if (keywords && keywords.length > 0) {
    urlsToCrawl = referencedUrls.filter(url => {
      const urlLower = url.toLowerCase();
      return keywords.some(keyword => urlLower.includes(keyword.toLowerCase()));
    });
  }

  // Limit URLs to crawl to prevent excessive requests
  const maxUrls = 50;
  urlsToCrawl = urlsToCrawl.slice(0, maxUrls);

  // Crawl referenced URLs (up to maxDepth)
  const referencedContents: ScrapedContent[] = [];
  const crawledUrls = new Set<string>([baseUrl]);

  async function crawlUrl(url: string, depth: number): Promise<void> {
    if (depth > maxDepth || crawledUrls.has(url)) {
      return;
    }

    crawledUrls.add(url);

    try {
      const content = await fetchWithRetry(url);
      const nestedUrls = extractUrls(content, url);

      const scraped: ScrapedContent = {
        url,
        content,
        referencedUrls: nestedUrls,
        timestamp: new Date().toISOString(),
      };

      referencedContents.push(scraped);

      // Recursively crawl nested URLs if within depth limit
      if (depth < maxDepth) {
        const nestedToCrawl = nestedUrls
          .filter(u => !crawledUrls.has(u) && u.includes('developers.cloudflare.com'))
          .slice(0, 10); // Limit nested crawling

        await Promise.all(
          nestedToCrawl.map(nestedUrl => crawlUrl(nestedUrl, depth + 1)),
        );
      }
    } catch (error: any) {
      console.warn(`Failed to crawl ${url}: ${error.message}`);
      // Continue with other URLs even if one fails
    }
  }

  // Crawl referenced URLs in parallel (with concurrency limit)
  const concurrencyLimit = 5;
  for (let i = 0; i < urlsToCrawl.length; i += concurrencyLimit) {
    const batch = urlsToCrawl.slice(i, i + concurrencyLimit);
    await Promise.all(batch.map(url => crawlUrl(url, 1)));
  }

  // Combine all content
  const totalContent = [
    `# Primary Documentation: ${baseUrl}`,
    primaryContent,
    ...referencedContents.map(ref => `\n\n# Referenced Documentation: ${ref.url}\n${ref.content}`),
  ].join('\n\n');

  return {
    primaryContent: primary,
    referencedContents,
    totalContent,
  };
}

/**
 * Load worker prompt from a live URL
 *
 * This is specifically for loading the main Workers system prompt from:
 * https://developers.cloudflare.com/llms.txt
 *
 * @param url - The URL to load (defaults to main llms.txt)
 * @returns The prompt content as a string
 */
export async function loadWorkerPrompt(url?: string): Promise<string> {
  const promptUrl = url || 'https://developers.cloudflare.com/llms.txt';

  try {
    const content = await fetchWithRetry(promptUrl);
    return content;
  } catch (error: any) {
    throw new Error(`Failed to load worker prompt from ${promptUrl}: ${error.message}`);
  }
}

/**
 * Search for llms-full.txt content by keywords
 *
 * Fetches the llms-full.txt for a binding type and searches for specific keywords,
 * then crawls referenced URLs that match the keywords.
 *
 * @param bindingType - The Cloudflare binding/service type
 * @param keywords - Keywords to search for in the content
 * @returns Filtered content matching the keywords
 */
export async function searchCloudflareDocs(
  bindingType: string,
  keywords: string[],
): Promise<ScrapeResult> {
  return scrapeCloudflareDocs(bindingType, keywords, 2);
}

/**
 * Get comprehensive documentation context
 *
 * Fetches multiple llms-full.txt files and combines them into a single context.
 * Useful for loading documentation for multiple Cloudflare services at once.
 *
 * @param bindingTypes - Array of binding types to fetch
 * @returns Combined content from all sources
 */
export async function getComprehensiveDocsContext(
  bindingTypes: string[],
): Promise<{
    sources: Record<string, ScrapeResult>
    combinedContent: string
}> {
  const results = await Promise.all(
    bindingTypes.map(async (type) => {
      try {
        const result = await scrapeCloudflareDocs(type, undefined, 1);
        return { type, result };
      } catch (error: any) {
        console.warn(`Failed to fetch docs for ${type}: ${error.message}`);
        return { type, result: null };
      }
    }),
  );

  const sources: Record<string, ScrapeResult> = {};
  const contentParts: string[] = [];

  for (const { type, result } of results) {
    if (result) {
      sources[type] = result;
      contentParts.push(`\n\n# ${type.toUpperCase()} Documentation\n${result.totalContent}`);
    }
  }

  return {
    sources,
    combinedContent: contentParts.join('\n\n'),
  };
}

