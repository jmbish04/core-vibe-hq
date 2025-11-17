# Problem Analyzer Script

This script runs `npm run problems`, analyzes the output using AI, and generates a categorized checklist for efficient batch fixing.

## Usage

```bash
npm run analyze-problems
```

Or directly:

```bash
tsx scripts/analyze-problems.ts
```

## What It Does

1. **Runs `npm run problems`** - Executes the full problem check (TypeScript, linting, Wrangler types)
2. **Parses errors** - Extracts TypeScript errors from `problems.log`
3. **AI Analysis** - Uses the OpenAI-compatible API to:
   - Categorize errors by type
   - Identify batch-fixable errors
   - Suggest search/replace patterns for common fixes
   - Provide fix suggestions
4. **Generates Output**:
   - `problems-analysis.json` - Structured JSON with all analysis
   - `problems-checklist.md` - Markdown checklist organized by error type

## Output Files

### `problems-checklist.md`
A markdown checklist with:
- **Batch Fixable Errors** - Errors that can be fixed with find/replace
  - Search/replace patterns provided
  - List of affected files
  - Checkboxes for tracking progress
- **Manual Fix Required** - Errors needing individual attention
  - Fix suggestions
  - Affected files list

### `problems-analysis.json`
Structured JSON data with:
- Error categories
- Error counts
- Batch fix patterns
- File mappings

## Configuration

The script uses the OpenAI-compatible API endpoint:
- Default: `https://openai-api-worker.hacolby.workers.dev/v1/chat/completions`
- Can be customized in the script

Optional environment variable:
- `OPENAI_API_KEY` - If the API requires authentication

## Example Output

```markdown
# Problems Analysis Checklist

**Generated:** 2025-01-15T10:30:00.000Z
**Total Errors:** 45

---

## 🔧 Batch Fixable Errors (20 errors)

### Unknown Type Error (15 errors)

**Description:** Variables are of type 'unknown'

**Suggestion:** Add type assertions or proper type definitions

**Batch Fix Pattern:**
```
Search:  (data|errorData|tokenData|verifyData) is of type 'unknown'
Replace: Add proper type annotations
```

**Affected Files:**
- [ ] `scripts/deploy.ts` (8 errors)
- [ ] `scripts/setup.ts` (7 errors)

## 📝 Manual Fix Required (25 errors)
...
```

## Requirements

- Node.js 18+ (for native fetch)
- `tsx` - Can be installed globally or via orchestrator dependencies
- Access to the OpenAI-compatible API endpoint

## Integration with Workflow

This script is designed to be run after `npm run problems` to:
1. Identify errors that can be fixed in bulk (e.g., bad import paths)
2. Group similar errors for efficient fixing
3. Provide actionable fix suggestions

Use the checklist to systematically fix errors, starting with batch-fixable ones.

