#!/usr/bin/env node
/**
 * Build the Codex plugin's generated files from the Claude Code skills.
 *
 * Codex installs a plugin from a git checkout and runs no build step, so what it
 * needs has to be committed. The skills are generated from `.claude/skills/` by
 * `bin/port-skills.js` (the same porter Gemini uses, with the `codex` target),
 * and this script is the one place that writes them. CI and the tests run it with
 * `--check`, which fails when the committed output differs from what this would
 * write, so the two cannot drift.
 *
 *   node scripts/build_codex_plugin.mjs           write .codex-plugin/skills and capabilities.json
 *   node scripts/build_codex_plugin.mjs --check   write nothing; exit 1 on any difference
 *   node scripts/build_codex_plugin.mjs --root D  build for the kit at D (default: this checkout)
 *
 * Hand-written, not generated: .codex-plugin/plugin.json, .codex-plugin/mcp.json
 * and .agents/plugins/marketplace.json. Everything under .codex-plugin/skills/
 * is owned by this script and is rewritten whole; nothing outside it is touched.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

export const SKILLS_DIR = '.codex-plugin/skills';
export const CAPABILITIES_FILE = '.codex-plugin/capabilities.json';

const HOOKS_REASON = 'Codex does not run the Claude Code hooks: they read the Claude Code event shapes '
  + '(Write|Edit tool names, its stop-hook protocol) and write a ledger only the Claude Code skills read. '
  + 'The plugin therefore declares an empty hooks object, so hooks/hooks.json at the plugin root is not loaded.';

/** The skills, ported, as { name -> {skill, metadata} } plus what was left out. */
export function build(kit) {
  const { portSkill, CLAUDE_ONLY, PLUGIN_ROOT } = require(join(kit, 'bin', 'port-skills.js'));
  const src = join(kit, '.claude', 'skills');
  const files = new Map();
  const included = [];
  const explicitOnly = [];
  for (const name of readdirSync(src).sort()) {
    const file = join(src, name, 'SKILL.md');
    if (name in CLAUDE_ONLY || !existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    files.set(`${SKILLS_DIR}/${name}/SKILL.md`, portSkill(text, `${PLUGIN_ROOT}/`, 'codex'));
    included.push(name);
    const frontmatter = text.slice(0, text.indexOf('\n---\n', 4));
    if (/^disable-model-invocation:\s*true\s*$/m.test(frontmatter)) {
      // Codex's own switch for "the user starts it, the model never does".
      files.set(`${SKILLS_DIR}/${name}/agents/openai.yaml`, 'policy:\n  allow_implicit_invocation: false\n');
      explicitOnly.push(name);
    }
  }
  const capabilities = {
    generatedBy: 'scripts/build_codex_plugin.mjs',
    source: '.claude/skills',
    skills: { included, explicitInvocationOnly: explicitOnly, excluded: { ...CLAUDE_ONLY } },
    hooks: { enabled: false, reason: HOOKS_REASON },
    mcp: {
      enabled: true,
      config: '.codex-plugin/mcp.json',
      pathsMustBeAbsolute: 'The server runs with the plugin root as its working directory, so a relative path '
        + 'would be read against the plugin, not the project. It refuses relative paths and measures nothing.',
    },
    browserGates: 'Gates that open a browser need playwright, which the plugin does not install. '
      + 'They report the browser as missing and fail; a missing browser is never a pass.',
  };
  files.set(CAPABILITIES_FILE, `${JSON.stringify(capabilities, null, 2)}\n`);
  return files;
}

/** Every generated file already on disk under the managed directory. */
function onDisk(kit) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    }
  };
  walk(join(kit, SKILLS_DIR));
  return out.map((p) => p.slice(kit.length + 1).split('\\').join('/'));
}

export function check(kit) {
  const want = build(kit);
  const problems = [];
  for (const [rel, text] of want) {
    const p = join(kit, rel);
    if (!existsSync(p)) problems.push(`missing: ${rel}`);
    else if (readFileSync(p, 'utf8') !== text) problems.push(`differs: ${rel}`);
  }
  for (const rel of [...onDisk(kit), CAPABILITIES_FILE]) {
    if (!want.has(rel) && existsSync(join(kit, rel))) problems.push(`stale: ${rel}`);
  }
  return problems;
}

export function write(kit) {
  const want = build(kit);
  rmSync(join(kit, SKILLS_DIR), { recursive: true, force: true });
  for (const [rel, text] of want) {
    const p = join(kit, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  return want.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  const kit = resolve(i >= 0 ? args[i + 1] : join(HERE, '..'));
  if (args.includes('--check')) {
    const problems = check(kit);
    if (problems.length) {
      console.error(`Codex plugin output is out of date (${problems.length}):\n  ${problems.join('\n  ')}\n`
        + 'Run: node scripts/build_codex_plugin.mjs');
      process.exit(1);
    }
    console.log(`Codex plugin output matches .claude/skills (${build(kit).size} files).`);
  } else {
    console.log(`Wrote ${write(kit)} files under ${SKILLS_DIR} and ${CAPABILITIES_FILE}.`);
  }
}
