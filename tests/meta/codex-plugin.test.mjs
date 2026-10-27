/**
 * The Codex plugin distribution: the contract a git checkout has to satisfy.
 *
 * Codex adds this repository as a marketplace (`codex plugin marketplace add
 * HiroshiYoshino/ux-ui-agent-skills`), then installs the plugin from it. It runs
 * no build and reads no developer checkout, so every claim here is about what a
 * clone contains: the catalog, the manifest, the generated skills, the assets
 * they name, and the things the plugin must NOT switch on (hooks).
 *
 * These tests need no Codex. They prove the files are right and reproducible;
 * they do not prove a client accepted them. That is tests/cli/codex-plugin-live
 * (real Codex, skipped loudly when absent) and docs/CODEX-PLUGIN.md (recorded runs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, run } from '../helpers/run.mjs';
import { isolatedCheckout, tempDir } from '../helpers/codex-plugin.mjs';
import { validate } from '../../scripts/validate_codex_plugin.mjs';
import { build, check, write } from '../../scripts/build_codex_plugin.mjs';

const require = createRequire(import.meta.url);
const { portSkill, CLAUDE_ONLY } = require('../../bin/port-skills.js');

const json = (p, base = ROOT) => JSON.parse(readFileSync(join(base, p), 'utf8'));
const SKILLS = '.codex-plugin/skills';
const skillNames = (base = ROOT) => readdirSync(join(base, SKILLS), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

/** A mutable copy to break one thing in. Copies only what the contract reads. */
function scratch() {
  const dir = join(tempDir('codex-broken'), 'kit');
  for (const rel of ['.agents', '.codex-plugin', '.claude/skills', 'bin', 'scripts', 'hooks', 'mcp', 'tokens', 'LICENSE', 'package.json', 'AGENTS.md', 'taste', 'design-systems/library.json', 'components', 'frameworks', 'accessibility', 'content', 'workflows', '.claude/rules', 'reference', 'templates']) {
    if (existsSync(join(ROOT, rel))) { mkdirSync(join(dir, rel, '..'), { recursive: true }); cpSync(join(ROOT, rel), join(dir, rel), { recursive: true }); }
  }
  return dir;
}

test('the committed distribution satisfies the contract', () => {
  assert.deepEqual(validate(ROOT), []);
});

test('the catalog is where Codex looks first, and git will carry it', () => {
  // .agents/ is ignored for locally installed skill bundles; the catalog is the exception.
  const ignored = spawnSync('git', ['check-ignore', '-q', '.agents/plugins/marketplace.json'], { cwd: ROOT });
  assert.equal(ignored.status, 1, '.agents/plugins/marketplace.json is git-ignored, so a clone would not contain it');
  const stillIgnored = spawnSync('git', ['check-ignore', '-q', '.agents/skills/x/SKILL.md'], { cwd: ROOT });
  assert.equal(stillIgnored.status, 0, 'locally installed .agents/skills must stay ignored');
});

test('Codex reads this catalog and not the Claude Code one', () => {
  // Codex tries .agents/plugins/marketplace.json before .claude-plugin/marketplace.json.
  // The Claude catalog stays exactly what Claude Code needs.
  const claude = json('.claude-plugin/marketplace.json');
  assert.equal(claude.plugins[0].name, 'ux-ui-agent-skills');
  assert.equal(json('.claude-plugin/plugin.json').skills, './.claude/skills');
  const codexMarket = json('.agents/plugins/marketplace.json');
  assert.notEqual(codexMarket.name, claude.name);
  assert.notEqual(codexMarket.plugins[0].name, claude.plugins[0].name);
});

test('the plugin says what it is, where it came from and what it is not', () => {
  const m = json('.codex-plugin/plugin.json');
  const pkg = json('package.json');
  assert.match(m.version, /^\d+\.\d+\.\d+-codex\.\d+$/);
  assert.ok(m.version.startsWith(`${pkg.version}-`));
  assert.equal(m.repository, 'https://github.com/HiroshiYoshino/ux-ui-agent-skills');
  assert.notEqual(m.name, pkg.name, 'the plugin must not share the npm package name');
  assert.match(m.interface.developerName, /HiroshiYoshino/);
  assert.match(m.interface.longDescription, /plugin87\/ux-ui-agent-skills/);
  assert.match(m.interface.longDescription, /does not ship the Claude Code hooks/);
  assert.equal(m.license, 'MIT');
  assert.match(readFileSync(join(ROOT, 'LICENSE'), 'utf8'), /Thientan Soparat/);
});

