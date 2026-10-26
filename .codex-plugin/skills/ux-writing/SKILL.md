---
name: ux-writing
description: Write or review UI copy (buttons, errors, empty states, microcopy, notifications, labels) using the voice & tone system (clear, concise, useful, human, honest) with the what→why→how error formula and inclusive-language rules. Use when the user needs interface copy, error messages, empty-state text, or a copy review.
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

# Skill: UX Writing

> **Step 0: is the kit here?** This skill reads files from the kit. Check once:
> `ls <plugin-root>/tokens >/dev/null 2>&1 && echo KIT_OK || echo KIT_MISSING`
> On `KIT_MISSING` only the skill folders were installed, which is what
> `npx skills add` does. Say so plainly, point the user at
> `npx ux-ui-agent-skills init` or the plugin install, and stop. Do not guess the
> contents of a file you could not open.

Produce or critique interface copy in the project's voice.

## Steps
1. Read `<plugin-root>/content/voice-tone.md` (voice principles, tone spectrum, formulas, microcopy patterns, inclusive language, pre-ship checklist).
2. Match tone to the user's emotional state (onboarding/success/routine/error/destructive). Higher stress → plainer language.
3. Apply the formulas:
   - Buttons: frontload the verb, name the outcome.
   - **Confirmation dialogs:** the confirm button **restates the action and object**: "Delete account", not "Delete"/"OK"/"Yes"/"Confirm". The title asks ("Delete account?"), the button answers in matching words. Cancel stays "Cancel". For irreversible/high-stakes actions, require a **type-to-confirm** step (WCAG 3.3.4/3.3.6).
   - Errors: what happened → why → how to fix (no dead ends, no codes/stack traces).
   - Empty states: value → first action.
4. Enforce mechanics: sentence case, no ALL CAPS, numerals, no blame on the user, labels (not placeholders), no directional/color-only instructions.
5. Run the 10-item pre-ship copy checklist.

## Output
Final copy (or a redline review) that reads naturally aloud and passes the checklist. Keep within any character limits for tight UI.

## Verification (mandatory before declaring done)
Run every line through the 10-item pre-ship checklist in `<plugin-root>/content/voice-tone.md`. Do not skip it:
- Reads naturally **aloud**; frontloaded verb on actions; no jargon/blame/dead-ends.
- Errors follow what→why→how; empty states give value→action; no bare "No data"/"Error".
- Mechanics: sentence case, numerals, labels (not placeholders), no color/direction-only cues, inclusive language.
- Within character limits; translatable (no concatenation; see `<plugin-root>/accessibility/i18n-rtl.md`).
