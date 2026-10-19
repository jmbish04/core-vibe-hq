# Colby Maestro — task tracking, coordination, and proposals

> Part of the workstation briefing. **`~/AGENTS.md` is the parent — read it first**;
> it carries the rules that apply everywhere (secrets, backups, how to write to
> Justin, when to flag). This file adds the rules for **the control plane that
> tracks what every agent on this machine is doing**.

---

# Where it lives now

**Colby Maestro is a Cloudflare Worker.** The REST API, the MCP server and the
operator console are all hosted on it. **The database is Postgres, not D1** —
`maestro` on LXC 109, reached through Hyperdrive; the D1 binding was removed on
2026-09-26, and `drizzle/*.sql` at the top level are its retired migrations.
Schema work therefore means `backend/db/schemas/**` (pgTable) and `drizzle/pg`:

| | |
|---|---|
| Console | `https://colby-maestro.hacolby.workers.dev/overview` |
| **Agent guide (canonical)** | `https://colby-maestro.hacolby.workers.dev/docs/agents` |
| MCP endpoint | `https://colby-maestro.hacolby.workers.dev/mcp` |
| API contract | `https://colby-maestro.hacolby.workers.dev/openapi.json` |
| Liveness | `/api/ping` (**unauthenticated**), `/health` (dependency checks) |
| Raw token telemetry | `https://agents.hacolby.app/api/submit/token-usage` — a FastAPI service on LXC 109, not the Worker. The plugin's `TokenUsage` hook posts to it; you do not call it by hand |
| Source | `/Volumes/Projects/workers/colby-maestro` |

**The local service is legacy, and is not how agents reach Maestro.** A
LaunchAgent still runs FastMCP on `127.0.0.1:4318` with its own SQLite mirror, and
a background reconciler pushes that mirror to the Worker's D1 every five minutes (newest `updated_at` wins per
task; worklogs are merged, never resolved; earliest `created_at` wins). It exists
so an agent mid-run never blocks on a Cloudflare round trip. **The Worker is the
source of truth.** Any older instruction that describes Maestro as "a local
FastAPI/FastMCP program on this Mac" is describing the client half of a system
that has moved.

# Which door, in order

**Every door reaches the Worker now. Pick the one in front of you and use it.**
Measured 2026-10-14 on this Mac: the MCP tools, the `colby-maestro` CLI and
`maestro-task` all write to `colby-maestro.hacolby.workers.dev`. There is no
local SQLite lane left to fall into, and no "wrong" client to avoid.

| Door | Goes to | Use it when |
|---|---|---|
| **The Worker's MCP** — `mcp__colby-maestro__search` / `execute`, the claude.ai connector | the Worker's `/mcp`. `codemode.spec().info.title` answers `Colby Maestro API`, 214 paths | **the normal path.** Code mode: `search` the spec, then `execute` with `codemode.request({ method, path, body })` |
| **`maestro-task`** — the plugin's CLI | the Worker's REST API | binding, status and worklog from a Bash tool, when the plugin is enabled |
| **`colby-maestro`** — `~/.local/bin/colby-maestro` | the Worker's REST API (`DEFAULT_WORKER_BASE_URL` in `shared/worker_api.py`) | the richer operator surface: briefings, assignees, model inventory |
| **Plain HTTP** — `/openapi.json` + `Authorization: Bearer $(tokens show WORKER_API_KEY --value-only)` | the Worker | no MCP in this session, or the connector is failing |
| `colby-maestro mcp-serve` — FastMCP on `127.0.0.1:4318` | a local store, and **no client on this machine points at it** | host-local operations only (`orchestrator_*`, `cfg_*`, local models). **Never** a task, status, claim or worklog |

**This table was wrong until 2026-10-14**, and it is worth knowing why. It
listed `mcp__colby-maestro__*` as "Legacy. Never write tracking state through
it", which had been true before Justin pointed it at the Worker. Agents read the
warning, distrusted the correct tool, went looking for a client that was not
installed, and reported themselves blocked. Whenever this file and the machine
disagree, **re-measure and then fix this file** — a stale warning routes work to
nowhere, which is worse than no warning at all.

