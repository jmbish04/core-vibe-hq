# GitHub

> Part of the workstation briefing. **`~/AGENTS.md` is the parent — read it first**;
> it carries the rules that apply everywhere (secrets, backups, how to write to
> Justin, when to flag). This file adds the rules for **GitHub** — PRs, reviews, merges, workflow files, and the auth traps.

---

# GitHub

**Use `gh-tools`. It is the toolkit built for exactly this.** Agents lose hours
to GitHub auth every week; this CLI exists so they stop.

```bash
gh-tools --help
```

`gh-tools` (in `~/bin`, on the terminal banner) is a thin wrapper around
`local-github-control` — either name works.

**Three subcommands live in the wrapper itself, not in `local-github-control`,** and
they are how the machine-wide briefings reach a repo (`~/AGENTS.md` → "Every repo
pulls its own right-sized copy of these briefings"):

| Command | What it does |
| --- | --- |
| `gh-tools agents-sync [<path>\|<owner/repo>]` | install the briefing sync Action into one repo — workflow, secret, first sync, git hooks |
| `gh-tools agents-audit [--limit=30]` | check the most recently pushed repos for it: `workflow`, `secret`, `synced` |
| `gh-tools agents-rollout [--yes]` | install it into every repo missing it. **Writes nothing without `--yes`** |

Run `agents-rollout` bare first and read the list — it commits to each repo's
default branch and sets a secret on each.

## Workflow files: measure the token, fall back to SSH — never ask Justin for a scope

**Before pushing `.github/workflows/*`, measure the token's scopes.** Since
2026-09-11 the gh login and both tokens-CLI names carry `workflow` (verified by
an accepted HTTPS token push). If a token ever lacks it again, **push over SSH**,
which does not need the scope at all — measured on one commit pushed both ways
while the tokens still lacked it:

```
https + token : ! [remote rejected] … (refusing to allow an OAuth App to create or
                update workflow `.github/workflows/probe.yml` without `workflow` scope)
ssh           : * [new branch]      probe/ssh-workflow-scope -> probe/ssh-workflow-scope
```

```bash
git push git@github.com:<owner>/<repo>.git <branch>               # no remote change needed
git push ssh://git@ssh.github.com:443/<owner>/<repo>.git <branch> # port 22 blocked
ssh -T git@github.com                                             # "Hi jmbish04!"
```

Three mistakes agents have made here:

- **Handing Justin `gh auth refresh -s workflow` from a local session.** SSH is
  right there. It is only a legitimate ask from a cloud session with no SSH key.
- **Trusting `gh-tools upsert-workflow` without measuring.** It writes through
  the Contents API with a token, so it needs `workflow` scope — and fails with a **404**, not
  a 403. GitHub answers a refused write on a private resource with "Not Found".
  A 404 on `PUT …/contents/.github/workflows/…` means *scope*, not *missing repo*;
  confirm the repo with a GET before believing it.
- **Concluding "no credential can do this"** after measuring only tokens. The
  scope is a token restriction. Your account can push workflows; your tokens
  cannot.

To write the workflow file, commit it and push the branch over SSH, then open the
PR with `gh-tools create-pr` as usual — PRs and merges do not need `workflow`
scope.

## The toolkit

It is PyGithub-first and **deliberately does not depend on the `gh` CLI** for PR
metadata or patch retrieval. It resolves auth itself: `GITHUB_TOKEN` or
`GH_TOKEN` from the environment, falling back to the tokens CLI when neither is
set. No browser flow. It authenticates with a token, so it inherits the token's
missing `workflow` scope (above).

| Need | Command |
|---|---|
| Open a PR | `create-pr` |
| Read a PR's discussion, reviews, and code comments | `pr-discussion <repo_path> <pr_number>` |
| Review / merge | `review-pr`, `merge-pr` |
| Clear merge drift | `update-pr-branch` |
| Check out a PR head locally, push a patch back | `sync-pr`, `patch-pr` |
| New repo | `create-repo` |
| Read / dispatch workflows | `list-workflows`, `get-workflow`, `run-workflow` |
| **Write** a workflow file | `git push` (measure the token has `workflow`; else push over SSH). `upsert-workflow` works only when the token has `workflow` — otherwise it 404s |
| Actions secrets | `set-secret` |
| Anything else | `github-op` (one JSON-driven entrypoint) |

Positional args, not flags — `gh-tools pr-discussion /path/to/repo 20`, not
`--repo-name`. Check `<subcommand> --help` first.

`gh` remains fine for quick reads and for anything the toolkit does not cover.
The maestro MCP GitHub tools are a third path. Use whichever works — but reach
for `local-github-control` first on PR and workflow work, because it sidesteps
the auth and sandbox problems that `gh` runs into.

## Never report a GitHub failure you have not measured

This is the rule that actually saves the time. Before saying you are blocked,
lack permission, or lack scope, run the check and quote the output:

```bash
gh auth status                    # accounts, which is active, and their scopes
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $(tokens show GH_TOKEN --value-only)" https://api.github.com/user
```

"I ran X and got `<exact error>`" is always acceptable. "I can't, I don't have
permission" without a command behind it is not. If one path fails, try another
before reporting — a differently-scoped token, the toolkit instead of `gh`, REST
instead of GraphQL. There is almost always a path.

**How the tokens actually behave (verified 2026-09-11 — re-measure, do not trust):**
The gh login, `GH_TOKEN` and `GITHUB_TOKEN` (tokens CLI) are one `gho_` token with
`repo, gist, read:org, admin:public_key, workflow`. The tokens CLI re-syncs both
names from `gh auth token` on every call (`_seed_github_tokens`,
`~/bin/tokens_cli/core/data.py`), checking only that the token works — not its
scopes. So a PAT stored by hand under either name is replaced on the next call;
change the **gh login's** scopes instead.

Justin's interactive terminal additionally exports a `ghp_` PAT from the cache
`~/.config/zsh/tokens.env` (via `tokens_env.zsh`); agent shells do not load it.
That split is why "my auth works" and "no token has `workflow`" were both true
before the fix. `~/.config/zsh/refresh_tokens.sh` rewrites that cache from the
tokens CLI — safe now that the tokens CLI copy has `workflow`.

If scope is ever missing again, Justin runs this once, in a browser. `env -u` is
required: with `GH_TOKEN` set, gh refuses ("The value of the GH_TOKEN
environment variable is being used for authentication"). Have him type the code
into a **fresh** github.com/login/device tab — a stale tab reports "expired" for
a code seconds old:

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh auth refresh -h github.com -s workflow
```
---
