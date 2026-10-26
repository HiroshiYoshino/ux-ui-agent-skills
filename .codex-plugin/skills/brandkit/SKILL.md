---
name: brandkit
description: Generate a complete, accessible brand design system from a brief, as primitive → semantic → component DTCG tokens (color, type, spacing, radius, shadow, motion), light + dark, plus a single theme.css, verified for WCAG. Use when the user wants a from-scratch brand/design foundation, a new palette + type system, or a themeable token kit for a product.
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

# Skill: Brand Kit

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Stand up the *foundation* (one token system everything renders from) before any screen. Get this right and every page stays consistent and themeable from one place.

## Steps
1. **Brief Inference (mandatory)**: name the industry, audience, the one mood adjective, and motion depth (`<plugin-root>/taste/design-taste.md` → Brief Inference). Pick an anchoring archetype from `<plugin-root>/taste/aesthetic-systems.md`.
2. **Primitives**: generate the brand color ramp in **OKLCH** (11 shades, consistent chroma) + a neutral ramp; verify the 500 shade ≥ 4.5:1 on white (text) and 600 ≥ 3:1 (UI) per `<plugin-root>/.claude/rules/tokens-and-color.md` → Color Generation.
3. **Semantic layer**: map roles to primitives (`action.primary`/`-hover`/`destructive`, `text.{primary,secondary,on-action,link}`, `surface.{page,card,raised}`, `border.{default,strong}`, `feedback.{success,warning,error,info}`), and the **dark** overrides (designed, not inverted).
4. **Scales**: Major Third type scale + composite text styles, 4px spacing scale, radius tiers, elevation, and `<plugin-root>/tokens/motion.json`-style durations/easings.
5. **Emit** the DTCG `<project-root>/tokens/*.json` (3-tier) + `<project-root>/theme.css` (the one shared source, `[data-theme="dark"]` overrides). `<project-root>` is the absolute path of the user's project, never the kit or plugin root. Optionally feed the token-build pipeline (`token-build` skill) for other platforms.

## Verification (definition of done)
- `python3 <plugin-root>/scripts/validate_tokens.py "<project-root>/tokens"`: valid JSON, all aliases resolve.
- `python3 <plugin-root>/scripts/validate_contrast.py "<project-root>/tokens/colors.json"`: required text/action/border pairs pass WCAG AA in **light AND dark**; `border.strong` ≥ 3:1.
- `python3 <plugin-root>/scripts/validate_theme_refs.py --theme "<project-root>/theme.css" "<project-root>/src"`: every component `var(--…)` resolves to the theme.
- One theme, no per-page palettes; destructive = danger token (not primary); zero hardcoded values.

> Report the actual output of each gate run against the project files. Do not substitute the kit's `accuracy_report.mjs` or an unrelated `npm run verify`. Brand "feel" still benefits from a human review against `<plugin-root>/taste/design-taste.md`.
