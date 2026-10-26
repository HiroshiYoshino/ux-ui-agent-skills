/**
 * The Codex plugin on a real Codex client.
 *
 * tests/meta/codex-plugin.test.mjs proves the files satisfy a contract. This
 * proves a client accepts them: it runs the actual `codex` CLI (and its
 * app-server, which is what the desktop app and IDE extension also drive)
 * against an isolated copy of the repository under a spaced, Japanese path, with
 * its own CODEX_HOME, from a project directory that is not the repository.
 *
 * It needs the `codex` binary and no login: adding a marketplace, adding a
 * plugin and listing skills, hooks and MCP servers touch no model. When the
 * binary is absent every test here is SKIPPED, and a skip is not a pass: set
 * REQUIRE_CODEX=1 (CI does) and a missing binary fails instead. The version
 * under test is printed, because a result is only true of the client that gave it.
 *
 *   npm i -g @openai/codex   (or CODEX_BIN=/path/to/codex)
 *   REQUIRE_CODEX=1 node --test tests/cli/codex-plugin-live.test.mjs
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appServer, codex, findCodex, isolatedCheckout, tempDir } from '../helpers/codex-plugin.mjs';
import { ROOT } from '../helpers/run.mjs';

const client = findCodex();
const required = process.env.REQUIRE_CODEX === '1';
const MARKET = 'hiroshiyoshino-ux-ui-agent-skills';
const PLUGIN = 'ux-ui-agent-skills-codex';
const ID = `${PLUGIN}@${MARKET}`;
const SKILLS = '.codex-plugin/skills';
const wanted = readdirSync(join(ROOT, SKILLS), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const USER_CONFIG = 'model = "the-users-own-choice"\n\n[projects."/somewhere/the/user/trusted"]\ntrust_level = "trusted"\n';

let kit, kitBase, home, project;
const cx = (args, opts = {}) => codex(client.bin, home, args, { cwd: project, ...opts });
const skipUnless = () => (client ? false : 'no codex binary: NOT verified (set REQUIRE_CODEX=1 to make this a failure)');
const opts = { timeout: 600000, skip: skipUnless() };

if (required && !client) {
  test('REQUIRE_CODEX=1 needs a codex binary', () => assert.fail('no codex binary found (CODEX_BIN or PATH): nothing was verified'));
}

before(() => {
  if (!client) {
    console.log('# codex not found: the live tests are SKIPPED, which verifies nothing');
    return;
  }
  console.log(`# client: ${client.version} on ${process.platform}/${process.arch}`);
  kitBase = tempDir('codex-kit');
  kit = isolatedCheckout(kitBase);
  const base = tempDir('codex-live');
  home = join(base, 'codex home');
  project = join(base, '利用先 プロジェクト');
  mkdirSync(home, { recursive: true });
  mkdirSync(project, { recursive: true });
  writeFileSync(join(home, 'config.toml'), USER_CONFIG);
});

test('the marketplace is added by path and Codex finds the catalog', opts, () => {
  const add = cx(['plugin', 'marketplace', 'add', kit]);
  assert.equal(add.status, 0, add.out);
  assert.match(add.out, new RegExp(`Added marketplace \`${MARKET}\``));
  const list = cx(['plugin', 'list']);
  assert.equal(list.status, 0, list.out);
  assert.ok(list.out.includes('.agents/plugins/marketplace.json'), `Codex used another catalog:\n${list.out}`);
  assert.match(list.out, new RegExp(`${ID}\\s+not installed`));
});

test('the plugin is added, and nothing the user wrote is touched', opts, () => {
  const add = cx(['plugin', 'add', ID]);
  assert.equal(add.status, 0, add.out);
  const manifest = JSON.parse(readFileSync(join(kit, '.codex-plugin/plugin.json'), 'utf8'));
  assert.ok(add.out.includes(manifest.version), add.out);
  const config = readFileSync(join(home, 'config.toml'), 'utf8');
  assert.ok(config.startsWith(USER_CONFIG.trimEnd()), `the user's config was rewritten:\n${config}`);
  assert.match(config, new RegExp(`\\[plugins\\."${ID}"\\]\\nenabled = true`));
  assert.equal(existsSync(join(project, 'AGENTS.md')), false, 'adding a plugin wrote into the project');
});

test('the skills are discovered from the project, under the plugin namespace', opts, async () => {
  const r = await appServer(client.bin, home, project, [['skills/list', { cwds: [project], forceReload: true }]]);
  const entry = r['skills/list'].data[0];
  assert.deepEqual(entry.errors, []);
  const ours = entry.skills.filter((s) => s.pluginId === ID);
  assert.deepEqual(ours.map((s) => s.name.replace(`${PLUGIN}:`, '')).sort(), wanted);
  assert.ok(ours.every((s) => s.enabled && s.path.includes('/plugins/cache/')), 'a skill was read from somewhere other than the plugin cache');
  assert.ok(ours.every((s) => !s.path.startsWith(kit)), 'the skills were read from the original checkout');
});

test('hooks are not loaded, and the Claude Code hooks do not leak in', opts, async () => {
  const r = await appServer(client.bin, home, project, [['hooks/list', { cwds: [project] }]]);
  const entry = r['hooks/list'].data[0];
  assert.deepEqual(entry.errors, []);
  assert.deepEqual(entry.hooks.filter((h) => h.pluginId === ID), []);
});

test('the MCP server starts from the plugin root and offers its tools', opts, async () => {
  const r = await appServer(client.bin, home, project, [['mcpServerStatus/list', { cwd: project }]]);
  const server = r['mcpServerStatus/list'].data.find((s) => s.pluginId === ID);
  assert.ok(server, 'the plugin\'s MCP server is not listed');
  assert.equal(server.name, 'ux-ui-kit');
  assert.ok(['run_gate', 'review_ui', 'get_tokens'].every((t) => t in server.tools), Object.keys(server.tools).join(','));
});

test('the installed plugin does not need the checkout it came from', opts, async () => {
  rmSync(kit, { recursive: true, force: true });
  const r = await appServer(client.bin, home, project, [['skills/list', { cwds: [project], forceReload: true }]]);
  const ours = r['skills/list'].data[0].skills.filter((s) => s.pluginId === ID);
  assert.equal(ours.length, wanted.length);
  assert.ok(existsSync(join(ours[0].path)), 'the installed skill is not on disk');
});

test('an update replaces the pinned version and leaves the user\'s config alone', opts, () => {
  // The checkout comes back at the same path with a newer manifest: that is what a `git pull` does.
  kit = isolatedCheckout(kitBase);
  const manifestPath = join(kit, '.codex-plugin/plugin.json');
  const next = readFileSync(manifestPath, 'utf8').replace(/"version": "([^"]+)"/, '"version": "$1.next"');
  writeFileSync(manifestPath, next);
  const again = cx(['plugin', 'add', ID]);
  assert.equal(again.status, 0, again.out);
  assert.match(again.out, /\.next/);
  const cache = join(home, 'plugins/cache', MARKET, PLUGIN);
  assert.equal(readdirSync(cache).length, 1, 'the superseded version was left behind');
  assert.ok(readFileSync(join(home, 'config.toml'), 'utf8').startsWith(USER_CONFIG.trimEnd()));
});

test('removing the plugin and the marketplace restores the user\'s config and spares the source', opts, () => {
  const rm = cx(['plugin', 'remove', ID]);
  assert.equal(rm.status, 0, rm.out);
  const rmMarket = cx(['plugin', 'marketplace', 'remove', MARKET]);
  assert.equal(rmMarket.status, 0, rmMarket.out);
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8').trim(), USER_CONFIG.trim());
  assert.ok(existsSync(join(kit, '.codex-plugin/plugin.json')), 'removal touched the source checkout');
  assert.ok(!existsSync(join(home, 'plugins/cache', MARKET, PLUGIN)), 'the plugin cache survived removal');
});

test('failure is a failure: no network, a missing path and an unknown plugin all exit non-zero', opts, () => {
  const before = readFileSync(join(home, 'config.toml'), 'utf8');
  const offline = cx(['plugin', 'marketplace', 'add', 'https://127.0.0.1:1/HiroshiYoshino/ux-ui-agent-skills.git']);
  assert.notEqual(offline.status, 0, offline.out);
  const missing = cx(['plugin', 'marketplace', 'add', join(project, 'does-not-exist')]);
  assert.notEqual(missing.status, 0, missing.out);
  cx(['plugin', 'marketplace', 'add', kit]);
  const unknown = cx(['plugin', 'add', `nothing@${MARKET}`]);
  assert.notEqual(unknown.status, 0, unknown.out);
  cx(['plugin', 'marketplace', 'remove', MARKET]);
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), before);
});

test('a source that is not a marketplace is refused', opts, () => {
  const empty = join(tempDir('codex-empty'), 'not a marketplace');
  mkdirSync(empty, { recursive: true });
  const r = cx(['plugin', 'marketplace', 'add', empty]);
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /supported manifest|marketplace/i);
});
