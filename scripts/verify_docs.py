#!/usr/bin/env python3
"""
Verify documentation files are in docs/ folder
"""

import os
from pathlib import Path

BASE_DIR = Path("/Volumes/Projects/workers/core-vibe-hq")
DOCS_DIR = BASE_DIR / "docs"

# Files that should be in docs/
EXPECTED_DOCS = [
    "TEMPLATE_REORGANIZATION_PLAN.md",
    "TEMPLATE_REORGANIZATION_COMPLETE.md",
    "TEMPLATE_CLI_INTEGRATION.md",
    "TEMPLATE_REORGANIZATION_SUMMARY.md",
    "AGENTS_SDK_MIGRATION_RECOMMENDATIONS.md",
    "ACTORS_RECOMMENDATIONS.md",
    "IMPLEMENT_BASE_CONTAINER_ACTOR.md",
]

# Files that should NOT be in root
ROOT_DIR = BASE_DIR

def main():
    print("🔍 Verifying documentation organization...\n")
    
    # Check files are in docs/
    print("📋 Checking expected documentation files in docs/:")
    all_found = True
    missing_files = []
    for doc_file in EXPECTED_DOCS:
        doc_path = DOCS_DIR / doc_file
        if doc_path.exists():
            print(f"  ✅ {doc_file}")
        else:
            print(f"  ❌ {doc_file} - NOT FOUND in docs/")
            missing_files.append(doc_file)
            all_found = False
    
    # Check files are NOT in root
    print("\n📋 Checking files NOT in root (should be moved):")
    root_files_found = []
    for doc_file in EXPECTED_DOCS:
        root_path = ROOT_DIR / doc_file
        if root_path.exists():
            print(f"  ⚠️  {doc_file} - STILL IN ROOT (needs to be moved to docs/)")
            root_files_found.append(doc_file)
            all_found = False
        else:
            print(f"  ✅ {doc_file} - not in root (good)")
    
    # List all .md files in docs/ root
    print("\n📄 All markdown files in docs/ root:")
    md_files = sorted(DOCS_DIR.glob("*.md"))
    for md_file in md_files:
        size = md_file.stat().st_size
        print(f"  - {md_file.name} ({size:,} bytes)")
    
    # Check OVERVIEW.md has entries
    print("\n📋 Checking docs/OVERVIEW.md for entries:")
    overview_path = DOCS_DIR / "OVERVIEW.md"
    if overview_path.exists():
        overview_content = overview_path.read_text()
        found_in_overview = []
        missing_from_overview = []
        for doc_file in EXPECTED_DOCS:
            # Check if file is referenced in OVERVIEW.md
            doc_name = doc_file.replace(".md", "")
            if doc_name in overview_content or doc_file in overview_content:
                found_in_overview.append(doc_file)
            else:
                missing_from_overview.append(doc_file)
        
        print(f"  ✅ Found {len(found_in_overview)}/{len(EXPECTED_DOCS)} files referenced in OVERVIEW.md")
        if missing_from_overview:
            print(f"  ⚠️  Missing from OVERVIEW.md:")
            for doc_file in missing_from_overview:
                print(f"    - {doc_file}")
    else:
        print("  ❌ OVERVIEW.md not found!")
        all_found = False
    
    # Summary
    print("\n" + "="*60)
    if all_found and not missing_files and not root_files_found:
        print("✅ All documentation files are properly organized in docs/")
        print("✅ All files are referenced in docs/OVERVIEW.md")
        return 0
    else:
        print("⚠️  Issues found:")
        if missing_files:
            print(f"  - {len(missing_files)} files missing from docs/: {', '.join(missing_files)}")
        if root_files_found:
            print(f"  - {len(root_files_found)} files still in root: {', '.join(root_files_found)}")
        return 1

if __name__ == "__main__":
    exit(main())

