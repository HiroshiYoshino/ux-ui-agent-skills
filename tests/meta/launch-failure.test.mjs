/**
 * Every render gate must FAIL when a browser cannot launch and
 * DS_REQUIRE_BROWSER=1 is set.
 *
 * guards.test.mjs covers the case where `playwright` itself will not import.
 * This covers the one after it: the package imports, and launch() throws.
 * measure_render.mjs exited 0 with SKIPPED here (#25), and through gate.mjs
 * that left a receipt the Stop hook accepted - a pass for a run that measured
 * nothing.
 */
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT } from '../helpers/run.mjs';

const register = join(ROOT, 'tests/fixtures/no-browser/register.mjs');
const page = join(ROOT, 'examples/sample-app/preview.html');
const gates = readdirSync(join(ROOT, 'scripts'))
  .filter(f => f.endsWith('.mjs'))
  .filter(f => f !== '_playwright.mjs')
  .filter(f => {
    const source = readFileSync(join(ROOT, 'scripts', f), 'utf8');
    return source.includes('loadPlaywright()')
      || /from ['"]playwright['"]|import\(['"]playwright['"]\)/.test(source);
  });

const projectRoot = mkdtempSync(join(tmpdir(), 'ux-ui-no-launch-project-'));
mkdirSync(join(projectRoot, 'node_modules/playwright'), { recursive: true });
writeFileSync(join(projectRoot, 'node_modules/playwright/package.json'), JSON.stringify({
  name: 'playwright',
  main: 'index.cjs',
}));
writeFileSync(join(projectRoot, 'node_modules/playwright/index.cjs'),
  `module.exports = { chromium: { launch: () => { throw new Error('stub browser launch failed'); } } };\n`);
after(() => rmSync(projectRoot, { recursive: true, force: true }));

test('the stub finds the render gates', () => {
  assert.ok(gates.length >= 10, `only ${gates.length} gate(s) import playwright - is the filter wrong?`);
});

for (const gate of gates) {
  test(`${gate} fails, not skips, when no browser launches`, () => {
    const args = gate === 'verify_focustrap.mjs' ? [page, '--open=button'] : [page];
    const r = spawnSync('node', ['--import', register, join(ROOT, 'scripts', gate), ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, DS_REQUIRE_BROWSER: '1', UX_UI_PROJECT_ROOT: projectRoot },
    });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.notEqual(r.status, 0, `${gate} exited 0 with no browser:\n${out}`);
  });
}
