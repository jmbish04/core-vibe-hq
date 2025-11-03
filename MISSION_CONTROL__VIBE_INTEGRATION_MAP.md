Here is the full technical integration map for integrating the Cloudflare "Vibe" (`vibesdk`) repository with the "Mission Control" platform.

***

**TO:** Mission Control Architecture Team
**FROM:** Senior AI Software Architect
**DATE:** 2025-11-03
**SUBJECT:** Technical Integration Map: Cloudflare `vibesdk` for Mission Control

***

### Section A – Executive Summary

This report details a full technical analysis of the Cloudflare `vibesdk` repository (herein "Vibe") and its direct applicability to our "Mission Control" platform.

The Vibe repository is not a simple starter kit; it is a complete, production-grade, and highly sophisticated platform for building, deploying, and managing AI-powered applications on the Cloudflare stack. It is, in effect, a specialized version of the "orchestrator + dashboard" we aim to build.

**Core Architecture:**
* **Backend:** A monolithic, Hono-based Cloudflare Worker (`worker/index.ts`) that serves a comprehensive API. It masterfully orchestrates core Cloudflare products, including D1 (database), R2 (templates), KV (storage), AI (inference), and Rate Limiters. Its most critical components are stateful, WebSocket-driven **Durable Objects** (`CodeGeneratorAgent`) for agent orchestration and **Cloudflare Containers** (`UserAppSandboxService`) for sandboxing user-deployed applications.
* **Frontend:** A modern, co-located Vite + React + ShadCN/UI + Tailwind application (`src/main.tsx`). It provides a rich, multi-panel dashboard for user authentication, app management, AI agent interaction (chat, file explorer, code editor, live preview), and settings management.

**Integration Thesis:**
We should not "replicate" or "build-new" where Vibe provides a solution. Vibe represents 80% of the foundational work for Mission Control. Our strategy must be to **Fork, Adapt, and Extend**.

1.  **Fork:** We will fork the `vibesdk` repository to serve as the new `mission-control-core` monorepo.
2.  **Adapt:** We will refactor Vibe's specific "AI code generator" logic into our generic "Agent Factory." This involves generalizing the `CodeGeneratorAgent` Durable Object and the `use-chat.ts` frontend hook.
3.  **Extend:** We will build the features Vibe lacks, primarily multi-agent "Team" orchestration (CrewAI/LangGraph) and a dedicated "Prompt Library" CRUD interface.

Adopting Vibe provides us with a best-practice, battle-tested architecture for our Hono API, D1 schema, dual-domain routing, secure middleware, and a near-complete ShadCN dashboard UI. This decision will accelerate our timeline by months.


---

### Section B – Backend Architecture Map

The Vibe backend is a model of a modern, stateful, multi-service application running entirely on Cloudflare Workers.

