---
name: token-build
description: Set up or run the token build pipeline. Transform the DTCG tokens/*.json (source of truth) into platform artifacts (CSS variables, Tailwind @theme, JS/TS, iOS Asset Catalog, Android, Compose) with Style Dictionary / Tokens Studio / W3C DTCG export. Use when the user wants to generate platform theme files from tokens, wire token CI, or multi-platform token output.
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

# Skill: Token Build

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Turn the DTCG token source of truth into platform-ready outputs. Tokens are authored once; every platform output is generated.

## Steps
1. Read `<plugin-root>/workflows/token-build.md` (architecture, tool options, resolution rules, output targets, CI).
2. Pick the tool: **Style Dictionary** (multi-platform, the default), **Tokens Studio** (Figma-owned tokens; pairs with `figma-integration`), W3C DTCG export, or a small custom script (model on `<plugin-root>/scripts/validate_tokens.py`).
3. Honor the resolution rules: resolve aliases to final values per platform; expose semantic + component tokens (primitives stay internal); emit base + dark/brand/density overrides (`<plugin-root>/tokens/theming.json`) as deltas only; format by `$type`.
4. Generate the requested target(s): CSS `:root` vars, Tailwind v4 `@theme`, typed JS/TS, iOS Asset Catalog + `Color.DS`/`Spacing`, Android `colors.xml`/Compose theme.
5. Wire CI: on `<project-root>/tokens/*.json` changes, run `python3 <plugin-root>/scripts/validate_tokens.py "<project-root>/tokens"`, regenerate, fail if committed artifacts are stale; gate the project's color file with `python3 <plugin-root>/scripts/validate_contrast.py "<project-root>/tokens/colors.json"`.

## Verification (definition of done)
- `python3 <plugin-root>/scripts/validate_tokens.py "<project-root>/tokens"` passes (no unresolved aliases).
- Regenerating produces no diff vs. committed artifacts.
- Dark/brand/density outputs contain only deltas, not full duplicates.
