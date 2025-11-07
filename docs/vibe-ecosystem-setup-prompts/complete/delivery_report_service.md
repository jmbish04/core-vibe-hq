Here’s a drop-in Cursor prompt that builds a Delivery Report service end-to-end in vibehq-orchestrator, compares Natural Language Prompt → Tasks → Code, records everything in D1, exposes both RPC + REST, and produces a gap-filling plan. It assumes your existing task/order model, CORE_GITHUB_API binding, and the standard /* TASK_ID:... */ + ###FINAL_MILE_PROMPT__...### anchors.

⸻

PROMPT — Delivery Report Service (NL→Tasks→Code Traceability)

Repo: vibehq-orchestrator (orchestrator at repo root)
Goal: Generate a verifiable Delivery Report that proves each user prompt requirement is covered by tasks, and each task is implemented in code. Persist a scored report + findings with links back to lines/PRs. Provide both RPC + REST.

1) Add/confirm bindings

orchestrator/wrangler.jsonc

{
  "name": "vibehq-orchestrator",
  "main": "worker/index.ts",
  "compatibility_date": "2025-11-03",
  "services": [
    { "binding": "CORE_GITHUB_API", "service": "core-github-api" }
  ],
  "d1_databases": [
    { "binding": "DB", "database_name": "core_vibe_hq_db", "database_id": "REPLACE_ME" }
  ],
  "vars": {
    "GITHUB_OWNER": "jmbish04",
    "GITHUB_REPO": "core-vibe-hq",
    "DELIVERY_EMBEDDING_MODEL": "none" // or set to a Workers AI model id later
  }
}

1) D1 schema (migrations)

Create orchestrator/migrations/004_delivery_reports.sql

-- Delivery report header
CREATE TABLE IF NOT EXISTS delivery_reports (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  coverage_score REAL NOT NULL,
  fidelity_score REAL NOT NULL,
  creativity_score REAL NOT NULL,
  implementation_score REAL NOT NULL,
  overall_score REAL NOT NULL,
  notes TEXT
);

-- Each requirement extracted from NL prompt
CREATE TABLE IF NOT EXISTS delivery_requirements (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  text TEXT NOT NULL,
  matched_tasks INTEGER DEFAULT 0,
  coverage REAL DEFAULT 0,
  FOREIGN KEY(report_id) REFERENCES delivery_reports(id)
);

-- Tasks evaluated in this report
CREATE TABLE IF NOT EXISTS delivery_task_findings (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  task_uuid TEXT NOT NULL,
  file_path TEXT,
  placeholder TEXT,
  implemented INTEGER NOT NULL DEFAULT 0,
  lines TEXT,              -- JSON: [{from,to}]
  pr_url TEXT,
  notes TEXT,
  FOREIGN KEY(report_id) REFERENCES delivery_reports(id)
);

-- Code ↔ Task edges
CREATE TABLE IF NOT EXISTS delivery_links (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  requirement_id TEXT,
  task_uuid TEXT,
  file_path TEXT NOT NULL,
  anchor TEXT,             -- e.g., TASK_ID tag or FINAL_MILE anchor
  line_from INTEGER,
  line_to INTEGER,
  confidence REAL NOT NULL,
  FOREIGN KEY(report_id) REFERENCES delivery_reports(id)
);

-- Quick index
CREATE INDEX IF NOT EXISTS idx_delivery_reports_order ON delivery_reports(order_id);

2) Core logging helper (reuse if you already have one)

orchestrator/worker/services/core/loggingService.ts