| Module / File | Purpose | Mapping to Mission Control | Strengths | Limitations | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wrangler.jsonc` | **Master Configuration** | Mission Control's main service definition. | **Exceptional.** Defines bindings for `ai`, `d1_databases`, `durable_objects`, `r2_buckets`, `kv_namespaces`, `containers`, and `dispatch_namespaces`. A perfect "all-in-one" template. | Vibe-specific names and IDs. | **Adapt** |
| `worker/index.ts` | **Main Request Router** | Mission Control's core orchestrator entrypoint. | **Critical Pattern.** Implements robust, dual-domain routing. `isMainDomainRequest` serves the API/dashboard. `isSubdomainRequest` serves user-deployed apps via `proxyToSandbox` or `env['DISPATCHER']`. | Tightly coupled to Vibe's "app" concept. | **Adapt** |
| `worker/app.ts` | **Hono API Server** | "Services Factory" API core. | **Best Practice.** A clean Hono setup with essential middleware: Sentry (`initHonoSentry`), `secureHeaders`, `cors`, and a robust `CsrfService`. Sets global auth and rate limiting. | None. This is textbook. | **Reuse** |
| `worker/api/routes/index.ts` | **API Route Aggregator** | "Services Factory" API gateway structure. | **Excellent Modular Design.** Cleanly imports and registers all API sub-modules (`authRoutes`, `appRoutes`, `analyticsRoutes`, `secretsRoutes`, `modelConfigRoutes`). | Vibe-specific routes. | **Adapt** |
| `worker/agents/core/smartGeneratorAgent.ts` | **Agent Durable Object** | The *core* of the "Agent Factory." | **Gold Mine.** This is a stateful, WebSocket-driven agent. It manages a `CodeGenState`, persists files, and handles a full lifecycle: `GENERATE_ALL`, `DEPLOY`, `PREVIEW`, `STOP_GENERATION`, `USER_SUGGESTION`. | Hard-coded for *code generation*. | **Adapt (Heavily)** |
| `worker/agents/core/websocket.ts` | **Agent WebSocket Handler** | "Agent Factory" communication layer. | Defines the WebSocket message protocol (`WebSocketMessageRequests`) and provides robust handlers (`handleWebSocketMessage`) for the Durable Object. | Tightly coupled to the `smartGeneratorAgent`. | **Adapt** |
| `worker/database/schema.ts` | **D1 Database Schema** | "Data Factory" core schema. | **Excellent & Comprehensive.** Defines `users`, `sessions`, `apiKeys`, `apps`, `userSecrets` (!!!), `userModelConfigs`, and `userModelProviders`. This is a massive head start. | `apps` table is Vibe-specific. | **Adapt** |
| `package.json` | **Build/Dev Scripts** | Mission Control's root `package.json`. | Defines clean, unified scripts for `dev` (Vite), `build` (Vite + `tsc`), `deploy` (Bun script), and `db:migrate` (Wrangler D1). | Uses Bun for deployment, which is fine. | **Reuse** |
| `vite.config.ts` | **Vite Build Config** | "UI Factory" build process. | **Perfect.** Correctly implements `@cloudflare/vite-plugin` and `configPath: 'wrangler.jsonc'` to bridge the Vite frontend with the Worker backend. | None. | **Reuse** |
| `worker/services/sandbox/sandboxSdkClient.ts` | **App Sandbox Service** | "Services Factory" for executing user code. | Implements a client for the `UserAppSandboxService` (defined in `wrangler.jsonc` as a **Container**). This is how Vibe isolates and runs user apps. | A complex but powerful pattern. | **Adapt** |

---

### Section C – Frontend Architecture Map

The Vibe frontend is a feature-rich, multi-panel dashboard built with the latest React standards. It is co-located in the same repository as the backend, a pattern we will inherit.

| Module / File | Purpose | Mapping to Mission Control | Strengths | Limitations | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/main.tsx` | **Frontend Entrypoint** | Mission Control dashboard entry. | Standard React 18+ entry with `createRoot`. Sets up React Router (`createBrowserRouter`) from `src/routes.ts` and Sentry. | None. | **Reuse** |
| `src/App.tsx` | **Root Layout / Providers** | Global dashboard providers. | **Excellent.** A clean, central component that composes all global providers: `ErrorBoundary`, `ThemeProvider`, `AuthProvider`, `AuthModalProvider`, `AppLayout`, `Toaster`. | `AuthProvider` is a custom context. | **Adapt** |
| `src/components/layout/app-layout.tsx` | **Main UI Shell** | Mission Control's primary navigation. | A high-quality, reusable layout. Implements `SidebarProvider` and `GlobalHeader` to create the main sidebar + top-nav + content shell. | Sidebar links are Vibe-specific. | **Reuse** |
| `src/routes/chat/chat.tsx` | **Agent Interaction UI** | The *entire* "Agent Factory" UI. | **Gold Mine.** This is a complete, complex UI for agent interaction. Manages a 3-panel layout, `PhaseTimeline`, `FileExplorer`, `MonacoEditor`, `PreviewIframe`, `DebugPanel`, and WebSocket-driven chat. | Tightly coupled to `use-chat.ts`. | **Adapt (Heavily)** |
| `src/routes/chat/hooks/use-chat.ts` | **Client-Side State** | "Agent Factory" client orchestrator. | Centralizes all client-side WebSocket logic, message parsing, and UI state management for the `chat.tsx` view. | **Monolithic Hook.** A massive collection of `useState`/`useEffect` calls. Not a modern state manager (e.g., Zustand). | **Adapt & Refactor** |
| `src/routes/settings/index.tsx` | **Settings Dashboard** | "Gateway & AI Models" settings. | **Direct Reuse.** Provides a perfect `Tabs`-based layout for "Profile," "Model," "Providers," and "Secrets." This directly maps to our needs. | None. | **Reuse** |
| `src/components/ui/*.tsx` | **ShadCN/UI Library** | Mission Control's core component lib. | `components.json` confirms this is a standard, high-quality ShadCN/UI setup. All components (`button`, `card`, `dialog`, `tabs`, etc.) are available. | Prompt allows Mantine, but this is already integrated. | **Reuse (Standardize)** |
| `src/contexts/auth-context.tsx` | **Auth State** | Mission Control's auth handler. | Provides user state via React Context. Fetches `/api/user/me`. | Simple React Context is outdated for global state (causes excess re-renders). | **Build-New** |
| `src/routes/apps/index.tsx` | **App Gallery** | "Inventory" dashboard foundation. | Provides a list/grid view of user's "apps" (`AppCard`) with filtering and sorting. | Vibe-specific. | **Adapt** |
| `src/routes/chat/components/phase-timeline.tsx` | **Agent Task View** | "Agent Factory" task visualizer. | A brilliant component for visualizing an agent's multi-step plan and execution status. | None. | **Reuse** |

