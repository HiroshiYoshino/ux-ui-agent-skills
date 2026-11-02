#!/usr/bin/env node
/**
 * Static contract for the Codex plugin distribution.
 *
 * Codex discovers this repository from `.agents/plugins/marketplace.json`, copies
 * the plugin root out of a git checkout, and reads `.codex-plugin/plugin.json`.
 * Nothing is built on the way. So every file the plugin needs has to be in the
 * checkout, every path in it has to be relative to the plugin root, and the
 * generated skills have to match their source. This checks all of that and exits
 * 1 on the first kind of drift, so a broken distribution fails here, not on a
 * user's machine.
 *
 * The rules mirror what the Codex client enforces, read in its source
 * (github.com/openai/codex, codex-rs/core-plugins, checked 2026-10-26) and run
 * against the 0.164.0 CLI: see docs/CODEX-PLUGIN.md for the sources.
 *
 *   node scripts/validate_codex_plugin.mjs [kit-root]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check as checkGenerated, SKILLS_DIR, CAPABILITIES_FILE } from './build_codex_plugin.mjs';

const MARKETPLACE = '.agents/plugins/marketplace.json';
const MANIFEST = '.codex-plugin/plugin.json';
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const INSTALLATION = ['NOT_AVAILABLE', 'AVAILABLE', 'INSTALLED_BY_DEFAULT'];
const AUTHENTICATION = ['ON_INSTALL', 'ON_USE'];
const PLUGIN_ROOT_REF = /<plugin-root>\/([A-Za-z0-9_./*-]*[A-Za-z0-9_*])/g;
const SECRET_KEY = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SECRET_VALUE = /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{16,})/;

const readJson = (p, problems, label) => {
  if (!existsSync(p)) { problems.push(`${label} is missing`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { problems.push(`${label} is not valid JSON: ${e.message}`); return null; }
};

/** A manifest path must be "./x", stay inside the root, and exist. */
function manifestPath(root, value, label, problems, { file = false } = {}) {
  if (typeof value !== 'string' || !value.startsWith('./')) { problems.push(`${label} must be a string starting with "./" (got ${JSON.stringify(value)})`); return null; }
  const abs = resolve(root, value);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) { problems.push(`${label} escapes the plugin root: ${value}`); return null; }
  if (!existsSync(abs)) { problems.push(`${label} points at ${value}, which does not exist`); return null; }
  if (file && !statSync(abs).isFile()) { problems.push(`${label} must be a file: ${value}`); return null; }
  return abs;
}

function frontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  return end < 0 ? null : text.slice(4, end);
}

function checkSkills(root, skillsDir, problems) {
  const names = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  if (!names.length) problems.push(`${SKILLS_DIR} holds no skill: a plugin with nothing to discover is not a pass`);
  for (const name of names) {
    const file = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(file)) { problems.push(`skill ${name} has no SKILL.md`); continue; }
    const text = readFileSync(file, 'utf8');
    const fm = frontmatter(text);
    if (fm === null) { problems.push(`skill ${name}: no frontmatter`); continue; }
    if (fm.match(/^name:\s*(\S+)\s*$/m)?.[1] !== name) problems.push(`skill ${name}: frontmatter name does not match its directory`);
    if (!/^description:\s*\S/m.test(fm)) problems.push(`skill ${name}: no description`);
    const left = text.match(/\$\{CLAUDE_[A-Z_]+\}|\$ARGUMENTS|\$CLAUDE_PROJECT_DIR/);
    if (left) problems.push(`skill ${name}: ${left[0]} is a Claude Code substitution and Codex fills in nothing`);
    for (const m of text.matchAll(PLUGIN_ROOT_REF)) {
      const rel = m[1].includes('*') ? m[1].split('*')[0] : m[1];
      if (!existsSync(join(root, rel))) problems.push(`skill ${name}: names <plugin-root>/${rel}, which is not in the plugin`);
    }
    if (!text.includes('<plugin-root>')) problems.push(`skill ${name}: never says where the plugin root is`);
    const meta = join(skillsDir, name, 'agents', 'openai.yaml');
    if (existsSync(meta) && !/^policy:\n {2}allow_implicit_invocation: false\n$/.test(readFileSync(meta, 'utf8'))) {
      problems.push(`skill ${name}: agents/openai.yaml is not the one policy this build writes`);
    }
  }
}

