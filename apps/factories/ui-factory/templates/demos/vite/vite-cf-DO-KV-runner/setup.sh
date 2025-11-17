#!/bin/bash

# Setup script to customize and setup the project
# Usage: ./setup.sh <new-project-name>

set -e  # Exit on any error

# Check if project name argument is provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide a project name as the first argument"
    echo "Usage: $0 <new-project-name>"
    exit 1
fi

NEW_PROJECT_NAME="$1"
echo "Creating KV namespace for project: $NEW_PROJECT_NAME"

# Create KV namespace and extract ID
echo "Creating KV namespace..."
WRANGLER_OUTPUT=$(bunx wrangler kv namespace create "$NEW_PROJECT_NAME" 2>&1)
echo "$WRANGLER_OUTPUT"

# Extract the KV namespace ID from the wrangler output
KV_NAMESPACE_ID=$(echo "$WRANGLER_OUTPUT" | grep -o '"id": "[^"]*"' | sed 's/"id": "\([^"]*\)"/\1/')

if [ -z "$KV_NAMESPACE_ID" ]; then
    echo "Error: Could not extract KV namespace ID from wrangler output"
    echo "Wrangler output was:"
    echo "$WRANGLER_OUTPUT"
    exit 1
fi

echo "Extracted KV namespace ID: $KV_NAMESPACE_ID"

# Replace {{KV_ID}} placeholder in wrangler.jsonc
echo "Updating wrangler.jsonc with KV namespace ID..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS sed syntax
    sed -i '' "s/{{KV_ID}}/$KV_NAMESPACE_ID/g" wrangler.jsonc
else
    # Linux sed syntax
    sed -i "s/{{KV_ID}}/$KV_NAMESPACE_ID/g" wrangler.jsonc
fi

# Verify the KV ID replacement
if grep -q "{{KV_ID}}" wrangler.jsonc; then
    echo "Error: Failed to replace {{KV_ID}} placeholder in wrangler.jsonc"
    exit 1
fi

echo "✅ Created KV namespace with ID: $KV_NAMESPACE_ID"
echo "✅ Updated wrangler.jsonc with KV namespace configuration"