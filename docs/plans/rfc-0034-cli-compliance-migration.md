---
name: Mirror RFC 0034 CLI Compliance Migration Plan
purpose: Provide an executable breaking-change plan for making the Mirror CLI fully comply with GUIHO RFC 0034.
description: Sequences Mirror's TypeBox and YAML migration, Citty catalog normalization, startup lifecycle, Developer Context help, complete agent namespace, upgrade/install distribution, fourteen assets, documentation, and validation.
created: 2026-07-18
flags:
  - approved
  - breaking-change
  - implementation-ready
tags:
  - planning
  - cli
  - migration
  - rfc-0034
keywords:
  - mirror
  - guiho-s-0034-cli-engineer
  - TypeBox
  - mirror.yaml
  - agent namespace
  - darwin assets
  - fourteen release assets
owner: mirror-docs-plans
---

# Mirror RFC 0034 CLI Compliance Migration Plan

## Outcome

Convert `@guiho/mirror` into a complete RFC 0034 CLI while preserving Mirror's
semantic-versioning domain responsibilities. The migration is intentionally
breaking and does not need to read legacy TOML configuration, preserve short
aliases, preserve `mirror agents`, preserve automatic agent-file mutation on
ordinary commands, preserve `guiho-mirror-*`/`macos` assets, or preserve the
Bun-dependent npm launcher.

Mirror must finish with Bun, strict ESM TypeScript, raw Citty, and TypeBox; YAML
configuration; exact startup/cache behavior; generated Developer Context help;
the complete singular agent namespace; complete upgrade and installer behavior;
a Node-compatible npm bootstrap; and exactly fourteen release assets.

## Authority And Required Execution Roles

Every implementation session must use:

- `guiho-a-0001-swe`, the GUIHO Software Engineer/SWE agent, as coordinator.
- `guiho-s-0034-cli-engineer` as the mandatory CLI specialist skill.
- `guiho-s-0023-plan-executor` to execute this plan one unit at a time.
- `guiho-s-0015-bun`, `guiho-s-0019-typescript`, and
  `guiho-s-0011-typebox` for source changes.
- `guiho-s-0016-writing-docs`, `guiho-s-0017-todo`, and `guiho-s-xdocs` for
  durable context.
- `guiho-s-mirror` for Mirror-managed versioning only after implementation is
  validated and release authorization is explicit.
- `guiho-s-0020-cloud-computing` when release workflows or GitHub-hosted
  installation infrastructure change.
- `guiho-s-0029-implementation-reviewer` and
  `guiho-s-0030-validation-reporter` before completion.

The CLI engineer is a skill, not an agent; the SWE agent owns lifecycle
coordination.

## Approved Breaking-Change Boundary

- Replace every `mirror.config.toml` input/output/reference with `mirror.yaml`.
- Do not implement a TOML fallback, conversion layer, deprecation period, or
  dual schema.
- Remove `-dy` and `-y`; only `-h` and root `-v` remain.
- Replace `mirror agents ...` and its `--tool`/positional-scope interface with
  the singular RFC namespace.
- Remove automatic skill installation and instruction mutation from normal
  Mirror version/config commands.
- Replace current marker text with exact RFC markers.
- Rename release binaries from `guiho-mirror-*` to `mirror-*` and from `macos`
  to `darwin`.
- Replace the Bun package launcher with a Node-compatible native bootstrap.
- Downstream GUIHO repositories using TOML become explicit follow-up migrations;
  Mirror itself does not retain compatibility to accommodate them.

## Final Public Command Catalog

```text
mirror
├── init
├── config
│   ├── show
│   ├── check
│   └── schema
├── version
│   ├── current
│   ├── next <target>
│   ├── plan <target>
│   └── apply <target>
├── agent
│   ├── skill
│   │   ├── install
│   │   ├── uninstall
│   │   ├── update
│   │   ├── list
│   │   └── show <id>
│   ├── instruction
│   │   ├── apply
│   │   ├── remove
│   │   ├── update
│   │   └── show
│   └── prompt
│       ├── list
│       └── show <id>
├── upgrade
│   ├── check
│   └── list
└── uninstall
```

Mirror release targets remain `major`, `premajor`, `minor`, `preminor`, `patch`,
`prepatch`, `prerelease`, or exact SemVer. They are domain values, not command
aliases. All other flags use descriptive long kebab-case names.

## Skill Routing By Unit

