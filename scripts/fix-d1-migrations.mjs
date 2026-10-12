#!/usr/bin/env node
// colby-ecosystem: managed script — edit it in jmbish04/colby-ecosystem/templates/scripts/,
// never here. `pull-agents` overwrites this file.
/**
 * fix-d1-migrations.mjs — make Drizzle's generated SQL re-runnable on Cloudflare D1.
 *
 * D1 is SQLite. SQLite supports IF NOT EXISTS on TABLE / VIRTUAL TABLE / INDEX /
 * VIEW / TRIGGER, and IF EXISTS on the matching DROPs. It does NOT support
 * CREATE SCHEMA, CREATE TYPE, or CREATE SEQUENCE at all — injecting those (as a
 * generic Postgres-oriented script would) makes wrangler fail with
 * `near "SCHEMA": syntax error`. So this only touches what SQLite actually has.
 *
 * Idempotent: the negative lookaheads mean running it twice never produces
 * `CREATE TABLE IF NOT EXISTS IF NOT EXISTS`. Wire it into db:generate and forget it.
 *
 * Usage:
 *   node scripts/fix-d1-migrations.mjs [dir-or-file]   # default ./drizzle, recursive
 *   node scripts/fix-d1-migrations.mjs --self-check
 *
 * ponytail: regex over SQL text, not a parser. It would also rewrite the words
 * inside a string literal containing "CREATE TABLE". Drizzle does not generate
 * those; if a repo ever hand-writes one, parse properly instead.
 *
 * Known ceiling: SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so a
 * re-run of a column-adding migration still errors. That is a wrangler
 * d1_migrations bookkeeping problem, not something this script can paper over.
 */
import fs from "node:fs";
import path from "node:path";

const RULES = [
  [/CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "IF NOT EXISTS "],
  [/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "IF NOT EXISTS "],
  [/CREATE\s+VIEW\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "IF NOT EXISTS "],
  [/CREATE\s+TRIGGER\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "IF NOT EXISTS "],
  [/DROP\s+TABLE\s+(?!IF\s+EXISTS\b)/gi, "IF EXISTS "],
  [/DROP\s+INDEX\s+(?!IF\s+EXISTS\b)/gi, "IF EXISTS "],
  [/DROP\s+VIEW\s+(?!IF\s+EXISTS\b)/gi, "IF EXISTS "],
  [/DROP\s+TRIGGER\s+(?!IF\s+EXISTS\b)/gi, "IF EXISTS "],
];

export function fixSql(sql) {
  return RULES.reduce((out, [re, add]) => out.replace(re, (m) => m + add), sql);
}

function sqlFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".sql") ? [target] : [];
  return fs.readdirSync(target).flatMap((entry) => sqlFiles(path.join(target, entry)));
}

function selfCheck() {
  const { strictEqual } = { strictEqual: (a, b) => { if (a !== b) throw new Error(`\n got: ${a}\nwant: ${b}`); } };
  strictEqual(fixSql("CREATE TABLE `users` (id text);"), "CREATE TABLE IF NOT EXISTS `users` (id text);");
  strictEqual(fixSql("CREATE UNIQUE INDEX `u` ON `t` (`a`);"), "CREATE UNIQUE INDEX IF NOT EXISTS `u` ON `t` (`a`);");
  strictEqual(fixSql("DROP TABLE `old`;"), "DROP TABLE IF EXISTS `old`;");
  // idempotent
  strictEqual(fixSql(fixSql("CREATE TABLE `users` (id text);")), "CREATE TABLE IF NOT EXISTS `users` (id text);");
  // untouched: SQLite has no schema/type/sequence, and no conditional ADD COLUMN
  strictEqual(fixSql("CREATE SCHEMA app;"), "CREATE SCHEMA app;");
  strictEqual(fixSql("ALTER TABLE `t` ADD `c` text;"), "ALTER TABLE `t` ADD `c` text;");
  console.log("self-check ok");
}

const arg = process.argv[2];
if (arg === "--self-check") {
  selfCheck();
} else {
  const target = path.resolve(arg ?? "./drizzle");
  if (!fs.existsSync(target)) {
    console.error(`fix-d1-migrations: ${target} not found`);
    process.exit(1);
  }
  const files = sqlFiles(target);
  if (files.length === 0) {
    console.log("fix-d1-migrations: no .sql files, nothing to do");
    process.exit(0);
  }
  let changed = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const after = fixSql(before);
    if (after === before) continue;
    fs.writeFileSync(file, after, "utf8");
    console.log(`  patched ${path.relative(process.cwd(), file)}`);
    changed++;
  }
  console.log(`fix-d1-migrations: ${changed}/${files.length} file(s) patched`);
}
