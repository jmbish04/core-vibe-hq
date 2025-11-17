# Core Vibe HQ - To-Do & Idea List

## 🚀 High Priority / Next Up
* [ ] Task:
* [ ] Task:
* [ ] Task:

## 🏃 In Progress
* [ ] Task: [Owner]

## 💡 Idea Backlog

### 🏛️ Architectural & Platform-Wide
* [ ] **Observability:** Implement robust observability (logging, tracing) on all generated workers. Perhaps via logpush to a centralized worker. Have standard health checks on any generated worker that push results to this orchestrator endpoint. 
* [ ] **Efficacy:** Measure efficacy/efficiency of factories (e.g., success rate, tokens used).
* [ ] **Efficacy:** Measure efficacy of specialists (e.g., grounding to CF docs, conflict resolution success).
* [ ] **Agentic Patterns:** Form more agentic, collaborative patterns (e.g., CrewAI/LangGraph style) for agents to work together.
* [ ] **Templates:** Define standardized base templates for all factories (`services-factory`, `agent-factory`) to clone.
* [ ] **Tracing:** Implement distributed tracing across `orchestrator` -> `factories` -> `specialists`.

### 🏭 Factories (agent-factory, services-factory, etc.)
* [ ] Idea: New Factory: A "docs-factory" for auto-generating/updating documentation from code.
* [ ] Idea: New Factory: A "testing-factory" for spinning up e2e test runners.
* [ ] Idea: Refine `services-factory` to support more complex resource provisioning.
* [ ] Idea: Standardize the input "blueprint" schema for all factories.

### 👨‍⚕️ Ops Specialists (conflict-specialist, etc.)
* [ ] Idea: New Specialist: A "Health Check Specialist" that analyzes failures from `healthCheckOps` and suggests remediation.
* [ ] Idea: New Specialist: A "Cost Tracking Specialist" to monitor AI gateway usage and flag anomalies.
* [ ] Idea: New Specialist: A "Schema Validation Specialist" to check `wrangler.jsonc` and other configs.
* [ ] Idea: Expand `delivery-report-specialist` to include code quality metrics.
* [ ] ColbyRules: After evaluating the repo, recommend and Propose a rules config file similar to cursor rules and also AGENTS.md file to the orchestrator for approval. The orchestrator should ensure that the rules are aligned with the overall global defaults like running tsc and clearing tsc before marking any task as complete, aligned with the cloudflare best practices like 'wrangler pages publish' instead of the deprecated 'wrangler pages deploy' or env.AI.run and wrangler types instead of their deprecated imports, aligned with an ui frameworks like shadcnui@latest instead of shadcn-ui@latest, and aligned with the individual project itself. 
* [ ] Interfaces: Every backend worker by default must have a RestAPI and WebSocketAPI that is managed via hono and zod. The OpenAPI schema must be built dynmaically and served via /openapi.json and /openapi.yaml on the frontend with the OpenAPI configured to 3.1.0 with operationids on every method and that the openapi 3.1.0 is fully compliant with any/all other OpenAI Custom GPT Custom Action requirements.
* [ ] DatabaseORM: Ensures that all D1 operations are managed via Drizzle and Kyslie. Runs searches for common sql code to ensure that all sql is using ORM kyslie. Verifies that schemas are not in conflict and that best practices are followed and that all sql code is compliant with d1 sqlite.
* [ ] Modularization: Ensures that code is logically modularized into structures that are categorized by functionality with folder trees, index.ts, health.ts, test.ts, routes.ts, etc. and that everything is tied together at the project level correctly. 
* [ ] DocString: Making sure that all code is well documented at the file level and the codeblock level, optimized for ai agent development.
* [ ] Documentation: Making sure that all features and functionality are automatically documented and the documentation is always fresh and accurate. 
* [ ] Code Hygeinest: Clears all linting errors and all problems, producing the same list that would be visible in vs code or cursor. Ensuring that no shortcuts are taken like `Env as any` or `// ignore ts-check`. 
* [ ] Health Advisor: Writes comprehensive 

### 🤖 Agents (agent-factory/core)
* [ ] Idea: Create a "Planner Agent" that decomposes tasks and assigns them to other specialist agents.
* [ ] Idea: Create a "Code Review Agent" that uses the `conflict-specialist` logic proactively on PRs.
* [ ] Idea: Refine `smartGeneratorAgent` with more robust planning and self-correction steps.
* [ ] Idea: Agent to manage and suggest refactoring for tech debt.

### 🛠️ Agent Tools (agent-factory/tools/toolkit)
* [ ] **Grounding:** New Tool: A RAG tool for grounding agent knowledge to **Cloudflare Docs**.
* [ ] **Grounding:** New Tool: A RAG tool for grounding against other "informative MCP tools".
* [ ] Idea: New Tool: A tool to interface with `data-factory` (e.g., query user secrets, get API keys).
* [ ] Idea: New Tool: A tool for creating/updating GitHub Issues from agent tasks.
* [ ] Idea: Expand `git.ts` tool with more complex operations (e.g., rebase, cherry-pick).
* [ ] 
### 🎶 Orchestrator (Entrypoints, Services, Integrations)
* [ ] Idea: New Entrypoint: A unified `/api/v1/task` entrypoint that routes to `taskOps`, `githubOps`, etc.
* [ ] Idea: New Service: A central service for dispatching jobs to `ops-specialists` queues.
* [ ] Idea: New Integration: Integrate with a persistent vector store (like Cloudflare Vectorize) for agent memory.
* [ ] Idea: New Integration: A service binding for the `colbyadmin-agent-worker`.
* [ ] Idea: Refactor `factoryOps.ts` to be a more generic router for all factory types.
* [ ] Webhooks: Create a webhook service that first records into d1 every webhook and routes the webhook to the appropriate agent or ai prompt to handle that webhook based on the webhook pattern. 
  * Example webhook routes:
    * [ ] Health Checks for self healing: Receiving health ping/pongs which will be the standard for all generated apps on a cron schedule which will post to this orchestrator service for logging and upon seeing an error, a devops agent would evaluate the logs to summarize the failure, check to see if an issue has already been opened or or not and if an issue had been already created just not fixed it would make a note against the issue d1 record that the issue is still open (so we can track how long issues stay open) and issue a checkin handoff to orchestrator; otherwise if no issue yet [new health issue] lookup the apps github repo from inventory, evaluate the code, and generate a prompt instruction to implement the fix, create an issue in github (and in d1 table so there's a record for tracking) with the issue title being descriptive and informative and the body being comprehensive showing the logs, summary of the logs, the steps taken to investigate the repo, findings from investigation, and a prompt that an ai agent would follow to initiate a fix complete with success criteria -- then handoff to the orchestrator to generate the order and send off to the appropriate factory to work on a fix. 

---

## ✅ Completed
* [x] Item: