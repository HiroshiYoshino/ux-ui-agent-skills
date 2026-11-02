import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { build, check } from '../../scripts/build_codex_plugin.mjs';
import { run } from '../helpers/run.mjs';

const require = createRequire(import.meta.url);
const { portSkill, geminiBrief } = require('../../bin/port-skills.js');
const crlf = text => text.replace(/\r?\n/g, '\r\n');
const skill = '---\nname: confirm\ndescription: Confirm an action\ndisable-model-invocation: true\n---\n'
  + 'Run python3 ${CLAUDE_SKILL_DIR}/../../../scripts/validate_tokens.py\n';

test('LF and CRLF skills produce the same Codex, Gemini and extension output', () => {
  for (const [base, target] of [['<plugin-root>/', 'codex'], ['', 'gemini'], ['${extensionPath}/', 'gemini']]) {
    assert.equal(portSkill(crlf(skill), base, target), portSkill(skill, base, target));
  }
  assert.match(portSkill(crlf(skill), '<plugin-root>/', 'codex'), /validate_tokens\.py "<project-root>\/tokens"/);
  assert.throws(() => portSkill('not frontmatter\r\n', ''), /without frontmatter/);
});

test('a CRLF AGENTS brief ports without losing the persona or rules', () => {
  const brief = '# Design kit\n\nDesign architect.\n\n---\n\nKeep the rules.\n';
  for (const where of ['workspace', 'extension']) {
    assert.equal(geminiBrief(crlf(brief), where), geminiBrief(brief, where));
  }
});

test('generation accepts CRLF source and output but still rejects changed content', t => {
  const dir = mkdtempSync(join(tmpdir(), 'skill CRLF-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'bin'), { recursive: true });
  writeFileSync(join(dir, 'bin/port-skills.js'), readFileSync(new URL('../../bin/port-skills.js', import.meta.url)));
  mkdirSync(join(dir, '.claude/skills/confirm'), { recursive: true });
  writeFileSync(join(dir, '.claude/skills/confirm/SKILL.md'), crlf(skill));
  const generated = build(dir);
  assert.ok(generated.has('.codex-plugin/skills/confirm/agents/openai.yaml'), 'CRLF lost the explicit-invocation policy');
  for (const [rel, text] of generated) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), crlf(text));
  }
  assert.deepEqual(check(dir), []);
  const rel = '.codex-plugin/skills/confirm/SKILL.md';
  writeFileSync(join(dir, rel), crlf(generated.get(rel).replace('Confirm an action', 'Changed content')));
  assert.deepEqual(check(dir), [`differs: ${rel}`]);
});

test('npm runs with a project path containing spaces, Japanese and shell characters', t => {
  const dir = mkdtempSync(join(tmpdir(), 'npm 日本語 & fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'package.json'), '{"private":true}\n');
  const result = run('npm', ['prefix', '--prefix', dir]);
  assert.equal(result.status, 0, result.out);
  assert.equal(resolve(result.stdout.trim()), resolve(dir));
});

test('the default token build resolves its own root under a spaced Japanese path', t => {
  const dir = mkdtempSync(join(tmpdir(), '取得先 token build-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(new URL('../../scripts/build_tokens.mjs', import.meta.url), join(dir, 'scripts/build_tokens.mjs'));
  cpSync(new URL('../../tokens/', import.meta.url), join(dir, 'tokens'), { recursive: true });
  const out = join(dir, 'theme.css');
  const result = run('node', [join(dir, 'scripts/build_tokens.mjs'), '--check', '--out', out]);
  assert.equal(result.status, 0, result.out);
  assert.match(readFileSync(out, 'utf8'), /--space-4:/);
});