| Units | Required skills |
| --- | --- |
| MR-01 | `guiho-a-0001-swe`, `guiho-s-0023-plan-executor`, `guiho-s-0034-cli-engineer`, and `guiho-s-mirror` for read-only self-hosting inspection |
| MR-02-MR-04 | Add `guiho-s-0011-typebox`, `guiho-s-0015-bun`, `guiho-s-0019-typescript`, and `guiho-s-xdocs` |
| MR-05-MR-09 | Keep CLI engineer, Bun, TypeScript, TypeBox, and xdocs loaded |
| MR-10-MR-13 | Add `guiho-s-0020-cloud-computing` for GitHub release/CI behavior; Mirror version application remains prohibited |
| MR-14 | Add `guiho-s-0016-writing-docs` and `guiho-s-0017-todo` |
| MR-15 | Use SWE coordination plus writing-docs/TODO skills for the downstream handoff |
| MR-16 | Add `guiho-s-0029-implementation-reviewer` and `guiho-s-0030-validation-reporter` |

Every row inherits the SWE agent and plan executor. Skills must be reloaded in a
new execution session rather than assumed active.

## Execution Sequence

### Unit MR-01 - Baseline, Consumer Inventory, And Bootstrap Strategy

- Goal: establish the live baseline and identify the impact of deleting TOML
  support before modifying the self-hosting versioning tool.
- Owner: repository root and `mirror/` package.
- Dependencies: none.
- Actions:
  1. Confirm branch/status and preserve unrelated work.
  2. Run package typecheck and tests from `mirror/`.
  3. Capture current help, command, config, agent, update, installer, wrapper,
     and asset behavior.
  4. Search this repository and the GUIHO root package map for documented
     `mirror.config.toml` consumers; record them as downstream follow-up, not
     compatibility requirements.
  5. Decide the safe self-hosting sequence: use the currently installed Mirror
     only to release the final migration after the new implementation and
     `mirror.yaml` are validated.
  6. Record current prohibited-import search, current asset list, and current
     agent automation side effects.
- Acceptance:
  - The implementation team knows how Mirror will validate and eventually
    release itself after deleting TOML.
  - No downstream repository is modified by this package-local plan.
- Stop conditions:
  - Stop if the worktree contains unexplained overlapping changes or no safe
    self-hosting validation path exists.

### Unit MR-02 - Add TypeBox And Define Authoritative Schemas

- Goal: replace manual shape checking with TypeBox runtime contracts.
- Dependencies: MR-01.
- Expected files:
  - `mirror/package.json`, `bun.lock`
  - `mirror/source/schema.ts`, `mirror/source/types.ts`
  - new focused schema modules where appropriate
  - schema tests and descriptors.
- Schemas:
  - complete Mirror YAML configuration
  - package.json and jsr.json version-source payloads
  - update cache
  - GitHub release/asset responses and catalog envelopes
  - agent resource metadata
  - enum-like CLI values and positive integers
  - JSON output envelopes and hook payloads where externally consumed.
- Actions:
  1. Add `@sinclair/typebox` as a runtime dependency.
  2. Define schemas with `additionalProperties` policy deliberately.
  3. Derive static types from schemas.
  4. Decode unknown data before use.
  5. Generate the public JSON Schema/reference from the same TypeBox source.
- Acceptance:
  - There is one runtime contract per structured boundary.
  - Handwritten `typeof` chains no longer act as the primary schema.

### Unit MR-03 - Replace TOML With The Exact YAML Configuration Contract

- Goal: make `mirror.yaml` the only Mirror configuration.
- Dependencies: MR-02.
- Expected files:
  - `mirror/source/config.ts`
  - `mirror/source/init.ts`
  - `mirror/source/schema.ts`
  - `mirror/source/reporter.ts`
  - `mirror/source/hooks.ts`
  - `mirror/schema/`
  - fixtures, docs, skills, and tests.
- Resolution order:
  1. `--config <path>`
  2. `<effective-cwd>/mirror.yaml`
  3. `~/.guiho/mirror/mirror.yaml`
- Actions:
  1. Remove root/nested `mirror.config.toml` discovery.
  2. Parse with `Bun.YAML.parse`.
  3. Decode with TypeBox and reject invalid YAML/shape without coercion.
  4. Delete `agents.auto_agents_md`, `agents.auto_skill_install`, and
     `agents.skill_tool`; explicit agent commands replace those mutation
     settings. Preserve Mirror's domain-specific `agents.write_changelog` and
     `agents.changelog_path` settings in the YAML schema.
  5. Make `mirror init` create/reconcile YAML only.
  6. Make `mirror config show/check/schema` describe the YAML contract.
  7. Print `configuration file loaded: <absolute-path>` for every loaded file.
  8. Rename hook/environment documentation that exposes the resolved config
     path but preserve the actual path value.
  9. Convert this repository's package-local self-hosting config to
     `mirror.yaml` in the same coherent implementation unit.
