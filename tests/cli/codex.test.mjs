import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync, existsSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { run, ROOT } from '../helpers/run.mjs';

const require = createRequire(import.meta.url);
const { portCodexSkill } = require('../../bin/port-skills.js');
const cli = (...args) => run('node', ['bin/cli.js', ...args]);

let work;
before(() => { work = mkdtempSync(join(tmpdir(), 'ds-codex-')); });
after(() => { if (work) rmSync(work, { recursive: true, force: true }); });

test('the legacy Codex install stays unchanged unless skills are requested', () => {
  const project = join(work, 'legacy');
  const r = cli('init', project, '--agent', 'codex');
  assert.equal(r.status, 0, r.out);
  assert.ok(existsSync(join(project, 'AGENTS.md')));
  assert.ok(!existsSync(join(project, '.agents', 'skills')));
  assert.ok(!existsSync(join(project, 'docs', 'codex-skill-port-report.json')));
});

test('Codex skills install from another cwd into a nested Unicode path', () => {
  const caller = join(work, '別の作業場所');
  const project = join(work, '親 folder', '日本語 project');
  mkdirSync(caller, { recursive: true });
  const r = spawnSync(process.execPath, [
    join(ROOT, 'bin', 'cli.js'), 'init', project, '--agent', 'codex', '--with-skills',
  ], { cwd: caller, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);

  const report = JSON.parse(readFileSync(join(project, 'docs', 'codex-skill-port-report.json'), 'utf8'));
  assert.equal(report.target, 'codex-workspace-skills');
  assert.equal(report.runtimeVerification, 'not-performed');
  const generated = report.skills.filter(skill => skill.generated).map(skill => skill.name).sort();
  const installed = readdirSync(join(project, '.agents', 'skills')).sort();
  assert.deepEqual(installed, generated);
  for (const skill of report.skills) {
    assert.ok(['native', 'adapted', 'fallback', 'unsupported'].includes(skill.status));
    assert.ok(['not-tested', 'docs-reviewed', 'source-reviewed', 'static-only', 'runtime-tested']
      .includes(skill.verification));
  }
  assert.ok(report.skills.some(skill => skill.name === 'critique' && skill.status === 'fallback'));
  assert.ok(report.skills.some(skill => skill.name === 'observe' && skill.status === 'unsupported'));
  assert.ok(report.skills.some(skill => skill.name === 'scaffold-project' && skill.status === 'unsupported'));
  assert.ok(existsSync(join(project, 'docs', 'CODEX-COMPATIBILITY.md')));
  assert.ok(existsSync(join(project, 'docs', 'agent-rules', 'components.md')));

  let checkedReferences = 0;
  for (const name of installed) {
    const skill = readFileSync(join(project, '.agents', 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(skill, /^---\nname: [a-z0-9-]+\ndescription: /);
    assert.doesNotMatch(skill, /\$\{CLAUDE_[A-Z0-9_]+\}|\$CLAUDE_[A-Z0-9_]+|\$ARGUMENTS/);
    assert.doesNotMatch(skill, /\.claude\/rules\//);
    if (name !== 'critique') {
      const source = readFileSync(join(ROOT, '.claude', 'skills', name, 'SKILL.md'), 'utf8');
      for (const match of source.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/\.\.\/\.\.\/\.\.\/([A-Za-z0-9_./*-]*[A-Za-z0-9_*])/g)) {
        let ref = match[1].replace('CLAUDE.md', 'AGENTS.md')
          .replace('.claude/rules/', 'docs/agent-rules/');
        assert.ok(skill.includes(`../../../${ref}`), `${name} did not port ${ref}`);
        if (ref.includes('*')) ref = ref.split('*')[0];
        assert.ok(existsSync(join(project, ref)), `${name} refers to missing project asset ${ref}`);
        checkedReferences++;
      }
    }
    if (name === 'gate') {
      assert.match(readFileSync(join(project, '.agents', 'skills', name, 'agents', 'openai.yaml'), 'utf8'),
        /allow_implicit_invocation: false/);
    }
  }
  assert.ok(checkedReferences > 100, `only ${checkedReferences} source references were checked`);
});

test('Codex skill generation rejects unknown Claude variables and frontmatter fields', () => {
  const source = '---\nname: sample\ndescription: Example skill.\n---\n';
  assert.throws(() => portCodexSkill(`${source}\${CLAUDE_UNKNOWN}/path`), /cannot port/);
  assert.throws(() => portCodexSkill(
    '---\nname: sample\ndescription: Example skill.\nmade-up: true\n---\nbody\n'),
  /unsupported skill frontmatter field/);
});

test('--with-skills is restricted to init --agent codex', () => {
  const wrongAgent = cli('init', join(work, 'wrong-agent'), '--agent', 'gemini', '--with-skills');
  assert.equal(wrongAgent.status, 1);
  assert.match(wrongAgent.out, /--with-skills requires --agent codex/);

  const wrongCommand = cli('new', join(work, 'wrong-command'), '--with-skills');
  assert.equal(wrongCommand.status, 1);
  assert.match(wrongCommand.out, /--with-skills is only valid with init/);
});

test('--with-skills --dry reports files without creating them', () => {
  const project = join(work, 'dry');
  const r = cli('init', project, '--agent', 'codex', '--with-skills', '--dry');
  assert.equal(r.status, 0, r.out);
  assert.ok(!existsSync(project));
});

test('Codex installation preserves existing skill files by default', () => {
  const project = join(work, 'preserve');
  const file = join(project, '.agents', 'skills', 'design-code', 'SKILL.md');
  mkdirSync(join(project, '.agents', 'skills', 'design-code'), { recursive: true });
  writeFileSync(file, 'user-owned\n');
  const r = cli('init', project, '--agent', 'codex', '--with-skills');
  assert.equal(r.status, 0, r.out);
  assert.equal(readFileSync(file, 'utf8'), 'user-owned\n');
});