**The connector's name does not say "maestro"** — in the desktop app it is
`mcp__<uuid>__search` / `__execute`. Identify it before concluding it is absent;
the probe is in "The Worker connector is invisible to a keyword search" below.

**`maestro-task` is not always installed.** It is on PATH only while the
`colby-maestro` plugin is enabled, and there is no copy in `~/bin`. Its absence
does not strand the session: `bind` is not a Worker route at all (there is no
`/bind` among the 214 paths — binding is per-session plugin state plus a
heartbeat), so without the plugin, link the session with
`POST /api/agents/heartbeat` carrying `session_key` and `task_id`, and move
status or add worklog notes through the ordinary task routes.

**Discover, do not guess a path** — `search` first, then `execute`.
## The Worker connector is invisible to a keyword search. Probe for it.

**This is the single most common Maestro failure, and it looks like the opposite
of what it is.** Sessions keep reporting "Maestro MCP not in this session" and
falling back to REST *while the connector is sitting right there*. Justin has had
to correct it by hand: "I see colby-maestro as available in your mcp tools, why
do you keep saying it's not there?"

Two things combine to hide it:

1. **A claude.ai connector is named by a UUID, not by its product name.** It
   arrives as `mcp__<uuid>__search` / `mcp__<uuid>__execute`. Nothing in the name
   says "maestro". The UUID changes if the connector is re-added, so never hard-
   code one.
2. **Its tool descriptions are the generic code-mode blurb** — an OpenAPI
   `codemode.spec()` explainer with no product nouns in it. Measured 2026-09-19:
   `ToolSearch` for `maestro task worklog room briefing` returned eight tools,
   **none of them Maestro**, while the connector was live in that same session.
   A keyword search *cannot* find this server. Not "might miss" — cannot.

So the absence test is not "did a keyword search find it". It is this, and it
takes one call per candidate:

```
# 1. Named local server present?  mcp__colby-maestro__*  → use it.
# 2. Otherwise list the code-mode servers in your tool list — every
#    mcp__<uuid>__search / __execute pair — and ask each one who it is:
```

```js
// as the `code` argument to mcp__<uuid>__search
async () => { const s = await codemode.spec();
  return { title: s.info.title, paths: Object.keys(s.paths).length }; }
```

`{"title": "Colby Maestro API", "paths": 58}` is the answer you are looking for.
Anything else (`core-sf-data`, `core-delegation`, Cloudflare) is a different
server — move to the next candidate. Measured 2026-09-19: the connector was
`mcp__0a637f3f-85a8-4ff7-90f6-ea8da59a3a6c__*`; treat that as a hint for where
to start, never as a fixed address.

Once identified, `execute` speaks the same REST surface documented below:

```js
async () => await codemode.request({ method: "GET", path: "/api/tasks?project_key=colby-ecosystem" })
```

**Only after every code-mode server has answered with something that is not
Maestro** may you say the MCP is absent and move to REST. "I searched for
'maestro' and found nothing" is not that check, and reporting it as one is
reporting a block you have not measured.

*Legacy detail, for the host-local tools only:* **the local `execute` sandbox is
Python, has no builtins, and does not bind tool names.** `dir`, `globals`, `type`, even `Exception` are undefined, and
`task_upsert_tool(...)` is a `NameError`. One entry point, and it must be
awaited:

```python
return await call_tool("task_upsert_tool", {"project_key": "...", "title": "..."})
```

(`get_schema` takes `tools=[...]`, not `tool_names=[...]`.) Measured 2026-09-12;
it cost five calls to find, which is the only reason it is written here.

**A write through the LOCAL MCP does not reach the Worker.** It lands in the
local SQLite mirror, and the Worker — the source of truth, and what Justin's
console shows — returns 404 for it until `worker_sync_tool` runs. Verified:
`task_upsert_tool` created `0fd70cecfba2` locally while
`GET /api/tasks/0fd70cecfba2` 404'd.

