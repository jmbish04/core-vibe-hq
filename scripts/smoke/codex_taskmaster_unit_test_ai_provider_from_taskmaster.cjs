#!/usr/bin/env node
/*
 Simple smoke/unit check that reads AI provider from .taskmaster/config.json
 and validates CLI presence without requiring network or MCP sampling.

 Usage:
   node scripts/smoke/codex_taskmaster_unit_test_ai_provider_from_taskmaster.js [--json]

 Optional env:
   EXPECTED_AI_PROVIDER  If set, assert provider matches this string.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const asJson = process.argv.includes('--json');
const root = path.resolve(__dirname, '..', '..');
const cfgPath = path.join(root, '.taskmaster', 'config.json');

function fail(msg, code = 1) {
  if (asJson) {
    console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  } else {
    console.error(`[fail] ${msg}`);
  }
  process.exit(code);
}

function ok(payload) {
  if (asJson) {
    console.log(JSON.stringify({ ok: true, ...payload }, null, 2));
  } else {
    if (payload && payload.message) console.log(payload.message);
  }
}

let cfg;
try {
  const raw = fs.readFileSync(cfgPath, 'utf8');
  cfg = JSON.parse(raw);
} catch (e) {
  fail(`Unable to read/parse ${cfgPath}: ${e.message}`);
}

const codexCfg = (cfg && cfg.codexCli) || {};
const provider = codexCfg.provider;
const model = codexCfg.model;
const approvalMode = codexCfg.approvalMode;
const sandboxMode = codexCfg.sandboxMode;

if (!provider || typeof provider !== 'string') {
  fail('codexCli.provider missing or not a string');
}

// Optional assertion
const expected = process.env.EXPECTED_AI_PROVIDER;
if (expected && expected !== provider) {
  fail(`provider mismatch: expected '${expected}', got '${provider}'`);
}

// Check CLI presence without executing network-bound actions
const whichCodex = spawnSync(process.platform === 'win32' ? 'where' : 'command', ['-v', 'codex'], { encoding: 'utf8' });
const codexPath = whichCodex.status === 0 ? whichCodex.stdout.trim() : null;

const whichTMA = spawnSync(process.platform === 'win32' ? 'where' : 'command', ['-v', 'task-master-ai'], { encoding: 'utf8' });
const tmaPath = whichTMA.status === 0 ? whichTMA.stdout.trim() : null;

const msg = `AI_PROVIDER: ${provider}\nMODEL: ${model || ''}\nAPPROVAL: ${approvalMode || ''}\nSANDBOX: ${sandboxMode || ''}\nCLI codex: ${codexPath || 'not found'}\nCLI task-master-ai: ${tmaPath || 'not found'}`;

ok({ message: msg, provider, model, approvalMode, sandboxMode, codexPath, tmaPath });
