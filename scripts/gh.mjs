#!/usr/bin/env node
// colby-ecosystem: managed script — edit it in jmbish04/colby-ecosystem/templates/scripts/,
// never here. `pull-agents` overwrites this file.
//
// scripts/gh.mjs — the GitHub entry point for this repo.
//
// THIS FILE EXISTS SO YOU DO NOT WRITE ANOTHER ONE. Agents reach for a homegrown
// `gh.mjs` in every repo, re-solve GitHub auth badly, and then lose an hour to a 401
// that was already solved. `gh-tools` is on this machine and handles it:
//
//   - PyGithub-first; it does NOT depend on the `gh` CLI for PR metadata or patches
//   - resolves auth itself: GITHUB_TOKEN / GH_TOKEN, falling back to the tokens CLI
//   - on this machine GITHUB_TOKEN is a dead token exported into every shell, and
//     GH_TOKEN is the live one. gh-tools prefers the live one. A hand-rolled helper
//     that reads process.env.GITHUB_TOKEN picks the corpse.
//
// Use it from the shell, or import it here.
//
//   node scripts/gh.mjs pr-discussion . 20
//   node scripts/gh.mjs open-prs .
//   node scripts/gh.mjs --help                 # the full subcommand list
//
//   import { gh, ghJson } from "./scripts/gh.mjs";
//   const { stdout } = await gh(["pr-checks", ".", "42"]);
//   const prs = await ghJson(["open-prs", "."]);
//
// Subcommands take POSITIONAL args, not flags: `gh-tools pr-discussion /path/to/repo 20`.
// The ones worth knowing: create-pr, pr-discussion, review-pr, merge-pr, pr-checks,
// open-prs, sync-pr, patch-pr, update-pr-branch, create-repo, set-secret,
// list-workflows, upsert-workflow, run-workflow, request-reviewers, github-op.
//
// Plus the three that keep this repo's agent briefings current (see AGENTS.md):
//   gh-tools agents-sync      install the briefing sync Action into a repo
//   gh-tools agents-audit     which repos have it: workflow / secret / synced
//   gh-tools agents-rollout   install it into the ones missing it (needs --yes)
//
// Local only. There is no gh-tools on a CI runner; in a workflow use the `gh` CLI or
// the REST API directly.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  join(homedir(), "bin", "gh-tools"),
  join(homedir(), ".local", "bin", "local-github-control"),
  "local-github-control",
];

/** Absolute path to gh-tools, or the bare name if only the PATH copy exists. */
export function ghToolsPath() {
  for (const c of CANDIDATES) {
    if (c.includes("/") ? existsSync(c) : true) return c;
  }
  return CANDIDATES.at(-1);
}

/**
 * Run a gh-tools subcommand.
 *
 * Rejects on a non-zero exit unless `check: false`, because a silent failure here
 * becomes a wrong answer three steps later.
 *
 * @param {string[]} args    subcommand and its POSITIONAL arguments
 * @param {{ cwd?: string, check?: boolean, stdio?: "pipe" | "inherit" }} [opts]
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function gh(args, opts = {}) {
  const { cwd = process.cwd(), check = true, stdio = "pipe" } = opts;
  const bin = ghToolsPath();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      reject(
        err.code === "ENOENT"
          ? new Error(
              `gh-tools not found (looked for ${CANDIDATES.join(", ")}).\n` +
                `  It is the GitHub toolkit for this machine — reinstall it from\n` +
                `  /Volumes/Projects/workers/cursor-code-review-agent, or run \`gh-tools --help\`\n` +
                `  to confirm it is on PATH. Do not work around it with a hand-rolled helper.`
            )
          : err
      );
    });
    child.on("close", (code) => {
      if (check && code !== 0) {
        reject(new Error(`gh-tools ${args.join(" ")} exited ${code}\n${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

/** Same as `gh`, parsed as JSON. Throws with the raw output when it is not JSON. */
export async function ghJson(args, opts = {}) {
  const { stdout } = await gh(args, opts);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`gh-tools ${args.join(" ")} did not return JSON:\n${stdout.slice(0, 500)}`);
  }
}

// CLI passthrough: every argument goes to gh-tools untouched, stdio inherited, and the
// exit code is preserved so `node scripts/gh.mjs ... && next` behaves.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length === 0) args.push("--help");
  try {
    const { code } = await gh(args, { check: false, stdio: "inherit" });
    process.exit(code);
  } catch (err) {
    console.error(err.message);
    process.exit(127);
  }
}