---

### Section D – Gap Analysis

Vibe is an incredible accelerator, but it is not Mission Control. It has several key gaps that we must fill.

1.  **Gap: Generic Agent Orchestration**
    * **Impact:** Vibe's core logic (`smartGeneratorAgent.ts`) is 100% focused on *code generation*. It cannot run arbitrary tasks. Mission Control's "Agent Factory" must be able to run *any* defined task (e.g., from a "Prompt Library").
    * **Reasoning:** The `CodeGeneratorAgent` DO's state and methods (`handleUserInput`, `generateAllFiles`) are purpose-built. The WebSocket protocol (`GENERATE_ALL`) is similarly specific.
    * **Recommendation (Build-New / Adapt):** Refactor `smartGeneratorAgent.ts` into a `BaseAgent` DO. This new DO will, on-load, read its `agentId` and fetch its "Mission" (e.g., prompt chain, tool list, LangGraph definition) from a new D1 table. We must define a new, generic WebSocket protocol (e.g., `AGENT_RUN`, `AGENT_MESSAGE`, `AGENT_STREAM`, `AGENT_STATE_UPDATE`).

2.  **Gap: Multi-Agent "Team" Orchestration (CrewAI/LangGraph)**
    * **Impact:** Vibe's model is one user session to one agent DO (`chatId`). Mission Control must be able to orchestrate *teams* of agents that collaborate, per the user's memory.
    * **Reasoning:** Vibe has no concept of agent-to-agent communication or task handoff. Its `dispatch_namespaces` are for *user apps*, not for backend agent collaboration.
    * **Recommendation (Build-New):** This is our largest backend build. We must create a new "Team Orchestrator" service. This could be a new set of Hono endpoints (`/api/teams/*`) that manage state in D1 (`agent_teams`, `team_tasks`) and use Queues to pass messages between `BaseAgent` DOs, simulating a CrewAI/LangGraph flow.

3.  **Gap: "Prompt Library" CRUD & Management**
    * **Impact:** A core requirement for Mission Control (from user memory) is a full "Prompt Library" (List, Search, Create, Save, Attach). Vibe has no such feature; its prompts are embedded in the agent's TypeScript code (`worker/agents/prompts.ts`).
    * **Reasoning:** This is a pure-greenfield feature. It requires a full vertical slice: D1 tables, backend API, and frontend UI.
    * **Recommendation (Build-New):**
        * **Backend:** Create new D1 tables (`prompts`, `prompt_versions`, `prompt_attachments`). Build new Hono endpoints (`/api/prompts/*`) for full CRUD.
        * **Frontend:** Build a new "Prompt Library" route/dashboard page. This page will use the ShadCN `DataTable`, `Dialog` (for create/edit), and `Command` (for search).

4.  **Gap: Centralized "Inventory" Dashboard**
    * **Impact:** Vibe's UI is split (`/apps`, `/discover`). Mission Control needs a single, dense "Inventory" dashboard to view, manage, and monitor *all* provisioned resources (agents, services, data stores, etc.), not just "apps."
    * **Reasoning:** Vibe's `apps/index.tsx` is a gallery, not an admin panel. It lacks the data density and filtering required for an orchestrator.
    * **Recommendation (Adapt):** Adapt the `/apps` route into a new `/inventory` route. Replace the `AppCard` grid with a powerful ShadCN `DataTable`. This table will be fed by a refactored API endpoint (`/api/inventory`) that aggregates data from `apps` and potentially other sources (e.g., Wrangler API for service health).

