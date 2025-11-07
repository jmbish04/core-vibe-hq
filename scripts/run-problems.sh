#!/bin/bash
# Problems check script with timestamp logging

TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')

echo "=== Problems Check Started at $TIMESTAMP ===" | tee problems.log

npm run typecheck:all 2>&1 | tee -a problems.log
TYPECHECK_EXIT=${PIPESTATUS[0]}

npm run lint:all 2>&1 | tee -a problems.log
LINT_EXIT=${PIPESTATUS[0]}

npm run types:all 2>&1 | tee -a problems.log
TYPES_EXIT=${PIPESTATUS[0]}

TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')

if [ $TYPECHECK_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ] && [ $TYPES_EXIT -eq 0 ]; then
  echo "=== Problems Check Completed Successfully at $TIMESTAMP ===" | tee -a problems.log
  exit 0
else
  echo "=== Problems Check Completed with Errors at $TIMESTAMP ===" | tee -a problems.log
  exit 1
fi

