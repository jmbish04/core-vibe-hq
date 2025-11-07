#!/usr/bin/env bash
# Usage: ./@shared/factory-templates/scripts/init_factory.sh agent-factory

NAME=$1
TARGET="./apps/$NAME"
SHARED="./@shared/factory-templates"

if [ -z "$NAME" ]; then
  echo "Usage: init_factory.sh <factory-name>"
  exit 1
fi

mkdir -p "$TARGET"
cp "$SHARED/factory-base.Dockerfile" "$TARGET/Dockerfile"
cp "$SHARED/wrangler.partial.jsonc" "$TARGET/wrangler.jsonc"

echo "[OK] Initialized $NAME with shared base config."




