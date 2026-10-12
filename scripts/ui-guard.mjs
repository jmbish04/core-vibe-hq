#!/usr/bin/env node
// colby-ecosystem: managed script — edit it in jmbish04/colby-ecosystem/templates/scripts/,
// never here. `pull-agents` overwrites this file.
//
// scripts/ui-guard.mjs — the checkable subset of the frontend standard, enforced by a
// deterministic scan instead of by somebody noticing in review.
//
// Every rule here is one Justin has had to correct by hand, more than once:
//
//   no-table         a plain <table>. Tables are the ReUI Data Grid, with grouping and the
//                    advanced filter builder.
//   no-pie-chart     pie / doughnut charts, in any library.
//   no-vertical-bar  a recharts <BarChart> without layout="vertical". Recharts names it
//                    backwards: layout="vertical" IS the horizontal bar. A genuine time
//                    series on the x-axis is the exception — suppress it with a reason.
//   no-raw-color     hex / rgb() / hsl() literals in colour props and style objects,
//                    Tailwind arbitrary colours (bg-[#0f766e]), and palette utilities
//                    (text-gray-500, bg-teal-600). Use the design tokens: bg-primary,
//                    text-muted-foreground, var(--chart-1). This is how a console ends up
//                    teal, or orange, when nobody asked for a brand colour.
//   no-custom-palette  a .css theme that tints --primary / --secondary / --accent / --ring
//                    (or their -foreground). ReUI's default theme keeps those achromatic;
//                    a hue there IS the custom brand palette — measured: a teal console
//                    (--primary: 191 91% 33%) and an orange one nobody asked for. Chart,
//                    destructive and sidebar-primary tokens are coloured by default and are
//                    not checked.
//   dark-default     the root <html> in a layout (or an .astro page) without `dark` in its
//                    class. Dark is the default; the header toggle offers light.
//   app-shell        a page under pages/ that renders <html> itself instead of going
//                    through the shared layout. What this CANNOT see: whether that layout is
//                    actually built on a ReUI app-shell block. It only proves that every page
//                    goes through *a* layout, which is the part a regex can measure.
//   base-ui-style    components.json declares a style whose LIBRARY is not Base UI. The style
//                    is {library}-{theme} (base-nova, base-vega, radix-nova, radix-vega) and
//                    only the `base` library is Base UI; the theme is a look, not an API. Base UI is
//                    the standard primitive layer (shadcn made it the default on 2026-07-03;
//                    ReUI's blocks are built on it). A repo on new-york-v4 gets radix
//                    primitives, and a Base UI block dropped onto radix primitives does not
//                    fail loudly - radix ignores `render`, `delay`, `closeDelay` and friends,
//                    so the trigger renders and does nothing.
//   no-radix         an import of `@radix-ui/*` or `radix-ui`, anywhere including the
//                    vendored components/ui/ wrappers - this is the one rule that looks
//                    inside them, because that is where the primitive layer lives and the
//                    whole point is which library it is.
//   select-wrapper   a raw <SelectValue> outside the vendored wrappers. NEITHER library
//                    renders the selected item's LABEL on its own: radix resolves the
//                    trigger's text from the mounted item (absent during SSR), and Base UI
//                    renders the raw value unless Select.Root is given `items`. Measured
//                    both ways - a trigger that paints `__all__` on first load, and one
//                    that paints an assignee id. The fix is one shared wrapper that
//                    resolves the label; this rule is what stops a call site going round it.
//   off-reason       a rule switched off in .ui-guard.json with no migration reference. An
//                    opt-out has to name the task that ends it, or it is permanent and
//                    nobody can tell.
//
//   node scripts/ui-guard.mjs              scan src/ and web/; exit 1 on any violation
//   node scripts/ui-guard.mjs --warn       same output, always exit 0
//   node scripts/ui-guard.mjs --json       a JSON array instead of lines
//   node scripts/ui-guard.mjs <dir>        scan another repo root (read-only)
//
// Suppress ONE line with a comment on that line or the line above it:
//   // ui-guard-allow no-vertical-bar: x-axis is a daily time series
// The reason is required. An allow without one is itself a violation (allow-reason).
//
// Optional .ui-guard.json at the repo root:
//   { "include": ["src", "web"], "exclude": ["src/backend/**"],
//     "rules": { "no-table": "off" },
//     "migration": { "no-table": "maestro task 5dc4f5e5b6b3" } }
//
// Switching a rule off needs a `migration` entry naming what ends the exemption - a task
// id, a PR, a dated decision. Without one the repo gets an `off-reason` violation
// instead, because an opt-out nobody can attribute is just the rule being deleted.
//
// Skipped always: node_modules, dist, .astro, and the vendored component directories
// components/ui/, components/reui/, components/blocks/ — ReUI and shadcn source is not ours
// to lint — plus any backend/ directory (server code, HTML email). `no-radix` is the one
// exception and runs inside the vendored directories too: which primitive library the
// wrappers wrap is exactly the thing being checked. Zero dependencies, Node 22.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const RULES = {
  "no-table": "plain <table> — use the ReUI Data Grid (with grouping and the filter builder)",
  "no-pie-chart": "pie/doughnut chart — use a horizontal bar, a stacked bar, or a number with a trend",
  "no-vertical-bar":
    'vertical <BarChart> — bars are horizontal (recharts layout="vertical") unless the x-axis is a time series; suppress with ui-guard-allow when it genuinely is',
  "no-raw-color": "raw colour — use a design token (bg-primary, text-muted-foreground, var(--chart-1)), never a literal or a palette utility",
  "no-custom-palette": "tinted theme token — ReUI's default theme keeps primary/secondary/accent/ring achromatic; never pick a brand colour",
  "dark-default": 'root <html> lacks class="dark" — dark is the default theme, light is the header toggle',
  "app-shell": "page renders <html> itself — go through the shared layout built on the ReUI app shell",
  "base-ui-style":
    'components.json style is not on the Base UI library — the style is {library}-{theme} and the library must be `base` (base-nova, base-vega), not radix-* or new-york-*. A Base UI block on radix primitives silently ignores render/delay/closeDelay rather than failing',
  "no-radix":
    "radix import — primitives come from Base UI (shadcn's base-nova style). Radix ignores the props Base UI blocks pass, so the mismatch ships working-looking and dead",
  "select-wrapper":
    "raw <SelectValue> — go through the shared select wrapper that resolves the option's label; on their own radix paints nothing during SSR and Base UI paints the raw value",
  "allow-reason": "ui-guard-allow needs a known rule id and a reason: `ui-guard-allow <rule-id>: <why>`",
  "off-reason":
    'a rule is "off" in .ui-guard.json with no `migration` entry naming what ends the exemption (a task id, a PR, a dated decision)',
};

