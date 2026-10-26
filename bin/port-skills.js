/**
 * Port the Claude Code skills and brief to agents that read the same files
 * without Claude Code's substitutions.
 *
 * A skill names kit files as `${CLAUDE_SKILL_DIR}/../../../<path>`, which only
 * Claude Code expands. Gemini CLI hands a workspace skill to the model verbatim,
 * and Antigravity has the model open SKILL.md itself, so there the variable is
 * a literal string and every path in the skill points at nothing. Extension
 * skills are the exception: Gemini CLI expands `${extensionPath}` in them.
 *
 * portSkill rewrites to `base`: '' for a workspace install, where the kit sits
 * at the project root and the agent works from there, or '${extensionPath}/'
 * for the extension. It refuses any form of the variable it was not written
 * for, rather than leave one half-rewritten.
 */
'use strict';

const SKILL_ROOT = '${CLAUDE_SKILL_DIR}/../../..';

/* Skills that only work inside Claude Code, with the mechanism each one needs. */
const CLAUDE_ONLY = {
  critique: 'runs the design critic as a forked subagent in a fresh context, which is a Claude Code mechanism',
  observe: 'reports what the Claude Code hooks recorded; nothing else records those events',
  'scaffold-project': 'scaffolds the Claude Code project layout: a CLAUDE.md brief, .claude/settings.json and .claude/rules',
};

/* A kit file a skill names that this surface ships under another name. */
const RENAMED = { 'CLAUDE.md': 'GEMINI.md' };

const CODEX_UNSUPPORTED = {
  observe: 'The current observer reads Claude hook events; no Codex event adapter is included.',
  'scaffold-project': 'The current scaffold creates a Claude Code project; no Codex template is included.',
};

const CODEX_CLAUDE_FIELDS = new Set([
  'disable-model-invocation',
  'user-invocable',
  'argument-hint',
  'context',
  'agent',
  'background',
]);

function parseCodexFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error('a skill without frontmatter cannot be ported');

  let name;
  let description;
  let manualOnly = false;
  const dropped = [];
  const metadata = [];
  let inMetadata = false;

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      if (inMetadata) {
        const nested = line.match(/^\s+short-description:\s*(.*)$/);
        if (nested) metadata.push(nested[0].trim());
        else if (line.trim()) throw new Error(`unsupported Codex skill metadata: ${line.trim()}`);
      }
      continue;
    }

    const field = line.match(/^([a-z][a-z0-9-]*):(?:\s*(.*))?$/);
    if (!field) throw new Error(`invalid skill frontmatter line: ${line}`);
    const [, key, value = ''] = field;
    inMetadata = key === 'metadata';
    if (key === 'name') name = line;
    else if (key === 'description') description = line;
    else if (key === 'metadata') continue;
    else if (CODEX_CLAUDE_FIELDS.has(key)) {
      if (key === 'disable-model-invocation' && value.trim() === 'true') manualOnly = true;
      dropped.push(key);
    } else {
      throw new Error(`unsupported skill frontmatter field: ${key}`);
    }
  }

  if (!name || !description) throw new Error('a Codex skill needs name and description fields');
  const skillName = name.slice(name.indexOf(':') + 1).trim();
  const skillDescription = description.slice(description.indexOf(':') + 1).trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName) || skillName.length > 64) {
    throw new Error(`invalid Codex skill name: ${skillName}`);
  }
  if (!skillDescription || skillDescription.length > 1024) {
    throw new Error(`invalid Codex skill description: ${skillName}`);
  }

  return {
    name: skillName,
    frontmatter: [name, description, ...(metadata.length ? ['metadata:', ...metadata] : [])].join('\n'),
    body: text.slice(match[0].length),
    manualOnly,
    dropped,
  };
}

function portCodexSkill(text, skillNames = []) {
  const parsed = parseCodexFrontmatter(text);
  let body = parsed.body
    .split(`${SKILL_ROOT}/CLAUDE.md`).join('../../../AGENTS.md')
    .split(`${SKILL_ROOT}/`).join('../../../')
    .split(SKILL_ROOT).join('..')
    .split('CLAUDE.md').join('AGENTS.md')
    .split('.claude/rules/').join('docs/agent-rules/')
    .split('`$ARGUMENTS`').join("the user's request")
    .split('$ARGUMENTS').join("the user's request");

  for (const name of skillNames) {
    const invocation = new RegExp(`(^|[\\s(\\x60])/${name}(?=$|[\\s)\\x60.,;:!?])`, 'g');
    body = body.replace(invocation, (_, prefix) => `${prefix}$${name}`);
  }

  if (/\$\{CLAUDE_[A-Z0-9_]+\}|\$CLAUDE_[A-Z0-9_]+|\$ARGUMENTS/.test(body)) {
    const unresolved = body.match(/\$\{CLAUDE_[A-Z0-9_]+\}|\$CLAUDE_[A-Z0-9_]+|\$ARGUMENTS/)[0];
    throw new Error(`cannot port "${unresolved}" in skill "${parsed.name}"`);
  }

  return {
    name: parsed.name,
    content: `---\n${parsed.frontmatter}\n---\n\n> Adapted from the Claude Code skill for Codex workspace discovery. This generated skill has not been runtime-tested in Codex.\n\n${body}`,
    manualOnly: parsed.manualOnly,
    droppedFrontmatter: parsed.dropped,
  };
}

