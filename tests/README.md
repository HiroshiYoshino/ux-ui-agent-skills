# tests/: the layer that checks the gates

The kit's 52 objective gates all point at `examples/` that already pass. That
proves a gate says yes to good work. It never proves the gate can still say no.

This directory supplies the other half: input built to be wrong, and the
requirement that each gate rejects it for the right reason.

```
tests/
  helpers/run.mjs        spawnSync wrapper that keeps the NUMERIC exit status
  helpers/preflight.mjs  hard-fails the suite when no browser is available
  meta/                  every gate must REJECT a broken fixture, and ACCEPT a clean one
  unit/                  the arithmetic under the contrast gates; build_tokens output
  cli/                   bin/cli.js and the project scaffold, end to end
  integration/          shell-specific tests, separate from the common gates
  fixtures/bad/          deliberately broken - one file per signal
  fixtures/good/         clean-panel.html survives all sixteen render gates, light and dark
```

## Running it

```bash
npm run test:unit    # no browser: unit + CLI + registry consistency
npm run test:gates   # everything, including the render meta-gates
```

`test:gates` needs Playwright and real Chrome (six gates launch
`channel: 'chrome'`). `helpers/preflight.mjs` fails loudly if either is missing,
because a suite that skips is a suite that proves nothing.

The common accuracy report uses argument arrays and checks each expected exit
code without invoking a shell. Its default is the complete 52-check plan:

```sh
node scripts/accuracy_report.mjs --json=accuracy-full.json
node scripts/accuracy_report.mjs --profile=smoke --json=accuracy-smoke.json
node scripts/accuracy_report.mjs --only="Screen economy" --json=economy.json
```

The smoke profile selects 18 checks and explicitly reports partial coverage.
`--list` prints the selected plan without running it. A step normally has a
180-second budget; the complete screen-economy scan has a 900-second budget.
`--step-timeout-ms=60000` overrides the budget for each command. A timeout,
missing executable or skipped measurement fails that check. JSON is saved
after each completed check as well as at the end, so an interrupted run keeps
its progress and is never described as complete.

Screen economy prints file and viewport progress with `--progress`; JSON stays
on stdout and progress goes to stderr. `--page-timeout-ms=15000` bounds each
viewport measurement, and a measurement timeout exits 2 rather than reporting
a clean page. The result includes per-viewport timing and measurement errors.

The command printed by the Claude Stop hook uses POSIX shell syntax. Its
integration test is `tests/integration/hooks-bash.test.mjs`; the common hook
logic stays in `tests/meta/hooks.test.mjs` on every OS. Linux render CI runs the
integration with `REQUIRE_BASH=1`. On Windows, set `BASH_BIN` to an installed
compatible shell to run it. Without a shell it reports NOT verified; with
`REQUIRE_BASH=1`, absence is a failure. It is not silently counted as a common
accuracy check. Windows CI runs the common gates and the explicit smoke profile;
Linux render CI also runs the full report.

## What a meta-test asserts

`rejects()` requires exit status exactly 1, and refuses three near-misses that
would otherwise look like a detection:

- a **usage message** (nine gates print one and exit 0 when handed nothing, so a
  typo'd fixture path would read as clean),
- a **SKIPPED** line (the gate never opened a browser),
- exit 1 whose output does not match the signal under test (a crash, not a find).

`accepts()` applies the same filters in reverse.

## Fixtures must not poison the real gates

`fixtures/bad/` contains an emoji, raw hex, and a failing contrast pair on
purpose. None of the repo-wide default scans reach into `tests/`, and
`meta/guards.test.mjs` holds that in place: if a default scan ever grows to
cover this directory, CI would go red for the wrong reason.

## Known blind spots

Not everything is coverable, and pretending otherwise is the failure mode this
directory exists to prevent.

- **`validate_theme_refs.py` scanned `examples/golden` and nothing else** until
  2026-09-15, so a `var()` pointing at a token no theme defines survived
  everywhere else. That is how `--space-7` reached the front door: the whole
  `gap` shorthand was invalid, the stat labels collided, and every gate still
  reported green. It takes repeated `--theme` files now, counts a custom
  property defined inside the scanned file as defined, and the gate runs it
  across the templates, harnesses, demos and the front door.
- **`design_systems.py` and `accuracy_report.mjs` are still hardwired to the repo
  root.** The other three - `validate_component_spec.py`,
  `validate_instruction_surface.py`, `validate_template.py` - take `--root` now,
  and `meta/root-scoped.test.mjs` uses it to show each one refusing a broken
  copy. `accuracy_report.mjs` is the runner itself, so pointing it elsewhere is a
  different feature. `design_systems.py` reads the index an install carries;
  its `catalog` and `index` output are generated from specs only the repo has.
- **The library is tested from the tarball, not the repo.** The repo has every
  spec on disk, so a test run from it passes whether or not fetching works.
  `cli/library.test.mjs` unpacks `npm pack`, points the loader at a local server
  that serves a spec intact, one byte off, or not at all, and checks the refusal
  as hard as the success.
- **`build_tokens.mjs` is a generator first.** Without `--check` it still writes
  what it can and exits 0, because that is what a generator should do; the gate
  runs it with `--check`, which turns a dropped reference into a failure. `unit/`
  covers both modes, plus the output contract: a directory build emits the whole
  system rather than colour alone, and no composite token reaches the CSS as
  `[object Object]` or a stray brace. Those last two exist because the bugs
  shipped: the colour-only directory build stood for four releases while CI ran
  the command and checked only its exit status.
- **Taste is still not covered.** `slop_tells` and `taste_audit` only fail on
  HIGH findings under `--strict`; MED and LOW never fail anything, by design.
  These tests confirm the HIGH signals fire. They say nothing about whether the
  work is good.
