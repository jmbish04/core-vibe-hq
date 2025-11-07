# factory/shared/factory-base.Dockerfile

FROM node:22-slim

LABEL maintainer="VibeHQ Mission Control"
LABEL description="Base image for all VibeHQ factories with preinstalled AI CLIs and shared utilities"

# --- Core System Tools ---
RUN apt-get update && apt-get install -y \
    python3 python3-pip git curl jq bash nano && \
    npm install -g typescript wrangler@latest pnpm && \
    pip3 install requests rich && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# --- AI CLI Toolchain (installed globally but idle until keys provided) ---
RUN npm install -g \
    codex-cli@latest \
    @google/gemini-cli \
    @anthropic/claude-cli \
    cursor-agent-cli \
    github-copilot-cli

# --- Environment defaults ---
ENV NODE_ENV=production
ENV PATH="/usr/local/bin:$PATH"
WORKDIR /app

# --- Shared utility scripts (patched at build) ---
COPY ./@shared/factory-templates/scripts /usr/local/bin/
RUN chmod +x /usr/local/bin/* || true

# --- Optional health check ---
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
 CMD wrangler --version || exit 1

CMD ["bash"]