So **never write tracking state there.** Write it through the Worker connector,
or over REST (below) when the connector is genuinely unavailable. **Do not casually run `worker_sync_tool` to push
one task:** it reconciles everything. On 2026-09-12 its dry run showed 96 tasks
to push and 53 to pull against 126 in sync, which is a fleet-wide change, not
your task. `dry_run` defaults to `True` for exactly this reason — read the plan,
and if it is bigger than your own work, flag it instead of applying it.

**2. REST on the Worker when MCP is offline or degraded.** Do not stop working
and do not ask Justin to restart anything:

```bash
K=$(tokens show WORKER_API_KEY --value-only)
B=https://colby-maestro.hacolby.workers.dev
curl -s -H "Authorization: Bearer $K" "$B/api/briefing?repo_path=$PWD"
curl -s -H "Authorization: Bearer $K" "$B/api/tasks?project_key=<key>"
curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
     -d '{"project_key":"…","repo_path":"/abs/path","title":"…","status":"in_progress","assignee_id":"…"}' \
     "$B/api/tasks"
```

`Authorization: Bearer` and `x-api-key` both work; unauthenticated is 401.
`WORKER_API_KEY` is the same secret the Worker binds from the Secret Store — in a
script, `tokens show WORKER_API_KEY --value-only`, or `requireSecret`/
`require_secret` from the scaffolded SDK (`tokens agent-onboarding`). Never
hardcode it, never read it from a `.env`.

**Measured API traps (retested 2026-09-13):**

- **`limit` is ignored.** `?limit=1` returned all 177 tasks; `?status_category=-done&limit=2`
  returned 112. Slice client-side, and never assume a list you asked to cap is capped.
- **`POST /api/tasks` requires `task_type` *and* `priority` explicitly.** Omitting
  them is a 400 (`priority: Invalid input: expected string, received undefined;
  task_type: …`). The legacy local `task_upsert_tool` used to default both, but
  the Worker connector REST API does not. Send `"task_type": "task"` and a
  `priority` unless you mean something else.
- *(Fixed 2026-09-13: the unscoped `GET /api/tasks` used to 500 and now returns
  200. Scoping with `project_key` is still cheaper, and `GET /api/briefing` is
  still the better call for "what am I supposed to be doing".)*

Open findings are filed as task `0fd70cecfba2` in the `colby-maestro` project.

**3. The `colby-maestro` CLI — legacy.** Do not use it to create or update
tracking state; use the connector. It remains useful to a human for
`colby-maestro health`, which prints the Worker's dependency checks.
`COLBY_MAESTRO_BASE_URL` overrides the base. The banner's "Status: offline" line
refers to the **local** LaunchAgent, not the Worker — check `colby-maestro health`
before repeating it as a diagnosis.

# Do not add to the drift — write where it will be seen

**The Worker is the source of truth. A write that only reaches the local mirror
is invisible** — to the console Justin reads, to every other session, and to the
next agent that picks the task up. A background reconciler now pushes the local
mirror every five minutes, but it **cannot push a new task at all**: the Worker
requires a plan heading and the local tools have no field for one, so a task born
locally is refused on every pass, forever. Before the reconciler existed, nothing
synced until someone ran `worker_sync_tool` by hand. On 2026-09-13
the two stores were 223 local / 187 remote, 96 tasks unpushed and 54 unpulled,
and they had grown worse, not better, over a day.

**As of 2026-10-14 the drift can no longer grow, because nothing an agent uses
writes to the mirror.** `~/.config/colby-mcp/servers.json` points
`colby-maestro` at the Worker's `/mcp`, the `colby-maestro` CLI's task commands
go through `shared/worker_api.py` to the Worker, and `maestro-task` posts to the
Worker. The numbers below are history, kept because they say what the failure
cost. Read this section as "the Worker is the source of truth", not as a reason
to distrust the tool in your hand.

So the default is: **write tracking state through the Worker.**

