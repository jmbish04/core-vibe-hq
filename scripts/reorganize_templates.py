#!/usr/bin/env python3
"""
Template Reorganization Script
Moves templates from STAGING and vibesdk-templates to appropriate factory workers
"""

import os
import shutil
from pathlib import Path

# Base paths
BASE_DIR = Path("/Volumes/Projects/workers/core-vibe-hq")
STAGING = BASE_DIR / "STAGING"
VIBESDK_TEMPLATES = BASE_DIR / "vibesdk-templates"

# Target paths
AGENT_FACTORY = BASE_DIR / "apps/factories/agent-factory/templates"
DATA_FACTORY = BASE_DIR / "apps/factories/data-factory/templates"
SERVICES_FACTORY = BASE_DIR / "apps/factories/services-factory/templates"
UI_FACTORY = BASE_DIR / "apps/factories/ui-factory/templates"
SHARED_TEMPLATES = BASE_DIR / "@shared/templates"

def ensure_dir(path):
    """Ensure directory exists"""
    path.mkdir(parents=True, exist_ok=True)
    return path

def copy_tree(src, dst):
    """Copy directory tree, creating parent directories if needed"""
    if not src.exists():
        print(f"⚠️  Source does not exist: {src}")
        return False
    try:
        ensure_dir(dst.parent)
        if dst.exists():
            print(f"⚠️  Destination already exists: {dst}")
            return False
        shutil.copytree(src, dst)
        print(f"✅ Copied: {src.name} -> {dst}")
        return True
    except Exception as e:
        print(f"❌ Error copying {src} to {dst}: {e}")
        return False

