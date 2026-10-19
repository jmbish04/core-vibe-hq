#!/usr/bin/env bash
# colby-ecosystem: managed script
#
# Verbose-by-default step runner. Source it at the top of any script an agent
# writes, then put every step through `run`.
#
#   . scripts/run.sh
#   need WORKER_API_KEY                  # resolve a credential, or exit naming it
#   run pnpm install
#   run pnpm run build
#   bg  npx wrangler tail                # long-running: full output to a file
#
# Why it exists. Justin's minimum bar, in his words: "at a minimum, these
# scripts need to be more verbose with their logging." Three measured failures
# this prevents, all recorded in ~/AGENTS.md:
#
#   1. A script that fails on its first line and looks like it succeeded,
#      because the error was silenced and only the exit code was read.
#   2. A ten-minute deploy that produced an EMPTY output file for its whole
#      life, because it was piped into grep, which buffers. `bg` writes the
#      whole stream to a file and prints the path, so a hang is visible.
#   3. A missing credential read as "not needed": the variable was empty, the
#      service started clean, and the first caller days later got a 500.
#      `need` makes absent an error rather than an inference.
#
# Self-check: `bash scripts/run.sh --self-check` proves every function here can
# fail. A check that cannot fail is not reporting.

set -euo pipefail

RUN_LOG_DIR="${RUN_LOG_DIR:-${TMPDIR:-/tmp}}"
_run_step=0

_run_ts() { date -u +%H:%M:%S; }

run() {                                   # run <command...>
  _run_step=$((_run_step + 1))
  printf '\n[%s] step %d: %s\n' "$(_run_ts)" "$_run_step" "$*" >&2
  local start rc=0
  start=$(date +%s)
  "$@" || rc=$?
  local secs=$(( $(date +%s) - start ))
  if [ "$rc" -eq 0 ]; then
    printf '[%s] step %d OK in %ds\n' "$(_run_ts)" "$_run_step" "$secs" >&2
  else
    printf '[%s] step %d FAILED exit=%d after %ds: %s\n' "$(_run_ts)" "$_run_step" "$rc" "$secs" "$*" >&2
    return "$rc"
  fi
}

run_ok() {                                # run <command...>, expecting it may fail; prints the status
  _run_step=$((_run_step + 1))
  printf '\n[%s] step %d (failure allowed): %s\n' "$(_run_ts)" "$_run_step" "$*" >&2
  local rc=0
  "$@" || rc=$?
  printf '[%s] step %d exit=%d\n' "$(_run_ts)" "$_run_step" "$rc" >&2
  return 0
}

bg() {                                    # bg <command...> -> prints the log path and the pid
  _run_step=$((_run_step + 1))
  local slug log
  slug=$(printf '%s' "${1##*/}" | tr -cd '[:alnum:]._-')
  log="$RUN_LOG_DIR/run-$slug-$$-$_run_step.log"
  printf '\n[%s] step %d in background: %s\n[%s]   full output: %s\n' \
    "$(_run_ts)" "$_run_step" "$*" "$(_run_ts)" "$log" >&2
  # Everything, unfiltered, to one file. Never pipe this into a filter: a filter
  # buffers, and then an empty log means nothing at all -- not "still working",
  # not "hung", not "died on line 1".
  ( "$@" ) > "$log" 2>&1 &
  local pid=$!
  printf '[%s]   pid %d. If that file is still empty in 2 minutes it has hung: kill %d and re-run in the foreground.\n' \
    "$(_run_ts)" "$pid" "$pid" >&2
  printf '%s\n' "$log"
}

need() {                                  # need <NAME> [NAME...] -> exports each, or exits
  local name value missing=0
  for name in "$@"; do
    value="${!name:-}"
    if [ -z "$value" ] && command -v tokens >/dev/null 2>&1; then
      # No 2>/dev/null here on purpose: when the tokens CLI itself is broken,
      # that message is the only thing that explains the rest of the run.
      value=$(tokens show "$name" --value-only) || value=""
    fi
    if [ -z "$value" ]; then
      printf '[%s] MISSING CREDENTIAL: %s is not in the environment and the tokens CLI did not return it.\n' \
        "$(_run_ts)" "$name" >&2
      missing=1
    else
      export "$name=$value"
      printf '[%s] have %s (%d chars)\n' "$(_run_ts)" "$name" "${#value}" >&2
    fi
  done
  [ "$missing" -eq 0 ] || return 1
}

# ------------------------------------------------------------------ self-check
# Every function is broken on purpose and the assertion must notice. Run it after
# any edit to this file.
_run_self_check() {
  local fails=0
  _assert() {                             # _assert <label> <expected> <actual>
    if [ "$2" = "$3" ]; then printf 'ok    %s\n' "$1"
    else printf 'FAIL  %s: expected %s, got %s\n' "$1" "$2" "$3"; fails=$((fails + 1)); fi
  }
  local rc
  rc=0; ( run true ) >/dev/null 2>&1 || rc=$?;              _assert "run passes a passing command" 0 "$rc"
  rc=0; ( run false ) >/dev/null 2>&1 || rc=$?;             _assert "run propagates a failure" 1 "$rc"
  rc=0; ( run sh -c 'exit 7' ) >/dev/null 2>&1 || rc=$?;    _assert "run propagates the exit code" 7 "$rc"
  rc=0; ( run_ok false ) >/dev/null 2>&1 || rc=$?;          _assert "run_ok swallows deliberately" 0 "$rc"
  # run must SAY the command it ran: a silent step is the whole problem.
  local said
  said=$( ( run echo hello ) 2>&1 >/dev/null | grep -c 'step 1: echo hello' || true )
  _assert "run names the command it runs" 1 "$said"
  said=$( ( run false ) 2>&1 >/dev/null | grep -c 'FAILED exit=1' || true )
  _assert "run names the failure" 1 "$said"
  # bg must write the whole stream to the file it names.
  local log
  log=$( bg sh -c 'echo line1; echo line2 >&2' 2>/dev/null )
  sleep 1
  _assert "bg captures stdout and stderr" "2" "$(wc -l < "$log" | tr -d ' ')"
  rm -f "$log"
  # need must fail on an absent name, and must not invent a value.
  rc=0; ( need COLBY_RUN_SH_DEFINITELY_NOT_SET ) >/dev/null 2>&1 || rc=$?
  _assert "need fails on a missing credential" 1 "$rc"
  rc=0; ( COLBY_RUN_SH_FIXTURE=x need COLBY_RUN_SH_FIXTURE ) >/dev/null 2>&1 || rc=$?
  _assert "need passes on a present credential" 0 "$rc"
  printf '\n%s\n' "$([ "$fails" -eq 0 ] && echo "all checks passed" || echo "$fails check(s) failed")"
  return "$fails"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  # BASH_SOURCE vs $0 is load-bearing: ~/AGENTS.md records a deploy guard that
  # printed "clean" on every run because a BASH_SOURCE mistake put it in the
  # wrong directory, so its check matched nothing at all.
  case "${1:-}" in
    --self-check) _run_self_check ;;
    *) sed -n '3,30p' "${BASH_SOURCE[0]}"; printf '\nSource it; do not run it. `--self-check` proves its checks can fail.\n' ;;
  esac
fi
