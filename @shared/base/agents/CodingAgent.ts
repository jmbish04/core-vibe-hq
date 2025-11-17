/**
 * @shared/base/agents/CodingAgent.ts
 *
 * Coding Agent with MCP Tools - Base implementation for coding assistance
 * Extends McpAgent with federated search across Cloudflare documentation and registries
 *
 * Provides tools for:
 * - Cross-MCP search across Cloudflare Docs, ShadCN registry, Context7, etc.
 * - Install UI components from ShadCN registry
 * - Access to latest best practices and documentation
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../../types";
import { promptBuilder } from "../../prompts/builder";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

/**
 * Coding Agent with MCP Tools
 * Provides federated search across Cloudflare documentation and component registries
 */
export class CodingAgent extends McpAgent<Env, Record<string, any>, {}> {
  server = new McpServer({
    name: "Coding Agent",
    version: "2.0.0",
  });

  /**
   * Get the system instructions for the Coding Agent
   * Uses the centralized prompt repository to combine Cloudflare base guidelines
   * with coding agent specialization
   */
  protected getSystemInstructions(): string {
    try {
      // Use the PromptBuilder to compose prompts properly
      const composedPrompt = promptBuilder.build('cloudflare-base', ['coding-agent']);
      return composedPrompt.content;
    } catch (error) {
      console.warn('[CodingAgent] Failed to compose prompts, falling back to basic instructions:', error);
      // Fallback to basic instructions if prompt composition fails
      return `You are a Coding Agent specialized in Cloudflare Workers development.
Focus on TypeScript, ES modules, and Cloudflare best practices.
Use MCP tools for documentation search and component installation.`;
    }
  }

  // Registry of remote MCP servers to query
  private mcpServers = [
    { name: "Cloudflare Docs", url: "https://docs.mcp.cloudflare.com/mcp" },
    { name: "Workers Bindings", url: "https://bindings.mcp.cloudflare.com/mcp" },
    { name: "Observability", url: "https://observability.mcp.cloudflare.com/mcp" },
    { name: "Radar", url: "https://radar.mcp.cloudflare.com/mcp" },
    { name: "Browser Renderer", url: "https://browser.mcp.cloudflare.com/mcp" },
    { name: "ShadCN Registry", url: "https://registry.shadcn.com/mcp" }, // example endpoint
    { name: "Context7", url: "https://context7.mcp.cloudflare.com/mcp" }, // your Context7 MCP portal
  ];

  initialState = { lastQuery: "", lastResults: [] as SearchResult[] };

  async init() {
    // Set system instructions from Cloudflare base prompt + coding agent specialization
    const systemInstructions = this.getSystemInstructions();
    console.log(`[CodingAgent] Setting system instructions (${systemInstructions.length} chars)`);

    // Set the initialize request with system instructions for MCP protocol
    await this.setInitializeRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: "Coding Agent",
          version: "2.0.0"
        },
        systemInstructions: systemInstructions
      }
    });

    /**
     * Tool: cross-MCP search
     */
    this.server.tool(
      "search",
      "Search Cloudflare Docs, ShadCN registry, and Context7 via MCP",
      z.object({ query: z.string() }),
      async ({ query }) => {
        console.log(`[CodingAgent] federated search for: ${query}`);

        const results = await this.searchAllMcpSources(query);

        // Persist minimal history
        this.setState({ ...this.state, lastQuery: query, lastResults: results });

        return {
          content: results.map((r) => ({
            type: "text",
            text: `[${r.source}] ${r.title}\n${r.snippet}\n${r.url}`,
          })),
        };
      }
    );

    /**
     * Tool: install ShadCN component
     */
    this.server.tool(
      "install-component",
      "Install a UI component via the ShadCN MCP registry",
      z.object({ component: z.string() }),
      async ({ component }) => {
        const result = await this.installShadcnComponent(component);
        return { content: [{ type: "text", text: result }] };
      }
    );

    await this.server.start();
    console.log("[CodingAgent] MCP server started with tools: search, install-component");
  }

  /**
   * Search all MCP servers in parallel and merge results
   */
  private async searchAllMcpSources(query: string): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const searches = this.mcpServers.map(async (srv) => {
      try {
        const res = await fetch(`${srv.url}?q=${encodeURIComponent(query)}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`MCP server ${srv.name} error ${res.status}`);
        const data = await res.json();

        // Normalize
        if (Array.isArray(data.results)) {
          return data.results.map((r: any) => ({
            title: r.title || "Untitled",
            url: r.url || srv.url,
            snippet: r.content?.slice(0, 200) || JSON.stringify(r).slice(0, 200),
            source: srv.name,
          }));
        }

        if (Array.isArray(data.content)) {
          return data.content.map((r: any) => ({
            title: r.title || "Untitled",
            url: r.url || srv.url,
            snippet: r.text || "",
            source: srv.name,
          }));
        }

        return [];
      } catch (err) {
        console.warn(`[CodingAgent] MCP server failed: ${srv.name}`, err);
        return [];
      }
    });

    const results = (await Promise.all(searches)).flat();
    clearTimeout(timeout);
    return results;
  }

  /**
   * Install a component via ShadCN MCP registry
   */
  private async installShadcnComponent(name: string): Promise<string> {
    try {
      const res = await fetch(`https://registry.shadcn.com/mcp/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component: name }),
      });
      if (!res.ok) throw new Error(`Failed to install component ${name}`);
      const data = await res.json();
      return `✅ Installed component ${name}\n${JSON.stringify(data, null, 2)}`;
    } catch (err: any) {
      return `❌ Error installing ${name}: ${err.message}`;
    }
  }

  onStateUpdate(state: Record<string, any>) {
    console.log("[CodingAgent] state updated:", state);
  }
}
