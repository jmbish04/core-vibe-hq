# Building MCP tools

> Part of the workstation briefing. **`~/AGENTS.md` is the parent — read it first**;
> it carries the rules that apply everywhere (secrets, backups, how to write to
> Justin, when to flag). This file adds the rules for **designing an MCP server's
> tool surface**. For a Worker that *serves* MCP — auth, the one-year grant, the
> icon, MCP Apps UIs — also load `~/AGENTS-cloudflare-workers.md` ("MCP servers").

---

# Tool definitions are the most expensive thing you ship

**Every tool definition is re-sent on every request, in every session, forever.**
It is paid before the user types anything, and it is paid whether or not the tool
is ever called. On this machine that is **58 connected MCP servers and roughly
351,000 tokens of tool definitions per session** — enough to matter on every
single turn.

Measured 2026-09-13 (`tools/list` payload ÷ 4 chars per token):

| Server | Shape | Tools | Cost |
|---|---|---|---|
| `colby-maestro` (Worker) | **code mode** | 2 | **~1,300 tokens** |
| `ecoflow-telemetry` | named tools | 9 | ~1,100 tokens (~120/tool) |
| `core-delegation` | named tools | 40 | **~8,500 tokens** (~210/tool) |
| `cloudflare-api-mcp` | code mode, fat descriptions | 3 | ~8,000 tokens ← see below |

A named-tool server costs roughly **120–210 tokens per tool**, so the price is
linear in how many tools you expose. Code mode breaks that link: the local
`colby-maestro` puts **78 tools behind 2**, and the whole surface costs less than
a nine-tool server.

# Build new MCP servers in code mode

**Default to code mode for anything with more than a handful of tools.** Expose
two or three tools and let the model discover the rest on demand:

| Tool | Job |
|---|---|
| `search` | Find the operation — over an OpenAPI spec, or over a tool registry |
| `execute` | Run it. The model writes a small script; one call can chain several operations |
| `docs` / `get_schema` | Optional: fetch the detail for one thing, only when needed |

Two working references on this machine, both worth reading before you invent a
third pattern:

- **`/Volumes/Projects/workers/cloudflare-api-mcp`** — `search`/`execute` over an
  OpenAPI spec. ~2,500 endpoints in three tools.
- **`/Volumes/Projects/workers/colby-maestro`** (local FastMCP half) — `search` /
  `list_tools` / `get_schema` / `execute` over a registry of 78 named Python
  tools, dispatched with `call_tool(name, args)`.

## Code mode alone is not the win — description discipline is

`cloudflare-api-mcp` is code mode and still costs **~8,000 tokens**, six times
`colby-maestro`, because its `search` and `execute` descriptions inline full type
definitions and worked examples. Those are re-sent every request to explain tools
whose entire purpose is to fetch detail on demand.

- **Keep every description to what the model needs to decide *whether* to call
  it.** One or two sentences.
- **Put the type definitions, parameter tables and examples behind `search` /
  `get_schema` / `docs`** — that is what they are for.
- **Except the calling convention.** Whatever is required to make the first call
  succeed belongs in the `execute` description. `colby-maestro`'s sandbox has no
  builtins, does not bind tool names, and needs `await call_tool("name", {...})`;
  none of that was written down, and it cost an agent five wasted calls to
  rediscover. A sandbox that cannot be used without guessing is not cheap, it is
  just differently expensive.

## Measure, do not estimate

```bash
B=<server>/mcp; K=$(tokens show WORKER_API_KEY --value-only)
curl -s -X POST "$B" -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | wc -c
```

Bytes ÷ 4 ≈ tokens, and that is the per-session floor for that server. Quote the
number you measured, with its date.

---

# Working on an existing MCP server or Worker? Offer the upgrade.

**At the end of a turn in which you touched a pre-existing MCP server — at the
same moment you raise lessons-learned proposals (see `~/AGENTS-maestro.md`) —
ask Justin two questions.** Not mid-task, and not instead of finishing the work
he asked for.

