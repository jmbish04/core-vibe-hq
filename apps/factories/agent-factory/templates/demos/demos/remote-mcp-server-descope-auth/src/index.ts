import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { DescopeHandler } from "./descope-handler";

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
	sub: string;
	name: string;
	email: string;
	accessToken: string;
};

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Descope OAuth Proxy Demo",
		version: "1.0.0",
	});

	async init() {
		// Hello, world!
		this.server.tool(
			"add",
			"Add two numbers the way only MCP can",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ text: String(a + b), type: "text" }],
			}),
		);

		// Use the upstream access token to access user info
		this.server.tool(
			"getUserInfo",
			"Get authenticated user info from Descope",
			{},
			async () => {
				return {
					content: [
						{
							text: JSON.stringify({
								email: this.props!.email,
								name: this.props!.name,
								sub: this.props!.sub,
							}),
							type: "text",
						},
					],
				};
			},
		);

		// Return the access token
		this.server.tool("getToken", "Get the Descope access token", {}, async () => ({
			content: [
				{
					text: String(`User's token: ${this.props!.accessToken}`),
					type: "text",
				},
			],
		}));
	}
}

export default new OAuthProvider({
	// NOTE - during the summer 2025, the SSE protocol was deprecated and replaced by the Streamable-HTTP protocol
	// https://developers.cloudflare.com/agents/model-context-protocol/transport/#mcp-server-with-authentication
	apiHandlers: {
		"/sse": MyMCP.serveSSE("/sse"), // deprecated SSE protocol - use /mcp instead
		"/mcp": MyMCP.serve("/mcp"), // Streamable-HTTP protocol
	},
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: DescopeHandler as any,
	tokenEndpoint: "/token",
});