function checkMcp(root, file, problems) {
  const doc = readJson(file, problems, 'the MCP config');
  const servers = doc && (doc.mcpServers ?? doc);
  if (!servers || typeof servers !== 'object' || !Object.keys(servers).length) { problems.push('the MCP config declares no server'); return; }
  for (const [name, s] of Object.entries(servers)) {
    if (typeof s.command !== 'string' || !s.command) problems.push(`MCP server ${name}: no command`);
    if (s.cwd !== undefined && (typeof s.cwd !== 'string' || isAbsolute(s.cwd) || s.cwd.split('/').includes('..'))) {
      problems.push(`MCP server ${name}: cwd must stay inside the plugin root`);
    }
    const base = resolve(root, typeof s.cwd === 'string' ? s.cwd : '.');
    for (const a of s.args ?? []) {
      if (typeof a === 'string' && /\.(m?js|cjs)$/.test(a) && !isAbsolute(a) && !existsSync(join(base, a))) {
        problems.push(`MCP server ${name}: ${a} does not exist relative to its cwd`);
      }
    }
    for (const [k, v] of Object.entries(s.env ?? {})) {
      if ((SECRET_KEY.test(k) && !/^\$\{[A-Z0-9_]+\}$/.test(String(v))) || SECRET_VALUE.test(String(v))) {
        problems.push(`MCP server ${name}: env ${k} looks like an embedded credential; pass it by \${VAR} instead`);
      }
    }
  }
}

