---
name: figma-integration
description: Keep Figma and code in sync. Map the 3-tier DTCG tokens to Figma Variables (collections + modes), sync in either direction, use the Figma MCP when connected, and verify component parity (variants/states). Use when the user wants to push tokens/components to Figma, pull a design into code, set up token↔Variable sync, or check design-code drift.
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

# Skill: Figma Integration

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Bridge design (Figma) and code (this repo) in both directions. The token JSON stays the source of truth; Figma Variables mirror it.

## Steps
1. Read `<plugin-root>/workflows/figma-integration.md` (token↔Variable mapping, sync directions, MCP usage, parity).
2. Map the 3-tier hierarchy → three Figma collections (Primitives → Semantic → Component) with aliasing; dark/brand/density → Figma **Modes** (`<plugin-root>/tokens/theming.json`).
3. Choose ONE authoritative sync direction (code→Figma publish, or Figma→code extract via Tokens Studio / Variables REST API). The other side is generated. Never hand-edit both.
4. **If a Figma MCP server is connected:** prefer its tools/skills (load its mandatory prerequisite skill first). Use it to read frames/variables/screenshots into code, build Variables/components from our tokens, or wire Code Connect to `<plugin-root>/components/*`.
5. Check component parity: Figma variants/properties must cover our variants + sizes + the 8 states; flag gaps.

## Verification (definition of done)
- Every Figma Variable resolves to a token in `<plugin-root>/tokens/*.json` (no orphan hex in designs).
- One authoritative direction; the generated side has zero hand edits.
- Variant sets cover all 8 states; Code Connect points to the right `<plugin-root>/components/*` file.
- After any token import: `python3 <plugin-root>/scripts/validate_tokens.py` passes.
