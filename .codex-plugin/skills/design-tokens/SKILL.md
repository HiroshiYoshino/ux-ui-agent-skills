---
name: design-tokens
description: Generate, extend, or audit design tokens in DTCG format with the 3-tier architecture (primitive → semantic → component). Use when the user wants a color palette, type scale, spacing/shadow/radius/motion tokens, multi-brand theming, or wants to validate token files. Covers colors, typography, spacing, shadows, borders, breakpoints, motion, gradients, opacity, blur, sizing, states, theming.
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

# Skill: Design Tokens

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Produce and maintain DTCG (`$type`/`$value`) tokens following the project's 3-tier system.

## Steps
1. Read `<plugin-root>/.claude/rules/tokens-and-color.md` → "Token System" + "Color Guidelines" and `<plugin-root>/.claude/rules/typography-and-spacing.md` for the rules (4px base, Major Third scale, OKLCH palette generation, dark-mode-at-semantic-layer).
2. Read the relevant existing files in `<plugin-root>/tokens/` to match structure: `colors.json`, `typography.json`, `spacing.json`, `shadows.json`, `borders.json`, `breakpoints.json`, `motion.json`, `gradients.json`, `opacity.json`, `blur.json`, `sizing.json`, `states.json`, `theming.json`.
3. Generate/extend tokens:
   - Primitives = raw values (never used directly). Semantic = purpose aliases. Component = component-scoped.
   - New palettes: generate 11 OKLCH shades; verify 500 ≥ 4.5:1 on white (text), 600 ≥ 3:1 (UI) using the `a11y-audit` skill / `<plugin-root>/scripts/contrast.py`.
   - Multi-brand/density → `theming.json`.
4. **Validate**: run `python3 <plugin-root>/scripts/validate_tokens.py "<project-root>/tokens"` (JSON validity + alias resolution).

## Output
Write DTCG JSON under `<project-root>/tokens/`. Preserve `$description` on every token. Reference, never hardcode. Pass the project's token paths explicitly to validators; never rely on their kit-root defaults.