export function validate(kit) {
  const root = resolve(kit);
  const problems = [];

  const market = readJson(join(root, MARKETPLACE), problems, MARKETPLACE);
  const manifest = readJson(join(root, MANIFEST), problems, MANIFEST);
  if (!market || !manifest) return problems;

  if (typeof market.name !== 'string' || !SEGMENT.test(market.name)) problems.push('marketplace name is not a valid identifier');
  if (!Array.isArray(market.plugins) || !market.plugins.length) problems.push('marketplace lists no plugin');
  for (const p of market.plugins ?? []) {
    if (typeof p.name !== 'string' || !SEGMENT.test(p.name)) problems.push(`marketplace plugin name ${JSON.stringify(p.name)} is not a valid identifier`);
    const src = p.source;
    const path = typeof src === 'string' ? src : src?.source === 'local' ? src.path : undefined;
    if (path === undefined) problems.push(`plugin ${p.name}: this contract allows only a local source inside this repository`);
    else if (!path.startsWith('./') || relative(root, resolve(root, path)).startsWith('..')) {
      problems.push(`plugin ${p.name}: source path must start with "./" and stay in the repository (got ${path})`);
    } else if (resolve(root, path) !== root) {
      problems.push(`plugin ${p.name}: the plugin root must be the repository root, where the kit assets are (got ${path})`);
    }
    if (p.policy?.installation !== undefined && !INSTALLATION.includes(p.policy.installation)) problems.push(`plugin ${p.name}: unknown policy.installation ${p.policy.installation}`);
    if (p.policy?.authentication !== undefined && !AUTHENTICATION.includes(p.policy.authentication)) problems.push(`plugin ${p.name}: unknown policy.authentication ${p.policy.authentication}`);
    if (p.name !== manifest.name) problems.push(`marketplace plugin ${p.name} does not match the manifest name ${manifest.name}`);
  }

  if (typeof manifest.name !== 'string' || !SEGMENT.test(manifest.name)) problems.push('plugin name is not a valid identifier');
  if (manifest.name === 'ux-ui-agent-skills' || manifest.name === 'ux-ui-skills') problems.push('plugin name must differ from the upstream plugin and the npm package, so the three are never confused');
  if (typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)) problems.push(`unsupported plugin version ${JSON.stringify(manifest.version)}: it must be semver, and an installed plugin is pinned to it`);
  if (!/^https:\/\/github\.com\/HiroshiYoshino\/ux-ui-agent-skills$/.test(manifest.repository ?? '')) problems.push('repository must name where this plugin is fetched from and updated');
  if (manifest.license !== 'MIT' || !existsSync(join(root, 'LICENSE'))) problems.push('the MIT license and its LICENSE file must travel with the plugin');
  else if (!readFileSync(join(root, 'LICENSE'), 'utf8').includes('Thientan Soparat')) problems.push('LICENSE lost the original copyright holder');
  const pkg = readJson(join(root, 'package.json'), problems, 'package.json');
  if (pkg && typeof manifest.version === 'string' && !manifest.version.startsWith(`${pkg.version}-`)) {
    problems.push(`plugin version ${manifest.version} must be a prerelease of the kit version ${pkg.version}, so it is never mistaken for the npm release`);
  }

  const skillsDir = manifestPath(root, manifest.skills, 'manifest.skills', problems);
  if (skillsDir && resolve(skillsDir) !== resolve(root, SKILLS_DIR)) problems.push(`manifest.skills must be ${SKILLS_DIR}, the directory the build owns`);
  if (skillsDir) checkSkills(root, skillsDir, problems);

  // hooks/hooks.json sits at the root and Codex loads it when the manifest says nothing.
  if (existsSync(join(root, 'hooks', 'hooks.json'))
    && !(manifest.hooks && typeof manifest.hooks === 'object' && !Array.isArray(manifest.hooks) && Object.keys(manifest.hooks).length === 0)) {
    problems.push('hooks/hooks.json exists at the plugin root and Codex would load the Claude Code hooks: the manifest must declare "hooks": {}');
  }

  const mcp = manifestPath(root, manifest.mcpServers, 'manifest.mcpServers', problems, { file: true });
  if (mcp) checkMcp(root, mcp, problems);

  const iface = manifest.interface ?? {};
  const prompts = Array.isArray(iface.defaultPrompt) ? iface.defaultPrompt : iface.defaultPrompt ? [iface.defaultPrompt] : [];
  if (prompts.length > 3) problems.push('interface.defaultPrompt: Codex keeps at most 3 prompts');
  for (const pr of prompts) if (typeof pr !== 'string' || !pr.trim() || [...pr].length > 128) problems.push('interface.defaultPrompt: each prompt is 1 to 128 characters');
  if (!iface.displayName || !iface.developerName) problems.push('interface needs displayName and developerName, so the source and publisher are shown');

  const caps = readJson(join(root, CAPABILITIES_FILE), problems, CAPABILITIES_FILE);
  if (caps && caps.hooks?.enabled !== false) problems.push('capabilities must state that hooks are not enabled in the published plugin');

  for (const rel of ['.codex-plugin/plugin.json', '.codex-plugin/mcp.json', MARKETPLACE]) {
    if (SECRET_VALUE.test(readFileSync(join(root, rel), 'utf8'))) problems.push(`${rel} contains something that looks like a credential`);
  }

  if (existsSync(join(root, 'bin', 'port-skills.js')) && existsSync(join(root, '.claude', 'skills'))) {
    problems.push(...checkGenerated(root).map((p) => `generated output ${p}`));
  } else {
    problems.push('bin/port-skills.js or .claude/skills is missing: the skills cannot be reproduced');
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const problems = validate(root);
  if (problems.length) {
    console.error(`Codex plugin contract broken (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Codex plugin contract holds: marketplace, manifest, skills, MCP, hooks and generated output.');
}
