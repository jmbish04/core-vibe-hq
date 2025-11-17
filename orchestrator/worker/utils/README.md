# Orchestrator Utilities

## Cloudflare Documentation Scraper

Tools for scraping Cloudflare documentation to load fresh content as system instructions for AI assistants.

### Features

1. **Scrape llms-full.txt files** - Fetches comprehensive documentation from Cloudflare docs
2. **Crawl referenced URLs** - Automatically follows and extracts content from linked documentation
3. **Load worker prompts** - Fetches the main Workers system prompt from live URLs
4. **Keyword filtering** - Search and filter documentation by keywords
5. **Multi-source aggregation** - Combine documentation from multiple Cloudflare services

### Usage in Orchestrator Agents

Since orchestrator agents run in the same worker, they can import utilities directly:

```typescript
import {
    scrapeCloudflareDocs,
    loadWorkerPrompt,
    searchCloudflareDocs,
    getComprehensiveDocsContext,
} from '../utils/cloudflareDocsScraper'

// Example: Load Agents documentation
const agentsDocs = await scrapeCloudflareDocs('agents', ['websocket', 'state'], 2)

// Example: Load worker prompt
const workerPrompt = await loadWorkerPrompt()

// Example: Search for specific topics
const workflowDocs = await searchCloudflareDocs('workflows', ['retry', 'timeout'])

// Example: Get comprehensive context
const allDocs = await getComprehensiveDocsContext(['agents', 'workflows', 'workers'])
```

### Usage from Other Workers (via RPC)

Other workers can access these tools via the `ORCHESTRATOR_DOCS` service binding:

```typescript
// In an apps/ worker
interface Env {
    ORCHESTRATOR_DOCS: Fetcher
}

// Scrape documentation
const response = await env.ORCHESTRATOR_DOCS.fetch(
    new Request('https://internal/rpc', {
        method: 'POST',
        body: JSON.stringify({
            method: 'scrapeDocs',
            params: {
                bindingType: 'agents',
                keywords: ['websocket', 'state'],
                maxDepth: 2,
            },
        }),
    })
)

const result = await response.json<ScrapeResult>()
```

### API Reference

#### `scrapeCloudflareDocs(bindingType, keywords?, maxDepth?)`

Fetches `llms-full.txt` from `https://developers.cloudflare.com/{bindingType}/llms-full.txt` and crawls referenced URLs.

**Parameters:**
- `bindingType` (string): Cloudflare service type (e.g., 'agents', 'workflows', 'workers')
- `keywords` (string[]?, optional): Keywords to filter URLs and content
- `maxDepth` (number?, optional): Maximum depth for crawling (default: 2)

**Returns:** `Promise<ScrapeResult>`

#### `loadWorkerPrompt(url?)`

Loads the main Workers system prompt from `https://developers.cloudflare.com/llms.txt` (or custom URL).

**Parameters:**
- `url` (string?, optional): Custom URL (defaults to main llms.txt)

**Returns:** `Promise<string>`

#### `searchCloudflareDocs(bindingType, keywords)`

Searches documentation by keywords and crawls matching URLs.

**Parameters:**
- `bindingType` (string): Cloudflare service type
- `keywords` (string[]): Keywords to search for

**Returns:** `Promise<ScrapeResult>`

#### `getComprehensiveDocsContext(bindingTypes)`

Fetches documentation from multiple sources and combines them.

**Parameters:**
- `bindingTypes` (string[]): Array of service types to fetch

**Returns:** `Promise<{ sources: Record<string, ScrapeResult>, combinedContent: string }>`

### RPC Methods (via DocsOps Entrypoint)

The `DocsOps` entrypoint exposes these methods:

- `scrapeDocs(params)` - Scrape documentation
- `loadWorkerPrompt(params)` - Load worker prompt
- `searchDocs(params)` - Search documentation
- `getComprehensiveContext(params)` - Get multi-source context
- `getDocsForService(params)` - Convenience method for single service

### Examples

#### Example 1: Load Fresh System Instructions

```typescript
// Load the latest worker prompt as system instructions
const systemPrompt = await loadWorkerPrompt()
// Use systemPrompt as context for AI model
```

#### Example 2: Get Agents Documentation

```typescript
// Get comprehensive Agents SDK documentation
const agentsDocs = await scrapeCloudflareDocs('agents')
// agentsDocs.totalContent contains all scraped content
// agentsDocs.primaryContent contains the main llms-full.txt
// agentsDocs.referencedContents contains crawled URLs
```

#### Example 3: Search for Specific Topics

```typescript
// Search for WebSocket and state management docs
const docs = await searchCloudflareDocs('agents', ['websocket', 'state', 'scheduling'])
// Only URLs and content matching keywords are included
```

#### Example 4: Multi-Service Context

```typescript
// Load docs for multiple services at once
const context = await getComprehensiveDocsContext([
    'agents',
    'workflows',
    'workers',
    'durable-objects',
])
// context.combinedContent has all documentation combined
// context.sources has individual results per service
```

### Notes

- All URLs are automatically crawled up to `maxDepth` levels
- Referenced URLs are extracted from markdown links, plain URLs, and relative paths
- Content is fetched with retries and proper error handling
- Maximum of 50 URLs are crawled per request to prevent excessive requests
- All content includes timestamps for freshness tracking