| | Lives on | Use |
|---|---|---|
| Tasks, claim/release, worklog, briefing, rooms, tags, taxonomy, assignees, artifacts | **Both** — full REST surface on the Worker | **Write through the Worker.** Read from whichever is handy |
| `github_*`, `jules_*`, `orchestrator_*`, `review_*`, `cfg_*`, `worker_sync_tool` | **Local only** (they act on this host) | Local MCP — they create no tracker drift |

## The three rules

**1. Write tracking state through the Worker when you can.** The REST surface
covers all of it — `POST /api/tasks`, `POST /api/tasks/{id}/claim`,
`POST /api/tasks/{id}/worklog`, `POST /api/collaboration/rooms`,
`POST /api/chat/rooms/{roomId}/messages`. The Worker's own MCP (code mode) is the
same thing with a tool wrapper. Remember REST wants `task_type` **and**
`priority` explicitly (above).

**2. If you wrote through the local MCP anyway, verify it landed.** You should
not have — `mcp__colby-maestro__*` looks like the obvious name and is the wrong
server. Check:

```bash
K=$(tokens show WORKER_API_KEY --value-only); B=https://colby-maestro.hacolby.workers.dev
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $K" "$B/api/tasks/<task_id>"
```

`404` means your work exists only on this Mac. Re-`POST` that one task to
`/api/tasks` (same `task_id`, plus `task_type` and `priority`) and move on.

**3. Never run `worker_sync_tool(dry_run=False)` to publish your own task.** It
reconciles *everything* — on 2026-09-13 that was 150 tasks across other agents'
work, and its pulls overwrite local rows that may belong to a session still
running. Run it only when reconciling the stores **is** your assigned task, and
read the dry-run plan first (`dry_run` defaults to `True` for that reason).

## The colby-maestro plugin enforces this

