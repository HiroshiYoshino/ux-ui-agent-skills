---
name: ship
description: Pre-release gate. Run the full gate, responsive + render checks, then produce the release checklist (README badge/current/changelog). Use before tagging a release.
# A command the user runs. Converted from .claude/commands/ so it has a
# CLAUDE_SKILL_DIR of its own and its paths resolve on every install route.
# disable-model-invocation keeps the behaviour a command had: the user
# starts it, the model never does, and its description stays out of the
# listing budget the model's skill choice is drawn from.
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
> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Gate first, then prepare the release. Do nothing destructive without explicit
confirmation (no tag, no publish). This command verifies and drafts only.

1. Quality gate (must be fully green before continuing):
   - Set `<project-root>` to the absolute path of the repository being released.
   - Only when that repository is this design-system kit, run `node "<project-root>/scripts/accuracy_report.mjs"` from its root and report its actual output.
   - For any other project, run applicable individual gates against its explicit token, source, and page or harness paths. Do not use the kit's `accuracy_report.mjs` or an unrelated `npm run verify` as release evidence.
   - For rendered files, set `DS_REQUIRE_BROWSER=1 UX_UI_PROJECT_ROOT="<project-root>"` and require a real measured result. A missing target, dependency, browser, or `SKIPPED` output is not a pass.
   If anything fails, stop and fix; do not proceed to the checklist.

2. Release checklist (per the project release rule):
   - Update `README.md`: version badge, "current" line, and changelog entry.
   - Confirm the bump level (major/minor/patch) with the user. It is their call.
   - Confirm `examples/apple-home` stays gitignored (local IP).
   - List the commits since the last tag so the changelog is accurate.

3. Output a ready-to-review summary: the actual gate output, the proposed version,
   and the drafted changelog entry. Wait for the user to approve before any
   `git tag` / publish step.
