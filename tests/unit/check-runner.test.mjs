import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runStep, runCheck } from '../../scripts/_check_runner.mjs';
import { runReport, checks } from '../../scripts/accuracy_report.mjs';
import { run, ROOT } from '../helpers/run.mjs';

const node = (code, extra = {}) => ({ command: 'node', args: ['-e', code], ...extra });
function dir(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'report 日本語 & paths-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

test('the full plan keeps 52 checks and the negative fixture has its own verdict', () => {
  assert.equal(checks.length, 52);
  for (const [, steps] of checks) for (const step of steps) {
    assert.ok(['node', 'python3'].includes(step.command));
    assert.ok(Array.isArray(step.args));
    assert.ok(!step.args.some(a => a === '&&' || a === ';'));
  }
  const [, steps] = checks.find(([label]) => label.startsWith('No native select'));
  assert.equal(steps.length, 2);
  assert.equal(steps[0].expectedExit ?? 0, 0);
  assert.equal(steps[1].expectedExit, 1);
  assert.ok(steps[1].expectedOutput);
});

test('an earlier failure stops the check instead of being hidden by expected rejection', async t => {
  const cwd = dir(t), marker = join(cwd, 'should-not-run');
  const result = await runCheck([node('process.exit(1)'), node(`require('fs').writeFileSync(${JSON.stringify(marker)},'bad')`, { expectedExit: 1 })], { cwd });
  assert.equal(result.status, 'fail');
  assert.equal(result.steps.length, 1);
  assert.equal(existsSync(marker), false);
});

test('expected rejection needs both the finding and the expected exit', async () => {
  assert.equal((await runStep(node("console.log('defect found');process.exit(1)", { expectedExit: 1, expectedOutput: 'defect found' }))).status, 'pass');
  assert.equal((await runStep(node("console.log('browser unavailable');process.exit(1)", { expectedExit: 1, expectedOutput: 'defect found' }))).status, 'fail');
  assert.equal((await runStep(node("console.log('SKIPPED');process.exit(1)", { expectedExit: 1 }))).status, 'skipped');
});

test('arguments stay literal and file globs expand without a shell', async t => {
  const cwd = dir(t), arg = 'literal 日本語 & $(echo injected) * ?';
  const literal = await runStep({ command: 'node', args: ['-e', 'console.log(process.argv[1])', arg] }, { cwd });
  assert.equal(literal.status, 'pass');
  assert.equal(literal.output.trim(), arg);
  writeFileSync(join(cwd, 'b.html'), 'b'); writeFileSync(join(cwd, 'a.html'), 'a');
  const glob = await runStep({ command: 'node', args: ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', '*.html'], expandGlobs: true }, { cwd });
  assert.deepEqual(JSON.parse(glob.output), ['a.html', 'b.html']);
  assert.equal((await runStep({ command: 'node', args: ['missing-*.html'], expandGlobs: true }, { cwd })).status, 'error');
});

test('timeouts and failed launches cannot count as expected failures', async () => {
  const timeout = await runStep(node('setInterval(()=>{},1000)', { expectedExit: 1 }), { timeoutMs: 100 });
  assert.equal(timeout.timedOut, true);
  assert.equal(timeout.status, 'timeout');
  assert.ok(timeout.elapsedMs < 8000);
  const missing = await runStep({ command: '__no_such_report_command__', args: [], expectedExit: 1 });
  assert.equal(missing.status, 'error');
  assert.equal(missing.code, null);
});

test('a subset is reported as partial and rejection receipts keep exit 1', async t => {
  const root = dir(t), file = join(root, 'bad.html'), receipts = [], logs = [];
  writeFileSync(file, '<p>bad fixture</p>');
  const step = { command: 'node', args: ['-e', "console.log('found');process.exit(1)", file], expectedExit: 1, expectedOutput: 'found' };
  const result = await runReport([['Negative fixture', [step]]], { root, totalChecks: 52, log: s => logs.push(s), recordReceipt: r => { receipts.push(r); return true; } });
  assert.equal(result.passed, 1);
  assert.equal(result.complete, false);
  assert.ok(logs.some(s => s.startsWith('PARTIAL:')));
  assert.ok(!logs.some(s => s.includes('100%')));
  assert.equal(receipts[0].exit, 1);
});

test('failure to record a measured file fails the report', async t => {
  const root = dir(t), file = join(root, 'page.html');
  writeFileSync(file, '<p>fixture</p>');
  const result = await runReport([['Receipt', [{ command: 'node', args: ['-e', 'process.exit(0)', file] }]]], { root, log: () => {}, recordReceipt: () => false });
  assert.equal(result.exitCode, 1);
});

test('Bash absence is explicit and REQUIRE_BASH makes it a failure', () => {
  const file = join(ROOT, 'tests/integration/hooks-bash.test.mjs');
  const env = { BASH_BIN: '__missing_bash__', REQUIRE_BASH: '', NODE_TEST_CONTEXT: undefined };
  const skipped = run('node', ['--test', file], { env });
  assert.equal(skipped.status, 0, skipped.out);
  assert.match(skipped.out, /NOT verified/);
  const required = run('node', ['--test', file], { env: { ...env, REQUIRE_BASH: '1' } });
  assert.notEqual(required.status, 0);
  assert.match(required.out, /needs a working Bash/);
});

test('test titles mentioning SKIPPED are distinct from actually skipped tests', async t => {
  const cwd = dir(t), file = join(cwd, 'fixture.test.mjs');
  writeFileSync(file, "import {test} from 'node:test';test('SKIPPED is just a title',()=>{});\n");
  const passed = await runStep({ command: 'node', args: ['--test', file] }, { cwd });
  assert.equal(passed.status, 'pass', passed.output);
  assert.ok(passed.args.includes('--test-reporter=tap'));
  writeFileSync(file, "import {test} from 'node:test';test('not measured',{skip:true},()=>{});\n");
  const skipped = await runStep({ command: 'node', args: ['--test', file] }, { cwd });
  assert.equal(skipped.status, 'skipped', skipped.output);
});

test('progress checkpoints remain incomplete until the whole selected plan finishes', async () => {
  const snapshots = [];
  const result = await runReport([['first', [node('process.exit(0)')]], ['second', [node('process.exit(1)')]]], {
    log: () => {}, onResult: progress => snapshots.push(JSON.parse(JSON.stringify(progress))),
  });
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].completedChecks, 1);
  assert.equal(snapshots[0].results.length, 1);
  assert.ok(snapshots.every(s => s.complete === false && s.state === 'running'));
  assert.equal(result.state, 'finished');
  assert.equal(result.failed, 1);
});
