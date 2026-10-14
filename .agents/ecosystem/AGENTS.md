# Agent Briefing — Colby's Local Developer Workstation

**Read this first when working on this Mac. Then load the topic files your task
actually touches — the rules in them are not optional just because they live in
another file.**

This file holds what applies to every task on this machine. Domain rules live in
sibling `AGENTS-*.md` files so a session about a Python script does not pay for
the Cloudflare Workers chapter, and so each chapter can grow without this one
becoming unreadable.

## Workstation identity

- **Host:** macOS 15.x
- **User home:** `/Users/126colby`
- **Heavy storage / projects:** `/Volumes/Projects` (external SSD; fast, but not the system disk)
- **Editors:** always use `Antigravity` unless explicitly told otherwise.
- **Package tooling:** `uv` is installed; Python heavy work should prefer it.

## Which files to load — decide before you start

Read this file, then load every topic file whose condition is true. Load them
**before** the first load-bearing change, not after something breaks.

| If your work involves… | Also load |
|---|---|
| **Any Cloudflare infrastructure** — a Worker or Pages project, any binding, deploy, CI/CD, wrangler, `wrangler.jsonc`, build failure, or **D1 / KV / R2 / Durable Objects / Vectorize / Workers AI** | **`~/AGENTS-cloudflare-workers.md`** — and read its **"Strict billing & resource allocation constraints"** section BEFORE designing anything that stores, embeds, or infers. Those are hard requirements. Measured on invoice IN-79888512: 99.5% of usage-based spend is **Workers AI neurons ($7.37)** and **D1 storage ($3.00)** — optimise those two; everything else on the account bills $0.00 and the rules are about keeping it there. |
| **An MCP server** — building one, adding tools, its auth, its icon, its tool UIs | **`~/AGENTS-mcp.md`** (tool surface, code mode) **and** **`~/AGENTS-cloudflare-workers.md`** ("MCP servers") |
| **Any user interface** — a page, a component, a dashboard, an app shell, a passcode/login screen, or picking any **ReUI block / design-system** decision | **`~/AGENTS-frontend.md`** — it points at the **ReUI Astro React design system** (<https://claude.ai/artifact/74kf88M44NMA7Xh769vJge>), which is the authority for tokens, the shell contract, responsive strategy, chart rules and the repo-root `AGENTS.md`. It also carries the **ask-once retrofit protocol** for a repo that has not adopted it. |
| **Any AI or LLM call**, in any language or runtime, including a one-off script | **`~/AGENTS-ai.md`** |
| **GitHub** — a PR, review, merge, Actions secret, or any `.github/workflows/*` file (those push over **SSH**) | **`~/AGENTS-github.md`** |
| **Task tracking, proposals, or several agents on one problem** — claiming work, worklogs, rooms, filing a lesson learned | **`~/AGENTS-maestro.md`** |
| **Python** — a script, a CLI, a FastAPI service, anything with a venv | **`~/AGENTS-python.md`** |
| **This Mac itself** — a LaunchAgent, a background service, LAN connectivity | **`~/AGENTS-macos.md`** |
| **The Proxmox hypervisor** — a guest's config or notes, the Proxmox API, a certificate on the node, cron on the host, or getting into a guest you cannot log into | **`~/AGENTS-proxmox.md`** |

A Worker with a UI is both: load the Cloudflare file *and* the frontend file. An
AI-powered Worker is both. "Both" is the normal case — err toward loading.

Repo-local and directory-local briefings still win over all of these:

| Domain | File |
|---|---|
| Shell config, terminal banner, `~/bin` CLI tools | `~/.config/zsh/AGENTS.md` |
| Adding / advertising a new `~/bin` executable | `~/bin/AGENTS.md` |
| `chrome-mcp` repo (humuf + Worker bridge) | `~/bin/chrome-mcp/AGENTS.md` |
| Worker code inside `chrome-mcp` | `~/bin/chrome-mcp/workers/core-browser-ops/AGENTS.md` |
| Whatever repo you are in | its own `AGENTS.md` / `CLAUDE.md` |

**Sample code to copy from is always `~/.colby-ecosystem/`** — Workers, Python,
and the frontend. Copy from there; do not invent boilerplate. See "Sample code"
below.

Two rules are in *this* file because they apply to literally everything, and
skipping them is the most expensive mistake available: **"Secrets & credentials"**
and, for anything that calls a model, **`~/AGENTS-ai.md`**.

## Universal conventions

1. **No secrets in code.** Local secrets are resolved via the `tokens` CLI (`tokens show <NAME> --value-only`). Worker secrets go through `backend/utils/secrets.ts`.
2. **Use the right config source for the job:**
   - Shared shell env / PATH / aliases → `~/.common_profile`
   - Interactive zsh-only settings → `~/.zshrc`
   - Terminal banner entries → `~/.config/terminal-tools/registry.json` (see `~/bin/AGENTS.md`)
   - Ollama env vars → `~/.config/zsh/ollama_zshrc.sh`
3. **When you add a new `~/bin` CLI program, advertise it.** See `~/bin/AGENTS.md` for the exact `terminal-tools` commands. A binary in `~/bin/` is invisible in the banner until it is registered.
4. **LaunchAgents live in `~/Library/LaunchAgents/`** for user-level services. System-level daemons live in `/Library/LaunchDaemons/` and usually require `sudo` to inspect or change.
5. **Heavy tools and caches live in `/Volumes/Projects`.** Prefer it for builds, large repos, and homebrew-style installs when possible.
6. **Verify real state with tools, don't assume.** Check `launchctl list`, `lsof`, logs, and `ps` before declaring a service up or down.
7. **If you are going to EDIT a repo, work in a worktree. Call `EnterWorktree` before your first edit.**

   There are **two** levers, and you need both — an earlier version of this rule
   claimed convention was the only one, which was wrong.

   1. **Per-project setting.** `~/.claude.json` — NOT `~/.claude/settings.json`,
      which is the file that looks right, holds no such key, and is how the
      earlier wrong version of this rule got written. It carries a per-project
      `remoteControlSpawnMode`, set to `"worktree"` or `"same-dir"`. A project
      with it UNSET is why sessions land in the shared checkout; the default is
      not worktree. Verified 2026-08-31: 71 projects, 19 `worktree`, 1
      `same-dir`, 51 unset. **Pin it per project rather than trusting the
      default** — `cachedGrowthBookFeatures.tengu_worktree_mode` is a
      server-controlled rollout flag, so behaviour can change with no local edit,
      which is what "worktrees suddenly stopped happening" actually was.
   2. **This instruction.** `EnterWorktree` refuses to act unless the user says
      "worktree" or a CLAUDE.md/AGENTS.md instruction authorises it. This line IS
      that authorisation, and it covers every session the setting does not —
      sessions started some other way, and any repo still unset.

   Treat it as standing instruction for every repo on this machine.

   - **Editing a repo** (writing code, committing, rebasing) → `EnterWorktree` first.
   - **Read-only, deploying, or verifying** → stay in the shared checkout. A
     worktree needs its own `node_modules` (core-guardian's is ~933MB), so do not
     pay that for a session that never installs deps.

   **Why this is a hard rule, not a preference.** Several sessions routinely share
   one checkout. `git reset --hard`, `git checkout`, and `git pull` in a shared
   tree **silently discard another session's uncommitted work** — no warning, no
   recovery, because unstaged changes never enter the object store so `git fsck`
   cannot get them back. Measured 2026-08-31 in core-guardian: one session ran
   `reset --hard origin/main` while HEAD was on another session's branch. The
   victim's build passed, its 167 tests passed, and its very next `git add -A`
   committed only untracked artifacts because every tracked edit had been wiped.
   It looked like a successful commit and shipped an endpoint that 404'd. The
   work had to be redone from scratch.

   Corollaries when you are in the shared tree anyway:
   - `git status --short` before ANY destructive git operation. Dirty and not
     yours then stop and message the other session (see the cross-session
     section in `~/.claude/CLAUDE.md`).
   - `git add src/` (or explicit paths), never `git add -A`. It does not prevent
     the loss, but it turns a silent empty commit into an obvious one.
   - **Do NOT try to enforce this with `core.bare = true`.** It looks like a
     one-line structural fix and is not. That key lives in the SHARED
     `.git/config` and every linked worktree inherits it, so it disables the
     whole repository rather than just the root: `status` fails and
     `rev-parse --is-inside-work-tree` returns false in EVERY worktree. Measured
     on the live core-guardian repo 2026-08-31, reverted 90 seconds later.
   - To commit in a shared tree without moving HEAD or disturbing a peer's
     working tree (verified on a scratch repo):

         git add <explicit paths>
         tree=$(git write-tree)
         commit=$(git commit-tree $tree -p HEAD -m "msg")
         git branch <name> $commit
         git reset -- <explicit paths>

     HEAD unchanged, peer's files byte-identical. Caveat: `write-tree` snapshots
     the INDEX, so this is only safe while the peer's work is UNSTAGED — if they
     have staged changes, it captures them into your commit.

## Strict Component Libraries & Data Input Standards (Zero Tailwind Slop & Zero CSV)

1. **NO RAW TAILWIND SLOP**:
   - Never write raw Tailwind markup, ad-hoc `div` utility chains, or hardcoded color palettes (`text-gray-500`, `bg-gray-900`, `text-cyan-400`, `border-gray-800`) when building frontend views.
   - You MUST use compiled ReUI (`@reui/*`, `src/components/reui/*`) and shadcn (`src/components/ui/*`) component library primitives exclusively.
   - Style strictly through semantic design tokens (`bg-background`, `text-foreground`, `border-border`, `bg-muted/50`, `text-muted-foreground`, `bg-card`).
   - Every container MUST be a ReUI `Frame`, every card a `Card`, every state an `EmptyState`, and every status a `Badge`.

2. **ABSOLUTE BAN ON CSV FOR LIST INPUTS**:
   - Never use comma-separated strings (`CSV`) in input fields, forms, settings, or state for lists of items (domains, tags, repos, keywords).
   - All lists MUST use discrete, interactive `Badge` elements with click-to-dismiss `X` buttons and an enter-to-add tag input component (`TagInput`).

3. **SECTIONED SETTINGS & PRO-BLOCKS**:
   - Settings views must always be organized into categorized tabs or tagged sections (e.g., using ReUI / shadcn `Tabs`).
   - Tables and list views must always use ReUI ProBlock data grids, never bare HTML tables.

4. **NUMERIC THRESHOLDS & INPUTS**:
   - Never use generic text inputs (`type="text"`) for fields that represent numbers, limits, intervals, or thresholds.
   - Always use strict numeric inputs or `NumberField` with increment/decrement steppers, valid `min`, `max`, and `step` constraints.

## If you are lost

1. Read `~/.config/zsh/AGENTS.md` for shell / banner questions.
2. Read `~/bin/AGENTS.md` for `~/bin` tool registration.
3. Read the project-specific `AGENTS.md` in the repo you're touching.
4. When in doubt, ask the user before editing secrets, LaunchDaemons, or anything in `/Volumes/Projects` that you did not create.

---

---

# Every repo pulls its own right-sized copy of these briefings

**The files above live in `$HOME`, which is exactly where a cloud session, a CI
runner, or another person's checkout cannot see them.** A repo that carries no
copy is a repo where the rules silently do not apply — and "the agent did not
have the briefing" reads identically to "the agent ignored the briefing".

So every repo Justin works in gets a **sync Action**: on every merge to the
default branch, on a weekly schedule, and on demand, it pulls the briefings this
repo actually needs from `github.com/jmbish04/colby-ecosystem` into
`.agents/ecosystem/` and commits them. Because they are committed, a plain
`git clone` already has them.

**Right-sized is the point.** A Python repo gets `AGENTS.md` +
`AGENTS-python.md`, not the 79KB Cloudflare chapter. The selection is derived from
what is in the repo — `wrangler.jsonc` means Workers, `pyproject.toml` means
Python — never from a guess.

| Always | Pulled on a match |
|---|---|
| `AGENTS.md`, `AGENTS-maestro.md`, `AGENTS-github.md` | `AGENTS-cloudflare-workers.md`, `AGENTS-frontend.md`, `AGENTS-mcp.md`, `AGENTS-ai.md`, `AGENTS-python.md`, `AGENTS-macos.md`, `AGENTS-proxmox.md` |

**The same sync ships the default scripts.** `scripts/gh.mjs` lands in every repo,
and the rest follow the stack the way the chapters do:

| Script | Where it goes | What it is |
| --- | --- | --- |
| `scripts/gh.mjs` | every repo | the GitHub entry point. Wraps the `gh-tools` CLI |
| `scripts/tokens.mjs` | every repo | scaffolded from the `tokens` CLI, not vendored — one source, no drift |
| `scripts/fix-d1-migrations.mjs` | Worker repos | makes Drizzle's SQL re-runnable on D1 |
| `scripts/reui.mjs` | frontend repos | pins the `@reui` registry so Pro blocks stop 401-ing |
| `scripts/ui-guard.mjs` | frontend repos | fails the build on the frontend standard's checkable rules — see `AGENTS-frontend.md` |

**`scripts/gh.mjs` exists so you do not write another one.** Agents reach for a
homegrown `gh.mjs` in every repo, re-solve GitHub auth badly, and lose an hour to a
401 that was already solved — on this machine `GITHUB_TOKEN` is a dead token exported
into every shell and `GH_TOKEN` is the live one, so a helper that reads
`process.env.GITHUB_TOKEN` picks the corpse. Import it (`import { gh, ghJson } from
"./scripts/gh.mjs"`) or run it (`node scripts/gh.mjs pr-discussion . 20`). It is local
only; there is no `gh-tools` on a CI runner.

**A script of yours is never silently replaced.** Only files carrying the
`colby-ecosystem: managed script` banner are overwritten. A `scripts/gh.mjs` that is
not ours is kept, and the run says so by name — `--force-scripts` replaces it, which
is the right call when the file in the way is exactly the hand-rolled helper this
is meant to retire.

**The repo's own `AGENTS.md` is never overwritten.** The synced files sit under
`.agents/ecosystem/`, and the only thing written to the repo-root `AGENTS.md` is a
delimited managed block of pointers at the top. Everything outside that block is
left byte-for-byte alone, so the effective briefing is **local `AGENTS.md` +
colby-ecosystem's**, not one replacing the other.

## Installing it — `gh-tools agents-sync`

Do this yourself; it is not a hand-off. One command, in the repo you are working in:

```bash
gh-tools agents-sync                 # this checkout: workflow, secret, first sync, git hooks
gh-tools agents-sync jmbish04/foo    # a repo with no local clone: commits + sets the secret
gh-tools agents-sync --dispatch      # also kick the workflow now instead of waiting
```

It writes `.github/workflows/agents-sync.yml`, sets the `COLBY_ECOSYSTEM_TOKEN`
secret, runs `pull-agents` once so the briefings are in the tree before anyone
clones it, and installs the git hooks. Then commit what it names. A repo with no
GitHub remote yet is fine — it says so and does the rest.

## Rolling it out — `gh-tools agents-audit` and `agents-rollout`

```bash
gh-tools agents-audit                        # the 30 most recently pushed repos
gh-tools agents-audit --limit=100 --all      # more, including forks
gh-tools agents-rollout                      # names what it WOULD install, writes nothing
gh-tools agents-rollout --yes                # installs into every repo missing it
gh-tools agents-rollout --only=jmbish04/foo --yes
gh-tools agents-rollout --refresh --yes      # after a template fix: rewrite it everywhere
```

The audit reports **three** columns, because any two of them can be true while the
thing is still broken: `workflow` (the file is committed), `secret`
(`COLBY_ECOSYSTEM_TOKEN` is set — without it every run 404s), and `synced`
(`.agents/ecosystem/` exists, so the Action has actually run at least once). A repo
counts as installed only when all three say yes.

`--refresh` is how a fix to `templates/agents-sync.yml` reaches repos that already
have the old copy — without it, rollout only touches repos missing the workflow or
the secret, and a template bug stays frozen everywhere it already shipped.

**`agents-rollout` writes nothing without `--yes`.** Run it bare first and read the
list: it commits to each repo's default branch and sets a secret on each, across as
many repos as the limit allows. That default is deliberate, and do not add a flag
that removes it.

**On the token — decided 2026-09-28, do not reopen it:** `COLBY_ECOSYSTEM_TOKEN`
carries `GH_TOKEN`, and **no dedicated token is to be minted for this.** A narrower
fine-grained PAT was offered and declined; the record is
`decisions/2026-09-28-ecosystem-read-token.md`. `gh-tools` still looks for
`GH_ECOSYSTEM_READ_TOKEN` first and falls back to `GH_TOKEN`, so if Justin ever
creates one it is picked up with no code change — but creating one is his call,
not a gap for you to close. It would live in the **tokens CLI only**: no Worker
reads it, so per "Secrets & credentials" it must never take a Secret Store slot.

The git hooks (`post-merge`, `post-checkout`) keep a local `git pull` fresh too.
Hooks are not cloned, so **run `.agents/ecosystem/pull-agents install-hooks` once
per clone and per worktree** — the workflow is what makes the files correct for
everyone else.

`pull-agents --list` prints the file set and the evidence for each choice. A repo
that needs a chapter the detector cannot see (Proxmox, say) states it in
`.agents/ecosystem.json`:

```json
{ "include": ["AGENTS-proxmox.md"], "exclude": [] }
```

**Verify, do not assume.** After the first run, `git status` must show
`.agents/ecosystem/` populated and the managed block present in `AGENTS.md`. If
the token is missing the script fails loudly and names the secret — it never
writes a half-synced tree.

---

---

# Secrets & credentials

**Every** API key, token, account id, and secret on this machine lives in the
`tokens` CLI (`~/bin/tokens_cli/tokens`, on PATH as `tokens`). It is the single
source of truth, it is encrypted at rest, and there is no second place to look.

**It does not follow that a secret belongs in the Cloudflare Secret Store.** The
store is a scarce, shared resource with a hard ceiling, and mirroring into it
"just in case" is how it fills up. Read the gate below before you create
anything.

Never invent a credential. Never read one from a `.env` or `dotenv`. Never
hardcode one, not even as a placeholder. Never ask the user to paste one into a
terminal or a curl command.

## The gate — before you create any credential

Three rules, in order. They exist because the Secret Store has a **hard limit of
100 secrets and only one store is allowed on the account**, and every wasted slot
is a slot the next project cannot have. Measured 2026-09-13: the store hit exactly
100 and refused a new secret with

```
maximum_secrets_exceeded: max 100
```

The failure is quiet. `tokens set` prints `✅ Saved <NAME> locally` *after* the
sync error scrolls past, so an agent can believe it stored a credential in
Cloudflare when it only stored it locally. Read the sync line, not the last line.

### Rule 1 — a Worker authenticates with `WORKER_API_KEY`. Every time.

`WORKER_API_KEY` already exists, is already in the store, and is already bound in
every Worker that needs it. **Use it.** Do not mint a second credential to do the
same job under a different name.

That means: **never create a webhook secret, a service token, a shared secret, an
inbound bearer, or a per-integration signing key.** Every one of those is
`WORKER_API_KEY`, without question. If an inbound webhook needs to prove itself,
it presents `WORKER_API_KEY` — see Step 4 for the header forms already accepted.

### Rule 2 — scan both surfaces before you create anything

Not one. Both. A name can exist locally and not in the store, or the reverse.

```bash
tokens find <keyword>                 # local — names only, safe in a transcript

# Remote — ALWAYS fetch all of them in ONE call. The store holds at most 100
# secrets, so one page of 100 is the whole store. Never reason about the store
# from a partial listing.
AID=b3304b14848de15c72c24a14b0cd187d; SID=8c42fa70938644e0a8a109744467375f
curl -s -H "Authorization: Bearer $(tokens show CLOUDFLARE_API_TOKEN --value-only)" \
  "https://api.cloudflare.com/client/v4/accounts/$AID/secrets_store/stores/$SID/secrets?per_page=100" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);n=[s['name'] for s in d['result']];\
print(len(n),'of',d['result_info']['total_count']);print('\n'.join(sorted(n)))"
```

**`wrangler secrets-store secret list` is NOT a way to enumerate the store.** It
pages at 50, `--per-page` is rejected (`invalid_per_page_parameter`), and
**`--page N` returns page 1 every time** — so a page-walk silently reads the same
rows over and over. Measured 2026-09-26: that walk reported **40** secrets when
the store held **98**, and an agent used the short list to tell the user a secret
was absent. The API call above returns all 98 names in one request, and
`result_info.total_count` states the real total, so a short answer is visibly
short. Never conclude a secret is absent from a listing you did not prove complete.

### Rule 3 — if you genuinely must create one, answer this question first

> **Does a Cloudflare Worker read this value at runtime?**

| Answer | Where it goes |
|---|---|
| **Yes** — a Worker reads it through `env.NAME.get()` | `tokens` CLI **and** a Secret Store binding. Answer `y` to the sync prompt. |
| **No** — anything else reads it | `tokens` CLI **only**. Answer `N` to the sync prompt. |

"Anything else" is most things, and none of them need a store slot:

- **`cloudflared` tunnel tokens** — read by the cloudflared daemon on the LXC box.
  Connectivity is over the tunnel/VPC; no Worker ever binds the token.
- **Database credentials reached over a tunnel or VPC** — same reason.
- Local scripts, CLIs, and anything in `~/bin`, which read through the `tokens` SDK.
- LaunchAgents and background services on this Mac.
- Credentials you use from the shell, or that only a human uses.

The `tokens` CLI does **not** require that a secret also go into the store, and
putting one there that no Worker binds buys nothing while costing a slot.

**`tokens delete <NAME>` is local-only — it does NOT remove the Cloudflare copy.**
Measured 2026-09-13. Removing a credential for real means deleting it in both
places.

**One more measured fact about the ceiling:** it is shared by every concurrent
session on this machine, and there are routinely ~20. On 2026-09-13 five freed
slots were consumed by three different sessions inside an hour. So "the user just
made room" is not a durable state you can rely on, and *freeing room is not a
substitute for not needing the slot.*

## Step 1 — verify the token exists, before you write the call site

Blind-search by keyword. This prints **names only, never values**, so it is safe
to run in an agent transcript:

```bash
tokens find anthropic
```

| Result | What you do |
|---|---|
| **Exactly one match** | Use that exact name. Proceed. |
| **Multiple matches** | **Ask the user which one.** Do not guess — `ANTHROPIC_API_KEY` and `ANTHROPIC_ADMIN_KEY` are different credentials with different scopes and different blast radii. |
| **No matches** (exit 1) | **Go back to the gate above.** Most often the answer is that no new credential is needed and `WORKER_API_KEY` is the one you want (Rule 1). If one genuinely is needed, answer the Rule 3 question, then `tokens set <NAME> <value> "<description>"`. Never proceed with a placeholder and never fall back to `process.env`. |

`tokens show <keyword>` runs the same fuzzy search but prints the **decrypted
values** and copies to the clipboard. Use it only when a human asked to see a
value — never as a routine existence check. `tokens show <NAME> --value-only`
is the scriptable exact-match form.

## Step 2 — local scripts: import the SDK, don't shell out

Drop a first-party SDK into the project rather than calling `tokens show` from
your code:

```bash
tokens agent-onboarding --scaffold-all scripts/            # both SDKs
tokens agent-onboarding --scaffold-mjs scripts/tokens.mjs
tokens agent-onboarding --scaffold-python utils/tokens.py
```

Then `requireSecret("NAME")` / `require_secret("NAME")` — both throw with an
actionable message; `getSecret` / `get_secret` return null instead. Zero
dependencies, cached, and they locate the CLI themselves. Convenience getters
exist for the common keys; `tokens agent-onboarding --print-rule` lists them.

## Step 3 — Cloudflare Workers: the same name, via a Secret Store binding

**When a secret is in the store at all, it is under the same name it has locally.**
That is the naming contract — resolve the name once with `tokens find`, then use
it on both sides. It is *not* a promise that every local token is in the store:
only the ones a Worker actually reads belong there (the gate above, Rule 3), so
confirm the store copy exists rather than assuming it.

A Worker "secret" is three different things wearing one word, which is why this
is confusing:

| Shape | How you read it |
|---|---|
| **Secret Store binding** (what we use) | `await env.NAME.get()` — async, the binding is an *object* |
| `wrangler secret put` | `env.NAME` — sync, a plain string |
| `.dev.vars` in local dev | `env.NAME` — sync, a plain string |

Declare the binding in `wrangler.jsonc`:

```jsonc
"secrets_store_secrets": [
  {
    "binding": "ANTHROPIC_API_KEY",
    "store_id": "8c42fa70938644e0a8a109744467375f",
    "secret_name": "ANTHROPIC_API_KEY"
  }
]
```

Then scaffold the helper instead of hand-rolling the `.get()` calls — it mirrors
the `tokens.mjs` API and falls back to a plain env var so the same call site
works in `wrangler dev` and in production:

```bash
tokens agent-onboarding --scaffold-worker src/backend/utils/secrets.ts
wrangler types
```

```typescript
import { requireSecret, getSecret } from "@/backend/utils/secrets";

const key = await requireSecret(env, "ANTHROPIC_API_KEY"); // throws if unresolvable
const opt = await getSecret(env, "SENTRY_DSN");            // undefined if absent
```

Canonical source: `~/bin/tokens_cli/sdk/secrets.ts`. Fix it there, not in a
downstream copy.

## Step 4 — authenticating to our own Workers: `WORKER_API_KEY`

`WORKER_API_KEY` is the standard service-to-service credential across the
ecosystem — and per Rule 1 of the gate, it is the **only** one. Inbound webhooks,
cron callers, sibling Workers and scripts all present this key; none of them get a
credential of their own. Same secret, same name, both sides:

| Caller | How it resolves the key |
|---|---|
| **A Cloudflare Worker** | **Secret Store binding.** Declare `WORKER_API_KEY` in `wrangler.jsonc` under `secrets_store_secrets`, then `await requireSecret(env, "WORKER_API_KEY")` |
| **A local script** (Python, Node, shell) | **tokens CLI / SDK.** `require_secret("WORKER_API_KEY")` / `requireSecret("WORKER_API_KEY")`, or `tokens show WORKER_API_KEY --value-only` in shell |

Send it as `Authorization: Bearer <WORKER_API_KEY>` (some services also accept
`x-api-key`). Verify the name first: `tokens find WORKER_API_KEY`.

An inbound webhook cannot send a browser session cookie, and that is **not** a
reason to invent a webhook secret. Accept this same key from whichever carrier the
third party can actually send — `Authorization: Bearer`, an `X-Webhook-Secret`
header, or a `?secret=` query param — and compare it in constant time. A working
example is `verifyWebhookSecret()` in
`workers/core-unifi-protect/src/garage/tesla/client.ts`.

**The trap that just cost a live Worker its entire auth layer.** A Secret Store
binding is an **object**, not a string. `wrangler types` declares it
`WORKER_API_KEY: SecretsStoreSecret`. So:

```ts
❌ apiKey === env.WORKER_API_KEY          // string === object → ALWAYS false
❌ sha256Hex(env.WORKER_API_KEY)          // hashes "[object Object]"
✅ apiKey === (await env.WORKER_API_KEY.get())
✅ await requireSecret(env, "WORKER_API_KEY")   // utils/secrets.ts, handles the dev fallback too
```

The first form compiles, deploys, and 401s every request forever — including
with a correct key. Always go through `utils/secrets.ts`.

---

---

---

# Sample code — `~/.colby-ecosystem/`

Do not invent boilerplate. Copy it.

**Two different things share the "colby-ecosystem" name — know which one you
want.** `~/.colby-ecosystem/` is the local directory of sample code below.
`github.com/jmbish04/colby-ecosystem` is the git repo that versions the
machine-wide `AGENTS*.md` briefings, the agent skills and the templates; it is
cloned at `/Volumes/Projects/colby-ecosystem` and synced with `sync-agents`.
Neither of them tracks work — that is colby-maestro.

- `workers/` — `wrangler.jsonc` (full observability, **no `ai` binding**, Secret
  Store bindings, `run_worker_first`), `utils/secrets.ts`, `utils/ai.ts`,
  `devOps/tokens.mjs`, `devOps/fix-d1-migrations.mjs`, `.vscode/settings.json`
- `python/utils/` — `secrets.py`, `ai.py`, `cf.py`
- `frontend/` — the default frontend (see "Frontends")
- `reference/` — deep-dive docs pulled out of this file
- `decisions/` — decision records (see "Flagging something for Justin")

`secrets.ts`, `tokens.mjs`, and `secrets.py` are **symlinks** into
`~/bin/tokens_cli/sdk/` so they cannot drift — fix bugs at the target. Prefer
scaffolding them over copying:

```bash
tokens agent-onboarding --scaffold-worker src/backend/utils/secrets.ts
tokens agent-onboarding --scaffold-python utils/secrets.py
tokens agent-onboarding --scaffold-mjs    scripts/tokens.mjs
```

Read each file's header comment before copying — they carry their own rules and
measured gotchas. Full map: `~/.colby-ecosystem/README.md`.

---

---

# Standing authorizations — do not ask for these

Justin has pre-approved the tools below. **They are allowlisted in
`~/.claude/settings.json` (user level, so every project inherits them), and you
should not ask for them in prose either** — no "may I proceed?", no "shall I
query the control plane?". Just use them and report what you did.

| Pre-approved | Covers |
|---|---|
| **Colby Maestro** (`mcp__colby-maestro*`) | Every tool: tasks, worklogs, claims, rooms, briefings, sync |
| **Cloudflare API MCP** (`mcp__cloudflare-api*`, the self-hosted proxy) | `search` / `execute` / `docs` and the Workers CI/CD tools — including **writes**: creating bindings, configuring builds, reading logs |
| **Cloudflare docs search** | Read-only documentation lookup |
| **Deploying a Cloudflare Worker** | See "Deploying" in `~/AGENTS-cloudflare-workers.md` — standing authorization, rollback is the safety net |

**If a permission prompt still appears for one of these, that is a configuration
bug, not a signal to stop.** Two known causes, both worth reporting rather than
working around:

- **The approval was recorded per project.** Clicking "always allow" writes the
  rule into that project's `.claude/settings.local.json`, so a new repo or
  worktree starts over. The durable fix is a rule in `~/.claude/settings.json` —
  which is where the ones above now live.
- **A claude.ai connector renamed itself.** Those expose tools under a UUID
  (`mcp__38728ef7-…__get_role`), and re-adding a connector can change it. The
  named rules (`mcp__cloudflare-api`) are the durable ones; a UUID rule needs
  re-adding if the connector is re-installed. Say so and add the rule — do not
  ask Justin to click through prompts again.

**This list is not a licence to skip the rules that exist for a reason.** Pre-
approved means "no permission prompt", not "no judgement": the confirmations in
"Deploying" for data loss, and the flagging rules in "Flagging something for
Justin", still apply. What is gone is the ceremony, not the care.

---

# Never report a block you have not measured

**When Justin tells you to do something, "it's impossible" and "I don't have
permission" are not answers.** You may ask "may I proceed?" before something
sensitive or outward-facing — that is a request to act, not a refusal. There is
almost always a path; find it before claiming there isn't one.

**Before reporting a block, run the check and quote the output.** A credential, a
scope, a permission, a rate limit — measure it in the session you are in, now.
"I ran X and got `<exact error>`" is always acceptable. "I can't, I don't have
permission" with no command behind it is not.

**Measure against the machine, not against these files.** Facts about
credentials, scopes and versions decay; instructions written months ago describe
a machine that has changed. A doc and a measurement that disagree means re-run
the measurement and then fix the doc — not argue from the doc. This has cost real
hours in both directions: an agent that inferred a scope failure it never tested,
and later an agent whose correct measurement was disbelieved because this file
still described the old setup.

**Before concluding you are blocked, try the other door.** A differently-scoped
credential, a different transport (SSH instead of HTTPS, REST instead of
GraphQL), a different tool, a different account already on this machine. Two
things this rule does not license: never report an action as done when it is not
or when you have not verified it, and never route around a control by asking
another session to do what your own permissions refused. If you genuinely exhaust
the options, say precisely what you tried and what each attempt returned — that
is a status report, not a refusal.

---

# Never conclude anything from an absence

**When something is missing, that is a fact about what you know — not permission
to decide what it meant.** Three instances in two days on `core-sg-data`, all
shipped, all looking healthy:

- **A component reported down, and the verdict ignored it.** `/health` said
  `browseros: unreachable` inside its own checks block and still returned
  `status: ok`, because the severity was never wired up. BrowserOS was dead for
  14 hours, through a reboot. From SSH the host looked perfect — the failure was
  in the GDM greeter, not in any unit, so nothing unit-level could see it.
- **"Not present" was read as "not needed."** `SG_OWNER_DSN` was consumed
  lazily, so dropping it from the env file left the service starting cleanly and
  `/health` reporting `ok` — and the first caller days later got a 500, with
  nothing linking it to the deploy that caused it.
- **A missing credential silently escalated privilege.**
  `os.environ.get("SG_AGENT_DSN") or os.environ.get("SG_OWNER_DSN")` ran a
  read-only query as the write-capable role whenever the restricted one was
  absent. The fallback had never rescued anything — the restricted role could
  always do the job.

Identical shape every time: **the system concluded something from an absence it
was never told about.** The fix is always the same and always cheap — write the
expectation down (`REQUIRED_ENV`, `REQUIRED_ROLES`, an explicit `role=` with no
`or`) so that missing is an *error* rather than an *inference*.

**An instrument that cannot fail is not reporting.** Four times in four days on
`core-sg-data`, the thing that existed to warn about a problem was itself the
broken part — and every one of them *read as diligence*, which is why none was
caught by review:

- `/health` reported `browseros: unreachable` in its own checks block and still
  returned `status: ok`. Dead 14 hours, through a reboot.
- The deploy guard printed `clean` on every deploy while its uncommitted-changes
  check matched nothing at all (a `BASH_SOURCE` mistake put it in the wrong
  directory).
- A "your result was truncated" flag that was *structurally incapable* of being
  true, on a path that silently returned 50,000 rows out of 958,379 and let
  aggregates be computed over them as if complete.
- The deploy guard's fallback to `ssh.github.com:443` could not run **on the one
  day port 22 stopped answering**. The retry only fires when the first fetch
  *fails*, and a black-holed port does not fail — it hangs, with ssh waiting
  through a full TCP timeout. Measured 2026-09-23: a deploy sat over ten minutes
  on a stuck `git-upload-pack` and never reached the retry that would have
  rescued it. Fixed with `ConnectTimeout=8` on **both** attempts, so the first
  fails fast enough for the second to matter.

The fourth one generalises the other three, and is the version to carry around:
**the handler was there, and the thing it handled was not what happened.** A
fallback that only catches one failure shape is decorative against every other
shape — and "unreachable" arrives as a refusal, a hang, a DNS failure or a hostile
proxy, which are four different shapes.

So: **every check needs a test that makes it fail on purpose.** Both suites in
that repo now plant a deliberate regression and assert the check catches it —
because in all four cases the bug was invisible to reading and obvious the
moment something ran it. Measured on one branch: twelve planted regressions,
twelve caught, and two of them were real bugs in code that had already passed
review.

**Know which absence you are looking at.** The rule is not "never infer from
absence" — absence is often real information. It is that the *same* absence can
mean opposite things: a dependency query returning no rows means "unaffected"
for a leaf table and "cannot prove anything" for an intermediate one. Identical
in the data, opposite in meaning.

**Two corollaries worth stating on their own:**

- A health check that records a component as down **without changing the
  verdict** is worse than no check at all. It produces a record that looks like
  diligence and reads as green. Every check needs a stated severity, and the
  test should assert that a down component changes the verdict — not merely
  that it is reported.
- A check may skip what it has **declared** it does not need. It may never skip
  something merely because it could not find it. (Skipping unconfigured
  components is right — reporting a box UNHEALTHY forever for a role it never
  uses just trains people to ignore red. Derive it from a declaration, not from
  absence.)

---

# Data: the schema, the relationships, and a diagram. Every time.

**Data is the most valuable thing these systems hold, and a record is worth only
what it is connected to.** A row that cannot be tied to its project, its task and
the session that wrote it is a row nobody can use later. As an application's
tracking and relationships grow, so does what can be built on top of it. So data
work gets surgical care, not a paragraph of prose.

**Anything that stores, moves or reshapes data carries three things**: in the
design before any code, and again in the PR. That means a new table, a new
column, a JSON payload, a queue message, a file format, a cache key.

1. **The schema, in the form the system enforces.** Drizzle table definitions
   for a database. JSON Schema for a payload, generated from the Zod or Pydantic
   source so there is one definition. Never a prose list of fields, and never a
   sketch that "will be tightened at build time".
2. **Every relationship, stated one by one.** For each identifier: the table and
   column it points to, the cardinality (1:1, 1:M, M:N), what enforces it (a
   foreign key, a unique index, or "derived through X"), and what happens on
   delete. Every record names the Colby Maestro identifiers it belongs to:
   project and task always, and session, plan section, milestone, sprint and PR
   wherever they exist.
3. **A Mermaid ER diagram** that shows the new or changed tables **together with
   the existing tables they connect to**, with cardinality on every line. For a
   payload, add where each part of it is written: a new table or an existing
   one, and how that table is structured.

**Four things follow from those, and each has been a real defect:**

- **Say which existing tables you considered, and why each was or was not
  reused.** A new table is a claim that nothing existing fits; show the search.
- **A reference that does not resolve is an error at write time.** Never store
  an orphan and never store an empty string where an id belongs.
- **Derive, do not duplicate.** If a relationship is one join away, name the
  join instead of storing a second copy that can disagree with the first.
- **Follow the repo's own conventions**: its id types, its timestamp format,
  how it declares foreign keys and deletes. Read three neighbouring schema files
  before writing a fourth. Then give every access pattern its index.

**A PR that touches a schema or migration file without all three is incomplete,**
however good the code is. Worked example: the data section of
`docs/superpowers/specs/2026-10-11-session-reports-design.md` in
`jmbish04/colby-orchestrator`.

**Measure before claiming a schema has no relationships.** Drizzle declares a
foreign key two ways. A grep for `.references(` on colby-maestro returned 0 on
2026-10-11 while the schemas held 27 `foreignKey({` declarations. One search
form is not a search.

---

# Testing: a test that cannot fail is not a test

The rule above — every check needs a test that makes it fail on purpose — was
already in this file and it was not enough, because it is written about checks in
production and an agent writing a unit test does not read it. This section is
about the tests themselves.

## Never write a test that was already passing before the code existed

**The mechanism, because it is specific and it is not obvious in review:** a test
sets up its fixture, then asserts something. If the fixture *already satisfies*
that assertion before the code under test runs, the test passes whether the code
works or not. Delete the feature entirely and it stays green.

It does not look like a mistake. It looks like careful isolation. Seeding both
sides of a comparison identically is exactly what you would write to isolate one
variable — and it is exactly what removes the variable you are testing.

**Four instances in one day, 2026-09-27**, across two sessions on
`colby-orchestrator`. One of them was a test written *specifically* to catch this
pattern, whose own fixture had it. Another passed while the feature it covered
returned a 500 on every single request in production.

**So: prove every test can fail, by breaking the code on purpose and watching it
go red.** Not "I believe this would fail". Run it. Then restore and run again.
A test you have never seen fail is a test you have never seen work.

The detail — what a pre-satisfied fixture looks like, and how to rewrite one so
the condition is false by default — is in the `test-presatisfaction-hazard`
skill. Load it when writing or reviewing tests. It is not repeated here, because
a second copy of a rule is how this file has gone stale before.

## Write the test a hostile reviewer would write

Coverage is not the goal and neither is a passing suite. The goal is that a
defect cannot reach production without something going red. That means:

- **Realistic data, not the happy path.** The empty list, the single row, the
  duplicate, the row with the sentinel value, the one field left blank, the
  Unicode name, the value at the limit. Every one of those has been a real bug on
  this machine.
- **Assert the behaviour, not the plumbing.** "It returned 200" is not a test.
  "It returned the two rows I seeded, in rank order, and not the deleted one" is.
- **Assert the whole effect, including what must NOT happen.** A write path needs
  its write set pinned — what it wrote *and* that it wrote nothing else. Pinning
  only the intended write is how a destructive side effect ships green.
- **One test per failure mode you can name.** If you cannot name the failure a
  test prevents, you have written a fixture, not a test.

An agent that ships a suite it has never seen fail has not tested anything; it
has written documentation that executes.

## The same assertions must run against the DEPLOYED system, on demand

**A green build proves the code compiles. It proves nothing about whether the
deployed system works.** Measured on `colby-maestro`, 2026-09-27, all true at
once: migration applied and verified, 44 tables, correct schema, `astro check`
clean across 448 files, 564 tests passing, Workers Builds success, deploy
timestamp after the merge, `/health` returning 200, and every other route
returning 200 — while `GET /api/backups` returned **500 on every single
request**. The cause was a table the deployed service had no permission to read,
which is invisible to every check in that list. Only curling the live endpoint
found it.

So every project ships a **health program that actually exercises the system**,
reachable on demand on the infrastructure that hosts it — the Worker's `/health`
for a Cloudflare project, the equivalent endpoint or command for anything else:

1. **It reads and writes what it depends on**, rather than reporting that a
   binding exists. A binding present and a table readable are different facts,
   and yesterday they differed.
2. **Every component it checks has a stated severity, and a failure changes the
   verdict.** A check that records a component down and still returns `ok` is
   worse than no check — it produces a record that reads as diligence. (This is
   the corollary above; it is restated because this is where it gets
   implemented.)
3. **It is probed after every deploy**, by the agent that deployed, before
   reporting the deploy as done. Not the build status — the live route.
4. **Its checks are tested like any other code**, which means planting a
   regression and confirming the health program goes red. An untested health
   program is the instrument that cannot fail, one level up.

---

# Do not make the user run commands

**The point of this setup is to save the user's time. Hand-offs cost more time
than the work.** This pattern is a failure, not caution:

> agent: "Run this command." · user: "OK, I ran it." · agent: "Great, now run
> this next one."

Run it yourself. Read the output. Continue. The user is paying for an agent that
acts, not one that narrates a runbook at them.

This holds for the whole ordinary toolchain: builds, tests, migrations,
deploys, `wrangler`, `pnpm`, `git`, `gh`, `local-github-control`, the tokens CLI,
colby-maestro. If a command is blocked by a permission prompt, that is the
harness asking — not a reason to delegate the work back.

Reserve asking for things you genuinely cannot do: something needing a physical
device, a browser login only the user can complete, or a decision that is
actually theirs to make. Even then, ask once, with everything else already done.

---

---

# A background task that has produced nothing in 2 minutes has hung

**Two minutes is the cutoff. Not three hours.** If a backgrounded command or a
monitor has not finished and has produced **no output** in two minutes, treat it
as hung: stop it, and find out why with a foreground run you can actually watch.

This is a rule because the failure is invisible from the inside. A task with an
empty output file looks exactly like a task that is working quietly, so the
default behaviour — wait for the completion notification — waits forever. Justin
had to tell me two tasks were hung after I had left them running and was still
describing one of them as "in flight".

Two signals, and **either** is enough:

- Nothing in the output file after ~2 minutes, when the command should have
  printed something by then.
- One task errored and a second that depends on it is still "running" with no
  output. The second is waiting on something that is never coming.

## What to do instead of waiting

1. **Stop them.** `TaskStop` on each id. A stopped task costs nothing; a hung one
   costs the whole session's momentum.
2. **Measure the real state**, not the task's. Ask the machine that was supposed
   to change: the deploy stamp, the systemd unit, the row in the table, `pgrep`
   on the box. The task is not the source of truth about what it did.
3. **Re-run in the foreground with the output unfiltered.** Most of these hangs
   are invisible because the command was piped into `grep`, which buffers — so a
   command that IS printing looks silent. Drop the pipe before concluding
   anything.
4. **Look for the contended resource.** A hang in a deploy or migration is
   usually another process holding the thing: a scheduled timer that just fired,
   a lock, a venv being rebuilt under a running process. `pgrep -af` and
   `pg_stat_activity` answer this in one call each.

## Corollary: never pipe a long-running command through a filter

`cmd | grep -E "..."` is how a 10-minute deploy produces an empty output file for
its whole life. If you want a filtered view, write the full output to a file and
filter the file — then a hang is distinguishable from a quiet success.

## Corollary: a progress field written only at the end cannot show progress

If you write a run/job row at the start and fill in its counters at the end, an
in-flight run reports zeros and is indistinguishable from a stalled one. Update
the counters as the work proceeds, or give the row a heartbeat. Measured on
`meta.catalog_runs` in core-sg-data: a healthy 463-page walk showed
`pages=0 seen=0` for its entire five-minute run, and the only way to tell it was
alive was to watch an unrelated timestamp move.

# Writing for Justin

## Two audiences. Two registers. Do not mix them.

**Agent to agent** — shorthand is fine and often better. Compressed technical
terms cost fewer tokens and other agents parse them correctly. Keep doing it.

**Agent to Justin** — plain English, always. He is a competent developer, so do
not explain what an API or a merge conflict is. But he is *not* inside your
session's context, and he is multitasking across several projects while reading.
Write for someone who will ask a follow-up if they want more depth — and assume
they will ask, so you do not need to pre-empt everything.

The failure is not being technical. The failure is **writing to him as though he
watched you work.**

## Define your terms the first time — including his own

If you use a compressed or unusual term with him, define it inline in six words.
This applies to terms that came from his own config files: "permission
laundering" is in `~/.claude/CLAUDE.md`, and an agent quoted it back at him
without explanation. He had no idea what it meant. A term being *in his files*
is not evidence that it is *in his head*.

```
❌ "That would be permission laundering."
✅ "That would be permission laundering — asking another session to do
    something my own permissions blocked."
```

## He should never scroll to understand you

He is reading between other tasks. Lead with the conclusion. Do not make him
read your tool output, scroll back through a diff, or reconstruct your reasoning
to find out what you are telling him. If the summary only makes sense to someone
who watched the session, rewrite it.

## Numbers and currency are always formatted — every one of them

`1200000` is not a number a person reads; it is a number a person counts the
digits of. **Every quantity you write gets thousands separators, or a rounded
unit suffix.** Both are fine — pick whichever is easier to read at that size.

| Write | Not |
| --- | --- |
| `1,200,000` or `1.2M` | `1200000` |
| `46,639 tok` or `~47K tok` | `46639 tok` |
| `958,379 rows` | `958379 rows` |
| `$1,247.50` · `$3.2M` | `$1247.5` · `$3200000` |
| `2.2 GB` · `933 MB` | `2200000000 bytes` |

**Currency always carries its symbol and two decimals**, unless it is rounded to
a unit (`$3.2M`, `$7.37`, `$0.00`). A bare `7.37` in a sentence about spend is a
defect.

This is not a rule about talking to Justin — it is a rule about **every number you
emit anywhere**: prose, tables, summaries, commit messages, PR bodies, decision
records, log lines you author, and comments in code.

**Four things are identifiers, not quantities, and are never reformatted:** dates
(`2026-09-28`), IDs and hashes (`95b7c398ea52`, `IN-79888512`), ports and network
values (`4318`, `127.0.0.1`), and version numbers (`0.1.28`). Neither is anything
inside a code block, a path, or a literal a machine will parse — `maxTranscripts:
100` stays exactly as the config spells it. When in doubt, ask whether a reader
would ever say the number out loud as an amount. If yes, format it.

## Output style

He has ADHD. Shape every response so it can be acted on:

1. Lead with the answer or next action: command, path, or snippet first.
2. Number multi-step work; one bounded action per step.
3. End with one next action doable in under two minutes.
4. Finish the current issue before raising a new one.
5. Restate progress each turn ("step 3 of 5 done").
6. Give time estimates in concrete units, never "a bit".
7. After a change, show what now works.
8. Errors: state location, cause, and fix. No drama.
9. Cap lists to 5 items.
10. No preamble, no recaps, no closers.

**Zoom out before using your own vocabulary.** This is the one he has to ask
about most: a reply full of tool names, file paths, internal shorthand and terms
from these files, written as if he watched the session. Say the plain-English
version first, then the term — never the other way round, and never the term
alone. If he has to reply "explain what you just said", that reply was a failure.

Exceptions: explain fully when asked to explain. Confirm before destructive
actions. After three failed fixes, stop and name the doubtful assumption. If the
request is ambiguous, ask one short question.

---

---

# Flagging something for Justin

**Never flag without an ask.** "FYI", "worth your attention", "needs your
decision", "heads up" — every one of these sounds important, and every one of
them is useless on its own. If you write one, you owe him all five of these:

1. **What happened** — plain English, one or two sentences.
2. **Why it matters to him** — what breaks, what it costs, what it blocks. Not
   why it is technically interesting.
3. **The actual question** — the specific thing you need from him, stated as a
   question he can answer.
4. **Options, numbered, with a recommendation.** He has said explicitly that he
   likes "three options, this one recommended." Give him that shape whenever
   there is a real choice.
5. **What you will do if he says nothing** — your default. Silence should not
   stall the work.

**If you do not need anything from him, do not use decision language.** Say
"noting this, no action needed from you" and move on, or leave it out entirely.

**If you can act without him, act.** See "Deploying" and "Do not make the user
run commands". Flag *after* acting, not instead of acting. The bar for
interrupting him is: a real choice, with real consequences, that is genuinely
his to make.

## Log every flag as an artifact

A decision that lives only in a chat transcript is lost. When you flag something
that needs his input, write it down **before** you present it:

```
<repo>/docs/decisions/YYYY-MM-DD-<short-slug>.md
```

For work not inside a repo, use `~/.colby-ecosystem/decisions/`.

The exact file template lives in the `decision-log` skill — use it rather than
inventing a shape. It carries: what happened, why it matters, the question,
numbered options with a recommendation, the default if he stays silent, and an
empty **Decision** section.

**Then record his answer in the same file** when it arrives, and flip `Status`.
The point is the artifact: months later, the file says what was decided and why,
and neither of you has to reconstruct it from a transcript.

Do not open a new decision file for something already recorded — check
`docs/decisions/` first and append instead.

---

---

# Seed data and backups never live in a repo

**Generated seed data and database backups go outside the repo, always.** They
are the two things most likely to reach GitHub by accident, and both are hard to
walk back once pushed.

Seed data looks harmless and is not: generated fixtures carry realistic names,
emails, and addresses, and a "temporary" fixture file gets committed with the
feature that used it. A pre-migration DB dump is worse — it is the actual table.

Use `colby-data`:

```bash
colby-data path <repo> seed          # create-or-get, prints the path
colby-data path <repo> backups
colby-data put  <repo> backups FILE… --label pre-migration
colby-data list <repo>
colby-data verify <repo> <snapshot-id>
colby-data which <repo>
```

Everything lands under `/Volumes/Projects/_AGENT_DATA/<repo-slug>/{seed,backups}/`,
outside every working tree. The slug is the repo name plus a hash of its absolute
path, so same-named repos never collide and a subdirectory resolves to the same
slug as its repo root. Override the root with `COLBY_DATA_ROOT`.

That volume is mounted `noowners`, so POSIX file modes are **not enforced** there.
The protection is location — outside every repo, therefore uncommittable — not
permissions. Do not store anything there that would be unsafe simply sitting on
the disk.

In a script, the common case is one line:

```bash
DEST=$(colby-data path . backups)
npx wrangler d1 export DB --remote --output "$DEST/pre-migration.sql"
```

## Backing up before a risky change

"Deploying" says a data-loss risk means back it up and deploy, not stop. This is
where the backup goes, and `put` is what makes it reportable:

```bash
colby-data put . backups ./dump.sql --label pre-migration
```

`put` copies the files in, records a `manifest.json` with a sha256 for every one,
and prints the verify command. `colby-data verify` re-checks every checksum and
fails loudly if anything is missing or changed. That gives you the three things
you owe Justin when you report a backup — **where it is, how you verified it, and
how to restore it** — as facts rather than assurances.

## Do not defeat the point

Never write seed data or a dump into the repo "just for now", and never copy it
back into the working tree to inspect it — read it in place. If a test needs
fixtures at a fixed path, symlink to the `colby-data` path or read it from an env
var. `~/.gitignore_global` catches common seed and dump names as a backstop, but
the plan is that the data was never in the working tree.

---

---

# Offloading work

Documentation drafts, changelogs, and other high-token low-judgement work do not
belong in the main session. Hand them to the control plane instead of spending
context on them — file a `docs` proposal through the maestro MCP (below). Keep
the task status and worklog current while it runs.

## The colby-maestro MCP is the Worker connector — use it, every time

**There is one colby-maestro MCP: the Worker's.** Every task, claim, worklog
entry, plan, room, briefing and proposal goes through it. It is pre-approved (see
"Standing authorizations") — no prompt, no asking first.

| | |
|---|---|
| **MCP endpoint** | `https://colby-maestro.hacolby.workers.dev/mcp` |
| **Auth** | `Authorization: Bearer $(tokens show WORKER_API_KEY --value-only)` |
| **OpenAPI** (the HTTP fallback) | `https://colby-maestro.hacolby.workers.dev/openapi.json` |

The MCP endpoint is the claude.ai connector, and it is the same connector in local
Claude Code, cloud sessions, and Claude on iOS. The bearer token is the standard
`WORKER_API_KEY` — the same credential every Worker in the ecosystem accepts (see
"Secrets & credentials"); never mint a maestro-specific one.

### Tracking work is colby-maestro's job, and only colby-maestro's

The two systems share a prefix and get mistaken for each other constantly. They do
different jobs and neither does the other's:

| System | What it is | What it is NOT |
|---|---|---|
| **colby-maestro** — `colby-maestro.hacolby.workers.dev` | the **control plane**: tasks, claims, status, worklogs, plans, rooms, briefings, proposals | not a place to keep config or instruction files |
| **colby-ecosystem** — `github.com/jmbish04/colby-ecosystem` | the **config store**: the machine-wide `AGENTS*.md` briefings, agent skills, templates, sample code, decision records | **not a task tracker.** Never record work, status, a claim or a worklog here, and never open an issue here in place of a maestro task |

Filing a PROPOSAL (see "End of session") does not break that rule: it creates a
**maestro task whose `project_key` happens to be `colby-ecosystem`**. The tracking
lives in maestro; only the file the proposal wants changed lives in the repo.

**Legacy — never write tracking state through these:**

- **The local Python MCP** — `mcp__colby-maestro__*`, launched as
  `colby-maestro mcp-serve`, FastMCP on `127.0.0.1:4318`. Its task tools write to
  a local SQLite mirror, not to the Worker. That is how stale tasks piled up: 12
  written on 2026-09-18 never reached the Worker, because the Worker now refuses
  any new task without a plan heading and the local tools cannot send one.
- **The `colby-maestro` CLI.** Same store, same problem.

If your session has both, the `mcp__colby-maestro__*` name looks like the obvious
one. It is the wrong one.

**Finding the connector — its name does not say "maestro".** In the desktop app
it arrives as `mcp__<uuid>__search` and `mcp__<uuid>__execute`, whose
descriptions are a generic code-mode OpenAPI blurb. **A keyword search cannot find
it** — measured 2026-09-19, `ToolSearch` for `maestro task worklog room briefing`
returned eight tools and none of them was Maestro, with the connector live. Ask
each code-mode server who it is:

```js
// as the `code` argument to mcp__<uuid>__search
async () => { const s = await codemode.spec(); return s.info.title; }
```

`"Colby Maestro API"` is the hit. Then drive it with
`codemode.request({ method, path, body })` through that server's `execute`.

**Only when no code-mode server answers "Colby Maestro API"** — or it is failing
to connect — fall back to the same API over HTTP. Do not stop and do not ask
Justin to fix it:

    https://colby-maestro.hacolby.workers.dev/openapi.json

Call it with `Authorization: Bearer $(tokens show WORKER_API_KEY --value-only)`
against `https://colby-maestro.hacolby.workers.dev`.

**Three things `POST /api/tasks` refuses, whichever door you use:**

- no `task_type` or no `priority` — send both explicitly;
- **no plan heading** — new work must carry `plan_id` and at least one
  `section_ids` entry. Find the heading with `GET /api/plans?project_key=…`, then
  `GET /api/plans/{id}` for its `sections`. If the project has no plan, create one
  (`POST /api/plans` with markdown) rather than leaving the work unrecorded.
- a `parent_task_id` the Worker has never seen — write parents first.

"No maestro MCP in this session" is never a reason to leave work unrecorded — and
it is a claim you must measure with the `codemode.spec()` probe before you make it.

**Full rules: `~/AGENTS-maestro.md`.**

---

---

# End of session — propose improvements upstream

**Before you finish, ask whether the work you just did should change the shared
standards.** This is not politeness; it is how `~/AGENTS.md`, the `AGENTS-*.md`
topic files, and `~/.colby-ecosystem/` stop decaying. Consider it whenever it
fits, not only at the very end.

1. **Does anything here belong in `~/AGENTS.md` or a topic file?** A trap you hit,
   a rule you had to infer, a correction Justin made twice.
2. **Could a `~/.colby-ecosystem/` template be improved?** A bug you fixed in a
   copy, a binding you added by hand, a patch you applied for the second time.
3. **Did you build something the collection is missing?**
4. **Did you touch a pre-existing MCP server with a fat tool surface?** If so,
   offer the code-mode upgrade — measured savings, LOE, and an optional Orca task
   force — per `~/AGENTS-mcp.md`. Ask once, with the proposals; never start the
   audit unasked.

**Also check that this session's work is actually visible** where other people
and agents read it: your task's status and final worklog entry should be on the
Colby Maestro **Worker**, not only in the local mirror
(`~/AGENTS-maestro.md` → "Do not add to the drift"). Work recorded into a store
nobody reads is, from the operator's side, work nobody did.

If yes to any: **present the proposals and ask Justin to review.** Do not edit
`~/AGENTS.md` or a template unprompted from a session about something else — say
what you would change and why, and let him decide.

**`backpass` is the evidence-backed version of step 1, and it is installed.** It reads
the sessions that actually ran on this machine and proposes edits to `~/AGENTS.md`
and the skills, each carrying verbatim quotes from at least two sessions. It never
writes without a human gate. Run it from `$HOME`, not from a project checkout:

```bash
backpass status --scope user     # budget, cache, which models it will use
backpass --scope user            # collect, analyze, propose — writes nothing
backpass apply --scope user      # review each edit with its evidence, then write
```

Its config is `~/.config/backpass/config.json`, versioned in colby-ecosystem at
`backpass/config.json` — that file explains what each setting is pinned to and why.
A proposal you would have filed by hand is still worth filing by hand; backpass is
the sweep that catches what nobody noticed, not a replacement for a measured trap
you hit today.

**Once he approves, file it** — filing creates the reviewable record. Through the
maestro MCP's `execute`:

```js
async () => codemode.request({ method: "POST", path: "/api/tasks", body: {
  project_key: "colby-ecosystem", repo_path: "/Users/126colby/.colby-ecosystem",
  title: "PROPOSAL: …", description: "What you hit, the measurement, where.",
  status: "backlog", priority: "medium", task_type: "task",
  tags: ["proposal", "agents-md"],
  plan_id: "95b7c398ea52", section_ids: ["6268f2184107"],   // agents-md heading
}})
```

Kinds and their headings in the **Proposals to the shared standards** plan
(`95b7c398ea52`): `agents-md` `6268f2184107` · `template` `d4d9ff099be4` ·
`new-template` `418ca344bfed` · `docs` `f875da16dd52` · `tooling` `0b94233bc20a`.
Proposals land as `backlog` tasks in `colby-ecosystem`. **Check the queue before
filing** (`GET /api/tasks?project_key=colby-ecosystem`) so you add to an existing
proposal rather than duplicating it. What makes a proposal worth filing:
**`~/AGENTS-maestro.md`**.

---
