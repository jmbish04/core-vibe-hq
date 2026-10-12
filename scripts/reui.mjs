#!/usr/bin/env node
// colby-ecosystem: managed script — edit it in jmbish04/colby-ecosystem/templates/scripts/,
// never here. `pull-agents` overwrites this file.
//
// scripts/reui.mjs — pin this repo's @reui registry so Pro blocks stop 401-ing.
//
// THIS FILE EXISTS SO YOU DO NOT DEBUG THIS AGAIN. `reui-registry` already knows the
// two separate reasons a ReUI Pro block returns 401, and fixing only one leaves you
// stuck:
//
//   1. `shadcn registry add @reui` writes the bare URL with no Authorization header.
//   2. THE REDIRECT. https://reui.io/r/{style}/{name}.json answers 307 to
//      /r/styles/{style}/{name}.json?v=<deployment>, and the shadcn CLI DROPS the
//      Authorization header across that redirect. Every install then fails with
//      "You are not authorized to access the item", which reads like a bad licence
//      key and is not — `curl -L` with the same key returns 200.
//
// So the fix is to write the already-redirected, versioned URL into components.json.
// `v` is ReUI's deployment id and changes whenever they ship, which is why this is a
// command you re-run rather than a value you paste once.
//
//   node scripts/reui.mjs            # patch every components.json found here
//   node scripts/reui.mjs --check    # report only, exit 1 if a file needs patching
//
// The licence key stays in $REUI_LICENSE_KEY; only the ${REUI_LICENSE_KEY} placeholder
// reaches disk. Never write the key itself into components.json.
//
// Local only: `reui-registry` lives on this machine, not on a CI runner.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [join(homedir(), ".local", "bin", "reui-registry"), join(homedir(), "bin", "reui-registry"), "reui-registry"];

export function reuiRegistryPath() {
  for (const c of CANDIDATES) if (!c.includes("/") || existsSync(c)) return c;
  return CANDIDATES.at(-1);
}

/**
 * Run reui-registry against a directory.
 *
 * @param {string[]} [args] e.g. ["--check"] or ["packages/web"]
 * @param {{ cwd?: string }} [opts]
 * @returns {Promise<number>} the exit code — 1 from `--check` means "needs patching"
 */
export function reui(args = [], opts = {}) {
  const bin = reuiRegistryPath();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd ?? process.cwd(), stdio: "inherit" });
    child.on("error", (err) =>
      reject(
        err.code === "ENOENT"
          ? new Error(
              `reui-registry not found (looked for ${CANDIDATES.join(", ")}).\n` +
                `  It is a machine tool, not a dependency of this repo. Do not hand-edit\n` +
                `  components.json instead — see ~/AGENTS-frontend.md.`
            )
          : err
      )
    );
    child.on("close", (code) => resolve(code ?? 0));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(await reui(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exit(127);
  }
}
