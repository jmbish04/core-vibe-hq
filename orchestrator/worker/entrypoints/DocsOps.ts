/**
 * Documentation Operations Entrypoint
 *
 * RPC entrypoint for orchestrator agents to access documentation scraping tools.
 * Provides methods to:
 * - Scrape Cloudflare llms-full.txt documentation
 * - Load worker prompts from live URLs
 * - Search documentation by keywords
 * - Get comprehensive documentation context
 */

import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import type { CoreEnv } from '@shared/types/env';
import {
  scrapeCloudflareDocs,
  loadWorkerPrompt,
  searchCloudflareDocs,
  getComprehensiveDocsContext,
  type ScrapeResult,
} from '../utils/cloudflareDocsScraper';

export class DocsOps extends BaseWorkerEntrypoint<CoreEnv> {
  /**
     * Scrape Cloudflare documentation llms-full.txt
     *
     * @param params.bindingType - The Cloudflare binding/service type (e.g., 'agents', 'workflows')
     * @param params.keywords - Optional keywords to search for and filter URLs
     * @param params.maxDepth - Maximum depth for crawling referenced URLs (default: 2)
     * @returns Scraped content with primary and referenced documentation
     */
  async scrapeDocs(params: {
        bindingType: string
        keywords?: string[]
        maxDepth?: number
    }): Promise<ScrapeResult> {
    try {
      return await scrapeCloudflareDocs(
        params.bindingType,
        params.keywords,
        params.maxDepth ?? 2,
      );
    } catch (error: any) {
      throw new Error(`Failed to scrape docs for ${params.bindingType}: ${error.message}`);
    }
  }

  /**
     * Load worker prompt from live URL
     *
     * Fetches the main Workers system prompt from Cloudflare docs.
     * This is known to be fresh when scraped live.
     *
     * @param params.url - Optional URL (defaults to https://developers.cloudflare.com/llms.txt)
     * @returns The prompt content as a string
     */
  async loadWorkerPrompt(params: { url?: string } = {}): Promise<string> {
    try {
      return await loadWorkerPrompt(params.url);
    } catch (error: any) {
      throw new Error(`Failed to load worker prompt: ${error.message}`);
    }
  }

  /**
     * Search Cloudflare documentation by keywords
     *
     * Fetches llms-full.txt and crawls referenced URLs matching the keywords.
     *
     * @param params.bindingType - The Cloudflare binding/service type
     * @param params.keywords - Keywords to search for in content and URLs
     * @returns Filtered documentation content matching keywords
     */
  async searchDocs(params: {
        bindingType: string
        keywords: string[]
    }): Promise<ScrapeResult> {
    try {
      return await searchCloudflareDocs(params.bindingType, params.keywords);
    } catch (error: any) {
      throw new Error(
        `Failed to search docs for ${params.bindingType} with keywords ${params.keywords.join(', ')}: ${error.message}`,
      );
    }
  }

  /**
     * Get comprehensive documentation context from multiple sources
     *
     * Fetches llms-full.txt files for multiple binding types and combines them.
     * Useful for loading documentation for multiple Cloudflare services at once.
     *
     * @param params.bindingTypes - Array of binding types to fetch
     * @returns Combined content from all sources
     */
  async getComprehensiveContext(params: {
        bindingTypes: string[]
    }): Promise<{
        sources: Record<string, ScrapeResult>
        combinedContent: string
    }> {
    try {
      return await getComprehensiveDocsContext(params.bindingTypes);
    } catch (error: any) {
      throw new Error(`Failed to get comprehensive docs context: ${error.message}`);
    }
  }

  /**
     * Get documentation for a specific Cloudflare service with keyword filtering
     *
     * Convenience method that combines scraping with keyword filtering.
     *
     * @param params.bindingType - The Cloudflare binding/service type
     * @param params.keywords - Keywords to filter and search for
     * @returns Filtered documentation content
     */
  async getDocsForService(params: {
        bindingType: string
        keywords?: string[]
    }): Promise<ScrapeResult> {
    try {
      return await scrapeCloudflareDocs(
        params.bindingType,
        params.keywords,
        2, // Default max depth
      );
    } catch (error: any) {
      throw new Error(
        `Failed to get docs for ${params.bindingType}: ${error.message}`,
      );
    }
  }
}

