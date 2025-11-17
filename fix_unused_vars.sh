#!/bin/bash
echo "🔧 Fixing unused variables by prefixing with underscore..."

# Get all files with unused variable errors
pnpm run typecheck 2>&1 | grep "error TS6133:" | sed 's/:.*//' | sort | uniq | while read file; do
  if [ -f "$file" ]; then
    echo "Processing $file"
    cp "$file" "$file.bak"
    
    # Fix common unused parameter names
    sed -i 's/(request:/(_request:/g' "$file"
    sed -i 's/(ctx:/(_ctx:/g' "$file"  
    sed -i 's/(env:/(_env:/g' "$file"
    sed -i 's/(ws:/(_ws:/g' "$file"
    sed -i 's/(template:/(_template:/g' "$file"
    sed -i 's/(instance:/(_instance:/g' "$file"
    sed -i 's/(alarmInfo:/(_alarmInfo:/g' "$file"
    sed -i 's/(fix:/(_fix:/g' "$file"
    sed -i 's/(React:/(_React:/g' "$file"
    sed -i 's/(strategy:/(_strategy:/g' "$file"
    
    # Fix variable declarations
    sed -i 's/const request =/const _request =/g' "$file"
    sed -i 's/const ctx =/const _ctx =/g' "$file"
    sed -i 's/const env =/const _env =/g' "$file"
    sed -i 's/const ws =/const _ws =/g' "$file"
    sed -i 's/const template =/const _template =/g' "$file"
    sed -i 's/const instance =/const _instance =/g' "$file"
    sed -i 's/const alarmInfo =/const _alarmInfo =/g' "$file"
    sed -i 's/const fix =/const _fix =/g' "$file"
    sed -i 's/const React =/const _React =/g' "$file"
    sed -i 's/const strategy =/const _strategy =/g' "$file"
  fi
done

echo "✅ Unused variable fixes applied. Run typecheck again to verify."
