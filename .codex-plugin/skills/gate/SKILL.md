---
name: gate
description: Run applicable quality gates against project files and report their actual results. Use before claiming work is done.
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

Set `<project-root>` to the absolute path of the user's project. Run only the gates applicable to the files changed, passing those project paths explicitly:

1. For generated token files, run `python3 <plugin-root>/scripts/validate_tokens.py "<project-root>/tokens"` and `python3 <plugin-root>/scripts/validate_contrast.py "<project-root>/tokens/colors.json"`.
2. For source files, run the applicable hardcode, emoji, theme-reference, and intent gates against the project's source and theme paths.
3. For a rendered page or harness, run `DS_REQUIRE_BROWSER=1 UX_UI_PROJECT_ROOT="<project-root>" node <plugin-root>/scripts/verify_states.mjs "<project-root>/<path-to-page-or-harness>"`, plus the responsive and accessibility gates that apply. Repeat state checks with `--dark` when relevant.
4. Report each gate's actual output. If a gate fails, list the failure, fix the cause, and rerun it. A missing target, missing Playwright, missing browser, or `SKIPPED` result is not a pass.

`accuracy_report.mjs` tests the kit's own examples and is only for developing the kit itself. Never use it, its `N/N` output, or an unrelated project `npm run verify` as evidence about this user's project. These objective gates do not prove taste; render and inspect the result, and pair it with human review.