/**
 * Which primitive library a shadcn style installs.
 *
 * The style is `{library}-{theme}`, and ReUI's agent skill states the rule:
 * "the base library is the segment before the first `-` (base-nova -> base,
 * radix-nova -> radix)". Measured 2026-10-04, all four exist in both the shadcn
 * and ReUI registries - `base-nova`, `base-vega`, `radix-nova`, `radix-vega` -
 * and `/r/styles/base-nova/select.json` imports `@base-ui/react/select` while
 * `/r/styles/radix-nova/...` and shadcn's own `new-york-v4` import `radix-ui`.
 *
 * So the check is on the LIBRARY, not on a list of style names. An earlier
 * version of this pinned the single name `base-nova` and would have flagged
 * core-template-cf-reui, which is on `base-vega` - Base UI with a different
 * theme, and the repo every new frontend is created from. A theme is a look; a
 * library is an API.
 *
 * This is not a substring match: `new-york-v4` yields `new`, not `base`.
 */
export const BASE_UI_LIBRARY = "base";

export const styleLibrary = (style) =>
  typeof style === "string" && style.includes("-") ? style.slice(0, style.indexOf("-")) : "";

const EXTS = [".astro", ".tsx", ".jsx", ".ts", ".mdx", ".css"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", ".git", ".wrangler"]);
const VENDORED = ["components/ui/", "components/reui/", "components/blocks/"];
// Server code renders no app UI. HTML email legitimately needs tables and literal colours,
// and seed rows (a project's label colour) are data, not styling.
const SERVER = /(^|\/)backend\//;

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_RE = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*-?[a-z]+(?:-[a-z]+)*-(?:${PALETTE})-(?:50|[1-9]00|950)(?:\\/\\d+)?(?![\\w-])`, "g");
const ARBITRARY_RE = /-\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch|oklab)\((?!var\())/g;
const COLOR_PROPS =
  "fill|stroke|color|stopColor|floodColor|lightingColor|background|backgroundColor|borderColor|outlineColor|textDecorationColor|caretColor|accentColor";
const COLOR_LITERAL_RE = new RegExp(
  `\\b(?:${COLOR_PROPS})\\s*[:=]\\s*\\{?\\s*["'\`](?:#[0-9a-fA-F]{3,8}\\b|(?:rgba?|hsla?|oklch|oklab)\\((?!\\s*var\\())`,
  "g",
);
const ALLOW_RE = /ui-guard-allow\s+([\w-]+)(?:\s*:\s*(\S.*?))?\s*(?:\*\/|-->|\}|$)/;

const isComment = (line) => /^\s*(\/\/|\/\*|\*|\{\/\*|<!--)/.test(line);
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

// The opening tag starting at `start` ("<Name ..."), tracking quotes and {} so that
// `=>` inside an attribute expression does not end it.
function openingTag(text, start) {
  let depth = 0, quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth <= 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

function* tags(text, nameRe) {
  const re = new RegExp(`<(?:\\w+\\.)?(?:${nameRe})(?![\\w.-])`, "g");
  for (const m of text.matchAll(re)) yield { index: m.index, tag: openingTag(text, m.index) };
}

// Chroma of a CSS colour value, normalised so that > 0.03 means "visibly tinted".
// null = cannot judge (var(), a keyword) -> not flagged.
export function chroma(value) {
  const v = value.trim().toLowerCase();
  let m;
  if ((m = v.match(/^oklch\(\s*[\d.]+%?\s+([\d.]+)/))) return Number(m[1]);
  if ((m = v.match(/^(?:hsla?\()?\s*[\d.]+(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/))) {
    const s = Number(m[1]) / 100, l = Number(m[2]) / 100;
    return s * (1 - Math.abs(2 * l - 1)) * 0.4; // HSL chroma, scaled to oklch's rough range
  }
  if ((m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/))) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return (Math.max(...rgb) - Math.min(...rgb)) * 0.4;
  }
  return null;
}

const TOKEN_RE = /^\s*--(primary|secondary|accent|ring)(?:-foreground)?\s*:\s*([^;]+);/;

function scanCss(lines) {
  const out = [];
  lines.forEach((line, i) => {
    const m = line.match(TOKEN_RE);
    const c = m && chroma(m[2]);
    if (c !== null && c > 0.03) out.push({ line: i + 1, rule: "no-custom-palette" });
  });
  return out;
}

// One file -> [{ line, rule }]. `rel` is the repo-relative path with forward slashes.
export function scan(rel, text) {
  const out = [];
  const add = (line, rule) => out.push({ line, rule });
  const lines = text.split("\n");
  if (rel.endsWith(".css")) return scanCss(lines);

  lines.forEach((line, i) => {
    if (isComment(line) && !/ui-guard-allow/.test(line)) return;
    const n = i + 1;
    if (/<table[\s>/]/.test(line)) add(n, "no-table");
    if (/\bfrom\s+["']@radix-ui\/[^"']+["']|\bfrom\s+["']radix-ui["']|\brequire\(\s*["'](?:@radix-ui\/[^"']+|radix-ui)["']/.test(line)) add(n, "no-radix");
    if (/<SelectValue[\s>/]/.test(line)) add(n, "select-wrapper");
    if (/\btype\s*[:=]\s*\{?\s*["'](?:pie|doughnut)["']/.test(line) || /from\s+["']@nivo\/pie["']/.test(line)) add(n, "no-pie-chart");
    if (line.match(PALETTE_RE) || line.match(ARBITRARY_RE) || line.match(COLOR_LITERAL_RE)) add(n, "no-raw-color");
    const allow = line.match(ALLOW_RE);
    if (allow && (!allow[2] || !RULES[allow[1]] || allow[1] === "allow-reason")) add(n, "allow-reason");
  });

  for (const { index } of tags(text, "PieChart|Pie")) add(lineAt(text, index), "no-pie-chart");
  for (const { index, tag } of tags(text, "BarChart")) {
    // ponytail: a dynamic layout={expr} cannot be judged statically, so it is not flagged.
    if (/\blayout\s*=\s*\{(?!\s*["'])/.test(tag)) continue;
    if (!/\blayout\s*=\s*\{?\s*["']vertical["']/.test(tag)) add(lineAt(text, index), "no-vertical-bar");
  }

  const inPages = /(^|\/)pages\//.test(rel);
  const isLayout = /(^|\/)layouts\//.test(rel);
  for (const { index, tag } of tags(text, "html")) {
    const n = lineAt(text, index);
    if (isLayout || (inPages && rel.endsWith(".astro"))) {
      const cls = tag.match(/\b(?:class|className|class:list)\s*=\s*("[^"]*"|'[^']*'|\{[\s\S]*?\})/);
      if (!cls || !/\bdark\b/.test(cls[1])) add(n, "dark-default");
    }
    if (inPages) add(n, "app-shell");
  }

  // Suppression: an allow for this rule, with a reason, on the line or the line above.
  const allowed = (n, rule) =>
    [lines[n - 1], lines[n - 2]].some((l) => {
      const m = l?.match(ALLOW_RE);
      return m && m[1] === rule && m[2];
    });
  const seen = new Set();
  return out
    .filter(({ line, rule }) => rule === "allow-reason" || !allowed(line, rule))
    .filter(({ line, rule }) => !seen.has(`${line}:${rule}`) && seen.add(`${line}:${rule}`))
    .sort((a, b) => a.line - b.line);
}

const globRe = (g) =>
  new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}`);

function* walk(root, dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(root, full);
    else if (EXTS.some((x) => e.name.endsWith(x)) && !e.name.endsWith(".d.ts")) yield full;
  }
}

/**
 * The repo's primitive layer: which shadcn style `components.json` declares.
 *
 * Repo-level rather than per-line, because the mistake is one line in one file
 * and it decides what every later `shadcn add` installs. Returns [] when there
 * is no components.json - a repo with no shadcn config is not a frontend repo
 * this rule has anything to say about, and inventing a violation for an absent
 * file is concluding something from an absence.
 */
export function scanComponentsJson(text) {
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch {
    // Malformed JSON is shadcn's problem to report, not this scan's to guess at.
    return [];
  }
  if (styleLibrary(cfg.style) === BASE_UI_LIBRARY) return [];
  const line = text.split("\n").findIndex((l) => /"style"\s*:/.test(l));
  return [{ line: line >= 0 ? line + 1 : 1, rule: "base-ui-style" }];
}

export function run(root = ".") {
  root = resolve(root);
  const cfgPath = join(root, ".ui-guard.json");
  const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
  const include = cfg.include ?? ["src", "web"];
  const exclude = (cfg.exclude ?? []).map(globRe);
  const off = new Set(Object.entries(cfg.rules ?? {}).filter(([, v]) => v === "off").map(([k]) => k));
  const migration = cfg.migration ?? {};
  const violations = [];
  const push = (file, v) => {
    if (!off.has(v.rule)) violations.push({ file, line: v.line, rule: v.rule, message: RULES[v.rule] });
  };

  for (const dir of include) {
    if (!existsSync(join(root, dir))) continue;
    for (const file of walk(root, join(root, dir))) {
      const rel = relative(root, file).split(sep).join("/");
      const vendored = VENDORED.some((v) => rel.includes(v));
      if (SERVER.test(rel) || exclude.some((re) => re.test(rel))) continue;
      // The vendored directories are skipped for every rule but `no-radix`:
      // which primitive library the wrappers wrap is the thing being checked,
      // so this is the one scan that has to look inside them.
      for (const v of scan(rel, readFileSync(file, "utf8")))
        if (!vendored || v.rule === "no-radix") push(rel, v);
    }
  }

  const componentsJson = join(root, "components.json");
  if (existsSync(componentsJson)) {
    for (const v of scanComponentsJson(readFileSync(componentsJson, "utf8"))) push("components.json", v);
  }

  // An opt-out has to name what ends it. This one is reported even when
  // `off-reason` is itself switched off - a rule that can disable its own
  // enforcement is an instrument that cannot fail.
  for (const rule of off) {
    if (rule === "off-reason") continue;
    if (!migration[rule]) {
      violations.push({ file: ".ui-guard.json", line: 1, rule: "off-reason", message: RULES["off-reason"] });
    }
  }

  return violations;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ui-guard.mjs")) {
  const args = process.argv.slice(2);
  const violations = run(args.find((a) => !a.startsWith("--")) ?? ".");
  if (args.includes("--json")) console.log(JSON.stringify(violations, null, 2));
  else for (const v of violations) console.log(`${v.file}:${v.line}: ${v.rule}: ${v.message}`);
  if (!args.includes("--json")) console.error(`ui-guard: ${violations.length} violation(s)`);
  process.exit(violations.length && !args.includes("--warn") ? 1 : 0);
}