Only ask when it is real: the server exposes named tools, has more than a
handful, and you have **measured** its `tools/list` cost. Do not ask about a
three-tool server; the saving would not pay for the reading.

## Question 1 — file an epic to convert it to code mode?

Bring numbers, not an idea:

- **Today's cost**, measured, with the tool count (e.g. "40 tools, ~8,500 tokens
  per session, measured today").
- **Estimated after**, and say what it rests on. The measured floor is ~1,300
  tokens for a lean code-mode server; a fair estimate is **800–1,500 tokens**,
  i.e. an **80–90% reduction** on a server of that size — *provided* the
  descriptions stay lean.
- **Saving per session**, and per day if you know roughly how many sessions run.
- **LOE and complexity**, using this rubric so estimates stay comparable:

| Size | When | Shape of the work |
|---|---|---|
| **S — half a day to a day** | The server already has a machine-readable spec (OpenAPI) | Wrap the spec: `search` over it, `execute` that calls it. Handlers untouched. |
| **M — one to three days** | Named tools with real handlers, no spec | Build a registry + `call_tool` dispatcher, keep every handler as-is, add `search`/`get_schema`. The `colby-maestro` shape. |
| **L — one to two weeks** | Per-tool auth, streaming, binary payloads, or tools whose side effects need confirmation | Needs a sandboxed runtime and a permission story per call. |

  Complexity risers to name explicitly if present: per-tool credentials, streamed
  responses, tools that mutate state without a dry run, and any client that calls
  the tools by name today and would break (check before promising a clean swap).

**If he says yes:** run a **complete audit** first — every tool, its schema size,
its handler, its auth, who calls it — then derive a **comprehensive plan**, and
only then file an **epic plus its child tasks** in Colby Maestro
(`task_upsert_tool` with `parent_task_id`, or `POST /api/tasks`; remember REST
wants `task_type` and `priority` explicitly). The epic carries the measured
before/after and the audit; each task is one shippable step. Rules for writing
them: `~/AGENTS-maestro.md`.

## Question 2 — spawn an Orca task force to execute it?

Ask this **at the same time**, so he answers both in one pass. If yes, do it
**after** the tasks exist in Maestro, and **run it on the farm, not this Mac** —
the point is that his laptop stays responsive.

**Target: `claude-farm`** (`orca host list` → a connected linux host; today
`--host ssh:ssh-1788878203605-unbd8l`, also reachable as
`--environment claude-farm`). **Resolve the id at run time — do not paste that
one.** There is no `orca farm` command; the host is selected with `--host`.

**1. Make sure the project exists on that host.** Orca knew about 0 repos and 0
projects here on 2026-09-13, so assume setup is needed rather than skipping it:

```bash
orca host list --json                 # result.hosts[] -> the farm's id + selector
orca repo add --path /Volumes/Projects/workers/<repo>     # register locally
orca project list --json
orca project setups --project <id> --host <farm-host-id> --json   # already there?
orca project setup-clone --project <id> --host <farm-host-id> \
    --url <clone-url> --destination <path-on-farm>
# or, if the checkout already exists on the farm:
orca project setup-existing-folder --project <id> --host <farm-host-id> --path <path>
```

**2. Spawn the work with the prompt attached.** `worktree create` makes the
worktree *and* starts an agent on it:

```bash
orca worktree create --name mcp-codemode-<repo> \
  --project <id> --host <farm-host-id> \
  --agent <agent-id> \
  --prompt "<the plan, the Maestro epic id, and the child task ids>"
```

Then follow it with `orca worktree list`, `orca terminal read`, and
`orca terminal send --text … --enter` to steer it. Do not `--activate` a farm
worktree from a local session unless Justin asked to watch it.

**The prompt must be self-contained.** The farm agent cannot see this
conversation: give it the Maestro **epic id and task ids**, the measured
before/after numbers, the audit findings, and the instruction to claim its task
before starting and keep the worklog current. A spawned agent that does not
claim its task is invisible work happening on another machine.

**If he says no to either question, that is the end of it.** File the
lessons-learned proposals as normal and move on — do not re-raise the upgrade in
the same session, and do not start an audit he did not approve.
