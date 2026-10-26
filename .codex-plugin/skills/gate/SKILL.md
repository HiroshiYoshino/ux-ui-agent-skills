---
name: gate
description: Run the one-command quality gate and report the real N/N result. Use before claiming any build/review is done.
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
> before running anything, and run every command from the user's project, never from the
> plugin root: the project is where the work is, the plugin root only holds the kit.
> Where it says `CLAUDE.md`, the same rules are in `AGENTS.md`. This plugin ships no hooks, so
> nothing records or blocks on your behalf: run the gates yourself and report what they print.
> `accuracy_report.mjs` is the kit's own self-test and measures the kit's examples, not the
> user's project: for the project, run the individual gates against the project's files.
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

Run the full quality gate and report the ACTUAL output, never a remembered or
reasoned number.

1. Run: `node <plugin-root>/scripts/accuracy_report.mjs`
   (tokens + contrast + spec + no-hardcode + theme-refs + no-emoji +
   real-render WCAG + state-aware, light and dark; all-or-nothing).
2. Report the exact `N/N` line it prints.
3. If it is not fully green:
   - List each failing check verbatim.
   - Fix the cause (do not suppress the check).
   - Re-run until green. Do not announce success between failures.
4. For any rendered HTML touched this session, also run the pixel-truth checks
   the gate cannot prove:
   - `node <plugin-root>/scripts/gate.mjs verify_states.mjs <file> [--dark]`
   - `node <plugin-root>/scripts/gate.mjs verify_responsive.mjs <file>`
   - RENDER-AND-LOOK: screenshot the harness, park the pointer off it, inspect
     every state, click each control to confirm the state changed.

Honest scope: these gates prove objective correctness (tokens, a11y, no drift).
They do not prove taste. Pair with `DS_REQUIRE_BROWSER=1 node <plugin-root>/scripts/taste_audit.mjs` + human review;
never claim auto-100% on aesthetics.
