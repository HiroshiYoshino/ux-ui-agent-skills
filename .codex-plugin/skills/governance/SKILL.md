---
name: governance
description: Govern how the design system evolves (SemVer for tokens/components, the contribution workflow, deprecation policy, and change communication). Use when the user wants to add/promote/deprecate a component or token, decide a version bump, set up a contribution process, or keep the system from fragmenting.
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

# Skill: Governance

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Keep the system consistent as it grows. Apply versioning, contribution, and deprecation rules.

## Steps
1. Read `<plugin-root>/workflows/governance.md` (SemVer table, contribution workflow, deprecation policy, change comms).
2. Classify the change: **major** (breaking: renamed/removed token or prop, changed anatomy/default), **minor** (additive: new token/component/variant/optional prop), **patch** (fix: contrast/bug/doc/value tweak in tolerance).
3. For a **new** component/token: confirm it serves a real, repeated need (≥ 2 places) before promoting product → candidate → core. Design it to the full quality bar (`<plugin-root>/.claude/rules/components.md` → Component Quality Bar).
4. For a **deprecation**: mark with reason + replacement + removal version; keep working ≥ 1 minor cycle; provide a migration map (`<plugin-root>/design-systems/crosswalk.md` style); remove only in a major.
5. Wire any new file into `CLAUDE.md` (File Reference Map + relevant table/router) and add a changelog entry.

## Verification (definition of done)
- Change has a SemVer level **and** a changelog entry.
- Removals have a deprecation window, a replacement, and a migration table.
- New spec meets the 8-state + a11y + token-mapping bar and is reachable via the router.
- `python3 <plugin-root>/scripts/validate_tokens.py "<project-root>/tokens"` passes; contrast re-checked against `"<project-root>/tokens/colors.json"` if colors changed.
