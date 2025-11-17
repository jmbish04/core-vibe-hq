#!/usr/bin/env python3

"""
This script scaffolds the new 'hq_staging' monorepo structure.

It is designed to:
1. Create a new '@shared' library based on 'STAGING/vibesdk/worker' (agents,
   tools, services, etc.) and the existing '@shared' (contracts, base).
   *** CRUCIALLY, it SKIPS the 'STAGING/vibesdk/worker/database' folder,
   as that logic will be moved to the orchestrator. ***
2. Create a 'templates/container-base' from 'STAGING/vibesdk/container' and
   'debug-tools'.
3. Copy the *existing* 'orchestrator' and 'apps/*' into the new 'hq_staging/apps/'
   directory, ready to be retrofitted.
"""

import os
import shutil
import json
from pathlib import Path

# --- Configuration ---
SRC_ROOT = Path(".")  # Current directory
DEST_ROOT = Path("hq_staging")

# Source paths (relative to SRC_ROOT)
SRC_ORCHESTRATOR = Path("orchestrator")
SRC_APPS = Path("apps")
SRC_SHARED_ORIGINAL = Path("@shared")
SRC_UI_FACTORY = Path("apps/ui-factory")
SRC_STAGING_VIBESDK = Path("STAGING/vibesdk")
SRC_VIBESDK_WORKER = SRC_STAGING_VIBESDK / "worker"

# Destination paths (relative to DEST_ROOT)
DEST_APPS = DEST_ROOT / "apps"
DEST_ORCHESTRATOR = DEST_APPS / "orchestrator"
DEST_FACTORIES = DEST_APPS / "factories"
DEST_SPECIALISTS = DEST_APPS / "specialists"
DEST_FRONTEND = DEST_APPS / "frontend"
DEST_SHARED_NEW = DEST_ROOT / "@shared"
DEST_TEMPLATE_CONTAINER = DEST_ROOT / "templates" / "container-base"

# --- Helper Functions ---

def log(message: str):
    """Prints an info message."""
    print(f"[INFO] {message}")

def warn(message: str):
    """Prints a warning message."""
    print(f"[WARN] {message}")

def success(message: str):
    """Prints a success message."""
    print(f"✅ {message}")

def safe_copy(src: Path, dest: Path, ignore_patterns: list = None):
    """
    Safely copies a file or directory from src to dest.
    Creates destination parent directories if they don't exist.
    Can ignore specific patterns.
    """
    if not src.exists():
        warn(f"Source '{src}' does not exist. Skipping.")
        return

    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        log(f"Copying '{src}' to '{dest}'...")
        if src.is_dir():
            ignore = shutil.ignore_patterns(*ignore_patterns) if ignore_patterns else None
            shutil.copytree(src, dest, dirs_exist_ok=True, ignore=ignore)
        else:
            shutil.copy2(src, dest)
    except Exception as e:
        warn(f"Failed to copy '{src}' to '{dest}': {e}")

def create_monorepo_files():
    """Creates the placeholder package.json and tsconfig.json files."""
    log("Creating monorepo configuration files...")

    # Root package.json
    root_pkg_json = {
        "name": "hq-monorepo",
        "private": True,
        "workspaces": [
            "apps/*",
            "apps/factories/*",
            "apps/specialists/*",
            "@shared"
        ],
        "scripts": {
            "dev": "echo \"Run dev script from within a specific app\""
        }
    }
    with open(DEST_ROOT / "package.json", "w") as f:
        json.dump(root_pkg_json, f, indent=2)

    # New @shared package.json
    shared_pkg_json = {
        "name": "@shared",
        "version": "1.0.0",
        "main": "index.ts",
        "types": "index.ts"
    }
    with open(DEST_SHARED_NEW / "package.json", "w") as f:
        json.dump(shared_pkg_json, f, indent=2)

    # Base tsconfig for the monorepo
    tsconfig_base = {
        "compilerOptions": {
            "target": "ESNext",
            "module": "ESNext",
            "moduleResolution": "bundler",
            "lib": ["ESNext", "DOM"],
            "esModuleInterop": True,
            "strict": True,
            "skipLibCheck": True,
            "baseUrl": ".",
            "paths": {
                "@shared/*": ["./@shared/*"]
            }
        }
    }
    with open(DEST_ROOT / "tsconfig.base.json", "w") as f:
        json.dump(tsconfig_base, f, indent=2)

