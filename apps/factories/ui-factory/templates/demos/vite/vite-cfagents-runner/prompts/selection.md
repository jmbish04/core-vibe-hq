# Template Selection Guidelines

This template provides a production-ready AI agent chatbot built with Cloudflare Agents SDK, featuring intelligent tool usage and multi-model support as well as control plane durable objects for session management.

* Use this template when you need:
  * AI chat applications with intelligent tool/function calling capabilities
  * Agent-based chatbots using production Cloudflare MCP servers
  * Multi-model AI support (GPT-4o, Gemini 2.0/2.5, Claude Opus 4)
  * Production-ready MCP integration with official TypeScript SDK
  * Real-time conversation management
  * Real-time streaming chat with AI Agents
  * Advanced AI Agents capabilities and AI based applications like image generation, chat bots etc

* Do not use it for:
  * Simple static websites without AI functionality
  * Applications that don't need AI capabilities
  * Projects requiring complex multi-user chat rooms or real-time streaming
  * Simple question-answer bots without tool requirements

**IMPORTANT NOTE: Only use this template if you NEED AI/LLM capabilities as core of your application. If the requirement is for durable objects, there are much better templates like 'vite-cf-DO-runner' or 'vite-cf-DO-v2-runner'**

* Built with:
  * **Cloudflare Agents SDK** for stateful agent management with Durable Objects
  * **Official MCP TypeScript SDK** for proper protocol implementation
  * **React + Vite** for fast, modern frontend development
  * **OpenAI SDK** for AI model integration via Cloudflare AI Gateway
  * **Production Cloudflare MCP Servers** (Documentation and Browser)
  * **Tailwind CSS** with glass morphism effects and responsive design
  * **Framer Motion** for smooth chat animations and loading states
  * **Shadcn/UI** components for polished interface elements
  * **TypeScript** for type safety and extensible architecture
  * **Validated MCP Integration** using official schemas and transports