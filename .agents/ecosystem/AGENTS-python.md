# Python

> Part of the workstation briefing. **`~/AGENTS.md` is the parent — read it first**;
> it carries the rules that apply everywhere (secrets, backups, how to write to
> Justin, when to flag). This file adds the rules for **Python work on this Mac**.

---

## Use `uv`

`uv` is installed and is the default for anything heavier than a single-file
script: environments, dependency resolution, and running. Do not reach for
`pip install` into the system interpreter, and do not hand-roll a `venv` when
`uv venv` is right there.

```bash
uv venv
uv pip install -r requirements.txt
uv run python script.py
```

**Pin the interpreter when the code will run under launchd.** `uv run`
re-resolves the interpreter on every invocation, which silently swaps the binary
out from under a background service — and on this Mac that reintroduces the Local
Network permission bug. See `~/AGENTS-macos.md` before writing a LaunchAgent.

## Pin `typer` and `click` together, and read the rendered help

Both measured on VM 132, 2026-09-21, installing with `uv`:

- **`typer==0.27.2` installs without `click`** and dies at import with
  `ModuleNotFoundError: No module named 'click'`. Its published dependency
  metadata is wrong. 0.12.5, 0.15.4 and 0.19.2 are fine.
- **`typer` 0.19.2 with `click` 8.5.0 silently drops every argument help
  string.** The panel renders `* source_key TEXT [required]` with no
  description, no warning, exit 0. `click` 8.4.2 renders it correctly.

So pin both, not just `typer`:

```
typer>=0.15,<0.20
click>=8.1,<8.5
```

The second one is the dangerous one, and it generalises past this library:
**output that looks complete and says nothing survives review, where output that
errors does not.** A help page is a deliverable — look at the rendered result,
not just the exit code. Leave a test that fails if someone widens the `click`
pin without checking the output.

(An earlier attempt at the same rewrite hit the same class of failure through a
different symptom — `ModuleNotFoundError: No module named 'annotated_doc'` — and
the workaround then was to abandon `typer` for `argparse`. `argparse` cannot do
grouped help; `click` can, and has neither broken dependency in its tree.)

## The three utilities you copy, never write

From `~/.colby-ecosystem/python/utils/`:

| File | What it is |
|---|---|
| `secrets.py` | tokens CLI SDK — **symlink to the canonical copy**, fix bugs at the target |
| `ai.py` | core-guardian client. The **only** path for an LLM call — see `~/AGENTS-ai.md` |
| `cf.py` | core-bridge client, for reaching this Mac or the LAN from a Worker |

Scaffold `secrets.py` rather than copying it:

```bash
tokens agent-onboarding --scaffold-python utils/secrets.py
```

Then `require_secret("NAME")` (throws, with an actionable message) or
`get_secret("NAME")` (returns `None`). Never read a credential from a `.env`,
never hardcode one, never ask Justin to paste one into a terminal. Full rules in
"Secrets & credentials" in `~/AGENTS.md`.

## A Python app with a UI uses the same frontend as everything else

There is one frontend for Workers and Python alike:
`~/.colby-ecosystem/frontend/`. Do not build a Jinja/Streamlit/Gradio surface
because the backend happens to be Python. Load `~/AGENTS-frontend.md`.

## LLM calls

Every one goes through core-guardian. A notebook, a test harness, a throwaway
script — all of it. A direct provider call is invisible to the budget and cannot
be killed. `~/AGENTS-ai.md` is not optional reading for Python work that touches
a model.
