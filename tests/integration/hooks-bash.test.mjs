import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const shell = process.env.BASH_BIN || 'sh';
const probe = spawnSync(shell, ['-c', 'exit 0'], { encoding: 'utf8' });
const available = probe.status === 0;
const required = process.env.REQUIRE_BASH === '1';
let scratch;
after(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });
function hook(name, payload, env) {
  return spawnSync(process.execPath, [join(ROOT, 'hooks', name)], { cwd: ROOT, input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env } });
}
function editedPage(html) {
  scratch = mkdtempSync(join(tmpdir(), 'ds-bash-hooks-'));
  const project = mkdtempSync(join(tmpdir(), 'ds-bash-project-'));
  const page = join(project, 'page.html');
  mkdirSync(join(project, 'node_modules'));
  const require = createRequire(import.meta.url);
  symlinkSync(dirname(require.resolve('playwright')), join(project, 'node_modules/playwright'), process.platform === 'win32' ? 'junction' : 'dir');
  writeFileSync(page, html);
  const env = { CLAUDE_PLUGIN_DATA: scratch, CLAUDE_PROJECT_DIR: project, CLAUDE_SESSION_ID: '' };
  const edit = hook('posttooluse-fast-gates.mjs', { session_id: 's1', tool_name: 'Edit', tool_input: { file_path: page } }, env);
  assert.notEqual(edit.status, null, 'setup: PostToolUse must run');
  return { project, page, env };
}

/**
 * #24. The hook printed a command, the agent ran it from its Bash tool - where
 * neither CLAUDE_PLUGIN_DATA nor CLAUDE_SESSION_ID exists - and the receipt
 * landed where the hook never looked. It blocked every turn for the rest of
 * the session. The only honest test is to run the printed command verbatim.
 */
test('the command the Stop hook prints is one that clears it', { skip: !available && !required ? 'Bash unavailable: integration NOT verified (set REQUIRE_BASH=1 to require it)' : false }, () => {
  assert.equal(probe.status, 0, 'REQUIRE_BASH=1 needs a working Bash-compatible shell');
  const { project, page, env } = editedPage('<!doctype html><html lang="en"><title>t</title><main><p>Hello</p></main></html>');
  try {
    const blocked = hook('stop-require-measurement.mjs', { session_id: 's1' }, env);
    assert.equal(blocked.status, 2, `expected a block:\n${blocked.stderr}`);
    const cmd = blocked.stderr.split('\n').map(l => l.trim()).find(l => /gate\.mjs" verify_states\.mjs/.test(l));
    assert.ok(cmd, `no runnable command in:\n${blocked.stderr}`);

    // As the agent's Bash tool runs it: from the project, without the hook's env.
    const bashEnv = { ...process.env };
    delete bashEnv.CLAUDE_PLUGIN_DATA; delete bashEnv.CLAUDE_SESSION_ID; delete bashEnv.CLAUDE_PROJECT_DIR;
    const ran = spawnSync(shell, ['-c', cmd], { cwd: project, encoding: 'utf8', env: bashEnv });
    assert.equal(ran.status, 0, `the printed command failed:\n${ran.stdout}${ran.stderr}`);

    const after = hook('stop-require-measurement.mjs', { session_id: 's1' }, env);
    assert.equal(after.status, 0, `still blocked after running its own command:\n${after.stderr}`);
  } finally { rmSync(project, { recursive: true, force: true }); }
});
