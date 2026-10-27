---
name: image-to-code
description: Turn a reference image, screenshot, or mockup into token-driven, accessible code. Infer the design system from the reference (palette, type scale, spacing, radius, layout archetype), map it to the 3-tier tokens, rebuild it, then verify with the kit's gates. Use when the user provides a design/screenshot and wants matching UI code.
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

# Skill: Image to Code

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Reconstruct a design from a visual reference as a real design system, not a one-off copy. Match the *system* (color/type/spacing language), never lift copyrighted imagery or brand assets.

## Steps
1. **Read the reference like a designer.** Infer and write down:
   - **Palette**: 1 dominant surface family, text colors, 1 primary action + at most 1 accent (sample the hues; don't guess random hex).
   - **Type**: family feel (geometric/grotesk/serif), the scale jumps, display vs. body contrast, weights.
   - **Spacing & density**: base unit, section rhythm, card padding; airy vs. compact.
   - **Radius & depth**: radius language (sharp/soft/pill), shadow vs. hairline separation.
   - **Layout archetype + sequence**: bounded hero / asymmetric split / dense bento / editorial stack (`<plugin-root>/taste/design-taste.md` → Variance Mandate).
2. **Anchor to a known system** if it's close: browse `<plugin-root>/taste/aesthetic-systems.md` / `python3 <plugin-root>/scripts/design_systems.py search <term>` and adopt that recipe to stabilize decisions.
3. **Build the token theme** from the inferred values → 3-tier DTCG (`design-tokens` skill) in `<project-root>/tokens`; generate a single `<project-root>/theme.css`. Verify every color pair with `<plugin-root>/scripts/contrast.py` / `python3 <plugin-root>/scripts/validate_contrast.py "<project-root>/tokens/colors.json"` (light + dark). A sampled brand color that fails AA gets adjusted; taste never overrides POUR.
4. **Rebuild layout + components** token-driven via `<plugin-root>/frameworks/adapter-protocol.md` + `<plugin-root>/components/*`: one shared primitive layer, all 8 states, a11y wired, no emoji (lucide), single theme. Apply taste (`design-taste.md`) so it doesn't regress to generic.
5. **Verify against the reference**: render and screenshot it, compare side-by-side to the reference; run the applicable gates against the project's actual output paths. For example, use `DS_REQUIRE_BROWSER=1 UX_UI_PROJECT_ROOT="<project-root>" node <plugin-root>/scripts/measure_render.mjs "<project-root>/<path-to-page>"` and `python3 <plugin-root>/scripts/lint_hardcodes.py "<project-root>/<source-dir>"`.

## Verification (definition of done)
- Report the actual output of each applicable gate. Do not use the kit's `accuracy_report.mjs` or an unrelated `npm run verify` as evidence about the user's project.
- The rebuilt UI uses ONE inferred token theme; no per-section palettes.
- A screenshot of the result visibly matches the reference's design language.

> Honest limit: this matches the design **system**, not a pixel-perfect copy. Do not reproduce the reference's photographs, logos, or copyrighted copy. Substitute your own or generic placeholders.