test('the changelog records the plugin version, which is what an update is keyed on', () => {
  const v = json('.codex-plugin/plugin.json').version;
  assert.ok(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').includes(v), `CHANGELOG.md never mentions ${v}`);
});

test('every Claude skill is either ported or excluded with a reason', () => {
  const caps = json('.codex-plugin/capabilities.json');
  const source = readdirSync(join(ROOT, '.claude/skills')).filter((n) => existsSync(join(ROOT, '.claude/skills', n, 'SKILL.md'))).sort();
  assert.deepEqual(skillNames(), source.filter((n) => !(n in CLAUDE_ONLY)));
  assert.deepEqual(Object.keys(caps.skills.excluded).sort(), Object.keys(CLAUDE_ONLY).sort());
  for (const n of Object.keys(CLAUDE_ONLY)) assert.ok(!skillNames().includes(n), `${n} needs Claude Code and must not be offered`);
});

test('commands the user starts stay user-started: the model may not invoke them', () => {
  const caps = json('.codex-plugin/capabilities.json');
  assert.ok(caps.skills.explicitInvocationOnly.length > 0);
  for (const n of caps.skills.explicitInvocationOnly) {
    assert.equal(readFileSync(join(ROOT, SKILLS, n, 'agents/openai.yaml'), 'utf8'), 'policy:\n  allow_implicit_invocation: false\n');
  }
  for (const n of skillNames().filter((s) => !caps.skills.explicitInvocationOnly.includes(s))) {
    assert.ok(!existsSync(join(ROOT, SKILLS, n, 'agents')), `${n} gained a policy it never asked for`);
  }
});

test('hooks are not enabled, and the root hooks.json cannot leak in', () => {
  const m = json('.codex-plugin/plugin.json');
  assert.deepEqual(m.hooks, {});
  assert.ok(existsSync(join(ROOT, 'hooks/hooks.json')), 'this test exists because the Claude Code hooks sit at the plugin root');
  assert.equal(json('.codex-plugin/capabilities.json').hooks.enabled, false);
  assert.match(m.interface.shortDescription, /no hooks/i);
});

test('the port keeps the other targets as they were', () => {
  const src = readFileSync(join(ROOT, '.claude/skills/design-tokens/SKILL.md'), 'utf8');
  assert.ok(!portSkill(src, '').includes('<plugin-root>'));
  assert.ok(!portSkill(src, '${extensionPath}/').includes('<plugin-root>'));
  assert.ok(portSkill(src, '<plugin-root>/', 'codex').includes('<plugin-root>/tokens'));
  assert.match(portSkill(src, '').split('\n').find((l) => l.startsWith('> Where it says')), /GEMINI\.md/);
});

test('Codex skill instructions verify project output, not the kit self-test or plugin assets', () => {
  const generated = skillNames().map((name) => [
    name,
    readFileSync(join(ROOT, SKILLS, name, 'SKILL.md'), 'utf8'),
  ]);
  const combined = generated.map(([, text]) => text).join('\n');
  assert.match(combined, /absolute path of the user's project/i);
  assert.match(combined, /accuracy_report\.mjs` is only the kit's self-test/i);
  assert.doesNotMatch(combined, /node <plugin-root>\/scripts\/accuracy_report\.mjs/);
  assert.doesNotMatch(combined, /`npm run verify` is 100%/);
  assert.match(combined, /DS_REQUIRE_BROWSER=1 UX_UI_PROJECT_ROOT=/);
  assert.match(combined, /UX_UI_PROJECT_ROOT="<project-root>" node <plugin-root>\/scripts\/gate\.mjs/);
  assert.match(combined, /<plugin-root>\/scripts\/validate_tokens\.py "<project-root>\/tokens"/);
  assert.match(combined, /<plugin-root>\/scripts\/validate_contrast\.py "<project-root>\/tokens\/colors\.json"/);
  assert.match(combined, /<plugin-root>\/scripts\/validate_theme_refs\.py --theme "<project-root>\/theme\.css" "<project-root>\/src"/);
  assert.match(combined, /<project-root>\/tokens\/\*\.json/);
  const brandkit = readFileSync(join(ROOT, SKILLS, 'brandkit/SKILL.md'), 'utf8');
  assert.doesNotMatch(brandkit, /Emit.*<plugin-root>\/tokens/);
  assert.match(brandkit, /Emit.*<project-root>\/tokens/);
});

test('generation is reproducible: same input, byte-identical output', () => {
  assert.deepEqual(check(ROOT), []);
  const a = build(ROOT);
  const b = build(ROOT);
  assert.deepEqual([...a], [...b]);
});

/* ------------------------------------------------ broken input is rejected */

const breakIt = (name, mutate, expect) => test(`REJECTS: ${name}`, () => {
  const dir = scratch();
  mutate(dir);
  const problems = validate(dir);
  assert.ok(problems.length > 0, 'nothing was reported: this is not a pass');
  assert.ok(problems.some((p) => expect.test(p)), `expected ${expect}, got:\n  ${problems.join('\n  ')}`);
});

const edit = (dir, rel, fn) => { const p = join(dir, rel); writeFileSync(p, fn(readFileSync(p, 'utf8'))); };
const editJson = (dir, rel, fn) => edit(dir, rel, (t) => { const o = JSON.parse(t); fn(o); return `${JSON.stringify(o, null, 2)}\n`; });

breakIt('a manifest that is not valid JSON', (d) => writeFileSync(join(d, '.codex-plugin/plugin.json'), '{ nope'), /not valid JSON/);
breakIt('a missing manifest', (d) => rmSync(join(d, '.codex-plugin/plugin.json')), /plugin\.json is missing/);
breakIt('a missing catalog', (d) => rmSync(join(d, '.agents/plugins/marketplace.json')), /marketplace\.json is missing/);
breakIt('an unsupported plugin version', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { o.version = 'latest'; }), /unsupported plugin version/);
breakIt('a version that looks like the npm release', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { o.version = '3.0.0'; }), /prerelease of the kit version/);
breakIt('the upstream plugin name', (d) => { editJson(d, '.codex-plugin/plugin.json', (o) => { o.name = 'ux-ui-agent-skills'; }); editJson(d, '.agents/plugins/marketplace.json', (o) => { o.plugins[0].name = 'ux-ui-agent-skills'; }); }, /differ from the upstream/);
breakIt('a catalog entry that names another plugin', (d) => editJson(d, '.agents/plugins/marketplace.json', (o) => { o.plugins[0].name = 'other'; }), /does not match the manifest name/);
breakIt('a source path without ./', (d) => editJson(d, '.agents/plugins/marketplace.json', (o) => { o.plugins[0].source.path = 'plugins/x'; }), /must start with "\.\/"/);
breakIt('a source path that leaves the repository', (d) => editJson(d, '.agents/plugins/marketplace.json', (o) => { o.plugins[0].source.path = './../elsewhere'; }), /stay in the repository/);
breakIt('a remote source this contract does not cover', (d) => editJson(d, '.agents/plugins/marketplace.json', (o) => { o.plugins[0].source = { source: 'url', url: 'https://example.com/x.git' }; }), /only a local source/);
breakIt('an unknown install policy', (d) => editJson(d, '.agents/plugins/marketplace.json', (o) => { o.plugins[0].policy.installation = 'ALWAYS'; }), /unknown policy\.installation/);
breakIt('a skills path that is missing', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { o.skills = './nope'; }), /does not exist/);
breakIt('a skills path without ./', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { o.skills = '.codex-plugin/skills'; }), /must be a string starting with "\.\/"/);
breakIt('a path that escapes the plugin root', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { o.mcpServers = './../../etc/passwd'; }), /escapes the plugin root|does not exist/);
breakIt('hooks left to the default, which would load the Claude Code hooks', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { delete o.hooks; }), /Claude Code hooks/);
breakIt('hooks switched on', (d) => editJson(d, '.codex-plugin/plugin.json', (o) => { o.hooks = './hooks/hooks.json'; }), /Claude Code hooks/);
breakIt('capabilities claiming hooks are enabled', (d) => editJson(d, '.codex-plugin/capabilities.json', (o) => { o.hooks.enabled = true; }), /hooks are not enabled/);
breakIt('a skill whose asset went missing', (d) => rmSync(join(d, 'tokens/colors.json')), /not in the plugin/);
breakIt('a missing skill directory (stale output)', (d) => rmSync(join(d, SKILLS, 'gate'), { recursive: true }), /missing: \.codex-plugin\/skills\/gate/);
breakIt('a hand-edited generated skill', (d) => edit(d, `${SKILLS}/design-tokens/SKILL.md`, (t) => `${t}\nextra\n`), /differs/);
breakIt('a stale generated file', (d) => writeFileSync(join(d, SKILLS, 'gate', 'old.md'), 'x'), /stale/);
breakIt('a Claude-only skill that slipped in', (d) => { mkdirSync(join(d, SKILLS, 'critique'), { recursive: true }); writeFileSync(join(d, SKILLS, 'critique/SKILL.md'), '---\nname: critique\ndescription: x\n---\n'); }, /stale|critique/);
breakIt('a skill still carrying a Claude Code variable', (d) => edit(d, `${SKILLS}/gate/SKILL.md`, (t) => `${t}\n\${CLAUDE_SKILL_DIR}/x\n`), /Claude Code substitution/);
breakIt('a skill whose name does not match its directory', (d) => edit(d, `${SKILLS}/gate/SKILL.md`, (t) => t.replace('name: gate', 'name: other')), /does not match its directory/);
breakIt('an MCP server script that is missing', (d) => rmSync(join(d, 'mcp/server.mjs')), /does not exist relative to its cwd/);
breakIt('an MCP config with an embedded credential', (d) => editJson(d, '.codex-plugin/mcp.json', (o) => { o.mcpServers['ux-ui-kit'].env.FIGMA_API_KEY = 'figd_abcdefghijklmnop'; }), /embedded credential/);
breakIt('a license that lost its author', (d) => writeFileSync(join(d, 'LICENSE'), 'MIT License\n'), /original copyright holder/);
breakIt('a missing generator source', (d) => rmSync(join(d, 'bin/port-skills.js')), /cannot be reproduced/);

/* -------------------------- a checkout somewhere else, run from somewhere else */

test('from an isolated checkout under a spaced, Japanese path, run from an unrelated cwd', () => {
  const kit = isolatedCheckout();
  assert.match(kit, /取得先 cache/);
  assert.ok(kit.includes(' '));
  const elsewhere = tempDir('cwd-elsewhere');
  const v = spawnSync('node', [join(kit, 'scripts/validate_codex_plugin.mjs')], { cwd: elsewhere, encoding: 'utf8' });
  assert.equal(v.status, 0, v.stdout + v.stderr);
  const c = spawnSync('node', [join(kit, 'scripts/build_codex_plugin.mjs'), '--check'], { cwd: elsewhere, encoding: 'utf8' });
  assert.equal(c.status, 0, c.stdout + c.stderr);
  // The kit does not reach back to the repository it was copied from.
  assert.ok(!(v.stdout + c.stdout).includes(ROOT));
});

test('explicit project token validation finds the bad project tokens and leaves plugin files untouched', () => {
  const kit = isolatedCheckout();
  const project = join(tempDir('project'), '利用先 tokens');
  const elsewhere = tempDir('cwd-elsewhere');
  mkdirSync(join(project, 'tokens'), { recursive: true });
  writeFileSync(join(project, 'tokens/colors.json'), JSON.stringify({
    color: { invalid: { $value: '{missing.reference}' } },
  }));
  assert.equal(existsSync(join(kit, 'node_modules')), false, 'the isolated plugin has no node_modules');

  const snapshot = (root) => {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else files.push([path.slice(root.length + 1), readFileSync(path)]);
      }
    };
    walk(root);
    return files.sort(([a], [b]) => a.localeCompare(b));
  };
  const pluginFiles = snapshot(kit);
  const kitValid = spawnSync('python3', [join(kit, 'scripts/validate_tokens.py'), join(kit, 'tokens')], {
    cwd: elsewhere, encoding: 'utf8',
  });
  assert.equal(kitValid.status, 0, kitValid.stdout + kitValid.stderr);
  const projectInvalid = spawnSync('python3', [
    join(kit, 'scripts/validate_tokens.py'), join(project, 'tokens'),
  ], { cwd: elsewhere, encoding: 'utf8' });
  assert.equal(projectInvalid.status, 1, projectInvalid.stdout + projectInvalid.stderr);
  assert.match(projectInvalid.stdout + projectInvalid.stderr, /missing\.reference/);
  assert.deepEqual(snapshot(kit), pluginFiles, 'validation changed a plugin file');
});

test('browser gate dependency resolution uses project_root from an unrelated cwd', () => {
  const kit = isolatedCheckout();
  const project = join(tempDir('project'), '利用先 project');
  const elsewhere = tempDir('cwd-elsewhere');
  const moduleDir = join(project, 'node_modules/playwright');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(moduleDir, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.cjs' }));
  writeFileSync(join(moduleDir, 'index.cjs'), `module.exports = { source: __dirname };\n`);
  assert.equal(existsSync(join(kit, 'node_modules')), false, 'the isolated plugin has no node_modules');
  const probe = [
    `import { loadPlaywright } from ${JSON.stringify(pathToFileURL(join(kit, 'scripts/_playwright.mjs')).href)};`,
    "console.log(loadPlaywright().source);",
  ].join('\n');
  const loaded = spawnSync('node', ['--input-type=module', '-e', probe], {
    cwd: elsewhere,
    encoding: 'utf8',
    env: { ...process.env, UX_UI_PROJECT_ROOT: project },
  });
  assert.equal(loaded.status, 0, loaded.stdout + loaded.stderr);
  assert.equal(loaded.stdout.trim(), moduleDir);
});

test('the build refuses to pass when the checkout is out of date, from any cwd', () => {
  const kit = isolatedCheckout();
  writeFileSync(join(kit, SKILLS, 'gate/SKILL.md'), 'edited by a user');
  const c = spawnSync('node', [join(kit, 'scripts/build_codex_plugin.mjs'), '--check'], { cwd: tempDir('cwd'), encoding: 'utf8' });
  assert.equal(c.status, 1);
  assert.match(c.stderr, /differs: \.codex-plugin\/skills\/gate\/SKILL\.md/);
});

test('an update rewrites only what the build owns', () => {
  const kit = isolatedCheckout();
  const project = tempDir('project');
  const userFiles = {
    [join(project, 'AGENTS.md')]: 'my own rules\n',
    [join(project, '.codex/config.toml')]: 'model = "mine"\n',
    [join(kit, 'docs/NOTES-by-user.md')]: 'unmanaged\n',
    [join(kit, '.codex-plugin/plugin.json.bak')]: 'unmanaged\n',
  };
  for (const [p, t] of Object.entries(userFiles)) { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, t); }
  writeFileSync(join(kit, SKILLS, 'removed-skill.md'), 'stale');
  mkdirSync(join(kit, SKILLS, 'gone'), { recursive: true });
  writeFileSync(join(kit, SKILLS, 'gone/SKILL.md'), 'stale');
  const before = readFileSync(join(kit, '.codex-plugin/plugin.json'), 'utf8');
  write(kit);
  for (const [p, t] of Object.entries(userFiles)) assert.equal(readFileSync(p, 'utf8'), t, `${p} was touched`);
  assert.equal(readFileSync(join(kit, '.codex-plugin/plugin.json'), 'utf8'), before, 'the hand-written manifest was rewritten');
  assert.ok(!existsSync(join(kit, SKILLS, 'gone')) && !existsSync(join(kit, SKILLS, 'removed-skill.md')), 'stale generated output survived an update');
  assert.deepEqual(check(kit), []);
});

/* --------------------------------------------- the MCP server, as the plugin runs it */

function mcpCall(kit, cwd, env, name, args) {
  const msgs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } },
  ];
  const r = spawnSync('node', [join(kit, 'mcp/server.mjs')], { cwd, input: `${msgs.map((m) => JSON.stringify(m)).join('\n')}\n`, encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env } });
  const reply = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.id === 2);
  assert.ok(reply, `no reply: ${r.stderr}`);
  return reply.result;
}

test('MCP: the plugin root is the server cwd, so relative project paths are refused, not mis-read', () => {
  const kit = isolatedCheckout();
  const env = JSON.parse(readFileSync(join(kit, '.codex-plugin/mcp.json'), 'utf8')).mcpServers['ux-ui-kit'].env;
  const project = join(tempDir('project'), 'プロジェクト 1');
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, 'page.html'), '<p>plain</p>\n');
  // Run as Codex runs it: cwd is the plugin root (the manifest's "cwd": ".").
  const relative = mcpCall(kit, kit, env, 'run_gate', { gate: 'check_no_emoji', paths: ['page.html'] });
  assert.equal(relative.isError, true);
  assert.match(relative.content[0].text, /Relative path refused/);
  assert.match(relative.content[0].text, /not a pass/);
  const absolute = mcpCall(kit, kit, env, 'run_gate', { gate: 'check_no_emoji', paths: [join(project, 'page.html')] });
  assert.notEqual(absolute.isError, true, absolute.content[0].text);
  assert.match(absolute.content[0].text, /check_no_emoji exited 0/);
});

test('MCP: outside the plugin the server keeps its documented relative-path behaviour', () => {
  const project = tempDir('project');
  writeFileSync(join(project, 'page.html'), '<p>plain</p>\n');
  const r = mcpCall(ROOT, project, { UX_UI_MCP_ABSOLUTE_PATHS: '' }, 'run_gate', { gate: 'check_no_emoji', paths: ['page.html'] });
  assert.equal(r.isError, false, JSON.stringify(r));
  assert.match(r.content[0].text, /exited 0/);
});

test('MCP browser gates require project_root and resolve Playwright from it', () => {
  const kit = isolatedCheckout();
  const env = JSON.parse(readFileSync(join(kit, '.codex-plugin/mcp.json'), 'utf8')).mcpServers['ux-ui-kit'].env;
  const project = join(tempDir('project'), '利用先 project');
  const moduleDir = join(project, 'node_modules/playwright');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(moduleDir, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.cjs' }));
  writeFileSync(join(moduleDir, 'index.cjs'), `module.exports = { chromium: { launch: () => { throw new Error('project-playwright-stub-loaded'); } } };\n`);
  const page = join(project, 'page.html');
  writeFileSync(page, '<button>Save</button>\n');

  const missing = mcpCall(kit, kit, env, 'run_gate', { gate: 'verify_states', paths: [page] });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /absolute project_root is required/);
  assert.match(missing.content[0].text, /Nothing was measured/);
  const missingReviewRoot = mcpCall(kit, kit, env, 'review_ui', { paths: [page] });
  assert.equal(missingReviewRoot.isError, true);
  assert.match(missingReviewRoot.content[0].text, /absolute project_root is required/);

  const result = mcpCall(kit, kit, env, 'run_gate', {
    gate: 'verify_states', paths: [page], project_root: project,
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /project-playwright-stub-loaded/);
  assert.doesNotMatch(result.content[0].text, /playwright not installed/);
});

/* ------------------------------------------------ the routes that already existed */

test('init --agent codex still installs AGENTS.md and the gates, and never the plugin', () => {
  const dest = tempDir('codex-init');
  writeFileSync(join(dest, 'keep.txt'), 'mine\n');
  const r = run('node', ['bin/cli.js', 'init', dest, '--agent', 'codex']);
  assert.equal(r.status, 0, r.out);
  assert.ok(existsSync(join(dest, 'AGENTS.md')));
  assert.ok(existsSync(join(dest, 'scripts/validate_tokens.py')));
  assert.ok(!existsSync(join(dest, 'CLAUDE.md')));
  assert.ok(!existsSync(join(dest, '.codex-plugin')), 'the legacy route must not install a plugin manifest');
  assert.ok(!existsSync(join(dest, '.agents/plugins')), 'the legacy route must not install a catalog');
  assert.equal(readFileSync(join(dest, 'keep.txt'), 'utf8'), 'mine\n');
});

test('the Claude Code plugin still loads the skills it always did', () => {
  const m = json('.claude-plugin/plugin.json');
  assert.equal(m.skills, './.claude/skills');
  assert.ok(readdirSync(join(ROOT, '.claude/skills')).length >= 26);
  assert.ok(!('hooks' in m) || m.hooks !== '{}');
});