- Acceptance:
  - No source, test, skill, README, DOCS, schema, or help reference promises
    TOML.
  - Config precedence and error exit code `3` are tested.

### Unit MR-04 - Keep Core Source Bun-Only And Isolate Platform Utilities

- Goal: preserve Mirror's current strength—no prohibited Node imports—while
  normalizing modules for RFC behavior.
- Dependencies: MR-03.
- Expected files:
  - `mirror/source/runtime.ts`
  - `mirror/source/path.ts`
  - new storage/config/cache modules
  - static compliance test.
- Actions:
  1. Use Bun file/write/spawn APIs for all core behavior.
  2. Resolve module resources with URLs and `Bun.fileURLToPath`.
  3. Resolve home through Bun environment values and fail clearly if absent.
  4. Add a static test banning Node filesystem, child-process, path, and OS
     imports in core source.
  5. Keep the Node exception confined to the npm bootstrap.
- Acceptance:
  - Core source remains Bun-only after the larger migration.

### Unit MR-05 - Rebuild One Final Citty Tree And Remove Short Aliases

- Goal: make the final catalog authoritative.
- Dependencies: MR-02 through MR-04.
- Expected files: `mirror/source/cli.ts`, focused command modules, CLI tests.
- Actions:
  1. Keep every final command in raw Citty definitions.
  2. Remove `-dy` and `-y`.
  3. Keep only `-h` and root `-v`.
  4. Use Citty context rather than raw-argument pre-scans for ordinary routing,
     version, help, and validation.
  5. Validate release targets, adapters, formats, architecture, variant, pages,
     and counts through TypeBox.
  6. Preserve the release safety model: `version plan` stays read-only;
     `version apply` owns mutation and explicit confirmation.
- Acceptance:
  - One command tree owns commands, metadata, help traversal, and docs
    traversal.
  - No proprietary parser/router or command alias exists.

### Unit MR-06 - Implement The Exact Startup And Cache Lifecycle

- Goal: standardize Mirror startup without blocking version operations.
- Dependencies: MR-02, MR-03, and MR-05.
- Storage:
  - `~/.guiho/mirror/mirror.yaml`
  - `~/.guiho/mirror/cache.json`
- Exact startup:
  1. synchronously read and TypeBox-decode cache
  2. print the exact cached update notice first when applicable
  3. load/decode/report configuration when needed
  4. spawn a hidden detached update worker
  5. route the command
  6. no arguments prints `Hello Windows - mirror v<version>`.
- Actions:
  - Replace XDG/`.cache` storage and current cache field names with the RFC
    object.
  - Ensure the worker validates GitHub payloads and never recursively spawns.
  - Remove automatic agent writes from startup and ordinary commands.
  - Keep corrupt cache recoverable and verbose-only.
- Acceptance:
  - Foreground tests prove no network wait and exact output ordering.

### Unit MR-07 - Generate Developer Context Help From Citty

- Goal: delete the separate drifting `HelpRecord` catalog.
- Dependencies: MR-05.
- Actions:
  1. Attach descriptions, positionals, flags, examples, and subcommands to the
     real definitions.
  2. Generate standard help through Citty.
  3. Implement `--help-tree` at every scope with `COMMAND TREE` and Unicode
     branches.
  4. Implement TypeBox-validated
     `--help-tree-depth <positive-integer>`.
  5. Generate redirect-safe Markdown for `--help-docs`.
  6. Keep help/version free of config, agent, update, Git, or filesystem
     mutations.
- Acceptance:
  - No ASCII `|-`, manual parallel command catalog, or missing nested help mode
    remains.

### Unit MR-08 - Replace Existing Agent Automation With The Full Namespace

- Goal: convert the substantial current agent implementation into the exact RFC
  contract instead of discarding its useful idempotency and discovery logic.
- Dependencies: MR-02, MR-04, and MR-05.
- Expected files:
  - `mirror/source/agents.ts`
  - `mirror/source/commands/agent.ts`
  - embedded-resource module/native entrypoint
  - `mirror/skills/guiho-s-mirror/SKILL.md`
  - `mirror/prompts/guiho-i-mirror.md`
  - tests and descriptors.
- Skill actions:
  - Global default; `--local` selects project scope.
  - `install`, `update`, and `uninstall` always operate on both
    `.agents/skills/guiho-s-mirror` and
    `.claude/skills/guiho-s-mirror`.
  - `list [--filter]` and `show <id>` expose embedded metadata.
  - Remove legacy `guiho-as-mirror` during update/uninstall, not through an
    implicit ordinary-command side effect.
