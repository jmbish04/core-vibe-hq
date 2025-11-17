#!/bin/bash

# Setup script for the Cloudflare Durable Object template
# Usage: ./setup.sh <new-project-name>

set -e  # Exit on any error

# Check if project name argument is provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide a project name as the first argument"
    echo "Usage: $0 <new-project-name>"
    exit 1
fi

NEW_PROJECT_NAME="$1"
echo "Setting up Durable Object project: $NEW_PROJECT_NAME"

# Update project name in package.json if needed
if command -v jq >/dev/null 2>&1; then
    echo "Updating package.json with project name..."
    jq --arg name "$NEW_PROJECT_NAME" '.name = $name' package.json > package.json.tmp && mv package.json.tmp package.json
fi

# Update wrangler.jsonc project name
echo "Updating wrangler.jsonc with project name..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS sed syntax
    sed -i '' "s/\"name\": \"test-project\"/\"name\": \"$NEW_PROJECT_NAME\"/g" wrangler.jsonc
else
    # Linux sed syntax
    sed -i "s/\"name\": \"test-project\"/\"name\": \"$NEW_PROJECT_NAME\"/g" wrangler.jsonc
fi

echo "✅ Project setup complete!"
echo "✅ Updated project name to: $NEW_PROJECT_NAME"
echo ""
echo "Next steps:"
echo "1. npm install (or bun install)"
echo "2. npm run dev (to start development server)"
echo "3. npm run deploy (when ready to deploy)"