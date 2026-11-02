import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../evals/run.mjs', import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), '評価 harness & cwd-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, call: args => spawnSync(process.execPath, [script, ...args], { cwd: dir,
    env: { ...process.env, PATH: '' }, encoding: 'utf8', timeout: 10000 }) };
}

test('brief listing reads the kit files from another cwd without head or a shell', t => {
  const f = fixture(t);
  const first = readdirSync(new URL('../../evals/briefs/', import.meta.url)).filter(p => p.endsWith('.md')).sort()[0];
  assert.ok(first);
  const result = f.call(['--list']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(first.replace(/^\d+-/, '').replace(/\.md$/, '')), result.stdout);
});

test('a nonexistent evaluation directory cannot report a successful score', t => {
  const f = fixture(t);
  const result = f.call(['fixture', '--dir', join(f.dir, 'missing')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Nothing to score/);
  assert.doesNotMatch(result.stdout, /OBJECTIVE/);
});

test('an empty evaluation directory reports that nothing was measured', t => {
  const f = fixture(t);
  writeFileSync(join(f.dir, 'readme.txt'), 'No HTML');
  const result = f.call(['fixture', '--dir', f.dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /nothing to measure/);
});