- Instruction actions:
  - Use exact markers
    `<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->` and
    `<!-- END MIRROR -->`.
  - Resolve AGENTS/CLAUDE exactly: one, both, or create AGENTS when neither.
  - Implement idempotent apply/remove/update/show.
  - Remove ancestor-walking behavior that could mutate a parent project when
    the selected local project is the intended target.
- Prompt actions:
  - Create `guiho-i-mirror.md` with the canonical Mirror planning/release
    instruction prompt.
  - Implement description list, `--names`, and raw-body show.
- Remove:
  - `mirror agents install`, `mirror agents instructions`, positional
    `local|global`, `--tool`, and config-driven auto-agent fields.
  - `runMirrorAgentAutomation` calls from ordinary init/config/version flows.
- Acceptance:
  - Tests cover every command, both directories, zero/one/two instruction
    files, legacy cleanup, idempotency, filtering, metadata, prompt raw output,
    and isolated homes.

### Unit MR-09 - Standardize Output, Errors, And Exit Codes

- Goal: provide stable human and agent contracts.
- Dependencies: MR-02 through MR-08.
- Exit codes:
  - `0` success
  - `1` unexpected/operational failure
  - `2` usage or TypeBox validation failure
  - `3` configuration failure
  - `4` remote release/network failure
  - `5` install/upgrade/filesystem mutation failure
  - `130` interruption.
- Actions:
  - Keep ordinary text on stdout and diagnostics on stderr.
  - Emit exactly one JSON document in JSON mode.
  - Keep Git/upgrade progress out of JSON stdout.
  - Preserve delegated Git process exit codes when Mirror explicitly delegates.
- Acceptance:
  - CLI tests assert streams, JSON parsing, and stable failure categories.

### Unit MR-10 - Complete Upgrade Check/List/Apply

- Goal: retain the verified transaction while matching every RFC flag and
  reconciliation rule.
- Dependencies: MR-02, MR-06, MR-08, and MR-09.
- `mirror upgrade`:
  - `--version`
  - `--arch`
  - `--variant`
  - `--dry-run`
  - `--format`.
- `mirror upgrade list`:
  - `--page`
  - `--per-page`
  - `--pre-releases`
  - stable-only default and latest-first order.
- Actions:
  1. Default x64 to baseline.
  2. TypeBox-decode remote pages and numeric flags.
  3. Keep observable download/validate/replace/verify/cache/cleanup events.
  4. Verify the canonical executable before success.
  5. After success, update the global skill in both directories.
  6. Reconcile local instruction blocks when inside a project.
  7. Write the RFC cache only after verification.
- Acceptance:
  - Existing reliability/rollback tests remain, expanded for pagination,
    pre-releases, JSON cleanliness, cache shape, and agent reconciliation.

### Unit MR-11 - Rebuild Direct Installers With Agent Assets

- Goal: make both canonical package installers and root delegates satisfy the
  complete installer contract.
- Dependencies: MR-08 and MR-10.
- Actions:
  1. Keep one implementation per shell; root `devops/install.*` may delegate.
  2. Print sequence heading, version, architecture, variant, and URL.
  3. Display real-time progress; remove silent curl/download behavior.
  4. Validate architecture/integrity and transactionally verify the binary.
  5. configure PATH when missing.
  6. download/install `guiho-s-mirror` to both global skill paths.
  7. download `guiho-i-mirror`, discover AGENTS/CLAUDE, and reconcile.
  8. print every mutation and final version verification.
- Acceptance:
  - Windows and POSIX isolated tests prove binary, PATH, both skills,
    instructions, rollback, corrupt/network failures, and visible progress.

### Unit MR-12 - Replace The Npm Launcher With A Node-Compatible Bootstrap

- Goal: make npm installation usable without Bun.
- Dependencies: MR-10 and final asset naming.
- Expected files: `mirror/package.json` and
  `mirror/scripts/mirror-bin.mjs`.
- Actions:
  - Replace the package `bin` target with a small Node ESM bootstrap at
    `scripts/mirror-bin.mjs`.
  - Detect platform/architecture/variant and cache the package-version binary.
  - Download when absent, chmod Unix binaries, forward args/stdio/env, and
    preserve exit code.
  - Remove Bun source fallback and postinstall dependence from the public
    launcher path.
  - Keep all versioning domain logic native.
- Acceptance:
  - Packed npm smoke tests run with Node while Bun is absent from PATH.

