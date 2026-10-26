---
name: apply-aesthetic
description: Apply a visual direction, an archetype (high-end agency, editorial minimal, brutalist, soft-SaaS, dark-tech) or one of 2,144 named design systems (apple, linear-app, stripe, vercel, notion, material, shadcn, spotify, tesla…), by resolving it into the token system. Use when the user wants a specific look/vibe/brand feel, or asks to make a design feel premium/expensive/non-generic.
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

# Skill: Apply Aesthetic

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Choose and apply a design direction without breaking accessibility.

## Steps
1. **Brief Inference first (mandatory).** Before any tokens, name it: industry/domain, audience & tone, the one mood adjective the result must earn, motion depth, and the layout-family sequence (`<plugin-root>/taste/design-taste.md` → Brief Inference + Variance Mandate). Generating before deciding = slop.
2. Pick a direction in `<plugin-root>/taste/aesthetic-systems.md`:
   - An **archetype** (recipe mapped to our tokens), or
   - A **named library system**: browse with `python3 <plugin-root>/scripts/design_systems.py list` (or `search <term>` / `show <name>`). Then run `node <plugin-root>/scripts/library.mjs get <name>` and read the `DESIGN.md` at the path it prints. An npm install carries the index and no spec, so this is what fetches it (checked against the sha256 the kit ships); where the spec is already on disk it fetches nothing. If it prints `refused`, say the spec could not be fetched and pick from an archetype instead; never write a spec from memory.
3. Apply the **Library Contract** (in `aesthetic-systems.md`): re-point `semantic.*` tokens to the chosen system's color roles; map typography/spacing/radius/shadow/motion to `<plugin-root>/tokens/*.json`.
4. **Verify contrast** of every mapped color pair (`<plugin-root>/scripts/contrast.py` / `a11y-audit`). A brand value that fails must be adjusted. Taste never overrides POUR.
5. Add motion per `<plugin-root>/taste/motion-choreography.md`; run the pre-flight aesthetic check in `design-taste.md`.

## Output
Updated/overridden semantic tokens + notes on type/space/motion, then render via `design-code`. Confirm the result passes both the aesthetic check and accessibility.
