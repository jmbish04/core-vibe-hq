# Agent Factory Dockerfile
# Uses the shared base image with Python tooling pre-installed

FROM core-vibe-base:latest

LABEL maintainer="VibeHQ Mission Control"
LABEL description="Agent Factory worker with factory automation tooling"

# Set working directory
WORKDIR /app

# Copy factory-specific files
COPY . /app

# Verify Python tools are available
RUN setup_repo --help || echo "Warning: setup_repo not found"
RUN template-manager --help || echo "Warning: template-manager not found"

# Default command
CMD ["bash"]