export async function logEvent(env: Env, evt: {
  trace_id?: string,
  source: string,
  stage: string,
  operation: string,
  details?: any,
  duration_ms?: number
}) {
  try {
    await env.DB.prepare(
      `INSERT INTO operation_logs (trace_id, source, stage, operation, details, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      evt.trace_id ?? null,
      evt.source,
      evt.stage,
      evt.operation,
      JSON.stringify(evt.details ?? {}),
      evt.duration_ms ?? null
    ).run();
  } catch (e) {
    console.error("[logEvent] failed", e);
  }
}

3) Delivery service

orchestrator/worker/services/delivery/deliveryService.ts

import { randomUUID } from "crypto";
import { logEvent } from "../core/loggingService";

type Requirement = { idx: number; text: string };
type TaskRow = {
  uuid: string; file_path: string | null; placeholder: string | null;
  status: string | null; pr_url?: string | null;
};
type Link = {
  requirement_id?: string; task_uuid?: string; file_path: string;
  anchor: string; line_from: number; line_to: number; confidence: number;
};

export class DeliveryService {
  constructor(private env: Env) {}

  // 1) Extract requirements from NL prompt (simple heuristic + bullets).
  extractRequirements(prompt: string): Requirement[] {
    const lines = prompt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const bullets = lines.filter(l => /^[-*•]|^\d+\./.test(l)).map(l => l.replace(/^[-*•]\s*/, ""));
    const sentences = bullets.length ? bullets : lines;
    const uniq: string[] = [];
    for (const s of sentences) {
      const t = s.replace(/\s+/g, " ").trim();
      if (t.length >= 5 && !uniq.includes(t)) uniq.push(t);
    }
    return uniq.map((text, idx) => ({ idx, text }));
  }

  // 2) Fetch tasks for order
  async getTasksForOrder(order_id: string): Promise<TaskRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT uuid, file_path, placeholder, status, pr_url FROM tasks WHERE order_id = ?`)
      .bind(order_id).all();
    return (results ?? []) as any;
  }

  // 3) Pull current repo tree & file contents through core-github-api
  async fetchRepoTextFiles(): Promise<Array<{ path: string; content: string }>> {
    const treeResp = await this.env.CORE_GITHUB_API.fetch(new Request(
      `https://core-github-api.hacolby.workers.dev/api/tools/files/tree`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: this.env.GITHUB_OWNER, repo: this.env.GITHUB_REPO, recursive: true }) }
    ));
    const tree = await treeResp.json() as { entries: any[] };
    const textEntries = (tree.entries || []).filter(e =>
      e.type === "blob" && /\.(ts|tsx|js|jsx|md|toml|jsonc?)$/i.test(e.path)
    );

    const out: Array<{ path: string; content: string }> = [];
    for (const e of textEntries.slice(0, 500)) {
      const fileResp = await this.env.CORE_GITHUB_API.fetch(new Request(
        `https://core-github-api.hacolby.workers.dev/api/octokit/rest/repos/get-content`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: this.env.GITHUB_OWNER, repo: this.env.GITHUB_REPO, path: e.path }) }
      ));
      if (!fileResp.ok) continue;
      const meta = await fileResp.json() as any;
      if (meta && meta.content) {
        const text = typeof meta.content === "string" ? atob(meta.content) : "";
        out.push({ path: e.path, content: text });
      }
    }
    return out;
  }

  // 4) Link tasks to code via anchors: TASK_ID & FINAL_MILE prompts
  linkTasksToCode(files: Array<{ path: string; content: string }>, tasks: TaskRow[]): {
    links: Link[],
    taskImplemented: Record<string, { implemented: boolean, locations: Array<{ path: string; from: number; to: number }> }>
  } {
    const links: Link[] = [];
    const implemented: Record<string, { implemented: boolean, locations: any[] }> = {};
    for (const t of tasks) {
      implemented[t.uuid] = { implemented: false, locations: [] };
    }

    for (const f of files) {
      const lines = f.content.split(/\r?\n/);
      lines.forEach((line, i) => {
        // TASK_ID pattern
        const m = line.match(/TASK_ID\s*:\s*([A-Za-z0-9\-]+)/);
        if (m) {
          const taskId = m[1];
          if (implemented[taskId]) {
            implemented[taskId].implemented = true;
            implemented[taskId].locations.push({ path: f.path, from: i + 1, to: i + 1 });
            links.push({
              task_uuid: taskId, file_path: f.path, anchor: "TASK_ID",
              line_from: i + 1, line_to: i + 1, confidence: 0.95
            });
          }
        }
        // FINAL_MILE anchor
        const n = line.match(/###FINAL_MILE_PROMPT__([A-Z0-9_]+)###/);
        if (n) {
          links.push({
            file_path: f.path, anchor: `FINAL_MILE:${n[1]}`,
            line_from: i + 1, line_to: i + 1, confidence: 0.7
          });
        }
      });
    }
    return { links, taskImplemented: implemented };
  }

  // 5) Map requirements → tasks (string heuristics; can swap with embeddings later)
  mapRequirementsToTasks(reqs: Requirement[], tasks: TaskRow[]): Array<{ reqIdx: number; task_uuid: string; score: number }> {
    const rows: Array<{ reqIdx: number; task_uuid: string; score: number }> = [];
    for (const r of reqs) {
      for (const t of tasks) {
        // lightweight heuristic: overlap of keywords from placeholder/file path/name
        const hay = [t.placeholder, t.file_path, t.uuid].filter(Boolean).join(" ").toLowerCase();
        const keys = r.text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const hits = keys.filter(k => hay.includes(k)).length;
        const score = keys.length ? hits / keys.length : 0;
        if (score >= 0.2) rows.push({ reqIdx: r.idx, task_uuid: t.uuid, score });
      }
    }
    return rows.sort((a, b) => b.score - a.score);
  }

  // 6) Scoring rubric
  computeScores(args: {
    reqs: Requirement[],
    reqTaskMap: Array<{ reqIdx: number; task_uuid: string; score: number }>,
    taskImplemented: Record<string, { implemented: boolean }>
  }) {
    const coveredReqs = new Set(args.reqTaskMap.filter(m => m.score >= 0.35).map(m => m.reqIdx));
    const coverage = args.reqs.length ? coveredReqs.size / args.reqs.length : 0;

    const fidelity = args.reqTaskMap.length
      ? args.reqTaskMap.filter(m => m.score >= 0.5).length / args.reqTaskMap.length
      : 0;

    const implVals = Object.values(args.taskImplemented).map(v => v.implemented ? 1 : 0);
    const implementation = implVals.length ? (implVals.reduce((a,b) => a+b,0) / implVals.length) : 0;

    // placeholder creativity proxy: if tasks exist with no strict match but anchors present -> small boost
    const creativeBoost = args.reqTaskMap.filter(m => m.score < 0.35).length > 0 ? 0.1 : 0.0;
    const creativity = Math.min(1, creativeBoost + (coverage > 0.8 ? 0.05 : 0));

    const overall = (coverage * 0.4) + (fidelity * 0.2) + (implementation * 0.3) + (creativity * 0.1);
    return { coverage, fidelity, implementation, creativity, overall };
  }

  // 7) Persist full report
  async persistReport(order_id: string, prompt: string, scores: any, reqs: Requirement[], reqTaskMap: any[],
    links: Link[], taskImplemented: Record<string, { implemented: boolean, locations: any[] }>
  ) {
    const report_id = randomUUID();
    await this.env.DB.prepare(
      `INSERT INTO delivery_reports (id, order_id, original_prompt, created_at, coverage_score, fidelity_score, creativity_score, implementation_score, overall_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      report_id, order_id, prompt, Date.now(),
      scores.coverage, scores.fidelity, scores.creativity, scores.implementation, scores.overall
    ).run();

    for (const r of reqs) {
      const matched = reqTaskMap.filter((m: any) => m.reqIdx === r.idx);
      const cov = matched.some((m: any) => m.score >= 0.35) ? 1 : 0;
      await this.env.DB.prepare(
        `INSERT INTO delivery_requirements (id, report_id, idx, text, matched_tasks, coverage)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(randomUUID(), report_id, r.idx, r.text, matched.length, cov).run();
    }

    for (const [task_uuid, info] of Object.entries(taskImplemented)) {
      const locs = info.locations ?? [];
      const any = locs[0];
      await this.env.DB.prepare(
        `INSERT INTO delivery_task_findings (id, report_id, task_uuid, file_path, placeholder, implemented, lines, pr_url, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        randomUUID(), report_id, task_uuid,
        any?.path ?? null, null, info.implemented ? 1 : 0,
        JSON.stringify(locs), null, null
      ).run();
    }

    for (const l of links) {
      await this.env.DB.prepare(
        `INSERT INTO delivery_links (id, report_id, requirement_id, task_uuid, file_path, anchor, line_from, line_to, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        randomUUID(), report_id, l.requirement_id ?? null, l.task_uuid ?? null,
        l.file_path, l.anchor, l.line_from, l.line_to, l.confidence
      ).run();
    }

    return report_id;
  }

  // 8) Orchestrated entry: Build, score, persist report
  async buildReport(order_id: string) {
    const start = Date.now();

    // fetch the user’s original NL prompt from orders table
    const order = await this.env.DB.prepare(`SELECT original_prompt FROM orders WHERE id = ?`).bind(order_id).first();
    const prompt = (order?.original_prompt as string) ?? "";

    const reqs = this.extractRequirements(prompt);
    const tasks = await this.getTasksForOrder(order_id);
    const files = await this.fetchRepoTextFiles();

    const { links, taskImplemented } = this.linkTasksToCode(files, tasks);
    const reqTaskMap = this.mapRequirementsToTasks(reqs, tasks);
    const scores = this.computeScores({ reqs, reqTaskMap, taskImplemented });

    const report_id = await this.persistReport(order_id, prompt, scores, reqs, reqTaskMap, links, taskImplemented);

    await logEvent(this.env, {
      source: "orchestrator", stage: "delivery_report_complete", operation: "DeliveryService.buildReport",
      duration_ms: Date.now() - start, details: { order_id, report_id, scores }
    });

    return { ok: true, report_id, scores, counts: { requirements: reqs.length, tasks: tasks.length, links: links.length } };
  }
}

4) RPC entrypoint + REST routes