The `colby-maestro` plugin (published from colby-ecosystem, enabled in user settings and in each repo's `.claude/settings.json`) does the tracking deterministically:

- **Session start:** matches the repo to its project (git remote, then folder) and injects the active tasks.
- **Prompt:** task ids you name are linked to the session.
- **PRs:** `gh pr create` links the PR to every linked task.
- **Stop:** a session that edited files is stopped once if no task is linked, or if no linked task changed since the edits.
- **Session end:** claims are released and a final heartbeat is sent.
- **Guards:** edits in a main checkout or a reused worktree are blocked; symlinking `node_modules` is blocked. A repo that is never worked in a worktree (`~/bin`, `~/system-configs`) opts out with an empty `.claude/worktree-optional` file.

Use `maestro-task` for status and worklog (`maestro-task status <id> review`, `maestro-task log <id> note "..."`), and the `maestro-worklog` skill for which kind to write. The old `maestro-session-end.py` (local-mirror sync) is retired to `~/.claude/hooks/retired/`.

## Before you finish

One curl, and it is the difference between work that is tracked and work that
only looks tracked:

```bash
curl -s -H "Authorization: Bearer $K" "$B/api/tasks/<task_id>" | head -c 200
```

Your task's status and your final worklog entry should be visible **on the
Worker**. If they are not, fix that before you end the session — an agent that
recorded everything faithfully into a store nobody reads has, from the operator's
side, recorded nothing.

**If you notice the drift growing, do not quietly fix it.** Append what you
measured to task `maestro-store-drift-backfill` in the `colby-maestro` project.
That task owns the backfill and the underlying fix; a second agent running a
partial sync on top of it makes the reconcile harder, not easier.

# Read the canonical guide, do not re-derive it

`agent_guide_tool` over MCP, `GET /api/agent-guide`, and `/docs/agents` are **one
file**, so the instructions you get and the ones Justin reads cannot disagree.
**Call it once at the start of a session.** What it covers, in one line each — the
guide is the authority on all of it:

- **Claim the task before you start.** `task_claim_tool` /
  `POST /api/tasks/{id}/claim` mints a `claim_key` and returns your briefing.
  Every write to a claimed task carries that key or is refused with 409 — it is
  what stops two agents silently overwriting each other.
- **Keep the status honest while you work.** `backlog` → `todo` → `in_progress`
  (requires an assignee) → `review` / `blocked`. Move to `blocked` the moment you
  are blocked and say what by. A task parked in `in_progress` while you wait is a
  lie that costs somebody an hour.
- **Close with the status that tells the truth** — `done`, `resolved`,
  `wont_fix`, `duplicate`, `closed`. All five clear the board; they differ in what
  they claim happened. Closing is not deleting (`task_delete_tool` is a soft
  delete with `task_restore_tool` as its inverse).
- **Ask what is left by category:** `status_category="-done"`, never a
  hand-written `status != "done"` — the taxonomy is operator-editable at runtime.
- **The worklog is the record and how you are visible.** Append at every real
  milestone: what you decided and why, what you measured with the number, what
  blocked you, what you handed off. One row per entry, append-only.
- **Any task whose execution calls a model is tagged `ai-usage`** and goes through
  core-guardian — `record_usage` for a subscription CLI you ran, `run_inference`
  for a call guardian should execute. See `~/AGENTS-ai.md`.
- **Rooms, not private messages**, when several sessions share one problem, and
  declare overlaps with `task_dependency_upsert_tool` so the collision checker can
  see them.
- **`github_*` tools when your sandbox cannot run `gh`** — the control plane runs
  on the host, which has the token and the network. (Workflow files are still a
  `git push` question: see `~/AGENTS-github.md`.)

Before finishing: status reflects reality and is terminal if the work is over, a
final worklog entry says what changed and what is left, and anything the next
agent would want is written where it will be read. **An unfinished task left
`in_progress` by a session that ended is worse than one never created.**

# A design lives in a Maestro plan and in the repo. Both, in full.

**A design, a spec or an implementation plan is written twice, and both copies
carry the whole text:**

1. **A Colby Maestro plan** in the project it belongs to. This is the working
   copy: Justin reads it, comments on it, and its headings are what epics and
   tasks attach to. Maestro has a whole interface for plans; a design that is
   not in it is a design he has to go and find.
2. **The repo markdown** the superpowers skills already write
   (`docs/superpowers/specs/…`, `docs/superpowers/plans/…`). This is the copy
   kept with the code, so a clone or a cloud session has it.

Each names the other in its first lines.

**A plan that is a summary pointing at a PR does not count.** Measured
2026-10-12: two designs of 88 KB and 42 KB went into repo markdown while their
Maestro plan held one paragraph per section and a link. Justin's response: "why
are you generating docs for this stuff? Its what colby-maestro is for". The
superpowers skills say nothing about Maestro, so an agent following them alone
writes only the file. This section is what closes that gap.

How to do it without losing anything:

- Create with `POST /api/plans` (markdown body); revise with
  `POST /api/plans/{id}/revisions`. A revision never overwrites.
- **A heading keeps its section id across a revision as long as its text is
  unchanged,** so tasks attached to it stay attached. Keep the headings tasks
  hang from; add new ones freely.
- Mermaid diagrams, code fences and tables survive the round trip (measured:
  6 of 6 diagrams, 15 of 15 tables, byte count within 1).
- Send a large document from a file: `curl --data-binary @body.json`. Do not
  paste it into the code-mode tool, which means typing the whole document as
  tool input. Do not use Python's `urllib`: Cloudflare refuses its signature
  with error 1010. `curl` is accepted.
- **Read it back.** Compare the stored byte count, the number of diagram and
  code fences, and the number of tasks still attached to sections. A post that
  returned 200 is not proof the plan is whole.

---

# Proposals — how a lesson learned becomes a change

This is the part that compounds. A trap you hit at 3am is worth nothing if it
lives only in a transcript.

**At the end of a session, ask three questions** (this is the same rule as "End of
session" in `~/AGENTS.md`):

1. Does anything here belong in `~/AGENTS.md` or one of the `AGENTS-*.md` topic
   files? A trap you hit, a rule you had to infer, a correction Justin made twice.
2. Could a `~/.colby-ecosystem/` template be improved? A bug you fixed in a copy,
   a binding you added by hand, a patch you applied for the second time.
3. Did you build something the collection is missing?

**Present the proposal to Justin and get approval. Never edit the shared standards
unprompted** from a session about something else. Once approved, **file it** —
filing is what makes it reviewable instead of forgotten:

Through the connector's `execute`:

```js
async () => codemode.request({ method: "POST", path: "/api/tasks", body: {
  project_key: "colby-ecosystem", repo_path: "/Users/126colby/.colby-ecosystem",
  title: "PROPOSAL: Push workflow files over SSH",
  description: "Token paths need the workflow scope; SSH does not. Measured on one commit pushed both ways.",
  status: "backlog", priority: "medium", task_type: "task",
  tags: ["proposal", "agents-md"],
  plan_id: "95b7c398ea52", section_ids: ["6268f2184107"],
}})
```

Every proposal attaches to its kind's heading in **Proposals to the shared
standards** (`95b7c398ea52`) — without a heading the Worker refuses it:

| Kind | `section_ids` |
|---|---|
| `agents-md` | `6268f2184107` |
| `template` | `d4d9ff099be4` |
| `new-template` | `418ca344bfed` |
| `docs` | `f875da16dd52` |
| `tooling` | `0b94233bc20a` |

That plan was created 2026-09-21. `colby-ecosystem` had no plan before it, so
from the day the plan-attachment rule shipped until then, **every proposal filed
was refused** — the newest of the 39 in the queue dates from 2026-09-17. It
changes nothing on disk; Justin reviews the queue under `colby-ecosystem`.

The `colby-maestro propose` CLI is legacy and writes to the local mirror; do not
use it.

**Check the queue before filing** — there were 32 tasks in `colby-ecosystem` on
2026-09-12. If the idea is already there, add to it rather than filing a
duplicate:

```bash
curl -s -H "Authorization: Bearer $(tokens show WORKER_API_KEY --value-only)" \
  "https://colby-maestro.hacolby.workers.dev/api/tasks?project_key=colby-ecosystem"
```

**If the session touched a pre-existing MCP server, there is a second ask at this
same moment** — whether to file an epic converting it to code mode, and whether
to spawn an Orca task force on `claude-farm` to execute it. It needs measured
numbers, an LOE, and (on approval) a full audit before any task is written:
**`~/AGENTS-mcp.md`**, "Working on an existing MCP server or Worker?".

**What makes a proposal worth filing.** The ones that pay off name the trap, the
measurement, and where it was hit — "`run_worker_first: true` makes the SPA
shadow API routes; hit in core-bridge" is actionable. "We should be careful with
assets" is not. Same standard as writing to Justin: lead with the conclusion, and
do not make the reader reconstruct your session.

# Offloading work

High-token, low-judgement work — documentation drafts, changelogs — does not
belong in the main session. Hand it over rather than spending context on it:

file a `docs` proposal through the connector — the snippet in the proposals
section above, with `tags: ["proposal", "docs"]` and `section_ids:
["f875da16dd52"]` — titled for the work, e.g. "Draft docs/deployment for <app>:
cover bindings, migrate:remote, deploy, rollback." Keep the task's status and
worklog current while it runs.

# When the control plane is unreachable

Do not block, and do not silently skip tracking:

0. **Confirm the MCP is actually absent** — probe every code-mode server with
   `codemode.spec()` as in "The Worker connector is invisible to a keyword
   search" above. Most "unreachable" reports are this step skipped.
1. `curl -s -o /dev/null -w '%{http_code}' https://colby-maestro.hacolby.workers.dev/api/ping`
   — unauthenticated, so a non-200 here is the Worker, not your credential.
2. If the Worker is up and MCP is genuinely not, use REST (above).
3. If the Worker is down, keep working and **write the task and worklog entries as
   soon as it is back**. Say in your final message that tracking was deferred and
   why — a session whose work never appears in the tracker is invisible to
   everyone else.
