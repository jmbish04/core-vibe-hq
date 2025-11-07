🧭 Prompt for Gemini / Cursor

Paste this into Cursor’s command palette or comment block before regenerating.

⸻

🎯 Goal

You are working inside the core-vibe-hq repository.
Your task is to create a centralized GitHub remediation service that the Orchestrator Worker can call when factories report errors (like missing files, placeholders, or injection failures).

The design must match this structure:

core-vibe-hq/
 ├─ orchestrator/
 │   ├─ worker/
 │   │   ├─ api/
 │   │   │   └─ routes/factoryRoutes.ts
 │   │   └─ services/
 │   │       └─ remediation/githubRemediation.ts
 │   └─ wrangler.jsonc
 ├─ shared/
 │   ├─ types/
 │   └─ memory-library/
 └─ factories/
     ├─ agent-factory/
     ├─ data-factory/
     └─ ui-factory/

🧩 What to Build

1️⃣ Create a new file:
orchestrator/worker/services/remediation/githubRemediation.ts
	•	It wraps around the core-github-api service:
https://core-github-api.hacolby.workers.dev/openapi.json
	•	Use D1 logging (operation_logs, followups) for each remediation step.
	•	Include helper functions:
	•	logOp() → logs to operation_logs
	•	insertFollowup() → records D1 followups
	•	callGitHubAPI() → generic call wrapper for the core API worker binding
	•	Export a single object:

export const githubRemediation = {
  findRenamedFile,
  getEncodedFileContent,
  fixMissingPlaceholder,
  createIssue,
}


	•	All internal functions should receive both the env and c context (c.env includes CORE_GITHUB_API and DB).
	•	Do not assume apps/orchestrator path — the current worker lives under:

orchestrator/worker/


	•	Add proper types for GitHubRemediationEnv:

interface GitHubRemediationEnv {
  DB: D1Database
  CORE_GITHUB_API: Fetcher
  GITHUB_API_KEY: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
}


	•	Make sure file paths used inside callGitHubAPI match core-github-api’s OpenAPI routes (for example /api/tools/files/upsert, /api/tools/files/tree, etc.)
→ Do not hardcode /v1/repo/....

⸻

2️⃣ Update the route:
orchestrator/worker/api/routes/factoryRoutes.ts
	•	Import the service:

import { githubRemediation, GitHubRemediationEnv } from '../../services/remediation/githubRemediation'


	•	Ensure the route logs errors, calls remediation, and records followups just like your previous implementation, but with the fixed import path and GitHubRemediationEnv binding.
	•	Keep AI patch stubs as TODOs (we’ll integrate AI Gateway later).

⸻

3️⃣ Validate
	•	Ensure Wrangler bindings include:

{
  "bindings": {
    "CORE_GITHUB_API": { "service": "core-github-api" },
    "GITHUB_API_KEY": "...",
    "GITHUB_OWNER": "jmbish04",
    "GITHUB_REPO": "core-vibe-hq"
  }
}


	•	Check that orchestrator/wrangler.jsonc exports:

{
  "main": "worker/index.ts",
  "name": "orchestrator",
  "compatibility_date": "2025-11-01"
}



⸻

✅ Acceptance Criteria
	•	The service runs under orchestrator/worker/services/remediation/
	•	All imports use relative paths from there (no /apps/orchestrator).
	•	It logs every GitHub action to operation_logs (with JSON details).
	•	It creates or updates followups and error_events tables as needed.
	•	The factory route correctly imports and calls the remediation methods.
	•	The project compiles without path or type errors.

⸻

