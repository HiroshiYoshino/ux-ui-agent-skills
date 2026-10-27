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
> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls ${CLAUDE_SKILL_DIR}/../../../tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Set `<project-root>` to the absolute path of the user's project. Run only the gates applicable to the files changed, passing those project paths explicitly:

1. For generated token files, run `python3 ${CLAUDE_SKILL_DIR}/../../../scripts/validate_tokens.py "<project-root>/tokens"` and `python3 ${CLAUDE_SKILL_DIR}/../../../scripts/validate_contrast.py "<project-root>/tokens/colors.json"`.
2. For source files, run the applicable hardcode, emoji, theme-reference, and intent gates against the project's source and theme paths.
3. For a rendered page or harness, run `DS_REQUIRE_BROWSER=1 UX_UI_PROJECT_ROOT="<project-root>" node ${CLAUDE_SKILL_DIR}/../../../scripts/verify_states.mjs "<project-root>/<path-to-page-or-harness>"`, plus the responsive and accessibility gates that apply. Repeat state checks with `--dark` when relevant.
4. Report each gate's actual output. If a gate fails, list the failure, fix the cause, and rerun it. A missing target, missing Playwright, missing browser, or `SKIPPED` result is not a pass.

`accuracy_report.mjs` tests the kit's own examples and is only for developing the kit itself. Never use it, its `N/N` output, or an unrelated project `npm run verify` as evidence about this user's project. These objective gates do not prove taste; render and inspect the result, and pair it with human review.