orchestrator/worker/entrypoints/DeliveryOps.ts

import { WorkerEntrypoint } from "cloudflare:workers";
import { DeliveryService } from "../services/delivery/deliveryService";

export class DeliveryOps extends WorkerEntrypoint {
  async generateReport(order_id: string) {
    const svc = new DeliveryService(this.env as any);
    return svc.buildReport(order_id);
  }
}

orchestrator/worker/api/routes/deliveryRoutes.ts

import { Hono } from "hono";
import { DeliveryService } from "../../services/delivery/deliveryService";

export const deliveryRoutes = new Hono();

deliveryRoutes.post("/delivery/:order_id/report", async (c) => {
  const order_id = c.req.param("order_id");
  const svc = new DeliveryService(c.env as any);
  const out = await svc.buildReport(order_id);
  return c.json(out);
});

deliveryRoutes.get("/delivery/report/:id", async (c) => {
  const id = c.req.param("id");
  const header = await c.env.DB.prepare(`SELECT * FROM delivery_reports WHERE id = ?`).bind(id).first();
  const reqs = await c.env.DB.prepare(`SELECT * FROM delivery_requirements WHERE report_id = ? ORDER BY idx`).bind(id).all();
  const tasks = await c.env.DB.prepare(`SELECT * FROM delivery_task_findings WHERE report_id = ?`).bind(id).all();
  const links = await c.env.DB.prepare(`SELECT * FROM delivery_links WHERE report_id = ?`).bind(id).all();
  return c.json({ header, requirements: reqs.results ?? [], tasks: tasks.results ?? [], links: links.results ?? [] });
});

