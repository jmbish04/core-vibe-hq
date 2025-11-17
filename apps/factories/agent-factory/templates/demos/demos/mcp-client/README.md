# Build an AI Agent that acts as an MCP Client

An example of how to build an `Agent` that acts as an MCP Client, so that it can connect to external services via MCP. 

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/mcp-client)

This demo showcases how to: 
- Connect an AI agent to a remote MCP server
- Handle authentication check using the built-in OAuth flow
- Discover and use tools exposed by remote MCP servers

[Learn more](https://blog.cloudflare.com/building-ai-agents-with-mcp-authn-authz-and-durable-objects/)

## Instructions

First, start an MCP server. A simple example can be found in `examples/mcp`, which already has valid binding setup.

```sh
npm install
npm start
```

Tap "O + enter" to open the front end. It should list out all the tools, prompts, and resources available.
