# Cloudflare Workers & Pages

> Part of the workstation briefing. **`~/AGENTS.md` is the parent — read it first**;
> it carries the rules that apply everywhere (secrets, backups, how to write to
> Justin, when to flag). This file adds the rules for **all Cloudflare infrastructure** — bindings, CI/CD, deploys, D1, KV, R2, Durable Objects,
> Vectorize, Workers AI, icons, and the traps that cost the most time.
>
> **Start with "Strict billing & resource allocation constraints" below.** It is first
> because it governs design decisions you cannot cheaply undo later.

---

# Strict billing & resource allocation constraints

**Read this before you design anything that touches D1, Workers AI, Vectorize,
Durable Objects, KV, or R2. These are hard engineering requirements, not tuning
you do later.** Every rule below exists because a real line item on a real bill
moved. A design that cannot meet them is a design you flag (see "When a design
genuinely needs more", at the end) — not one you ship and reconcile at month-end.

## The bill — invoice IN-79888512, issued 19 Sep 2026

Usage period **19 Aug – 18 Sep 2026**; subscriptions **19 Sep – 18 Oct 2026**.
Total **$20.42**. These five lines are the entire invoice — every other line
across its 8 pages billed **$0.00**.

| Line item | Billed qty | Rate | Amount |
|---|---|---|---|
| **Workers Paid** — subscription | 1 | $5.00 | **$5.00** |
| **Images Stream Bundle Basic** — subscription | 1 | $5.00 | **$5.00** |
| **Regular Twitch Neurons (RTN)** | 669,729 | $0.011 / 1,000 | **$7.37** |

*(The billed feed totals 671,383 / $7.39 for the same cycle. The 1,654-neuron
difference is exactly 18 Sep's billable quantity — the invoice was cut before that
day landed. Both numbers are right for their snapshot; say which one you are quoting.)*
| **D1 — Storage GB-mo** (first 5 GB included) | 4 | $0.75 | **$3.00** |
| **Vectorize — Stored Dimensions** (first 10M included) | 45,683,806 | $0.05 / 100M | **$0.05** |
| | | **Total** | **$20.42** |

**Read the shape before you read the rules.** $10.00 of the $20.42 is fixed
subscription that no code change touches. Of the $10.42 that is usage-based,
**$7.37 is Workers AI and $3.00 is D1 storage — 99.5% of it.** Vectorize is five
cents. KV, R2, Durable Objects, Queues, Workers requests, Workers CPU ms,
Observability, Containers, Browser Rendering, Images, Stream, Email, Realtime and
Zaraz all billed exactly zero.

So **two variable line items matter.** Optimise those hard. Everywhere else the
rules below are about *staying* at zero — which is currently free, with large
headroom — not about clawing anything back. Do not trade schema clarity or code
readability for a line that costs nothing.

**A correction worth keeping, because the reasoning error is reusable.**
I read `Images Stream Bundle Basic` ($5.00/month) as dead spend, because the
metered lines under it showed `0`. That was wrong. Measured 2026-09-26 against
the Images API: **5,335 images stored** of the bundle's 100,000 allowance, 9
uploaded that same afternoon. It is in constant use.

Two ways the invoice misled me, both avoidable:

- **`$0.00` on a tiered line means "inside the allowance", not "unused".** The
  storage lines read `qty 1 · First 1 · $0.00` — that is the included unit being
  *consumed*. It is the identical shape to `Dynamic Workers · First 1,000: 715 ·
  $0.00`, which this very file already explains. I derived the rule and then
  failed to apply it one section later.
- **Check the unit before reading a zero.** `Images Delivered (in hundred
  thousands)` shows `0` for anything under 100,000 deliveries. Zero in that
  column is not zero deliveries.

The general rule: a metered line reading `0` is a statement about a *threshold*,
not about usage. Query the product's own API before calling a subscription dead.

**The same trap in the API, and this one under-reports the line these rules
exist to control.** `GET /accounts/{id}/billable-usage` is the right source for
line items — it returns one row per product per day with the invoice's own
wording, so do not build OCR to recover what it already gives you. But its
`pricing_quantity` is *documented* as the quantity after the included allowance
is deducted, and **on storage lines that is false.** Grouped by billing cycle
(the 19th, never the calendar month):

| line | cycle | consumed | over allowance | `pricing_quantity` | cost |
|---|---|---|---|---|---|
| D1 storage | Jun 19 | 8.92 | 3.92 | **0** | 0 |
| D1 storage | Jul 19 | 7.69 | 2.69 | **0** | 0 |
| D1 storage | Aug 19 | 8.74 | 3.74 | **0** | 0 |
| R2 storage | Jun 19 | 37.13 | 27.13 | **23** | 0.345 |
| R2 storage | Jul 19 | 16.51 | 6.51 | **0** | 0 |

Four over-allowance cycles price 0, and the single populated case prices 23
against an excess of 27.13 — so it is not "consumed minus allowance" there
either. The provable row is Aug D1, because the invoice above exists: excess
3.74, invoice qty **4** at $0.75 = **$3.00**, feed `pricing_quantity` **0**. The
feed had the consumption right and the priced quantity wrong.

So on a storage line, a `pricing_quantity` or `contracted_cost` of 0 means
**UNKNOWN, not ZERO** — and anything deriving storage spend from it under-reports
**D1 storage**, which is one of the two lines this whole section tells you to
optimise. `consumed_quantity` is still trustworthy; the allowance arithmetic is
what you do yourself. The $3.00 in the table above is the invoice's figure, not
the feed's, so it stands.

Same shape as the two bullets above and as `~/AGENTS.md`'s "Never conclude
anything from an absence": a zero that is a claim about a threshold, a unit or a
field's reliability rather than about usage. Here it is a row **present at 0 for
a line that was in fact charged**, which is the one case "not billed yet versus
billed $0" does not cover.

---

## 1. Dynamic Workers — 715 / 1,000

**The allocation is a count of distinct Worker identities, and it is consumed,
not rented.** Invoice line: `Dynamic Workers (First 1,000 are included)` — qty
**715**, **$0.00**. At 715, the remaining 285 is roughly a year of normal project
work — or a single afternoon of a loop that mints one per request.

This is the only line where the *ceiling* matters more than the *rate*: crossing
1,000 is a structural problem, not a cent-per-unit problem.

**Hard rules:**

- **Reuse before you create.** Before adding a Worker, check whether an existing
  one should grow a route instead. A new route on a `core-*` Worker costs zero
  allocation; a new Worker costs one of 285.
- **Never generate an identity per request, per session, or per user.** No
  `crypto.randomUUID()` in a Worker or sandbox id, no id built from `Date.now()`,
  no id derived from a request body.
- **Always `.get(stableId)`.** The id must come from something that already
  exists and repeats — a project slug, a tenant id, a task id that is itself
  stable. A stable id also lands on a warm instance, so this is a latency win as
  well as a billing one.

  ```ts
  // BAD — one identity per call, forever
  ns.get(ns.newUniqueId());
  ns.get(ns.idFromName(crypto.randomUUID()));

  // GOOD — derived from something that repeats
  ns.get(ns.idFromName(`project:${projectSlug}`));
  ns.get(ns.idFromName(`tenant:${tenantId}:queue`));
  ```

- **Never build a Worker out of a code string at runtime.** Dynamic script upload
  per session is the fastest way to burn the remaining 285. If behaviour must
  vary, vary it with *data* passed into one stable Worker.
- **Cache scripts and module graphs aggressively.** Anything you fetch, compile
  or template once belongs in module scope so it survives across requests in the
  same isolate.

**If you are about to cross 900, stop and flag it.** That is a platform-shape
decision — consolidate into fewer multi-route Workers, or move to a dispatch
namespace — not something to solve inside one feature branch.

---

## 2. Workers AI / Neurons — $7.37, and it was two bad days

**The allowance is 10,000 neurons/day free on Workers Paid *and* 10,000/day free
on Workers Free** ([docs](https://developers.cloudflare.com/workers-ai/platform/pricing/),
checked 2026-09-21). core-guardian runs both accounts
(`ai-router/workers-ai-accounts.ts`), so **routing capacity is 20,000/day**.

**But do NOT credit 20,000/day against an invoice.** An invoice belongs to ONE
account and forgives only that account's allowance. Crediting the dual-account
figure halves the only genuinely billable line and produces a number that cannot
be reconciled. (This is AGENTS.md #41 in the core-guardian repo; I got it wrong
first, and the billed feed corrected me.)

**What Cloudflare actually did — measured from `billable_usage`, not derived**
(`GET /api/billing/workers-ai-neurons?cycleStart=2026-08-19`, guardianAuth):

| | |
|---|---|
| consumed | 981,383 |
| billable | 671,383 |
| **forgiven** | **310,000 — exactly 10,000 × 31** |
| billed | $7.39 |

**It behaved as ONE CYCLE POOL, not a daily reset.** The docs say the allowance
resets daily at 00:00 UTC. The feed says otherwise: the 310,000 drained partway
through 1 Sep, and from 2 Sep onward Cloudflare billed **100% of every day** —
including days of 1,315 neurons, which are 87% *under* the documented daily
allowance.

| Day | Consumed | Billed | |
|---|---|---|---|
| 19 Aug – 31 Aug | 8k – 11k/day | **0** | inside the pool |
| **1 Sep** | **519,109** | **340,643** | **$3.75** — pool ran dry mid-day |
| 4 Sep / 7 Sep | 72,345 / 125,517 | in full | $0.79 / $1.38 |
| 8 – 18 Sep | 1,300 – 1,700/day | **in full** | $0.011–0.022/day |

**That last row is the dispute, and it is TWO claims, not one.** Keep them apart
— conflating them hands Cloudflare a factual error to lead its reply with.

| | Days | What happened | Unsupported |
|---|---|---|---|
| **A** | 11 (8–18 Sep) | 1,315–1,701 neurons/day — **83–87% BELOW** the allowance — and every neuron billed. The allowance was not applied at all. | **16,525** |
| **B** | 6 (2–7 Sep) | Usage genuinely exceeded 10,000/day, but billing started at neuron **1**, not 10,001. Exactly 10,000/day unsupported. | **60,000** |
| | | | **76,525 total** |

**1 Sep belongs to neither.** Cloudflare forgave 178,466 that day — the cycle pool
draining — so it is the one day the allowance demonstrably *was* applied. Do not
count it as unapplied; the arithmetic that says otherwise is a naive
`min(allowance, billed)` that I ran and had corrected.

Claim B is the stronger one: the arithmetic is exactly 10,000/day, which is hard
to argue with. Claim A is the more striking one. Pitching all 17 days as
"1,300–1,700 while 87% below" is **false** — 7 Sep alone was 125,517.

**The single most useful fact in this whole audit: consumption is not disputable.**

Cloudflare's BILLED consumption and Cloudflare's OWN analytics agree to a
rounding error. Measured 2026-09-26 over the 24 days still inside analytics
retention:

| Source | 26 Aug – 18 Sep |
|---|---|
| `billable_usage` feed, `consumedNeurons` | 915,284.00 |
| GraphQL `aiInferenceAdaptiveGroups` | 915,283.99 |
| **difference** | **0.01 neurons — 0.000001%** |

(A peer session measured the same thing over 26 days from 24 Aug and got 0.75
neurons out of 933,748. Same conclusion, and the day-level agreement is exact.)

This deletes the cheapest deflection in any metering dispute. The usual first
reply is *"your measurement differs from ours"* — but the measurement is not ours
at all; it is two of Cloudflare's own surfaces agreeing. **What is in dispute is
only how the allowance was applied to a quantity both sides already agree on.**

It is also why account analytics is the MEASUREMENT and the router's
`ai_router_requests` is attribution ONLY: analytics ties to the billed quantity
this tightly, and the router saw 3.4–6% of the real spend.

**Analytics retention is ~32 days and it moves daily.** On 2026-09-26 the window
had already rolled past 24 Aug, so the peer's exact comparison could no longer be
reproduced. That is the argument for the daily snapshot that outlives GraphQL —
if a figure matters for a dispute, capture it the day you see it.

**Keep observation and conclusion apart.** *"17 days billed in full while under
the documented allowance"* is an OBSERVATION — it is in the data and Cloudflare
can verify it in one query. *"The allowance did not reset"* is a CONCLUSION about
Cloudflare's internal behaviour, inferred from the totals landing on exactly
310,000. State the first; raise the second as a question. A vendor that can rebut
one sentence tends to treat the whole message as rebutted.

1 Sep alone is **$3.75 of the $7.39**, not the $5.60 that
`(519,109 − 20,000) × $0.011/1000` suggests. The feed carries the billed quantity
directly — never reconstruct it by subtracting an allowance you assumed applied.

**The lesson is therefore not "compress your prompts". It is "cap the day".** A
month of normal operation costs nothing; one unattended job costs the whole bill.
Prompt hygiene (below) still matters, but it would not have prevented a single
cent of this invoice.

### The rule that would have: a hard daily neuron ceiling, enforced

Cloudflare does **not** stop at 10,000 on a paid account — past the allowance it
silently bills the card. The ceiling is ours to enforce. `neurons.ts` already
tracks it per tier; the failure mode is a caller that never consults it.

- **Every Workers AI path goes through `runWorkersAi`** — the router door — so
  the ledger sees it and the free account is tried first.
- **Never declare an `ai` binding in `wrangler.jsonc`.** core-guardian
  deliberately does not have one: `env.AI.run` is account-implicit, always lands
  on the paid account, and cannot be metered per-account. That is precisely the
  hole a runaway job bills the card through.
- **Any batch, backfill, cron or agent loop that calls a model declares a neuron
  budget before it starts and aborts on it.** Not a step ceiling — a *neuron*
  ceiling, checked against the ledger between iterations.
- **Price the model per call, not per token.** `kimi-k2.6` cost **~1,200 neurons
  per call** here; `bge-large-en-v1.5` cost **9**. A 130× spread makes model
  choice the dominant lever, far ahead of prompt length.

### Attribution is currently broken — fix it before trusting any neuron number

Measured 2026-09-21: `ai_router_requests` logged **54,326 neurons across 271
calls** for the billing period. Cloudflare's analytics for the same account and
period show **951,778 neurons**. **The router's own records account for under 6%
of actual spend.** On 1 Sep the router logged 31,365 neurons against Cloudflare's
519,109.

Whatever burned the other 94% did not go through `/api/ai-router/run`, and
**measured 2026-09-25, it cannot be found after the fact:**

- **Cloudflare has no per-script neuron attribution.** `aiInferenceAdaptiveGroups`
  offers `modelId`, `date`, `errorCode`, `requestSource`, `tag` — and **no
  `scriptName`**. On every row for 1 Sep and for 19–24 Sep, `requestSource` came
  back `unknown` and `tag` came back null. You cannot query who spent it.
- **111 of the 218 deployed Worker scripts on the account hold an `ai` binding.**
  (Walked every script's `/settings`; 0 errors on the final pass.) Any one of them
  can bill the card, account-implicitly, with nothing recording which.

So attribution is not a query, it is a **build**: either the binding goes away and
the guardian door is the only path, or an approved direct caller sets an AI Gateway
tag naming itself. Until one of those is true, **no dashboard built on
`ai_router_requests` is telling the truth about cost.**

**Corollary for any new Worker:** do not add an `ai` binding. `~/.colby-ecosystem/workers/wrangler.jsonc`
already ships without one, deliberately. Adding one puts the Worker in the 111.

### Stay on Regular Twitch Neurons

The same invoice carries a `Fast Twitch Neurons (FTN)` line at **$0.125 per
1,000** — 11.4× the RTN rate, currently 0.
The same 669,729 neurons billed as FTN would have cost **$83.72** instead of
$7.37. Never move a workload to a fast-twitch model without pricing it first, and
say in the PR why the latency was worth an order of magnitude.

### Prompt hygiene — still required, but it is not what saves the money

These keep steady-state usage inside the free pool, where it already sits. They
are hygiene, not the cost control. The cost control is the daily ceiling above.

- **Route through the AI router, never `env.AI.run` directly.** `~/AGENTS-ai.md`
  already requires this: `POST /api/ai/workers-ai/{model}` with an `origin`.
  Calling the binding directly dumps the spend into an unattributed bucket, which
  means the next person trying to cut this bill cannot see who spent it. **An
  unattributed neuron is worse than an expensive one.**
- **Truncate input before the call, not inside the prompt.** Cap every
  variable-length field at a byte budget you chose deliberately, and say so:

  ```ts
  // ponytail: 8 KB is ~2k tokens; past this is noise for classification
  const body = raw.slice(0, 8_000);
  ```

  Never pass a whole document, file, HTML page, or result set into a prompt
  "because the model will figure it out". It will, and you pay per token for it.
- **Compress system prompts.** They are sent on every single call. Strip
  politeness, stale examples, and restated rules. A 400-token system prompt over
  100k calls is 40M tokens of pure overhead.
- **Short-circuit duplicate prompts with a cache.** Hash the fully resolved prompt
  (system + input + model + params) and check before spending:

  ```ts
  const key = `ai:${model}:${await sha256Hex(system + "|" + input)}`;
  const hit = await env.CACHE.get(key, { cacheTtl: 86_400 });
  if (hit) return JSON.parse(hit);          // zero neurons
  ```

  Identical input must never be paid for twice. Highest-value single change
  available on this line item.
- **No recursive or consecutive model calls without a hard ceiling.** An agent
  that calls the model, reads the answer, and calls again is an unbounded spend
  loop. Every such loop carries an explicit ceiling and exits on it:

  ```ts
  // ponytail: hard ceiling 4; raise only with a measured reason
  for (let step = 0; step < MAX_STEPS; step++) { /* … */ }
  ```

  A loop whose only exit condition is "the model says it is done" is not a
  ceiling.
- **Pick the smallest model that passes.** Do not default to the largest and trim
  later — trimming later never happens.
- **Batch.** One call classifying 20 items beats 20 calls classifying one: the
  system prompt is paid once instead of twenty times.

---

## 3. D1 — $3.00, and the stored size needs verifying

**Storage is the entire D1 bill. Rows are not.** Measured on IN-79888512:
`D1 - Rows Read` billed **0** against **25 billion** included, `D1 - Rows Written`
billed **0** against **50 million** included. The row-level rules below are sound
engineering and they keep latency honest — but at this account's volume they are
**not** a billing lever. Do not bend a schema for them and do not claim they save
money.

**The stored size is probably double what the dashboard summary suggests, and
that needs settling first.** The invoice bills `D1 - Storage GB-mo (first 5GB
included)` at **qty 4 × $0.75 = $3.00**. On this invoice, quantity is the
*billable* amount: a line still inside its allowance prints a `First N` sub-line
and charges $0.00 — `Dynamic Workers` does exactly that at 715 of 1,000. The D1
line has no such sub-line and was charged in full, so the 4 is **4 GB over the
5 GB allowance — roughly 9 GB stored, not 4 GB**. The alternative reading is that
the account is being billed for storage that should be free. Both are worth five
minutes:

```bash
pnpm exec wrangler d1 list
pnpm exec wrangler d1 info <DB_NAME>          # per database; sum the sizes
```

At ~9 GB, retention is not a precaution — it is overdue work, and it is the only
D1 change that moves the bill.

**Hard rules:**

- **Every query must be index-covered. Prove it with `EXPLAIN QUERY PLAN`.** The
  plan must say `SEARCH` — `SCAN` on any table with real row counts is a defect,
  not a slow path:

  ```bash
  pnpm exec wrangler d1 execute DB --remote \
    --command "EXPLAIN QUERY PLAN SELECT * FROM interactions WHERE vendor_id = ?"
  ```

  Ship the index in the same migration as the query that needs it. A new `WHERE`
  or `ORDER BY` column with no index is an incomplete change.
- **Batch every multi-statement write.** `db.batch([...])` is one round trip and
  one transaction; a loop of `await stmt.run()` is N of each.

  ```ts
  // BAD
  for (const r of rows) await env.DB.prepare(INSERT).bind(...r).run();

  // GOOD
  await env.DB.batch(rows.map((r) => env.DB.prepare(INSERT).bind(...r)));
  ```

- **Every table that grows gets a retention policy, written at the same time as
  the table.** Logs, events, interactions, scan results, model outputs, job rows
  — all of them. A cron-triggered purge, not a someday plan:

  ```sql
  DELETE FROM events WHERE created_at < unixepoch('now', '-30 days');
  ```

  A table with no retention rule is the table that will eat the last gigabyte.
- **Lightweight types, always.** `INTEGER` unix seconds for timestamps, never ISO
  strings. Integer or short enum codes, never repeated long labels. Large blobs
  go in **R2** with the D1 row holding only the key — the 5 GB is for relational
  data, not payloads.
- **Compress anything text-heavy before storing it.** JSON blobs, HTML snapshots
  and model outputs go in gzipped (`CompressionStream`) as `BLOB`, or to R2 by key.
- **`SELECT` the columns you need.** `SELECT *` on a wide table bills bytes you
  threw away.
- **Before any migration that could lose data, back it up** — `colby-data put`,
  per `~/AGENTS.md` ("Seed data and backups never live in a repo").

**This overage grows monthly and does not self-correct.** Every month at ~9 GB
is another $3.00, and storage only goes up unless something deletes. Getting back
under 5 GB ends the line item entirely.

---

## 4. Durable Objects — $0.00, keep it at zero

DO bills on requests, on **duration while the object is awake**, and on stored
bytes. Measured on IN-79888512, **every** DO line billed zero:

| DO line | Billed | Included |
|---|---|---|
| Compute Requests | 0 | 1M |
| Compute Duration | 0 | 400,000 GB·s |
| Storage Rows Read / Written | 0 | 25B / 50M |
| Storage Reads / Writes / Deletes | 0 | 1M each |
| SQL Storage | 0 | 5 GB-month |
| Storage (KV-style) | 0 | 1 GB-month |

Zero today means nothing idles awake and nothing accumulates. Both are easy to
break by accident, and **duration is the one that bites** — an object that never
goes idle burns the 400,000 GB·s allowance without any traffic at all.

**Hard rules:**

- **Never hold an object awake.** No `setInterval`, no long-lived `setTimeout`,
  no polling loop, no `while (true)`, no open `await` on something that never
  settles. A DO that never goes idle bills duration continuously.
- **Use alarms for deferred and periodic work.** One alarm that wakes, drains a
  batch, and reschedules is the pattern; a timer that keeps the object resident
  is the anti-pattern:

  ```ts
  await this.ctx.storage.setAlarm(Date.now() + 60_000);

  async alarm() {
    const batch = await this.ctx.storage.list({ prefix: "q:", limit: 100 });
    if (batch.size === 0) return;               // no reschedule — go idle
    await drain(batch);
    await this.ctx.storage.delete([...batch.keys()]);
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }
  ```

  Aggregate: one alarm draining 100 queued items, never 100 alarms.
- **Hibernate WebSockets.** Use `this.ctx.acceptWebSocket(ws)` with the
  `webSocketMessage` / `webSocketClose` handlers — never a bare `ws.accept()` plus
  an `addEventListener` closure, which pins the object in memory for the life of
  the connection.
- **Delete state on the way out.** Every write to `ctx.storage` needs a deletion
  path: a TTL sweep in the alarm, or `deleteAll()` when the object's job is done.
  DO storage is billed and has no automatic expiry.
- **Close idle connections immediately.** Do not keep a socket or stream open "in
  case" a client comes back.

---

## 5. Vectorize — $0.05, and an index nothing queries

**Correct the alarm first: this line costs five cents.** 45,683,806 stored
dimension-months against 10M included, at $0.05 per 100M. The overage is real;
the rate is negligible. It is not this account's problem, and no schema should be
bent for it.

**The finding underneath it is the one that matters.** `Vectorize - Queried
Dimensions (First 50 million included)` billed **0** for the entire period.
Nothing queried the index. The account is storing ~45.7M dimension-months of
embeddings that no code reads — dead weight that cost neurons to create and will
cost more neurons on every re-embed. **That spend lands in section 2, where it is
expensive.**

**Do this before applying any rule below:**

```bash
pnpm exec wrangler vectorize list
pnpm exec wrangler vectorize get <INDEX>
```

Find out which index it is and whether anything still needs it. If not, delete it
and the pipeline that fills it — the saving is in Workers AI, not here.

The billed unit is `dimensions × vectors × months stored`, so the levers, in order
of power, are **dimension width**, **vector count**, then **retention**. At 1,536
dimensions, 45.7M dimension-months is roughly 29,700 vectors — a small corpus, so
width dominates. Keep this table for the *next* index, the one that grows into
real money:

| Change | Result |
|---|---|
| 1,536 → 768 dims | 45.6 M → 22.8 M |
| 1,536 → 384 dims (e.g. `bge-small`) | 45.6 M → **11.4 M** |
| 384 dims + purge half the corpus | **≈ 5.7 M — back inside the tier** |

**Hard rules:**

- **Justify the dimension count before you create an index.** An index's
  dimension is fixed at creation; changing it means a rebuild. Default to the
  smallest model that passes your retrieval test, not the largest available.
- **Metadata stays out of the index.** Store only what a filter needs — a short
  id, a type, a timestamp. Titles, snippets, source text, full records, anything
  a human reads, live in **D1 or KV** keyed by the vector id and are joined after
  the query returns.

  ```ts
  // BAD
  { id, values, metadata: { title, body, url, author, raw } }

  // GOOD
  { id, values, metadata: { kind: "note", ts: 1758326400 } }
  // then: SELECT title, body FROM notes WHERE id IN (…matched ids)
  ```

- **Every index ships with its deletion routine.** Session vectors, scratch
  embeddings and superseded document versions get deleted on a cron —
  `deleteByIds` over the ids you already track in D1. Nothing accumulates by
  default.
- **Never re-embed unchanged content.** Store a content hash beside the vector id
  in D1 and skip the embed when the hash matches. This rule pays twice — once in
  Vectorize, once in Workers AI.
- **One index per purpose, never per session or per user.** Partition with
  metadata filters, and delete the partition when it dies.

---

## 6. Workers KV & R2 — $0.00, keep it at zero

### KV

Measured on IN-79888512: reads **0** of 10M included, writes **0** of 1M, lists
**0** of 1M, deletes **0** of 1M, storage **0** of 1 GB. Enormous headroom.

Note the rate asymmetry, because it is what makes `list` dangerous: reads are
**$0.50 per million**, while writes, lists and deletes are **$5.00 per million** —
**10×** — and lists get only a tenth of the reads' free allowance.

- **Never call `kv.list()` on a request path.** Lists belong in a cron job or a
  one-off script. If application code needs to enumerate keys, the index belongs
  in **D1** — not in a KV listing.
- **Every read is an exact-key `get`.** Design key names so you can *construct*
  them, never discover them: `user:${id}:prefs`, not "list the prefix and find
  the match".
- **Cache at both layers** — `cacheTtl` on the read, plus a module-scope `Map` for
  hot keys so repeat reads inside one isolate cost nothing:

  ```ts
  const hot = new Map<string, unknown>();          // per-isolate, free
  async function cfg(env: Env, k: string) {
    if (hot.has(k)) return hot.get(k);
    const v = await env.KV.get(k, { type: "json", cacheTtl: 3600 });
    hot.set(k, v);
    return v;
  }
  ```

- **Never write a value that has not changed.** Read-compare-write beats blind
  write.

### R2

Measured on IN-79888512: Class A **0** of 1M included, Class B **0** of 10M,
storage **0** of 10 GB-month, plus every Infrequent Access line at zero.

Class A (writes, lists, multipart) is the expensive class at **$4.50 per million**
against Class B reads at **$0.36 per million** — 12.5× — with a tenth of the
allowance. Consolidation is the whole game.

- **Consolidate before writing.** Many small objects is the Class A trap. Buffer
  and write one object per batch, run, or day — an NDJSON roll-up beats 5,000
  single-record puts.
- **Lifecycle rules on the bucket, not cleanup code in a Worker.** Set the TTL on
  the bucket itself (dashboard, or `wrangler r2 bucket lifecycle` — check
  `--help`, the surface moves) so expiry is automatic and free, rather than a
  Worker paying for billed deletes.
- **Never `list()` on a request path** — same rule as KV. Key paths must be
  derivable: `${project}/${yyyy}/${mm}/${dd}/${id}.json`.
- **Use conditional reads** (`onlyIf` with an etag / `If-None-Match`) so unchanged
  objects are not re-fetched.

---

## Pre-flight checklist — answer these before writing the code

Five questions. Any "no" is a design change, not a TODO.

1. **Does this create a new Worker identity, or reuse a stable one?**
2. **Does every model call have truncated input, a compressed system prompt, a
   cache check, and a hard step ceiling?**
3. **Does every new query have an index, and every new table a retention rule?**
4. **Does anything I added keep a Durable Object awake, or keep state forever?**
5. **Does everything I embed or store have a deletion path with a date on it?**

## Re-measuring — these numbers decay

`~/AGENTS.md` is explicit: measure against the machine, not against the doc. The
snapshot above is invoice IN-79888512 (usage 19 Aug – 18 Sep 2026) — **the invoice
PDF is the authority, not the dashboard summary and not a remembered number.** The
dashboard reports usage; the invoice reports what was *billed*, and for D1 those
two differ by the size of the free allowance (see section 3). Before you reason
from any of it:

```bash
pnpm exec wrangler d1 info <DB_NAME>              # D1 size + row counts
pnpm exec wrangler vectorize get <INDEX>          # dimensions + vector count
pnpm exec wrangler r2 bucket info <BUCKET>        # R2 object count + bytes
```

For the account-wide picture — neuron spend, Dynamic Worker count,
dimension-months — use the **Cloudflare API MCP** (`search`, then `execute`;
pre-approved per `~/AGENTS.md` "Standing authorizations"), or the dashboard's
usage-based billing page. **Update the table above when you measure it** rather
than leaving a stale snapshot behind.

## When a design genuinely needs more

Do not silently overrun, and do not silently cripple the feature either. Flag it
per `~/AGENTS.md` ("Flagging something for Justin"): what the feature needs,
which line item it moves and roughly how much per month, numbered options with a
recommendation, and your default if he says nothing. Log it in `docs/decisions/`
via the `decision-log` skill.

The bar for "just ship it" is a change that stays inside an included tier.
Anything that creates or grows an overage is his call, not yours.

---

# Start of session: bring wrangler current

**At the start of every session that will touch a Worker, update wrangler in that
repo and confirm the version.** One command, before you plan anything:

```bash
pnpm add -D wrangler@latest && pnpm exec wrangler --version
```

Not optional, and not "if something breaks". Wrangler ships several releases a
week, and the failures a stale one produces do not look like version problems —
they look like your code being wrong. Measured on this machine 2026-09-10:

| Where | Version |
|---|---|
| `npm ls -g` (global install) | **4.53.0** |
| `cloudflare-api-mcp/node_modules` | **4.123.0** |
| `npm view wrangler version` (latest) | **4.130.0** |

Seventy releases between the global install and current. An agent that runs a
bare `wrangler` and gets the global one is working against a build of the CLI
from another era, with different config validation and missing subcommands —
`wrangler check startup` (the error 10021 profiler, below) only exists from
4.114.0, so on the global install it simply is not there.

- **The repo's devDependency is the version that matters.** Bump it there and
  commit it; that is what Workers Builds installs from the lockfile, so a stale
  pin means CI is running a different CLI than you are.
- **Invoke it as `pnpm exec wrangler`** (or `npx wrangler` in a non-pnpm repo),
  never bare `wrangler` — bare resolves to whatever global happens to be there.
- **A major bump is a real change.** Read the changelog before committing it, and
  redeploy something small to confirm the config still validates.
- **This does not apply to the MCP.** The connector calls the Cloudflare REST API
  directly and has no CLI version at all — one more reason it is the default for
  account state (above).

---

# Cloudflare API MCP — the default tool for Worker account state

**Connector name: "Cloudflare API"** (`https://cloudflare-api-mcp.hacolby.workers.dev/mcp`).
Source: `/Volumes/Projects/workers/cloudflare-api-mcp`. It is a self-hosted OAuth
proxy in front of Cloudflare's Code Mode MCP server, so it reaches **the whole
Cloudflare REST API — roughly 2,500 endpoints — through three tools**:

| Tool | What it does |
|---|---|
| `search` | Searches the Cloudflare OpenAPI spec. You pass a JS arrow function that walks `spec.paths`; `$ref`s are already resolved inline. Run it *before* `execute` — do not guess a path. |
| `execute` | Calls the API for real: `cloudflare.request({ method, path, query, body })`. |
| `docs` | Semantic search of developers.cloudflare.com. `search` already appends docs context to its results. |

`accountId` is **pre-injected** into `execute`. Write `` `/accounts/${accountId}/…` ``
and never paste an account id.

## Use the MCP, not the CLI — this is a requirement, not a preference

**Every change to Cloudflare _account state_ goes through this connector:**
creating bindings, wiring CI/CD, reading build logs, listing deployments,
inspecting what exists. Not the dashboard, and not `wrangler` when the MCP can
do it.

The reason is not taste. **Agents run in sandboxed and cloud coding environments
that cannot execute the wrangler CLI at all** — no interactive login, no outbound
shell to Cloudflare, often no network egress from the sandbox. An instruction
written as "run `wrangler d1 create`" is an instruction that silently fails for
every one of those agents, and they then either invent a binding id or hand the
work back. The MCP is a plain tool call, so it works identically in a local
terminal, a cloud session, and a subagent. Write the MCP call; it is the only
form that is correct everywhere.

`wrangler` keeps exactly two jobs — **building and deploying code from a machine
that has the repo** (`wrangler deploy`, `wrangler types`, `wrangler d1 migrations
apply`) and being the local fallback when the connector genuinely is not present
in a session. Say so when you fall back; do not silently start clicking around
the dashboard, and do not tell Justin to.

## Bindings through the MCP

The standing rule does not change: **never hand-write a binding id.** There are
now two equally valid ways to get a real one — the wrangler CLI (see "Creating
bindings" below) or `execute`. Verified request bodies:

```js
// D1              -> result.uuid          (required: name)
async () => cloudflare.request({ method: "POST", path: `/accounts/${accountId}/d1/database`,             body: { name: "my-db" } })
// KV              -> result.id            (required: title)
async () => cloudflare.request({ method: "POST", path: `/accounts/${accountId}/storage/kv/namespaces`,   body: { title: "SESSIONS" } })
// R2                                      (required: name)
async () => cloudflare.request({ method: "POST", path: `/accounts/${accountId}/r2/buckets`,              body: { name: "my-files" } })
// Queues                                  (required: queue_name)
async () => cloudflare.request({ method: "POST", path: `/accounts/${accountId}/queues`,                  body: { queue_name: "my-queue" } })
// Vectorize                               (required: name, config)
async () => cloudflare.request({ method: "POST", path: `/accounts/${accountId}/vectorize/v2/indexes`,    body: { name: "my-index", config: { dimensions: 768, metric: "cosine" } } })
// Secret Store stores                     (required: name)
async () => cloudflare.request({ method: "GET",  path: `/accounts/${accountId}/secrets_store/stores` })
```

Then the workflow is unchanged: paste the **real** id into `wrangler.jsonc`, run
`wrangler types`, never hand-edit `worker-configuration.d.ts`.

## CI/CD — Workers Builds, so a merge deploys itself

**Setting up Workers Builds is mandatory for every Worker that lives in a GitHub
repo, and checking the build after a merge is mandatory too.** Not "nice to
have": a Worker without it goes stale the moment someone forgets to run
`wrangler deploy`, and a merge whose build you never looked at is a deploy you
did not verify. Both are covered by dedicated tools on this connector — you do
not have to hand-write the API calls any more.

### The tools (use these first)

| Tool | Use it for |
|---|---|
| `workers_cicd_get` | What CI/CD a Worker has right now: repo, production branch, triggers, build/deploy commands, build-token reference, pause state. **Run this before assuming anything.** |
| `workers_cicd_configure` | Create or update the configuration. Partial: an omitted field keeps its value. `dry_run: true` previews. |
| `workers_cicd_pause` / `_resume` / `_reconcile` | Hold CI still while you work — see the collaboration rule below. |
| `workers_builds_list` | Build history, newest first, 30-day default, with honest coverage reporting. |
| `workers_build_logs_get` | The logs **plus** a diagnosis: which rules made it critical, any known failure pattern with its fix, and a live Cloudflare docs lookup. |
| `workers_build_logs_search` | Find a string or regex across recent builds' logs. |
| `workers_pr_build_logs_get` | The build for a GitHub PR, with the evidence for why that build is the match. |
| `build_patterns_*` | The shared failure-pattern library — see "leave a pattern behind" below. |

Everything is addressed by **Worker name**. The immutable tag is resolved for
you; you never handle it.

### Mandatory: set it up

For a Worker in a GitHub repo with no triggers, wiring CI/CD is part of the work,
not a follow-up:

```
workers_cicd_get      { worker_name }                      # [] triggers = not connected
workers_cicd_configure { worker_name, repository: "owner/repo",
                         production_branch: "main",
                         build_command: "pnpm run build",
                         deploy_command: "pnpm run deploy",
                         build_token_uuid, dry_run: true }  # then again without dry_run
```

Two things the tool cannot do for you:

- **Installing the Cloudflare GitHub App is a one-time dashboard step.** There is
  no API for it. If it is missing, `workers_cicd_configure` returns the exact
  prerequisite and Cloudflare's own error — that is the one moment to ask Justin,
  with the link, not a runbook.
- **The Worker name in Cloudflare must equal `name` in `wrangler.jsonc`** at the
  configured root directory, or every build fails.

**The deploy command is always `pnpm run deploy`, never a bare `npx wrangler
deploy`.** Workers Builds runs the commands stored in the trigger; it does not
read them from the repo. The stock `npx wrangler deploy` fails for any Astro SSR
Worker (entry point and assets must be on the command line) and leaves production
silently stale. See "Every Worker repo ships `pnpm run deploy`" below.

### Mandatory: check the build after you merge

**A merge is not a deploy until the build says so.** After merging a PR that
should deploy:

```
workers_builds_list    { worker_name, limit: 3 }
workers_build_logs_get { build_uuid, worker_name }     # if it failed
```

`workers_build_logs_get` follows the log cursor across every page and returns the
failure with any matching known pattern already applied — read that instead of
asking Justin to paste anything. Same rule as "a deploy you did not verify is not
done" in "Deploying" below.

### Working alongside other agents: pause CI, do not fight it

**When several agents are working on one repo at the same time, pause CI/CD
first.** (It stops production builds. It cannot stop an implicit preview trigger —
see fact 5 below — so expect PR builds to keep firing.) Concurrent pushes to a shared branch queue builds that deploy each
other's half-finished work, and a red build that belongs to someone else's push
will send you debugging a failure you did not cause.

```
workers_cicd_pause  { worker_name, owner: "<your session name>",
                      reason: "...", idempotency_key: "<stable per task>" }
… work …
workers_cicd_resume { worker_name, lease_id }
```

It is lease-based on purpose, so this is safe to do even when you do not know who
else is working:

- Every agent gets its **own** lease. Releasing yours does **not** resume anyone
  else's pause — the saved configuration is restored only when the **last** lease
  is released, and `workers_cicd_resume` tells you who is still holding it.
- The pre-pause configuration is captured on the **first** pause and never
  overwritten, so a second agent pausing an already-paused Worker cannot destroy
  the thing a resume has to restore.
- Repeating a pause with the same `idempotency_key` is a no-op, not a second lease.
- Expiry is **reported, never acted on**. Nothing resumes because time passed.
- If someone edited the build configuration while it was paused, resume stops and
  shows you the difference instead of reverting their work.

**Always release your lease when you finish**, including when you are handing off
or abandoning the task — a forgotten lease leaves the repo with CI off and no
obvious culprit. If you find leases you believe are abandoned,
`workers_cicd_resume { force: true, force_reason }` releases them all; that is an
administrative override, so say who and why. `workers_cicd_reconcile` recovers a
Worker whose pause or resume died half-way.

Announce a pause where the other agents will see it — a collaboration room in
`colby-maestro`, not a private message (see "Talking to other sessions" in
`~/.claude/CLAUDE.md`).

### Leave a pattern behind

When you diagnose a build failure that no stored pattern matched, record it:

```
build_patterns_create { title, match_method, match_expression, root_cause,
                        resolution_steps, verification_steps,
                        supporting_build_ids, status: "proposed" }
```

The next agent then gets your diagnosis instead of re-deriving it, and
`workers_build_logs_get` surfaces it automatically. If an existing pattern helped
(or did not), say so with `build_patterns_record_outcome`. **Verification needs
evidence** — a build UUID and what you observed — so a guess you have not
confirmed stays `proposed`. Do not invent a confirmed fix from an error message.

### The raw endpoints, when you need them

The tools above cover the normal cases. For anything they do not — deploy hooks,
purging the build cache, triggering a manual build — use `execute` directly.
Facts that will waste your time otherwise (all measured 2026-09-10):

1. **Builds endpoints identify a Worker by its `tag`, not its name** — an
   immutable UUID from `GET /accounts/{account_id}/workers/scripts` (documented
   as `external_script_id`). The name returns "Resource not found".
2. **The Builds API needs a user-scoped API token.** Account-scoped tokens return
   `401 / 12006 Invalid token` on every `/builds/*` path while working fine for
   `/workers/scripts`. The token this connector forwards is user-scoped.
3. **A trigger has no enable/disable field.** That is why pausing narrows
   `branch_includes` instead. `branch_excludes: ["*"]` is rejected with
   `400 / 12002` — you may not exclude every branch.
4. **`GET /builds/workers/{tag}/builds` supports only `page`/`per_page`** — no
   filter, no sort. Anything else you must do client-side, over enough pages to
   actually cover the window you claim to have covered.
5. **Cloudflare can run a preview trigger the API does not expose.** Measured
   2026-09-10 on `cloudflare-api-mcp`: a PR built under trigger `59918e36-…`
   while `GET /builds/workers/{tag}/triggers` returned only the production
   trigger, that uuid 404s when fetched, and the build was missing from
   `GET /builds/workers/{tag}/builds`. So a pause **cannot** stop preview builds,
   an empty preview trigger is not evidence preview builds are off, and "no build
   found for this PR" is not proof none ran — open the PR's Workers Builds check
   in GitHub for the build id, then pass it to `workers_build_logs_get`.
6. **The logs endpoint's `cursor` is a tail cursor** — replaying it returns zero
   lines. Loop only while `truncated` is set *and* the page produced lines, or a
   finished build spins forever.

Useful raw endpoints: `POST /builds/triggers/{uuid}/builds` (manual build, body
`{"branch":"main"}`), `PUT /builds/builds/{uuid}/cancel`,
`POST /builds/triggers/{uuid}/purge_build_cache`,
`PATCH /builds/triggers/{uuid}/environment_variables`,
`/builds/workers/{script_name}/deploy_hooks`.

---

---

# Creating bindings (Cloudflare Workers)

**Never hand-write a binding id into `wrangler.jsonc` from memory or from a
guess.** Create the resource through the **Cloudflare API MCP** (see "Bindings
through the MCP" above), take the real id off the response, paste it in, then
regenerate types. A fabricated `database_id` deploys clean and fails at runtime.

**Use the MCP even when you are on a machine with a working wrangler CLI.** The
next agent to touch this may be running in a cloud sandbox that cannot execute
wrangler at all, and a procedure written around the CLI leaves it stuck. The
wrangler commands below are the local fallback, and are what you run for the
parts that need the repo on disk (`wrangler types`, migrations, deploys).

## 1. Authenticate from the tokens CLI — never a hand-pasted key

```bash
export CLOUDFLARE_API_TOKEN="$(tokens show CLOUDFLARE_WRANGLER_API_TOKEN --value-only)"
export CLOUDFLARE_ACCOUNT_ID="$(tokens show CLOUDFLARE_ACCOUNT_ID --value-only)"
wrangler whoami     # prove auth and scope BEFORE claiming anything is blocked
```

Other tokens the same way, by name: `CLOUDFLARE_AI_GATEWAY_TOKEN` (guardian
inference door), `CLOUDFLARE_SECRET_STORE_ADMIN_TOKEN` (Secret Store writes),
`WORKER_API_KEY`. Verify a name first with `tokens find <keyword>`.

`tokens wrangler-setup` runs the interactive login; `tokens wrangler-audit`
and `tokens wrangler-list` show what the current token can actually do. If a
wrangler command 403s, run the audit before concluding you lack permission —
a differently-scoped token on this machine usually already clears it.

## 2. Create the resource, then bind it

```bash
wrangler d1 create my-db                      # -> database_id
wrangler kv namespace create SESSIONS         # -> id
wrangler r2 bucket create my-files
wrangler queues create my-queue
wrangler secrets-store store list             # -> store_id
wrangler secrets-store secret create <STORE_ID> --name MY_SECRET --scopes workers --remote
wrangler vectorize create my-index --dimensions 768 --metric cosine
```

These are the **fallback**. Prefer the MCP `execute` equivalents above — they
work in sandboxed and cloud sessions where these commands cannot run. What is
never valid, by either route, is inventing an id.

## 3. Add the binding to `wrangler.jsonc`, then regenerate types

Every created resource gets an entry in `wrangler.jsonc` — that file is the
deployable record of what this Worker can reach. Then:

```bash
wrangler types      # regenerates worker-configuration.d.ts
```

Never hand-edit `worker-configuration.d.ts`; it is generated.

## 4. Two bindings with standing rules

- **No `ai` binding.** See "AI operations" below. `env.AI.run()` is unmetered
  and unattributed — route inference through core-guardian instead.
- **`assets` before API routes.** If the Worker serves both static assets and
  API routes, set `"run_worker_first": true`. Without it the asset handler
  answers first and shadows your routes — this is exactly how core-bridge's
  proxy paths became unreachable behind an SPA fallback.

---

---

# Every Worker repo ships `pnpm run deploy`

**The deploy command is never a bare `npx wrangler deploy`.** Not locally, not in
a Workers Builds trigger, not in anything you hand a human. Every Worker repo
defines `deploy` in `package.json` as the **whole** sequence that release needs —
build, then D1 migrations, then the real deploy — so one command is correct
everywhere, and there is exactly one place to fix when it changes.

This is a rule, not a preference, because Workers Builds stores its deploy command
**in the trigger, not in the repo** (see "CI/CD" above). If that stored command is
the stock `npx wrangler deploy`, then any repo whose build emits its entry point
somewhere non-default, or whose release needs a migration, deploys wrong or not at
all — while every PR keeps merging green and production quietly goes stale.

## The contract

```jsonc
{
  "scripts": {
    "build":         "astro build",
    "db:generate":   "drizzle-kit generate && node scripts/fix-d1-migrations.mjs",
    "migrate":       "wrangler d1 migrations apply <DB_BINDING> --remote",
    "migrate:local": "wrangler d1 migrations apply <DB_BINDING> --local",
    "deploy":        "pnpm run build && pnpm run migrate && wrangler deploy -c ./wrangler.jsonc dist/server/entry.mjs --assets dist/client"
  }
}
```

- **`deploy` is the single entry point** and chains everything. It is what you run
  locally and what goes in the Workers Builds **Deploy command** field.
- **Keep the real `wrangler deploy` invocation at the tail**, with whatever args
  the repo actually needs. The Astro SSR form above (`dist/server/entry.mjs
  --assets dist/client`) is exactly the case a bare `npx wrangler deploy` gets
  wrong — see `/Volumes/Projects/workers/cloudflare-api-mcp/DEPLOY.md`.
- **Drop `migrate` from the chain if the Worker has no D1.** Do not leave a step
  that fails on a missing binding.
- **Workers Builds fields:** put `pnpm run deploy` in **Deploy command**. If the
  dashboard forces you to fill **Build command** too, use `pnpm run build` — that
  builds twice, which is cheap, and it keeps `pnpm run deploy` self-contained for
  a human running it by hand. Do not "fix" the double build by stripping the build
  out of `deploy`; that is how the local command silently rots.
- **Migrations run before the deploy, not after.** New code must never boot against
  an un-migrated database.

## D1 migrations run through an `.mjs` script, so they are re-runnable

Never apply raw `drizzle-kit generate` output to D1. Post-process it with the
template so every statement is `IF NOT EXISTS` / `IF EXISTS`, then a partial or
repeated apply is a no-op instead of `table already exists`:

```bash
cp ~/.colby-ecosystem/workers/devOps/fix-d1-migrations.mjs scripts/
node scripts/fix-d1-migrations.mjs --self-check     # proves the regexes still hold
```

Chain it into `db:generate` (above) so it is never a step someone can forget.

**D1 is SQLite, and that constrains what the script may inject.** SQLite supports
`IF NOT EXISTS` on `TABLE`, `VIRTUAL TABLE`, `INDEX` (incl. `UNIQUE`), `VIEW`, and
`TRIGGER`, and `IF EXISTS` on the matching `DROP`s. It has **no** `CREATE SCHEMA`,
`CREATE TYPE`, or `CREATE SEQUENCE` — a generic Postgres-oriented fixer injects
those and wrangler dies with `near "SCHEMA": syntax error`. The template covers
the SQLite set only; do not "improve" it by adding the Postgres ones.

Known ceiling, stated so nobody rediscovers it at 3am: SQLite has no
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, so a re-run of a column-adding migration
still errors. That is wrangler's `d1_migrations` bookkeeping to sort out, not
something the script can paper over.

### One migration ledger: wrangler's. Never two.

`wrangler d1 migrations apply` records what it has run in the **`d1_migrations`**
table (rename with `migrations_table` in the D1 binding). That is the ledger.

`drizzle-orm/d1/migrator`'s `migrate()` keeps a **separate** `__drizzle_migrations`
table and decides what to run by comparing timestamps. Point both at one database
and neither knows what the other applied — that is how a table gets created twice
and how a migration gets silently skipped. **Pick wrangler and stay there.**
`drizzle-kit generate` produces the SQL; `wrangler` applies it. Nothing else
writes to the database's schema.

Wrangler looks for `${migrations_dir}/*.sql` and defaults `migrations_dir` to
`migrations/`, while `drizzle-kit` writes to `drizzle/` — so **point one at the
other or nothing is ever applied and every command exits successfully**. Either
set drizzle's `out` to `migrations`, or set `"migrations_dir": "drizzle"` in the
D1 binding. For an ORM layout that nests each migration in its own folder, set
`"migrations_pattern": "migrations/*/migration.sql"` (it must start with
`migrations_dir`).

### Local and remote are two databases with two ledgers

`--local` runs against a SQLite file in `.wrangler/state/v3/d1`; `--remote` runs
against real D1. Each keeps its own `d1_migrations`, so "it worked locally" says
nothing about production.

- `migrate:local` and `migrate` are **separate scripts**. Only the `--remote` one
  belongs in the `deploy` chain.
- **Never edit a migration file that has already been applied anywhere.** The
  ledger records the filename, not the contents — an edited file is simply never
  re-run, and the two databases diverge permanently. Generate a new migration.
- Local state is a cache and is disposable: `rm -rf .wrangler/state/v3/d1` then
  `pnpm run migrate:local` rebuilds it from zero. That is the fix for local drift.
  There is no remote equivalent — see "Seed data and backups" before you touch a
  remote database that has real rows in it.

### Do not bundle migrations into the Worker and run them at runtime

Tempting — `env.DB.batch()` inside a startup hook, no deploy step. Don't:

- `drizzle-orm/d1/migrator` cannot do it anyway. Its `migrate()` calls
  `readMigrationFiles()`, which is Node `fs`. It does not run in a Worker. Any
  runtime migrator is hand-rolled, un-reviewed code on your schema.
- Every isolate races. Workers spin up concurrently across colos, so "migrate on
  first request" means N simultaneous migrators, and D1 has no advisory lock to
  serialise them with.
- A failure has nowhere to go. A failed `wrangler d1 migrations apply` fails the
  deploy, loudly, before the new code is live. A failed runtime migration is a
  500 on a user's request, with the new code already serving traffic.

Migrations are a **deploy-time** step, in `pnpm run deploy`, before
`wrangler deploy`. If you genuinely need runtime schema work (a tenant-provisioned
database, say), that is a different problem — write it deliberately and say so;
do not arrive at it by trying to skip the deploy step.

---

---

# Every Worker ships an icon — tab, MCP, and in-app

**A Worker with a blank browser tab is unfinished.** So is an MCP server that
shows up as a grey square in a client, and a frontend whose own header has no
mark. It is the single most common thing missing from a generated app, it takes
one command, and it is the difference between a tool that looks maintained and
one that looks abandoned.

## The icon depicts the project — never its initials

**The mark must show what the project _is_ or _does_.** A roofing-complaint
tracker gets a hard hat. A budget guardian gets a shield. A job scout gets
binoculars. Two letters on a square are not an icon — they identify nothing,
look the same across the fleet, and are the tell of an agent that skipped the
step. The generator no longer has any way to produce initials; run it without a
pictogram and it refuses.

It has two halves that do two different jobs:

| Half | Job | Who decides |
|---|---|---|
| **Pictogram** | Says what the project does | **You**, after reading the project |
| **Tile gradient** | Spreads Workers across the colour wheel | **Derived** from the Worker name — hue, second hue, radius, fill style |

**The pictogram carries the identity; the palette only helps.** A name hashes
into one of 360 hues, and across a fleet of ~100 Workers collisions are
guaranteed (birthday problem) — measured on the first real batch:
`code-review-bot` and `ecoflow-telemetry` both land on hue 45. They stay
distinguishable because the second hue, gradient direction and above all the
pictogram differ. So never lean on colour alone to tell two Workers apart, and
nobody hand-picks a colour either.

### Choosing the pictogram

1. **Read the project first** — README, `wrangler.jsonc`, what its routes and
   tools actually do. Choose from its *purpose*, not its name: `core-guardian`
   is a budget kill-switch (shield), not a "core".
2. Search Lucide, the frontend's own icon library (`components.json` →
   `"iconLibrary": "lucide"`), by what the project does:

   ```bash
   node scripts/make-favicon.mjs --search "roof complaint contractor construction"
   ```

   Whole-word match against Lucide's tag index; preview at
   `https://lucide.dev/icons/<name>`.
3. Generate:

   ```bash
   node scripts/make-favicon.mjs --icon hard-hat
   ```

4. **Say which icon you chose and why** in the commit or PR ("hard-hat: the app
   tracks roofing contractor complaints"). The choice is a design decision, and a
   reviewer should be able to disagree with it.

Custom art is allowed and better when the project deserves it:
`--icon-file art/mark.svg`. Line art in the Lucide style (24×24, stroked) reads
best at 32px. The script strips `<script>` and `on*` handlers from custom SVG;
it is not a general sanitiser, so never feed it user-uploaded files.

### Rules

- **Never initials, never a letter, never the project name as text.** If no
  Lucide icon fits, draw one — a simple silhouette beats a monogram.
- **Let it derive the palette.** Name comes from `wrangler.jsonc` →
  `package.json` → cwd. Passing `--name` by hand is how two Workers end up
  sharing a colour.
- **Do not pass `--color` to "make it look nice."** That throws away what keeps
  the icon distinct. Use it only to match real existing branding.
- **Never copy another project's `public/` icons in.** Choose and generate.
- **Regeneration is stable.** The choice is recorded in `public/favicon.svg` as
  `data-icon="lucide:hard-hat"`, and a bare `node scripts/make-favicon.mjs`
  reuses it. Lucide is pinned in the script (`LUCIDE = "1.44.0"`), so the output
  is byte-identical until someone bumps it deliberately.

It writes `public/`: `favicon.svg`, `favicon.ico`, `favicon.png` (32),
`icon-128.png`, `apple-touch-icon.png` (180), `logo.svg`, `og.png`. Icons and
raster tools come over the network (jsDelivr for Lucide, npx for
`sharp-cli`/`png-to-ico`); on failure it prints what to run and exits non-zero
rather than pretending.

## Serving them — this is where Workers differs from a normal static site

Wrangler uploads everything in `assets.directory` and sets `Content-Type` from
the file extension, so the files above just work — **as long as the request
actually reaches the asset handler.** Two Cloudflare-specific traps:

**1. `run_worker_first` shadows your icons.** "Creating bindings" above tells you
to set `"run_worker_first": true` so the SPA fallback stops swallowing API
routes. That flag runs your Worker before static assets **for every request** —
including `/favicon.ico` and `/icon-128.png`, which then 404 unless your router
falls through to the assets binding. Two ways out, and the first is better:

```jsonc
// Preferred: scope it to the routes that actually need the Worker.
// Array form takes globs and `!` exceptions, up to 100 entries.
"assets": { "directory": "./dist/client", "binding": "ASSETS",
            "run_worker_first": ["/api/*", "/mcp", "/oauth/*"] }
```

```ts
// Or keep run_worker_first: true and end the router with an explicit fallthrough.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
```

**2. `_headers` does not apply to anything your Worker generates.** The `_headers`
file only decorates responses served by the asset handler. On an SSR app, or
behind `run_worker_first: true`, set headers in the Worker instead. The default
on real static assets is `Cache-Control: public, max-age=0, must-revalidate` plus
an `ETag` — correct for an icon that may change, so leave it alone unless you
have a reason.

## Wire it in all three places

**1. Browser tab** — in the app shell `<head>` (present in the template's
`AppShell.astro`; confirm it survived, do not assume):

```html
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

**2. MCP clients**, if the Worker serves an MCP server. The spec puts an `icons`
array on `Implementation` — the `serverInfo` returned from `initialize`. This is
what gives your server a real mark in Claude, Cursor, and everything else:

```ts
{ name: "core-guardian", version: "1.0.0",
  icons: [
    { src: "https://<worker>.workers.dev/icon-128.png", mimeType: "image/png",     sizes: ["128x128"] },
    { src: "https://<worker>.workers.dev/favicon.svg",  mimeType: "image/svg+xml", sizes: ["any"] },
  ] }
```

- **Lead with the PNG.** Clients that render icons **MUST** support `image/png`
  and `image/jpeg`; SVG and WebP are only a **SHOULD**. An SVG-only server is
  unbranded in any client that took the optional half.
- **Serve it from the Worker's own origin over https.** The spec tells clients to
  verify same-origin and reject unsafe schemes, so a cross-origin icon may be
  dropped without a word.
- **The icon path must be reachable unauthenticated.** Clients fetch icons
  **without credentials** — no cookies, no `Authorization`. On an OAuth-gated
  Worker like cloudflare-api-mcp, an auth middleware that covers `/icon-128.png`
  means the icon silently never renders. Exempt the icon paths explicitly.

**3. The frontend itself** — `public/logo.svg` in the app-shell header and on the
landing page. A header with no mark while the tab has one is the tell that an
agent did step 1 and stopped.

## Verify against the deployed URL

Same rule as any deploy — a 404 here is invisible in local dev, because the asset
handler serves `public/` straight off disk:

```bash
for p in /favicon.ico /favicon.svg /icon-128.png; do
  curl -s -o /dev/null -w "%{http_code} %{content_type}  $p\n" "https://<worker>.workers.dev$p"
done
```

All three must be `200` with an image content type, **with no auth header**.

---

---

# MCP servers

Every MCP server we build on a Worker ships the same four things: two ways to
authenticate, a one-year grant, an icon, and a real UI for anything a person
reads. None of them is optional.

**Design the tool surface in code mode** — two or three tools, not forty. Tool
definitions are re-sent every request, this machine already pays ~351k tokens a
session for them, and `~/AGENTS-mcp.md` has the measurements, the rule, and the
upgrade path for an existing server. Read it before adding tools.

**Build it with `createMcpHandler` from `@modelcontextprotocol/server`.**
Cloudflare's own docs now mark `McpAgent` **deprecated and feature-frozen**; only
existing `McpAgent` routes stay on it, and only while they migrate.

## Auth: both doors, one secret

| Door | Who uses it | How |
|---|---|---|
| `Authorization: Bearer <WORKER_API_KEY>` | Scripts, other Workers, tests, CI, headless MCP clients | Checked with a constant-time compare |
| **OAuth 2.1** (authorization code + PKCE, dynamic client registration) | Claude, ChatGPT, Cursor — any client that connects interactively | The client opens `/oauth/authorize` on the Worker; the page asks for a **passcode**; the passcode is `WORKER_API_KEY` |

**Both are required.** Bearer-only servers cannot be added as connectors in
Claude; OAuth-only servers cannot be scripted or tested headlessly.

- **The page says "Passcode".** Never name `WORKER_API_KEY` anywhere a person can
  see it — the page, an error, the docs, a 401 body. There is no reason to tell a
  stranger which credential they are guessing.
- **The grant lasts one year.** `expires_in: 31536000`. Anything shorter means
  re-authorising every client every day or month, which in practice means
  connectors silently breaking.
- **PKCE S256 is mandatory**, and plain `http:` redirects are allowed only to
  loopback (CLI clients listen on `localhost`). Registration is stateless, so
  anyone can register any redirect — the authorize page therefore **names the host
  receiving the grant**, so a phishing link reads "connect evil.example" before
  the passcode goes in. PKCE alone does not stop that; the attacker makes their
  own verifier.
- **A 401 carries** `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"`.
  That header is what makes a client start the OAuth flow instead of giving up.
- **Serve discovery unauthenticated:** `/.well-known/oauth-authorization-server`,
  `/.well-known/oauth-protected-resource`, `/oauth/register`, `/oauth/authorize`,
  `/oauth/token`, and the icons.

**Copy the template — do not hand-roll this.** It implements every line above:

```bash
cp ~/.colby-ecosystem/workers/utils/auth.ts   src/backend/auth.ts
cp ~/.colby-ecosystem/workers/routes/oauth.ts src/backend/routes/oauth.ts
bash ~/.colby-ecosystem/workers/devOps/auth-check/run.sh
```

It came from ecoflow-telemetry, which runs it in production, and was hardened on
the way: that original accepted any `redirect_uri` with optional PKCE, which let
a crafted link turn a typed passcode into someone else's year-long token. The
check asserts all 19 behaviours — PKCE refusals, loopback-only `http`, page
wording, the 365-day token, the 400-day cookie, and all three credentials
accepted at the gate.

**If you use `@cloudflare/workers-oauth-provider` instead**, its defaults will
quietly cap the grant: `refreshTokenTTL` defaults to 30 days and
`clientRegistrationTTL` to **90 days**, and whichever is shorter wins. Set both
to `365 * 24 * 60 * 60`, then verify against the live KV key expirations rather
than the config (skill: `cloudflare-oauth-ttl-trap`). The template sidesteps the
trap entirely — its tokens are stateless and carry their own signed expiry.

**Testing:** smoke tests and scripts get the key from the tokens SDK
(`requireSecret("WORKER_API_KEY")` — `tokens agent-onboarding --scaffold-mjs`),
and exercise *both* doors against the deployed URL.

## The icon goes in `serverInfo`

`initialize` must return `serverInfo.icons` — PNG first, SVG second, both on the
Worker's own origin and reachable without credentials. Full rule and code: "Every
Worker ships an icon" above.

**A proxy must inject its own.** An MCP server that forwards `initialize` to an
upstream passes the *upstream's* `serverInfo` through. Measured on
cloudflare-api-mcp 2026-09-10: it returns `{"name":"cloudflare-api","version":"0.1.0"}`
— Cloudflare's identity, no icons — and its `/favicon.*` paths throw error 1101.
Rewrite `serverInfo` on the way out.

**Be honest about what this buys today.** As of 2026-09-10, Claude does not render
it: [anthropics/claude-ai-mcp#152](https://github.com/anthropics/claude-ai-mcp/issues/152)
is open — custom connectors show a generic globe whatever you send, and the
reporter confirmed `icons` URLs, data URIs, `/favicon.ico`, and `<link rel=icon>`
are all ignored. The Claude Code equivalent
([#49040](https://github.com/anthropics/claude-code/issues/49040)) was closed as
not planned. Ship the icon anyway: it is the spec, other clients render it, and it
lights up the day Claude does. Just do not tell Justin it will appear in Claude.

## Tools that return something a person reads get a UI — mcpcn

**When a tool's result is something a human looks at — a list, a table, a stat, a
status, a confirmation, a form — ship it as an MCP App, built from mcpcn blocks.**
Plain JSON stays the fallback, not the product.

**MCP Apps** is the MCP extension for this: the host renders the tool's UI in a
sandboxed iframe inside the chat. Supported by Claude, Claude Desktop, VS Code
GitHub Copilot, Microsoft 365 Copilot, Goose, and Postman, among others.

- **Server:** register the tool with `_meta: { ui: { resourceUri: "ui://<tool>/app.html" } }`
  and serve that resource with `mimeType: RESOURCE_MIME_TYPE`
  (`text/html;profile=mcp-app`). The helpers `registerAppTool` /
  `registerAppResource` come from `@modelcontextprotocol/ext-apps/server`.
- **View:** a single self-contained HTML file (`vite-plugin-singlefile`) whose
  script uses `App` from `@modelcontextprotocol/ext-apps` — `app.ontoolresult` to
  receive the result, `app.callServerTool` to act, `app.connect()` to start.
- **Components:** **mcpcn**, a shadcn registry of MCP App blocks (quick-reply,
  table, option-list, status-badge, stat-card, progress-steps, forms, and ~40
  more). The `@mcpcn` alias is already in the frontend template's
  `components.json` (ReUI's default theme with dark is the locked look — see
  `~/AGENTS-frontend.md`):

  ```bash
  pnpm dlx shadcn@latest add @mcpcn/table @mcpcn/status-badge
  ```

- **Always return `content` (text) and `structuredContent` as well.** Clients
  without MCP Apps must still get a usable answer, and the model reads the text.

Known rough edge: [ext-apps#671](https://github.com/modelcontextprotocol/ext-apps/issues/671)
(open) reports a UI that works in the SDK's test host but falls back to text in
Claude. If yours does that, check the SDK's `basic-host` first to separate "my
widget is broken" from "the host did not render it" before debugging your code.

---

# Deploying

## You are authorized to deploy. Do it.

**Deploying a Cloudflare Worker is pre-approved standing authorization — do not
stop to ask.** Nothing in this workstation's setup forbids it, no sandbox blocks
it, and any agent that says otherwise is inventing a restriction. Cloudflare
keeps every prior version and rollback is one command; that is precisely why
deploying is low-risk. PRs and version history are the safety net, and they
already exist.

Build it, deploy it, then **verify it against the deployed URL** — a deploy you
did not verify is not done.

## If a deploy threatens data, back it up and then deploy

Fear of data loss is a reason to take a precaution, **not** a reason to stop and
hand the problem back. If a migration or deploy could destroy or permanently
delete data:

1. Back up the data at risk **first**.
2. Deploy.
3. Report, in the same message: that you took a backup and what you were worried
   about, **where it is stored**, **how you verified it is complete** (row counts,
   checksum, a spot-read — say which), and **exactly how to restore it** if the
   deploy goes wrong.

Do not stop at "I didn't deploy because I was worried about losing data." The
answer to that is always "then back it up first," so skip the round trip and do
both.

## The rare exception

There will occasionally be a genuine reason not to deploy. Declining is allowed
and should be **rare**. If you decline, say plainly what the specific risk is and
what you would need in order to proceed — do not decline vaguely, and do not
decline because deploying feels consequential.

## When a deploy fails, prove it is YOUR branch before you go looking

**Deploy a control from clean `origin/main` first.** A branch whose tests
disagree with production is not evidence the branch is wrong — production may be
the odd one out. Measured 2026-09-04 in core-remodel: two QC scripts failed only
on the branch's preview, and both turned out to be production running four merged
PRs behind. Ten minutes of control deploy replaced an hour of hunting a diff that
was fine.

```bash
git worktree add -b ctrl/control /tmp/ctrl origin/main
ln -s "$PWD/node_modules" /tmp/ctrl/node_modules     # skip the reinstall
cd /tmp/ctrl && pnpm run build && node scripts/deploy-preview.mjs
# …reproduce there. Then, always:
node scripts/deploy-preview.mjs --delete && cd - && git worktree remove --force /tmp/ctrl
```

If the control reproduces it, stop reading your diff. If it does not, you have
learned something real about your branch rather than assumed it.

---

---

# Cloudflare Worker startup CPU — error 10021

```
Error: Script startup exceeded CPU time limit. [code: 10021]
```

**This is not a size limit and the size numbers will mislead you.** A Worker must
parse and execute its **global scope inside 1 second of CPU**
([limits](https://developers.cloudflare.com/workers/platform/limits/#worker-startup-time)).
core-remodel hit this at 6.15 MB gzipped against a 10 MB cap — comfortably under
every size limit while completely undeployable.

**It is a threshold, not a cliff.** The same commit failed five consecutive
deploys one day and passed six the next. Once you are near the limit, the outcome
depends on which machine validates. So "it deployed" is not evidence you are
clear, and the fix to aim for is *headroom*, not a passing run.

## Diagnose it

```bash
npx wrangler check startup --outfile startup.cpuprofile   # works from 4.114.0
npx wrangler deploy --outdir /tmp/bundle --dry-run        # bundle + its SOURCEMAP
```

Then attribute the samples back to modules. A ready-made tool lives at
`~/.colby-ecosystem/workers/devOps/attribute-startup.py` (core-remodel ships it
as `pnpm run perf:startup`):

```bash
python3 attribute-startup.py                      # build, profile, report
python3 attribute-startup.py band --runs 5        # size the noise first
python3 attribute-startup.py compare before.cpuprofile after.cpuprofile \
  --before-map …/_worker.js.map --after-map …/_worker.js.map
```

Three things that tool exists to stop you getting wrong:

- **Attribute through the SOURCEMAP, never esbuild's `// <path>` banners.**
  esbuild does not emit one banner per module, so counting bytes between banners
  credits a region to whichever banner preceded it. Done that way, core-remodel's
  MCP tool registry was reported at **0.0%** of startup when it was **13.1%** —
  and the write-up told the next engineer not to bother with it.
- **Read the INCLUSIVE view, not self time.** Self time says "zod", because zod
  is what runs when your schemas are constructed. It does not say *whose*
  schemas. Inclusive cost — samples whose stack touches a module — is what
  answers "what would deferring this buy me".
- **It is noisy.** Five runs of identical code spanned 110–131 samples. Quote a
  band; never a percentage to two significant figures off one run.

## Fix it: defer, with dynamic `import()`

esbuild wraps a module that is *only* dynamically imported in a lazy `__esm()`
initialiser, so its top-level code runs on first use instead of at startup. One
static import anywhere drags it back onto the startup path.

The usual culprits, in the order they were worth fixing:

| Cost | What | Fix |
| --- | --- | --- |
| 46.5% | 109 routers eagerly imported by the API index, building 231 module-scope `z.object()` | a mount table of dynamic `import()`s, dispatched per prefix |
| 13.1% | an MCP tool registry (219 modules) pulled in by a Durable Object export | `await import()` inside the DO's `init()` |
| — | cron-only services imported at module scope in `_worker.ts` | `await import()` inside `scheduled()`, per cron branch |

**What you cannot defer:** Durable Object and Workflow classes. The runtime
resolves them as named exports, so `export { Thing } from "./thing"` evaluates
that module and everything it imports. Anything reachable only through those
stays eager — in core-remodel that is what keeps a 359-table Drizzle barrel on
the startup path.

## Two traps inside the fix

**Do not strip the mount prefix.** Hono's own `mount()` does, and copying it
broke two routes that read the absolute `c.req.path` — one derived an R2 key from
it, and one gated auth on `SECRET_GATED_PATHS.has(c.req.path)`, which would have
put secret-verified webhooks behind a cookie they cannot send. Mount each
sub-router at its own **absolute** prefix and dispatch the request untouched.

**When you defer or restructure something, go read what MONITORS it.** This is
the one that generalises furthest. core-remodel's `api_route_registry` probe
proved admin auth was wired with
`routes.some(r => r.path.startsWith("/api/admin") && r.method === "ALL")`. The
new lazy dispatcher registers `app.all("/api/admin/*", …)` — same prefix, same
method — so **the dispatcher satisfied the check by itself**, and deleting the
auth middleware entirely would have left a HIGH-severity probe green. Its other
check counted `app.routes`, which no longer contains any sub-router's routes:
1064 before, 276 after, against a floor of 50. Both still passed. Types, lint and
a 90-path production diff all went straight through it.

Compare the **handler reference** (`r.handler === requireAccessAuth`), not a path
and method — an identity test cannot be satisfied by accident. And where a check
used to work by counting, make it do the work instead: force every lazy module to
import and name the ones that throw.

---

---

# core-bridge — reaching local services from a Worker

`core-bridge` is the **single ingress into the home/LAN fleet**. A Worker that
needs something on this Mac or the LAN goes through it — it does not open its own
tunnel and does not get its own VPC binding.

```jsonc
"services": [{ "binding": "BRIDGE", "service": "core-bridge" }]
```

RPC is primary: `env.BRIDGE.call("protect", request)` / `env.BRIDGE.health()`.
Registered services: `protect`, `ollama`, `scanner`. Adding one is a registry
entry plus a FastAPI router — never a new binding or Worker.

**Two open defects** (measured 2026-08-29): the public HTTP route has no auth, and
the `/{service}/{path}` proxy is shadowed by the SPA assets binding. Worker-to-worker
service binding is the working path. Details and the Python client:
`~/.colby-ecosystem/reference/core-bridge.md`, `python/utils/cf.py`.

Source: `/Volumes/Projects/workers/core-bridge` (read its README and SETUP first).