export default deliveryRoutes;

Wire routes in your worker/index.ts if not already mounted.

5) Add orchestrator service binding to downstream workers (gRPC/RPC) (already pattern in your repo)

Each downstream worker wrangler.jsonc:

{
  "services": [
    { "binding": "ORCHESTRATOR_DELIVERY", "service": "vibehq-orchestrator", "entrypoint": "DeliveryOps" }
  ]
}

Now any worker (or your bash taskctl) can call:

await env.ORCHESTRATOR_DELIVERY.generateReport(order_id)

6) Gap-filling behavior
	•	If a requirement has no mapped task (no match ≥0.35), mark uncovered in delivery_requirements.coverage=0.
	•	If a task has implemented=0 (no TASK_ID: anchor in repo), include it in delivery_task_findings with notes.
	•	The frontend can show: Requirement → (tasks) → (files+lines) with confidence and PR links.

You can later swap the heuristic mapper with embeddings: store vectors for requirements, tasks (title/desc), and file snippets, then cosine-match. The service is isolated so you only replace mapRequirementsToTasks().

7) Minimal tests (Dev quick check)
	•	Insert a fake order with a multi-bullet prompt.
	•	Insert several tasks (some with file_path and ensure code files contain /* TASK_ID:xyz */).
	•	Hit POST /api/delivery/{order}/report → expect non-zero coverage, links, scores.

⸻

(Optional) Stitch Mockup Prompt — Delivery Report UI

Paste into Google Labs Stitch:

# VibeHQ Delivery Report — Requirements→Tasks→Code Traceability

Design a dashboard page titled “Delivery Report” with:
1) Header Summary Cards:
   - Coverage %, Fidelity %, Implementation %, Creativity %, Overall Score
   - Order ID, Report ID, Created At
2) Left Panel: Requirements List
   - Each requirement shows coverage dot (green/red), matched task count, click to filter center.
3) Center Panel: Task Findings
   - Table: [Task UUID, File, Implemented (yes/no), PR Link, Notes]
   - Row click highlights related files/lines.
4) Right Panel: Code Links
   - For the selected task: file path(s), line ranges, anchor tags (TASK_ID / FINAL_MILE).
   - Inline code preview with the anchor line highlighted.
5) Footer: Gaps & Recommendations
   - List uncovered requirements, unimplemented tasks, and suggested follow-ups.

Dark theme, Inter + JetBrains Mono. Use subtle confidence badges (High/Med/Low).
Include one example dataset with 3 requirements, 5 tasks, 4 code links.


⸻

That’s it

This gives you a concrete, repeatable Delivery Report pipeline with full chain-of-custody in D1, RPC + REST access, and a clear path to upgrade heuristics to embeddings later.