5.  **Gap: Modern, Global Client-Side State**
    * **Impact:** Vibe's frontend state management relies on a mix of massive hooks (`use-chat.ts`) and basic React Context (`auth-context.tsx`). This is difficult to maintain, test, and share across components, leading to prop-drilling and poor performance.
    * **Reasoning:** `use-chat.ts` is over 300 lines of state and effects. `auth-context.tsx` will cause any component that *uses* it to re-render when auth state changes, even if it only needs the `login` function.
    * **Recommendation (Refactor):**
        * **Zustand:** Immediately replace `auth-context.tsx` and UI state context with a global, persistent Zustand store.
        * **React Query:** Implement TanStack Query (React Query) for all API data fetching (`use-apps.ts`, `use-stats.ts`). This provides caching, refetching, and mutation management out of the box.
        * **Refactor `use-chat`:** Port the *logic* from `use-chat.ts` into a new Zustand "slice" that manages the agent's WebSocket connection and session state. The React components will then simply *select* the state they need.

---

### Section E – Integration Plan

This is a prioritized, concrete plan to transform `vibesdk` into `mission-control-core`.

**P1: Foundation & Refactoring (Weeks 1-2)**
1.  **[P1] Fork & Rename:** Fork `cloudflare/vibesdk` to `mission-control-core`. Perform a project-wide find-and-replace for `vibesdk` -> `mission-control`.
2.  **[P1] Clean & Verify:** Rip out Vibe-specific branding and content (`README.md`, docs). Get the base application running locally using `npm run dev`.
3.  **[P1] Implement Global State:**
    * Introduce **Zustand**.
    * Introduce **React Query (TanStack Query)**.
    * Refactor `src/contexts/auth-context.tsx` into a `useAuthStore` (Zustand).
    * Refactor `src/hooks/use-apps.ts` to use `useQuery`.
4.  **[P1] Define Generic Agent Protocol:** Define the new, generic WebSocket protocol in a shared types file (e.g., `AGENT_RUN`, `AGENT_LOG`, `AGENT_STATE_UPDATE`).

**P2: Agent & UI Generalization (Weeks 3-4)**
1.  **[P2] Refactor Core Agent DO:**
    * Rename `smartGeneratorAgent.ts` to `BaseAgent.ts`.
    * Gut the code-generation logic.
    * Implement the new generic WebSocket protocol handlers (from P1.4).
    * Create a simple "echo" or "hello world" task runner inside the new `BaseAgent`.
2.  **[P2] Refactor Chat UI:**
    * Refactor the *logic* from `src/routes/chat/hooks/use-chat.ts` into a new `useAgentStore` (Zustand slice).
    * Modify `src/routes/chat/chat.tsx` to read from this Zustand store.
    * Update the `chat.tsx` UI to use the new generic WebSocket protocol (e.g., sending `AGENT_RUN` on submit).
    * Verify the "echo" agent works.
3.  **[P2] Adapt Navigation:**
    * Modify `src/components/layout/app-sidebar.tsx` to reflect Mission Control's routes: "/inventory", "/factories", "/health", "/settings".
    * Create placeholder pages for these new routes.

**P3: Building New "Mission Control" Features (Weeks 5-8)**
1.  **[P3] Build "Inventory" Page:**
    * Create the `/inventory` route.
    * Use ShadCN `DataTable` to list all "apps" (soon to be "agents").
    * Use React Query to fetch data from `/api/apps`.
2.  **[P3] Build "Prompt Library" (Vertical Slice):**
    * **Backend:** Add `prompts` table to `worker/database/schema.ts`. Build new API routes in `worker/api/routes/` for full CRUD.
    * **Frontend:** Build the new `/prompts` route and UI, using `DataTable` and `Dialog` from ShadCN.
3.  **[P3] "Agent Factory" v1:**
    * Modify `BaseAgent.ts` to load its "mission" from the new `prompts` table via its `agentId`.
    * Mission Control is now capable of running generic, prompt-based agents.
4.  **[P3] Multi-Agent "Team" Scaffolding:**
    * Begin design and implementation of the "Team Orchestrator" service (see Gap Analysis). This is the next major feature block.
