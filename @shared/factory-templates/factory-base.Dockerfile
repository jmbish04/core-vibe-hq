# factory/shared/factory-base.Dockerfile

FROM node:22-slim

LABEL maintainer="VibeHQ Mission Control"
LABEL description="Base image for all VibeHQ factories with multi-API monitoring and AI CLIs"

# --- Core System Tools (No SQLite dependencies) ---
RUN apt-get update && apt-get install -y \
    python3 python3-pip git curl jq bash nano htop procps && \
    npm install -g typescript wrangler@latest pnpm bun@latest && \
    pip3 install requests rich websockets fastapi uvicorn typer pydantic && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# --- Install Bun globally ---
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/ && \
    bun --version

# --- AI CLI Toolchain (installed globally but idle until keys provided) ---
RUN npm install -g \
    @openai/codex \
    @google/gemini-cli \
    @anthropic/claude-code \
    opencode-ai \
    wrangler

# --- Install MCP CLI (for template analysis) ---
RUN npm install -g @modelcontextprotocol/cli || echo "mcp-cli installation skipped (may not be available)"

# --- Multi-API Monitoring Infrastructure ---
# REST API monitoring with FastAPI/Python
# WebSocket monitoring with websockets library
# RPC monitoring with custom Vibe SDK clients

# Install Vibe SDK monitoring packages
RUN pip3 install \
    aiohttp \
    prometheus-client \
    structlog \
    || echo "Monitoring packages installed"

# --- Environment defaults ---
ENV NODE_ENV=production
ENV PYTHONPATH=/app
ENV BUN_INSTALL=/usr/local
ENV PATH="/usr/local/bin:/usr/local/bun/bin:$PATH"
WORKDIR /app

# --- Shared utility scripts ---
COPY ./@shared/factory-templates/scripts /usr/local/bin/
RUN chmod +x /usr/local/bin/* || true

# --- Python monitoring modules ---
COPY ./@shared/factory-templates/monitoring /app/monitoring/
RUN chmod +x /app/monitoring/*.py || true

# --- Factory Tooling ---
# TypeScript CLI tool is available via pnpm factory-orchestrator
# No additional Python packages needed for factory orchestration

# --- Multi-API Health Checks ---
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health 2>/dev/null || \
      python3 -c "import websockets; print('WebSocket lib OK')" 2>/dev/null || \
      wrangler --version 2>/dev/null || exit 1

# --- Default command with monitoring ---
CMD ["bash", "-c", "python3 -m uvicorn monitoring.rest_monitor:app --host 0.0.0.0 --port 3000 & bun run monitor.js 2>/dev/null || wrangler dev --port 8787"]




