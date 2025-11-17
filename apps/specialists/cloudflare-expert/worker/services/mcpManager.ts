import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

interface MCPServerConfig {
  name: string;
  sseUrl: string;
}

const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'cloudflare-docs',
    sseUrl: 'https://docs.mcp.cloudflare.com/sse',
  },
];

export class MCPDocManager {
  private initialized = false;
  private clients: Map<string, Client> = new Map();
  private toolIndex: Map<string, { server: string; description?: string }> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    for (const server of MCP_SERVERS) {
      try {
        const transport = new SSEClientTransport(new URL(server.sseUrl));
        const client = new Client(
          { name: 'cloudflare-expert', version: '0.1.0' },
          { capabilities: {} },
        );

        await client.connect(transport, { timeout: 10000, maxTotalTimeout: 20000 });
        this.clients.set(server.name, client);

        const tools = await client.listTools();
        for (const tool of tools?.tools ?? []) {
          this.toolIndex.set(tool.name, {
            server: server.name,
            description: tool.description,
          });
        }
      } catch (error) {
        console.error(`Failed to initialize MCP server ${server.name}`, error);
      }
    }

    this.initialized = true;
  }

  async searchDocs(query: string): Promise<string[]> {
    await this.initialize();
    if (this.toolIndex.size === 0 || this.clients.size === 0) {
      return [];
    }

    const preferredTool = this.findSearchTool();
    if (!preferredTool) {
      return [];
    }

    const client = this.clients.get(preferredTool.server);
    if (!client) {
      return [];
    }

    try {
      const result = await client.callTool({
        name: preferredTool.name,
        arguments: { query },
      });

      if (result.isError) {
        throw new Error(Array.isArray(result.content) ? result.content.map((c: any) => c.text).join('\n') : 'Unknown MCP error');
      }

      if (!Array.isArray(result.content)) {
        return [];
      }

      return result.content
        .filter((item: any) => item.type === 'text' && typeof item.text === 'string')
        .map((item: any) => item.text);
    } catch (error) {
      console.error('MCP search failed', error);
      return [];
    }
  }

  private findSearchTool(): { name: string; server: string } | null {
    const entries = Array.from(this.toolIndex.entries());
    const ranked = entries
      .map(([name, meta]) => ({ name, server: meta.server, description: meta.description ?? '' }))
      .sort((a, b) => this.rankTool(b) - this.rankTool(a));

    return ranked[0] ?? null;
  }

  private rankTool(tool: { name: string; description: string }): number {
    const normalizedName = tool.name.toLowerCase();
    const normalizedDescription = tool.description.toLowerCase();
    let score = 0;
    if (normalizedName.includes('search')) score += 5;
    if (normalizedName.includes('docs') || normalizedName.includes('documentation')) score += 4;
    if (normalizedDescription.includes('cloudflare')) score += 2;
    if (normalizedDescription.includes('workers')) score += 1;
    return score;
  }
}