function codexCritiqueFallback() {
  return `---
name: critique
description: Review a UI artifact against its brief and observed evidence. This is a self-review, not an independent-context review.
---

# Self-review fallback

This skill runs in the same conversation as the work. It cannot provide the independent context guaranteed by a separate reviewer. Do not describe this as an independent critique.

Review only the supplied artifact, brief, screenshots, interaction results, and measured gate output. If screenshots, browser access, interaction results, or required measurements are missing, state what is missing and do not claim a complete review. Separate objective gate findings from subjective design judgments, and cite the artifact or observed evidence for each finding.

If independent review is required, stop and ask for a reviewer that can be given an isolated context.
`;
}

function codexSkillPortReport(names, packageVersion) {
  return {
    schemaVersion: 1,
    target: 'codex-workspace-skills',
    kitVersion: packageVersion,
    runtimeVerification: 'not-performed',
    skills: names.map(name => {
      if (name === 'critique') {
        return {
          name,
          status: 'fallback',
          verification: 'static-only',
          generated: true,
          reason: 'Uses same-context self-review; it cannot guarantee an independent reviewer context.',
        };
      }
      if (name in CODEX_UNSUPPORTED) {
        return {
          name,
          status: 'unsupported',
          verification: 'not-tested',
          generated: false,
          reason: CODEX_UNSUPPORTED[name],
        };
      }
      return {
        name,
        status: 'adapted',
        verification: 'static-only',
        generated: true,
      };
    }),
  };
}

function portSkill(text, base) {
  let out = text;
  for (const [from, to] of Object.entries(RENAMED)) {
    out = out.split(`${SKILL_ROOT}/${from}`).join(`${base}${to}`)
      .split(`(${from} → Verification Protocol)`).join(`(${to} → Verification)`);
  }
  out = out
    .split(`${SKILL_ROOT}/`).join(base)
    .split(SKILL_ROOT).join(base ? base.replace(/\/$/, '') : '.')
    .split('`$ARGUMENTS`').join("the user's request");
  const left = out.match(/\$\{CLAUDE_SKILL_DIR\}\S*|\$ARGUMENTS/);
  if (left) throw new Error(`cannot port "${left[0]}": only ${SKILL_ROOT}/ is understood`);
  // The skill was written for Claude Code, and the reader is not in it. Say what
  // differs once, at the top, rather than rewrite prose that would then be wrong.
  const end = out.indexOf('\n---\n', 4);
  if (!out.startsWith('---\n') || end < 0) throw new Error('a skill without frontmatter cannot be ported');
  const note = [
    '> Ported from the Claude Code skill.'
      + (base ? '' : ' Every path in it is relative to the project root, where the kit is installed.'),
    '> Where it says `CLAUDE.md`, the same rules are in `GEMINI.md`. A `/name` it mentions is',
    '> the skill of that name. `/critique` exists only in Claude Code: where it is asked for, run',
    `> \`node ${base}scripts/taste_audit.mjs <file>\` and \`node ${base}scripts/slop_tells.mjs <file>\`,`,
    '> report what they print, and say that a human read of the work is still owed.',
  ].join('\n');
  return `${out.slice(0, end + 5)}\n${note}\n${out.slice(end + 5)}`;
}

/* AGENTS.md from its first rule on, under an opening that says where the
   paths are relative to. Same doctrine, so it cannot drift from the source. */
const OPENING = {
  workspace: [
    'This file is the whole brief, written for **Gemini CLI** and **Antigravity**,',
    'which both read `GEMINI.md`. Every path in it is relative to the project root,',
    'where the kit is installed. The kit\'s skills are in `.agents/skills/` and load',
    'when a task matches one; their paths are relative to the project root too.',
  ],
  extension: [
    'This file is the whole brief, loaded by the **Gemini CLI extension**. Every path',
    'in it is relative to the directory this file is in, the extension root, not to',
    'the project being worked on: run a gate as',
    '`node <extension root>/scripts/verify_states.mjs path/to/page.html`. The',
    'extension\'s skills carry absolute paths already, and its MCP tools (`run_gate`,',
    '`review_ui`, `get_design_system`) need no path to the kit at all.',
  ],
};

function geminiBrief(agentsMd, where) {
  const cut = agentsMd.indexOf('\n---\n');
  if (cut < 0 || !OPENING[where]) throw new Error('cannot build GEMINI.md');
  const [title, persona] = agentsMd.slice(0, cut).split('\n\n');
  return `${title}\n\n${persona}\n\n${OPENING[where].join('\n')}\n${agentsMd.slice(cut)}`;
}

module.exports = {
  portSkill, portCodexSkill, codexCritiqueFallback, codexSkillPortReport,
  CODEX_UNSUPPORTED, geminiBrief, CLAUDE_ONLY, RENAMED,
};