def main():
    print("🚀 Starting template reorganization...\n")
    
    # 1. Agent Factory - Cloudflare Agents SDK
    print("📦 Agent Factory - Cloudflare Agents SDK")
    copy_tree(STAGING / "agents-starter", AGENT_FACTORY / "cloudflare-agents-sdk/agents-starter")
    copy_tree(STAGING / "agents/examples", AGENT_FACTORY / "cloudflare-agents-sdk/examples")
    copy_tree(STAGING / "agents/guides", AGENT_FACTORY / "cloudflare-agents-sdk/guides")
    copy_tree(STAGING / "agents/packages", AGENT_FACTORY / "cloudflare-agents-sdk/packages")
    copy_tree(STAGING / "actors", AGENT_FACTORY / "cloudflare-agents-sdk/actors")
    
    # Agent Factory - OpenAI SDK
    print("\n📦 Agent Factory - OpenAI SDK")
    copy_tree(STAGING / "agents/openai-sdk", AGENT_FACTORY / "openai-sdk")
    
    # Agent Factory - AI SDK (demos, libs, packages, types)
    print("\n📦 Agent Factory - AI SDK")
    copy_tree(STAGING / "ai/demos", AGENT_FACTORY / "demos")
    copy_tree(STAGING / "ai/libs", AGENT_FACTORY / "libs")
    copy_tree(STAGING / "ai/packages", AGENT_FACTORY / "packages")
    copy_tree(STAGING / "ai/types", AGENT_FACTORY / "types")
    
    # Agent Factory - Patterns
    print("\n📦 Agent Factory - Patterns")
    copy_tree(STAGING / "ai/demos/remote-mcp-server-autorag", AGENT_FACTORY / "patterns/autorag/example")
    
    # Agent Factory - Durable Objects examples
    print("\n📦 Agent Factory - Durable Objects")
    ensure_dir(AGENT_FACTORY / "cloudflare-agents-sdk/durable-objects")
    copy_tree(STAGING / "templates/hello-world-do-template", AGENT_FACTORY / "cloudflare-agents-sdk/durable-objects/hello-world")
    copy_tree(STAGING / "templates/durable-chat-template", AGENT_FACTORY / "cloudflare-agents-sdk/durable-objects/chat")
    
    # 2. Data Factory Templates
    print("\n💾 Data Factory Templates")
    copy_tree(STAGING / "templates/r2-explorer-template", DATA_FACTORY / "r2-explorer")
    copy_tree(STAGING / "templates/d1-template", DATA_FACTORY / "d1-template")
    copy_tree(STAGING / "r2-data-catalog-examples", DATA_FACTORY / "r2-data-catalog")
    copy_tree(STAGING / "templates/to-do-list-kv-template", DATA_FACTORY / "kv-handling/to-do-list")
    copy_tree(STAGING / "pipelines-starter", DATA_FACTORY / "pipelines")
    
    # 3. Services Factory Templates
    print("\n🔧 Services Factory Templates")
    copy_tree(STAGING / "queues-web-crawler", SERVICES_FACTORY / "web-crawler")
    
    # Browser render templates
    ensure_dir(SERVICES_FACTORY / "browser-render/playwright")
    copy_tree(STAGING / "templates/playwright-tests", SERVICES_FACTORY / "browser-render/playwright/tests")
    
    # 4. UI Factory Templates
    print("\n🎨 UI Factory Templates")
    
    # React Router
    ensure_dir(UI_FACTORY / "demos/react-router")
    copy_tree(STAGING / "templates/react-router-starter-template", UI_FACTORY / "demos/react-router/starter")
    copy_tree(STAGING / "templates/react-router-hono-fullstack-template", UI_FACTORY / "demos/react-router/hono-fullstack")
    copy_tree(STAGING / "templates/react-router-postgres-ssr-template", UI_FACTORY / "demos/react-router/postgres-ssr")
    
    # Next.js
    ensure_dir(UI_FACTORY / "demos/nextjs")
    copy_tree(STAGING / "templates/next-starter-template", UI_FACTORY / "demos/nextjs/starter")
    
    # Remix
    ensure_dir(UI_FACTORY / "demos/remix")
    copy_tree(STAGING / "templates/remix-starter-template", UI_FACTORY / "demos/remix/starter")
    
    # Vite
    ensure_dir(UI_FACTORY / "demos/vite")
    copy_tree(STAGING / "templates/vite-react-template", UI_FACTORY / "demos/vite/react")
    
    # React
    ensure_dir(UI_FACTORY / "demos/react")
    copy_tree(STAGING / "templates/react-postgres-fullstack-template", UI_FACTORY / "demos/react/postgres-fullstack")
    
    # 5. Shared Templates
    print("\n🔗 Shared Templates")
    copy_tree(STAGING / "workflows-starter", SHARED_TEMPLATES / "workflows")
    copy_tree(STAGING / "pipelines-starter", SHARED_TEMPLATES / "queues/pipelines")
    copy_tree(STAGING / "templates/hello-world-do-template", SHARED_TEMPLATES / "durable-objects/hello-world")
    copy_tree(STAGING / "templates/durable-chat-template", SHARED_TEMPLATES / "durable-objects/chat")
    copy_tree(STAGING / "actors", SHARED_TEMPLATES / "actors")
    
    # 6. Organize vibesdk-templates definitions
    print("\n📋 Organizing vibesdk-templates definitions")
    vibesdk_defs = VIBESDK_TEMPLATES / "definitions"
    if vibesdk_defs.exists():
        for item in vibesdk_defs.iterdir():
            if item.is_dir():
                name = item.name
                # Categorize based on name patterns
                if "next" in name.lower():
                    copy_tree(item, UI_FACTORY / f"demos/nextjs/{name}")
                elif "react" in name.lower() and "router" not in name.lower():
                    copy_tree(item, UI_FACTORY / f"demos/react/{name}")
                elif "vite" in name.lower():
                    copy_tree(item, UI_FACTORY / f"demos/vite/{name}")
                elif "DO" in name or "durable" in name.lower():
                    copy_tree(item, SHARED_TEMPLATES / f"durable-objects/{name}")
                elif "agents" in name.lower() or "cfagents" in name.lower():
                    copy_tree(item, AGENT_FACTORY / f"cloudflare-agents-sdk/{name}")
                else:
                    print(f"⚠️  Unclassified vibesdk template: {name}")
    
    print("\n✅ Template reorganization complete!")
    print("\n📊 Summary:")
    print(f"  - Agent Factory: {len(list(AGENT_FACTORY.rglob('*')))} files")
    print(f"  - Data Factory: {len(list(DATA_FACTORY.rglob('*')))} files")
    print(f"  - Services Factory: {len(list(SERVICES_FACTORY.rglob('*')))} files")
    print(f"  - UI Factory: {len(list(UI_FACTORY.rglob('*')))} files")
    print(f"  - Shared Templates: {len(list(SHARED_TEMPLATES.rglob('*')))} files")

if __name__ == "__main__":
    main()


