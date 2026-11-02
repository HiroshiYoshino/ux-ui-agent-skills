---
name: prototype
description: Move an idea up the fidelity ladder (content-first → wireframe → low-fi → high-fi → code) with a validation plan at each level, plus user-journey mapping and usability-testing scripts. Use when the user wants to prototype, wireframe, map a user flow, or plan/run usability testing.
# `invocation:` was not a field Claude Code reads - unknown frontmatter keys are
# ignored without an error, so these six were auto-invocable the whole time they
# were marked user-only. This is the field that actually does it.
disable-model-invocation: true
---

> Ported from the Claude Code skill for the Codex plugin.
> `<plugin-root>` is the plugin root: three directories above the directory of this
> SKILL.md (it holds `tokens/`, `scripts/` and `AGENTS.md`). Resolve it to an absolute path
> before reading kit references. The plugin root is read-only; `<project-root>` means the
> absolute path of the user's project. Run commands from that project and pass its output
> paths explicitly. Never write to or validate the plugin root as if it were the project.
> Browser gates resolve an already-installed `playwright` from `<project-root>` (or the
> current working directory); set `UX_UI_PROJECT_ROOT` when launching from another cwd.
> MCP `run_gate` and `review_ui` calls must pass `project_root` as an absolute path.
> This does not install dependencies. `DS_REQUIRE_BROWSER=1` makes missing Playwright or a
> missing browser fail rather than skip; module resolution is not proof that a browser ran.
> Where it says `CLAUDE.md`, the same rules are in `AGENTS.md`. This plugin ships no hooks, so
> nothing records or blocks on your behalf: run the gates yourself and report what they print.
> `accuracy_report.mjs` is only the kit's self-test. For a user project, run the individual
> gates against its explicit token, source, page or harness paths; never report the kit test
> or an unrelated `npm run verify` as project evidence.
> `/critique`, `/observe` and `/scaffold-project` exist only in Claude Code: where `/critique`
> is asked for, run `node <plugin-root>/scripts/taste_audit.mjs <file>` and
> `node <plugin-root>/scripts/slop_tells.mjs <file>`, report what they print, and say that
> a human read of the work is still owed.

# Skill: Prototype & Research

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Guide work through the right fidelity level with validation.

## Steps
1. Read `<plugin-root>/workflows/prototyping.md` (5-level fidelity ladder, journey mapping template, usability-testing script, sample data).
2. Identify the current need and pick the **lowest** fidelity that answers it. Never skip levels:
   - Content-first (info needs) → Wireframe (layout/nav) → Low-fi (task completion) → High-fi (visual/a11y) → Code (feasibility/perf).
3. For flows: produce a user-journey map with decision points, error paths, and edge cases.
4. For validation: define the usability test (tasks, success criteria, 5-user rule) using the script.
5. High-fi/code steps pull tokens (`<plugin-root>/tokens/*`), components (`<plugin-root>/components/*`), taste (`<plugin-root>/taste/*`), and a11y (`<plugin-root>/accessibility/*`).

## Output
The artifact at the chosen fidelity + an explicit "what we validate next" plan.

## Verification (before declaring done)
- The fidelity matches the question being answered; no level skipped.
- Flows include decision points, **error paths, and edge cases** (empty/loading/overflow), not just the happy path.
- A concrete validation step is named (tasks + success criteria), not "test later".
- High-fi/code artifacts pass the same token + a11y bar as `design-code` (no hardcoded values, contrast, states).
