#!/usr/bin/env node
/**
 * ACCURACY REPORT: one command, all-or-nothing, reproducible.
 *
 * Runs every objective correctness gate the kit can prove and prints a single
 * verdict. "100%" here means: of the checks that CAN be measured objectively,
 * every one passes, and nothing partial ships. It does NOT claim subjective visual
 * or brand fidelity (no tool can); it claims token-consistency, theme-resolution,
 * WCAG contrast (real headless-Chrome render, light + dark), and no-emoji.
 *
 * Usage: node scripts/accuracy_report.mjs
 * Exit 0 only if 100% of checks pass.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeReceipt } from './gate.mjs';
import { runCheck } from './_check_runner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  ["Token JSON valid + aliases resolve", [
    {"command":"python3","args":["scripts/validate_tokens.py"]}
  ]],
  ["WCAG contrast: token pairs (light + dark)", [
    {"command":"python3","args":["scripts/validate_contrast.py"]}
  ]],
  ["Component specs complete (anatomy/variants/states/tokens/a11y)", [
    {"command":"python3","args":["scripts/validate_component_spec.py"]}
  ]],
  ["No hardcoded values (hex/px/ms/Tailwind/font): golden", [
    {"command":"python3","args":["scripts/lint_hardcodes.py","examples/golden"]}
  ]],
  ["No hardcoded values: sample-app", [
    {"command":"python3","args":["scripts/lint_hardcodes.py","examples/sample-app"]}
  ]],
  ["No hardcoded values: industry templates", [
    {"command":"python3","args":["scripts/lint_hardcodes.py","examples/templates"]}
  ]],
  ["No hardcoded values: every harness, demo and front door (the whole examples tree)", [
    {"command":"python3","args":["scripts/lint_hardcodes.py","examples"]}
  ]],
  ["Every var(--…) resolves to the theme (no floating tokens): golden", [
    {"command":"python3","args":["scripts/validate_theme_refs.py"]}
  ]],
  ["Every var(--…) resolves: templates, harnesses, demos and the front door, and each of the five websites against its own theme", [
    {"command":"python3","args":["scripts/validate_theme_refs.py","--theme","examples/brandkit-demo/theme.css","--theme","examples/directions.css","examples/templates","examples/component-states","examples/index.html","examples/showcase","examples/terminal","examples/apple-demo","examples/brandkit-demo"]},
    {"command":"python3","args":["scripts/validate_theme_refs.py","--theme","examples/sites/launch/theme.css","examples/sites/launch"]},
    {"command":"python3","args":["scripts/validate_theme_refs.py","--theme","examples/sites/store/theme.css","examples/sites/store"]},
    {"command":"python3","args":["scripts/validate_theme_refs.py","--theme","examples/sites/journal/theme.css","examples/sites/journal"]},
    {"command":"python3","args":["scripts/validate_theme_refs.py","--theme","examples/sites/local/theme.css","examples/sites/local"]},
    {"command":"python3","args":["scripts/validate_theme_refs.py","--theme","examples/sites/gov/theme.css","examples/sites/gov"]}
  ]],
  ["Plugin surface reachable: every skill/agent path built from a variable, not the cwd", [
    {"command":"python3","args":["scripts/measure_install_paths.py","--gate"]}
  ]],
  ["Hooks fire - preflight, fast gates on write, and no unmeasured stop", [
    {"command":"node","args":["--test","tests/meta/hooks.test.mjs"]}
  ]],
  ["No native select, and no one-sided accent border - the two house rules", [
    {"command":"python3","args":["scripts/lint_native_select.py","examples"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","tests/fixtures/bad/one-sided-border.html"],"expectedExit":1,"expectedOutput":"ONE side only"}
  ]],
  ["Mobile-first - every base layer is the phone layout, with the queries removed", [
    {"command":"node","args":["scripts/verify_mobile_first.mjs","examples"]},
    {"command":"node","args":["scripts/verify_mobile_first.mjs","examples","--scale=1.25"]}
  ]],
  ["Screen economy - media bounded, no hollow boxes, the first screen earns itself", [
    {"command":"node","args":["scripts/verify_screen_economy.mjs","examples","--progress"],"timeoutMs":900000},
    {"command":"node","args":["scripts/verify_screen_economy.mjs","examples","--dark","--progress"],"timeoutMs":900000}
  ]],
  ["AGENTS.md and CLAUDE.md carry the same doctrine - the agent-neutral surface", [
    {"command":"python3","args":["scripts/validate_agents_surface.py"]}
  ]],
  ["No emoji in UI output, taste docs, or the agent instruction surface", [
    {"command":"python3","args":["scripts/check_no_emoji.py"]}
  ]],
  ["REAL-render WCAG: sample-app (light)", [
    {"command":"node","args":["scripts/measure_render.mjs","examples/sample-app/preview.html"]}
  ]],
  ["REAL-render WCAG: sample-app (dark)", [
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sample-app/preview.html"]}
  ]],
  ["State-aware WCAG: every element, default/hover/focus (light)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/sample-app/preview.html"]}
  ]],
  ["State-aware WCAG: every element, default/hover/focus (dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sample-app/preview.html"]}
  ]],
  ["axe-core a11y (ARIA/labels/landmarks): sample-app", [
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sample-app/preview.html"]}
  ]],
  ["Focus-trap (WCAG 2.1.2/2.4.3): sample-app modal", [
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/sample-app/preview.html","--open=#delBtn"]}
  ]],
  ["RTL layout (logical properties, no mirror overflow): sample-app", [
    {"command":"node","args":["scripts/verify_rtl.mjs","examples/sample-app/preview.html"]}
  ]],
  ["Token build resolves all aliases + emits CSS (--check fails on a dropped token)", [
    {"command":"node","args":["scripts/build_tokens.mjs","--check","--out","dist/tokens.css"]}
  ]],
  ["Component states harness: Button, every variant × state (states + axe, light + dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/button.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/button.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/button.html"]}
  ]],
  ["Component states harness: Input, every state incl error/disabled/loading (states + axe + contrast, light + dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/input.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/input.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/input.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/input.html"]}
  ]],
  ["Component states harness: Modal (focus trap + states + axe, light + dark)", [
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/component-states/modal.html","--open=#openBtn"]},
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/component-states/modal.html","--open=#openBtn","--dark"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/modal.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/modal.html"]}
  ]],
  ["Component harnesses: Tabs / Select / Checkbox-Radio-Switch / Toast (states + axe + render, light + dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/tabs.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/tabs.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/tabs.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/tabs.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/select.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/select.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/select.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/select.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/form-controls.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/form-controls.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/form-controls.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/form-controls.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/toast.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/toast.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/toast.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/toast.html"]}
  ]],
  ["Component harnesses: Feedback / Navigation / Overlays / Misc (states + axe + render, light + dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/feedback.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/feedback.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/feedback.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/feedback.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/feedback.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/navigation.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/navigation.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/navigation.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/navigation.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/navigation.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/overlays.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/overlays.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/overlays.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/overlays.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/overlays.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/misc.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/misc.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/misc.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/misc.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/component-states/misc.html"]}
  ]],
  ["Component harnesses: Card / Data Table / Date Picker / File Upload / Search-Field (states + axe, light + dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/card.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/card.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/card.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/card.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/data-table.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/data-table.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/data-table.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/data-table.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/datepicker.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/datepicker.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/datepicker.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/datepicker.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/fileupload.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/fileupload.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/fileupload.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/fileupload.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/search.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/search.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/search.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/search.html"]}
  ]],
  ["Component harness: Drawer (focus trap + Escape + states + axe, light + dark)", [
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/component-states/drawer.html","--open=#openBtn"]},
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/component-states/drawer.html","--open=#openBtn","--dark"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/drawer.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/drawer.html"]}
  ]],
  ["Component harnesses: Charts / Tree-Carousel-Gallery / App Shell / Context Menu (states + axe, light + dark)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/charts.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/charts.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/charts.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/charts.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/data-display.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/data-display.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/data-display.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/data-display.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/app-shell.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/app-shell.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/app-shell.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/app-shell.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/context-menu.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/context-menu.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/context-menu.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/context-menu.html"]}
  ]],
  ["Component harness: Command Palette (focus trap + combobox/listbox + states + axe, light + dark)", [
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/component-states/command-palette.html","--open=#openBtn"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/command-palette.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/command-palette.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/command-palette.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/command-palette.html"]}
  ]],
  ["Responsive: no horizontal overflow from 280 to 951px (iPhone Duo included), then folded, across every component harness", [
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/component-states"]}
  ]],
  ["Slop tells: no HIGH anti-slop tell (hardcoded AI gradient, single-radius) across every harness (light + dark)", [
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/component-states/*.html","examples/sample-app/preview.html"],"expandGlobs":true},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/component-states/*.html","examples/sample-app/preview.html"],"expandGlobs":true}
  ]],
  ["Target size (WCAG 2.5.8): every target >= 24x24 or spacing/inline-exempt, mobile + desktop (light + dark)", [
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/component-states"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","--dark","examples/component-states"]}
  ]],
  ["Reduced motion: policy present, motion stopped under reduce, no content lost across every harness", [
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/component-states"]}
  ]],
  ["Keyboard (WCAG 2.1.1): Tab reaches every control, Enter/Space and arrow keys operate the widgets", [
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/component-states"]}
  ]],
  ["Token by intent: destructive never wears action.primary, affirmative never wears danger (light + dark)", [
    {"command":"node","args":["scripts/lint_intent.mjs","examples/component-states"]},
    {"command":"node","args":["scripts/lint_intent.mjs","--dark","examples/component-states"]}
  ]],
  ["Content overflow, spacing and Thai text: no clipped text, no overlapping or touching controls, rows of cards share a height, no Thai compound or count split across lines, Thai lines far enough apart, every page (light + dark)", [
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/component-states"]},
    {"command":"node","args":["scripts/verify_spacing.mjs","examples","examples/templates","examples/component-states","examples/sample-app","examples/showcase","examples/terminal","examples/apple-demo","examples/brandkit-demo","examples/foldable","examples/sites/launch","examples/sites/store","examples/sites/journal","examples/sites/local","examples/sites/gov"]},
    {"command":"node","args":["scripts/verify_spacing.mjs","--dark","examples","examples/templates","examples/component-states","examples/sample-app","examples/showcase","examples/terminal","examples/apple-demo","examples/brandkit-demo","examples/foldable","examples/sites/launch","examples/sites/store","examples/sites/journal","examples/sites/local","examples/sites/gov"]},
    {"command":"node","args":["scripts/verify_thai.mjs","examples","examples/templates","examples/component-states","examples/sample-app","examples/showcase","examples/terminal","examples/apple-demo","examples/brandkit-demo","examples/foldable","examples/sites/launch","examples/sites/store","examples/sites/journal","examples/sites/local","examples/sites/gov"]}
  ]],
  ["Responsive under wider font metrics: every example holds at 280px with a 1.25x root font", [
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/component-states","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sample-app","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/apple-demo","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/brandkit-demo","--scale=1.25"]}
  ]],
  ["Interactive truth: every control that declares a state contract honours it on a real click", [
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/component-states"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sample-app"]}
  ]],
  ["Eval harness: the 15-gate cold-start scorer runs green on the reference app", [
    {"command":"node","args":["evals/run.mjs","--self-test"]}
  ]],
  ["Instruction surface: always-on rules stay in CLAUDE.md, every rule file routed, brief within budget", [
    {"command":"python3","args":["scripts/validate_instruction_surface.py"]}
  ]],
  ["Starter template: reference layout complete, tokens resolve, seeded theme passes WCAG (light + dark)", [
    {"command":"python3","args":["scripts/validate_template.py"]}
  ]],
  ["Industry templates: twenty whole screens, commerce through operator consoles (light + dark)", [
    {"command":"node","args":["scripts/measure_render.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/checkout.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/crm.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/emr.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/banking.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/logistics.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/orbital.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/tracing.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/daw.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/atc.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/grid.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/genomics.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/editor.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/soc.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/warehouse.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/mes.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/dispatch.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/rail.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/training.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/training.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/training.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/training.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/training.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/training.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/training.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/training.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/training.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/weather.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/templates/trial.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/templates/trial.html"]}
  ]],
  ["Trading terminal: ten chart types on one dense screen (light + dark)", [
    {"command":"node","args":["scripts/measure_render.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/terminal/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/terminal/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/terminal/index.html"]}
  ]],
  ["Showcase dashboard: a whole product screen, every gate that applies to it (light + dark)", [
    {"command":"node","args":["scripts/measure_render.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/showcase/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/showcase/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/showcase/index.html"]}
  ]],
  ["Live demo front door, the iPhone Duo simulator and the five websites: every gate that applies to them (light + dark)", [
    {"command":"node","args":["scripts/measure_render.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/foldable/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/foldable/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sites/launch/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/sites/launch/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sites/store/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/sites/store/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sites/store/product.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/sites/store/product.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sites/journal/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/sites/journal/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sites/local/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/sites/local/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_keyboard.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_interactive.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","examples/sites/gov/index.html","--scale=1.25"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","--dark","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","--dark","examples/sites/gov/index.html"]},
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/sites/launch/index.html","--open=#hero-order"]},
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/sites/store/index.html","--open=.cart-btn"]},
    {"command":"node","args":["scripts/verify_focustrap.mjs","examples/sites/store/product.html","--open=.cart-btn"]}
  ]],
  ["Framework source compiles, renders, and every class it emits resolves", [
    {"command":"node","args":["scripts/render_framework_source.mjs"]}
  ]],
  ["Framework source under the render gates: the React components themselves, light + dark", [
    {"command":"node","args":["scripts/render_framework_source.mjs"]},
    {"command":"node","args":["scripts/measure_render.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","dist/framework-render/dashboard.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","dist/framework-render/settings.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","dist/framework-render/settings-confirm.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","dist/framework-render/button-variants.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/measure_render.mjs","--dark","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/verify_target_size.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/verify_overflow.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/verify_responsive.mjs","--scale=1.25","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/verify_reduced_motion.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/lint_intent.mjs","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/slop_tells.mjs","--strict","dist/framework-render/modal.html"]},
    {"command":"node","args":["scripts/taste_audit.mjs","--strict","dist/framework-render/modal.html"]}
  ]],
  ["Edge cases: hostile content harness (long unbroken strings, empty, single, missing, extremes, many items)", [
    {"command":"node","args":["scripts/verify_states.mjs","examples/component-states/edge-cases.html"]},
    {"command":"node","args":["scripts/verify_states.mjs","--dark","examples/component-states/edge-cases.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","examples/component-states/edge-cases.html"]},
    {"command":"node","args":["scripts/axe_audit.mjs","--dark","examples/component-states/edge-cases.html"]}
  ]]
];

// A quick, explicit subset. The full plan above remains the default, with all 52 checks.
const SMOKE = new Set([1, 2, 3, 4, 8, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 24, 44, 45]);

function options(argv) {
  const out = { profile: 'full' };
  for (const arg of argv) {
    if (arg === '--list') out.list = true;
    else if (arg.startsWith('--profile=')) out.profile = arg.slice(10);
    else if (arg.startsWith('--only=')) out.only = arg.slice(7);
    else if (arg.startsWith('--json=')) out.json = arg.slice(7);
    else if (arg.startsWith('--step-timeout-ms=')) out.timeoutMs = Number(arg.slice(18));
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!['full', 'smoke'].includes(out.profile)) throw new Error('profile must be full or smoke');
  if (out.timeoutMs !== undefined && (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0)) throw new Error('step-timeout-ms must be positive');
  return out;
}

export async function runReport(entries, { root = ROOT, totalChecks = entries.length, profile = 'full',
  timeoutMs, log = console.log, recordReceipt = writeReceipt, onResult = () => {} } = {}) {
  const started = performance.now(), results = [];
  let recorded = 0, unrecorded = 0;
  log(`ACCURACY REPORT: ${profile}; ${entries.length}/${totalChecks} checks selected`);
  log('Bash-specific hook integration is verified separately from this common check plan.');
  for (const [index, [label, steps]] of entries.entries()) {
    log(`START [${index + 1}/${entries.length}] ${label}`);
    const result = await runCheck(steps, { cwd: root, timeoutMs,
      onStart: (step, i, n) => log(`  RUN [${i + 1}/${n}] ${step.command} ${JSON.stringify(step.args)}`),
      onOutput: text => { if (text.includes('screen-economy:')) log(text.trimEnd()); },
      onEnd: step => log(`  ${step.status.toUpperCase()} exit=${step.code} expected=${step.expectedExit} ${(step.elapsedMs / 1000).toFixed(2)}s`),
    });
    for (const step of result.steps) {
      const files = step.args.filter(a => !a.startsWith('-') && !a.startsWith('scripts/')
        && /\.(html|json|css|mjs|py|md|tsx|jsx|ts|js)$/.test(a) && existsSync(resolve(root, a)));
      if (!files.length || step.code === null || ['skipped', 'timeout', 'error'].includes(step.status)) { unrecorded++; continue; }
      // Expected rejection is a passing detector test, but the page's receipt must keep exit 1.
      if (recordReceipt({ gate: 'accuracy_report', args: [label], exit: step.code, files: files.map(f => resolve(root, f)) })) recorded++;
      else { result.status = 'fail'; result.receiptError = 'Could not record measurement'; unrecorded++; }
    }
    results.push({ label, ...result });
    onResult({ state: 'running', complete: false, profile, totalChecks, selected: entries.length,
      completedChecks: results.length, results });
    log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} ${label} (${(result.elapsedMs / 1000).toFixed(2)}s)`);
    if (result.status !== 'pass') {
      if (result.receiptError) log(result.receiptError);
      for (const step of result.steps.filter(s => s.status !== 'pass')) {
        log(step.error || step.output.trim().split('\n').slice(-12).join('\n') || `No output: ${step.status}`);
      }
    }
  }
  const passed = results.filter(r => r.status === 'pass').length;
  const complete = profile === 'full' && entries.length === totalChecks;
  const report = { state: 'finished', profile, complete, selected: entries.length, totalChecks, passed, failed: entries.length - passed,
    elapsedMs: performance.now() - started, recordedSteps: recorded, unrecordedSteps: unrecorded, results,
    exitCode: passed === entries.length ? 0 : 1 };
  log(`RESULT: ${passed}/${entries.length} selected checks passed; ${(report.elapsedMs / 1000).toFixed(2)}s`);
  if (!complete) log(`PARTIAL: the full ${totalChecks}-check report was not run. This is not a full-kit pass.`);
  else if (report.failed === 0) log('100%: every check in the common objective check plan passed.');
  else log('FAIL: the common objective check plan did not pass.');
  return report;
}

export { checks };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = options(process.argv.slice(2));
    const selected = checks.filter(([label], index) => (opts.profile === 'full' || SMOKE.has(index + 1))
      && (!opts.only || label.toLowerCase().includes(opts.only.toLowerCase())));
    if (!selected.length) throw new Error('No checks matched; nothing was measured');
    if (opts.list) console.log(JSON.stringify(selected, null, 2));
    else {
      const saveProgress = progress => { if (opts.json) writeFileSync(resolve(opts.json), JSON.stringify(progress, null, 2) + '\n'); };
      saveProgress({ state: 'running', complete: false, completedChecks: 0, totalChecks: checks.length });
      const report = await runReport(selected, { ...opts, totalChecks: checks.length, onResult: saveProgress });
      if (opts.json) writeFileSync(resolve(opts.json), JSON.stringify(report, null, 2) + '\n');
      process.exitCode = report.exitCode;
    }
  } catch (e) { console.error(`accuracy_report: ${e.message}`); process.exitCode = 2; }
}