### Unit MR-13 - Enforce The Exact Fourteen Assets

- Goal: replace current legacy asset names and binary-only publishing.
- Dependencies: MR-08, MR-11, and MR-12.
- Required binaries:
  - `mirror-linux-arm64`
  - `mirror-linux-x64`
  - `mirror-linux-x64-baseline`
  - `mirror-linux-x64-modern`
  - `mirror-darwin-arm64`
  - `mirror-darwin-x64`
  - `mirror-darwin-x64-baseline`
  - `mirror-darwin-x64-modern`
  - `mirror-windows-arm64.exe`
  - `mirror-windows-x64.exe`
  - `mirror-windows-x64-baseline.exe`
  - `mirror-windows-x64-modern.exe`
- Required agent assets:
  - `guiho-s-mirror`
  - `guiho-i-mirror`
- Actions:
  - Remove `guiho-mirror-*` and `macos` naming everywhere.
  - Build through Bun-only tooling.
  - package both agent artifacts reproducibly.
  - upload exactly fourteen and fail CI on extras/legacy names/duplicates.
- Acceptance:
  - Build and workflow tests assert the exact set.

### Unit MR-14 - Update Canonical Docs, Skill, Schema, TODO, And XDocs

- Goal: remove every obsolete contract from durable documentation.
- Dependencies: MR-01 through MR-13 stable.
- Expected files:
  - root and package README/DOCS/CHANGELOG
  - `AGENTS.md`
  - bundled Mirror skill
  - schema/reference docs
  - TODO/spec/implementation note
  - previous help/Citty/upgrade docs when they conflict
  - all affected descriptors.
- Actions:
  1. Document `mirror.yaml`, exact precedence, and loaded-path output.
  2. Document final command catalog, no aliases, help modes, startup/cache,
     agent actions, upgrade flags, installer progress, wrapper, exit map, and
     fourteen assets.
  3. Supersede earlier decisions that require compatibility or TOML.
  4. Update the bundled skill so it no longer instructs users to inspect
     `mirror.config.toml` or use `mirror agents`.
  5. Keep XDocs tree and companion metadata valid.
- Acceptance:
  - Search finds no shipping/public `mirror.config.toml`, `mirror agents`,
    `-dy`, `-y`, `guiho-mirror-`, or `macos` contract.

### Unit MR-15 - Downstream Migration Handoff

- Goal: identify—not implement—the GUIHO repositories that must replace their
  Mirror TOML configuration after this breaking release.
- Dependencies: MR-03 and MR-14.
- Actions:
  - Produce a validation/handoff list with repository, current config path, and
    required `mirror.yaml` follow-up.
  - Add cross-repository coordination to the GUIHO root only when the developer
    authorizes that separate scope.
- Acceptance:
  - No consumer is silently assumed compatible.
  - This Mirror repository remains the owner of the new schema and migration
    reference.

### Unit MR-16 - Full Verification And Release Readiness

- Goal: prove the completion gate without publishing.
- Dependencies: MR-14 and MR-15.
- Checks from `mirror/` unless noted:
  1. `bun run typecheck`
  2. `bun test`
  3. `bun run build`
  4. `bun run binary`
  5. exact matrix build
  6. complete RFC CLI behavior suite
  7. Node-only packed npm bootstrap tests
  8. isolated installer tests
  9. prohibited-import scan
  10. exact fourteen-asset assertion
  11. strict xdocs metadata/tree/doctor checks from the root
  12. `git diff --check` and scoped final status.
- Evidence:
  - Implementation review and durable validation report.
  - TODO remains `testing` until all required evidence passes.
- Approval gates:
  - No version apply, tag, publish, push, real install, or consumer-repository
    edit without separate explicit authorization.

## First Executable Unit

Begin with MR-01, especially the self-hosting and downstream inventory. Then add
TypeBox in MR-02 before changing the configuration format in MR-03. Do not begin
the command/agent migration while the authoritative YAML schema is unsettled.

## Completion Definition

Mirror is complete only when YAML and TypeBox own every structured boundary,
normal commands no longer mutate agent files, the exact singular agent
namespace is fully tested, the startup/update lifecycle is non-blocking, the
npm/bootstrap/install paths work without Bun already installed, and release
validation observes exactly the fourteen RFC assets.

## References

- [Mirror TODO](../../todo.md)
- [RFC 0034 task specification](../todo/rfc-0034-cli-compliance-migration.md)
- [Current contextual help design](../cli-contextual-help-design.md)
- [Current upgrade plan](./upgrade-reliability-implementation.md)
- [Package documentation](../../mirror/DOCS.md)