def main():
    """Main execution function."""
    log("Starting project restructuring...")
    
    if DEST_ROOT.exists():
        warn(f"Destination directory '{DEST_ROOT}' already exists. Files may be overwritten.")
    
    log(f"Creating new directory structure in '{DEST_ROOT}'...")

    # 1. Create the new directory skeleton
    (DEST_ORCHESTRATOR / "src").mkdir(parents=True, exist_ok=True)
    DEST_FACTORIES.mkdir(parents=True, exist_ok=True)
    DEST_SPECIALISTS.mkdir(parents=True, exist_ok=True)
    (DEST_FRONTEND / "src").mkdir(parents=True, exist_ok=True)
    DEST_SHARED_NEW.mkdir(parents=True, exist_ok=True)
    DEST_TEMPLATE_CONTAINER.mkdir(parents=True, exist_ok=True)

    success("Created new directory skeleton.")

    # 2. Build the NEW @shared library
    log("Building new @shared library from 'STAGING/vibesdk' and existing '@shared'...")
    
    # 2a. Copy the agent/service patterns from vibesdk
    # *** THIS IS THE CRITICAL STEP ***
    # We copy the *entire* vibesdk worker, *except* for the 'database' directory.
    safe_copy(
        SRC_VIBESDK_WORKER,
        DEST_SHARED_NEW,
        ignore_patterns=['database'] # <--- INTENTIONALLY SKIPPED
    )
    
    # 2b. Copy the existing shared contracts and base (overwriting if needed)
    safe_copy(SRC_SHARED_ORIGINAL / "base", DEST_SHARED_NEW / "base")
    safe_copy(SRC_SHARED_ORIGINAL / "contracts", DEST_SHARED_NEW / "contracts")
    safe_copy(SRC_SHARED_ORIGINAL / "types", DEST_SHARED_NEW / "types")
    
    # 3. Create the container-base template
    log(f"Creating 'templates/container-base' from '{SRC_STAGING_VIBESDK}'...")
    safe_copy(SRC_STAGING_VIBESDK / "container", DEST_TEMPLATE_CONTAINER)
    safe_copy(SRC_STAGING_VIBESDK / "debug-tools", DEST_TEMPLATE_CONTAINER / "debug-tools")
    
    # 4. Copy the *EXISTING* Orchestrator
    log(f"Copying existing orchestrator to '{DEST_ORCHESTRATOR}'...")
    safe_copy(SRC_ORCHESTRATOR / "worker", DEST_ORCHESTRATOR / "src")
    safe_copy(SRC_ORCHESTRATOR / "migrations", DEST_ORCHESTRATOR / "migrations")
    safe_copy(SRC_ORCHESTRATOR / "drizzle", DEST_ORCHESTRATOR / "drizzle")
    safe_copy(SRC_ORCHESTRATOR / "package.json", DEST_ORCHESTRATOR / "package.json")
    safe_copy(SRC_ORCHESTRATOR / "wrangler.jsonc", DEST_ORCHESTRATOR / "wrangler.jsonc")
    safe_copy(SRC_ORCHESTRATOR / "tsconfig.json", DEST_ORCHESTRATOR / "tsconfig.json")
    
    # 4b. *** NEW STEP ***
    # Copy the vibesdk database logic to the orchestrator for merging
    log(f"Copying 'vibesdk/worker/database' to '{DEST_ORCHESTRATOR}/src/vibesdk-database-base' for retrofitting...")
    safe_copy(
        SRC_VIBESDK_WORKER / "database",
        DEST_ORCHESTRATOR / "src" / "vibesdk-database-base"
    )

    # 5. Copy the *EXISTING* Factories
    log(f"Copying existing factories to '{DEST_FACTORIES}'...")
    safe_copy(SRC_APPS / "agent-factory", DEST_FACTORIES / "agent-factory")
    safe_copy(SRC_APPS / "data-factory", DEST_FACTORIES / "data-factory")
    safe_copy(SRC_APPS / "services-factory", DEST_FACTORIES / "services-factory")

    # 6. Copy the *EXISTING* Specialists
    log(f"Copying existing specialists to '{DEST_SPECIALISTS}'...")
    safe_copy(SRC_APPS / "ops-specialists", DEST_SPECIALISTS / "ops-specialists")

    # 7. Copy the *EXISTING* Frontend (ui-factory)
    if SRC_UI_FACTORY.exists():
        log(f"Copying '{SRC_UI_FACTORY}' contents to '{DEST_FRONTEND}'...")
        shutil.copytree(SRC_UI_FACTORY, DEST_FRONTEND, dirs_exist_ok=True)
    else:
        warn(f"Source '{SRC_UI_FACTORY}' not found. Skipping frontend.")

    success("All existing apps copied to new structure.")
    
    # 8. Create monorepo config files
    create_monorepo_files()
    success("Monorepo configuration files created.")

    log("---")
    success(f"Staging directory '{DEST_ROOT}' created successfully!")
    log(f"You can now 'cd {DEST_ROOT}' and start the retrofit process.")
    log("---")
    log("🔥 IMMEDIATE NEXT STEPS (THE RETROFIT PLAN):")
    log("  1. 'cd hq_staging' and run 'bun install' (or 'npm install').")
    log("  2. In 'hq_staging/@shared':")
    log("     - Refactor any code (e.g., in 'agents/', 'services/') that imported 'database'.")
    log("     - Change it to expect a 'db_binding' or 'logger_binding' to be passed into its constructor.")
    log("  3. In 'hq_staging/apps/orchestrator':")
    log("     - Update 'tsconfig.json' to use workspace path '@shared/*'.")
    log("     - Merge the logic from 'src/vibesdk-database-base' into your existing 'src/database' services.")
    log("     - Create/Update your 'src/entrypoints' (e.g., LoggingEntrypoint) to expose this database logic via RPC.")
    log("     - When you use agents from '@shared', pass your *local* D1 client to them.")
    log("  4. In 'hq_staging/apps/factories/*' and 'specialists/*':")
    log("     - Update 'tsconfig.json' to use '@shared/*'.")
    log("     - Update 'wrangler.jsonc' to remove D1 bindings and add *only* service bindings to the orchestrator.")
    log("     - When you use agents from '@shared', pass the *RPC binding* (e.g., 'env.ORCHESTRATOR_LOGGING') to them.")

if __name__ == "__main__":
    main()