import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/gate.mjs', import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), '検証 gate CLI-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: join(dir, 'data'), CLAUDE_PROJECT_DIR: dir, CLAUDE_SESSION_ID: 'test' };
  const call = args => spawnSync(process.execPath, [script, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
  return { dir, env, call, receipt: () => JSON.parse(readFileSync(join(dir, 'data/receipts/test.jsonl'), 'utf8').trim().split('\n').at(-1)) };
}

test('the CLI runs from another cwd and importing it does not run the CLI', t => {
  const f = fixture(t);
  const dir = f.call(['--dir']);
  assert.equal(dir.status, 0, dir.stderr);
  assert.equal(dir.stdout.trim(), join(f.dir, 'data/receipts'));
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../../scripts/gate.mjs', import.meta.url).href)}); console.log('imported');`], { cwd: f.dir, encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout.trim(), 'imported');
  assert.equal(f.call([]).status, 2);
  assert.equal(f.call(['__missing_gate__.mjs']).status, 2);
});

test('a real run writes a receipt, and editing the file expires it', t => {
  const f = fixture(t), page = join(f.dir, 'page.html');
  writeFileSync(page, '<p>Clean</p>');
  const ran = f.call(['check_no_emoji.py', page]);
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  assert.match(ran.stdout, /Scanned 1 file/);
  const receipt = f.receipt();
  assert.equal(receipt.exit, 0);
  assert.equal(receipt.targets[0].path, page);
  assert.match(receipt.targets[0].sha256, /^[a-f0-9]{16}$/);
  assert.equal(f.call(['--check', page]).status, 0);
  writeFileSync(page, '<p>Changed</p>');
  const expired = f.call(['--check', page]);
  assert.equal(expired.status, 1);
  assert.match(expired.stdout, /EXPIRED/);
});

test('a failed measurement records its real exit and cannot clear verification', t => {
  const f = fixture(t), css = join(f.dir, 'bad.css');
  writeFileSync(css, '.bad{margin:13px}');
  const failed = f.call(['lint_hardcodes.py', css]);
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.equal(f.receipt().exit, 1);
  const checked = f.call(['--check', css]);
  assert.equal(checked.status, 1);
  assert.match(checked.stdout, /FAILING/);
});

test('legacy receipt values from the report API remain readable by the CLI', t => {
  const f = fixture(t), page = join(f.dir, 'page.html');
  writeFileSync(page, '<p>Fixture</p>');
  const api = new URL('../../scripts/gate.mjs', import.meta.url).href;
  const recorded = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const {writeReceipt}=await import(${JSON.stringify(api)});if(!writeReceipt({gate:'accuracy_report',exit:0,files:[process.argv[1]],values:{}}))process.exit(2);`, page],
    { cwd: f.dir, env: f.env, encoding: 'utf8' });
  assert.equal(recorded.status, 0, recorded.stderr);
  const checked = f.call(['--check', page]);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.match(checked.stdout, /1 live receipt/);
});

test('an unwritable receipt location is an error even if the gate passed', t => {
  const f = fixture(t), page = join(f.dir, 'page.html');
  writeFileSync(page, '<p>Clean</p>');
  writeFileSync(f.env.CLAUDE_PLUGIN_DATA, 'a file blocks the receipt directory');
  const failed = f.call(['check_no_emoji.py', page]);
  assert.equal(failed.status, 2);
  assert.match(failed.stderr, /could not write the receipt/);
});

test('the wrapper resolves browser dependencies from the current project', t => {
  const f = fixture(t), module = join(f.dir, 'node_modules/playwright');
  mkdirSync(module, { recursive: true });
  writeFileSync(join(module, 'package.json'), '{"main":"index.cjs"}');
  writeFileSync(join(module, 'index.cjs'), "module.exports={chromium:{launch:async()=>{throw Error('project-browser-reached')}}};");
  const page = join(f.dir, 'page.html');
  writeFileSync(page, '<button>Save</button>');
  delete f.env.UX_UI_PROJECT_ROOT;
  const result = f.call(['verify_states.mjs', page]);
  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /project-browser-reached/);
  assert.equal(f.receipt().exit, 1);
});
