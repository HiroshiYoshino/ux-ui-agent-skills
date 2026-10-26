# Codex adapter: compatibility and contract

Reviewed on 2026-10-26. This is a source review, not a Codex runtime test. The
Codex CLI, desktop app, and IDE integration were not installed in this
environment. Do not read a source-level capability as proof that a packaged
skill, hook, plugin, or MCP server works in a particular client.

## Evidence and limits

The official documentation pages below were linked from OpenAI's public
`openai/codex` repository, but their live content could not be retrieved during
this review. The implementation notes are pinned to the public repository
snapshot `970111f6cb62cc02fe36a82ea7d71b37a2889c97`, retrieved on 2026-10-26.
No Codex runtime version was measured.

| Official source | What was available |
|---|---|
| [Skills](https://developers.openai.com/codex/skills) | Documentation link plus the official repository's skill parser, discovery, and sample skill files |
| [AGENTS.md](https://developers.openai.com/codex/guides/agents-md) | Documentation link only; precedence details were not verified |
| [Configuration](https://developers.openai.com/codex/config-reference) | Documentation link; repository configuration stub documents managed-hooks-only policy |
| [Security](https://developers.openai.com/codex/security) | Documentation link only; approval defaults and client differences were not verified |
| [IDE](https://developers.openai.com/codex/ide) | Repository README link only; capability parity was not verified |
| [Codex app](https://chatgpt.com/codex?app-landing-page=true) | Repository README link only; capability parity was not verified |
| [Codex source snapshot](https://github.com/openai/codex/tree/970111f6cb62cc02fe36a82ea7d71b37a2889c97) | Read-only implementation evidence cited by source path below |

The source paths are not a substitute for product documentation. In
particular, no plugin manifest or public plugin-distribution contract is
claimed here.

## Capability and verification status

Capability status describes this kit's integration, not whether Codex as a
product has the feature. Verification is a separate axis.

| Capability | Kit status | Verification | Scope and limit |
|---|---|---|---|
| `AGENTS.md` guidance and existing gates | adapted | source-reviewed; existing static tests | Existing `--agent codex` remains the instruction-and-gates route. It does not install Codex skills or Claude hooks. |
| Workspace skills in `.agents/skills/` | adapted | format and output statically tested; runtime untested | Optional `init --agent codex --with-skills` emits Codex `SKILL.md` metadata. Official source resolves repository `.agents/skills` roots and supports `name`, `description`, and `metadata.short-description`. |
| `critique` | fallback | generated output statically tested; runtime untested | Same-context self-review only. It is not an independent reviewer and says so in the skill. |
| `observe` | unsupported | not tested | Current observer consumes Claude hook events; no Codex event source is connected. |
| `scaffold-project` | unsupported | not tested | The bundled scaffold is Claude Code-specific; this route does not generate Codex settings. |
| Lifecycle hooks | unsupported | source-reviewed only | Codex source contains hook configuration and event types, but this kit has no Codex hook adapter or sanitized runtime fixture. No approval or sandbox policy is changed. |
| MCP | fallback | generic server tests only; Codex connection untested | The kit's MCP server remains available for manual client configuration. This install route does not write Codex configuration or claim a successful connection. |
| Plugins and public plugin distribution | unsupported | not tested | No manifest, installation, marketplace, or public-distribution format is generated. |
| Desktop and IDE integration | unsupported by this adapter | not tested | The workspace-skill generator targets a project directory. Skills, hooks, plugins, and MCP parity in desktop and IDE clients are not asserted. |

The generated `docs/codex-skill-port-report.json` reports every source skill,
including unsupported entries. `static-only` means generation and repository
tests, not a Codex runtime acceptance test.

## Evidence from the pinned Codex source

- `codex-rs/skills/src/selection.rs` resolves repository skill roots under
  `.agents/skills` and explicitly recognizes `$skill-name` mentions.
- `codex-rs/skills/src/parser.rs` parses `name`, `description`, and
  `metadata.short-description`.
- `codex-rs/skills/src/assets/samples/skill-creator/SKILL.md` documents
  `$CODEX_HOME/skills` (or `~/.codex/skills` when unset) as a user-level
  discovery location and describes `agents/openai.yaml`.
- `codex-rs/skills/src/assets/samples/skill-creator/references/openai_yaml.md`
  documents `policy.allow_implicit_invocation`, defaulting to enabled.
- `docs/config.md` points to the official configuration documentation and
  documents `allow_managed_hooks_only` in `requirements.toml`. It does not
  provide the hook event payload contract.
- `codex-rs/protocol/src/hooks.rs` defines event configuration types. This
  source review did not validate event behavior in a running client.

All cited source links are available from the pinned snapshot, for example:
`https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/skills/src/selection.rs`.

## Shared adapter contract

This is the target contract for adapters. It does not claim that all current
paths already use it.

- **Capability status:** `native`, `adapted`, `fallback`, or `unsupported`.
- **Verification status:** `not-tested`, `docs-reviewed`, `source-reviewed`,
  `static-only`, or `runtime-tested`. Record the product surface and tested
  version for `runtime-tested`; never infer it from static tests.
- **Roots:** `kitRoot` is the immutable source of shipped scripts and
  references. `projectRoot` is the absolute root of the project being
  modified. A Codex workspace skill is discovered under
  `projectRoot/.agents/skills/<name>/`; skill references to installed kit
  assets resolve from `projectRoot`, not the caller's current directory.
- **Normalized event:** `{ schemaVersion, source, event, sessionId,
  projectRoot, observedAt, paths }`. Adapter-specific stdin, environment
  variables, trust state, and patch formats remain at the adapter boundary.
  An absent session or project identity must not be replaced by a shared
  fallback identity.
- **Gate result:** `{ status, gate, projectRoot, targets, inspectedCount,
  exitCode, startedAt, finishedAt, output }`, where `status` is `PASS`,
  `FAIL`, `SKIPPED`, or `ERROR`. A missing target, zero inspected items,
  skipped browser, timeout, or missing required gate cannot be `PASS`.
- **Receipt:** records the gate result, target hashes, relevant configuration
  and dependency hashes, gate/version, arguments, project root, and timestamp.
  Required-gate aggregation must keep per-gate failures and omissions visible.
  A receipt is quality evidence, not a security boundary or tamper-proof
  approval.

The existing shell receipt writer and MCP runner do not yet share this
contract. Claude hook event handling remains Claude-specific. Codex hook
integration, shared receipt storage, required-gate aggregation, and
cross-client concurrency are follow-up work, not completed features.

## Compatibility and safe installation

- `init --agent codex` is unchanged for compatibility.
- `init --agent codex --with-skills` is an opt-in workspace-skill route.
- The generator does not write a Codex config, plugin manifest, hook config,
  or user-level `$CODEX_HOME` files. It does not publish packages or releases.
- Existing files are skipped unless the user explicitly passes `--force`.
- A skill port report is written to
  `docs/codex-skill-port-report.json`; review unsupported and fallback entries
  before relying on the generated skills.

No CLI, desktop, or IDE runtime acceptance test has been completed. Do not
describe this source review or the static install tests as Codex compatibility
certification.
