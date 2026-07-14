---
name: Mirror Citty CLI Migration
purpose: Define the outcome, compatibility contract, safety boundaries, and completion signals for migrating Mirror's CLI to Citty.
description: Specifies the complete replacement of handwritten argument parsing and routing while preserving Mirror commands, release behavior, hooks, help, agent automation, and native packaging.
created: 2026-07-14
flags:
  - completed
  - validated
tags:
  - cli
  - migration
  - release
keywords:
  - mirror
  - citty
  - argument parsing
  - command routing
  - native binary
owner: mirror-docs-todo
---

# Mirror Citty CLI Migration

## Summary

Migrate Mirror to the same Citty-owned CLI architecture proven in RunX.
Citty must become the only argument parser, command router, alias registry, and
ordinary usage generator. Mirror's version planning, release execution, hooks,
configuration, agent automation, self-management, reporting, and Git behavior
remain domain logic and must not be rewritten as part of the migration.

## Todo Index

- Task: `Citty CLI Migration`
- Status: completed
- Index: [TODO.md](../../TODO.md)

## Outcome

The shipped npm launcher and every Bun-native Mirror executable use one
declarative Citty command tree. No general Mirror-owned token loop, positional
collector, or top-level conditional router remains, while existing commands,
flags, output contracts, release safeguards, hooks, and error semantics remain
compatible. Narrow compatibility normalizers retain exact `-dy` and
repeated/comma-separated `--output` and `--auxiliary` behavior that Citty
`0.2.2` does not preserve by itself.

## Implementation Result

- Status: completed and validated on 2026-07-14.
- Implementation: [Citty CLI migration implementation](citty-cli-migration-implementation.md)
- Validation: [Citty CLI migration validation](../validation/citty-cli-migration.md)
- Release state: no version bump, tag, push, or publish was performed.

## Current Baseline

- `mirror/source/flags.ts` expands short aliases and parses long options.
- `mirror/source/cli.ts` separately collects positionals and routes commands
  through a large conditional dispatcher.
- `mirror/source/help.ts` owns contextual help, the extended command tree, and
  Markdown help documentation.
- `MirrorUsageError` distinguishes usage failures from `MirrorError` domain
  failures.
- The package is Bun-native and must not gain a Node.js runtime dependency.

## Scope

### In scope

- Add `citty` as a production dependency in `mirror/package.json` and update
  the package lock with Bun.
- Replace the handwritten parser in `mirror/source/flags.ts`, the
  `collectPositionals` loop, and the manual top-level router in
  `mirror/source/cli.ts` with one Citty command tree.
- Remove `mirror/source/flags.ts` after all consumers have migrated.
- Preserve current command handlers and domain modules behind thin Citty
  adapters.
- Update tests, `mirror/DOCS.md`, `mirror/README.md`, `AGENTS.md`, the bundled
  Mirror skill when its CLI contract is described, and affected XDocs
  descriptors.
- Validate package-launcher and native-binary behavior on supported targets.

### Out of scope

- Changing semantic-version calculations, config schema, file adapters, hook
  ordering, reporters, Git mutation behavior, release protection, installers,
  or self-upgrade algorithms except where a thin CLI adapter is required.
- Adding Commander, yargs, oclif, Clipanion, or a second parser around Citty.
- Publishing, tagging, or applying a Mirror release as part of the migration
  implementation unless separately authorized.

## Required Command Tree

```text
mirror
|- init [source]
|- config
|  |- show
|  |- check
|  `- schema
|- agents
|  |- install <local|global>
|  `- instructions
|- version
|  |- current
|  |- next <target>
|  |- plan <target>
|  `- apply <target>
|- upgrade
|  |- check
|  `- list
`- uninstall
```

The bare `mirror upgrade` path remains the default upgrade action. The hidden
background update-check worker remains callable only by internal automation.

## Compatibility Contract

- Bare `mirror` preserves agent automation, cached-update notice,
  background-check scheduling, and home help behavior.
- Citty owns `-h`/`--help` and `-v`/`--version`; neither path may require a
  Mirror config or perform a release mutation.
- Preserve `-y` for `--yes` and `-dy` for `--dry-run`.
- Preserve `--cwd`, `--config`, `--format`, `--no-color`, `--verbose`,
  `--help-tree`, and `--help-docs` at the appropriate scopes.
- Preserve init and release overrides, including repeated/comma-separated
  `--output` and `--auxiliary`, adapter validation, `--source`,
  `--package-file`, `--jsr-file`, `--tag-template`, `--name`, `--preid`,
  `--commit`, `--push`, `--allow-dirty`, `--non-interactive`, and `--yes`.
- Preserve `upgrade --version`, `--arch`, `--variant`, and `--dry-run` without
  confusing the upgrade target with the global version flag.
- Preserve `--tool agents|claude|all` and local/global agent installation.
- Unknown flags, commands, nested commands, and missing targets must produce
  contextual usage failures and must never fall through to a release.

## Domain and Safety Boundaries

- `version plan` remains read-only.
- `version apply` keeps confirmation, dry-run, dirty-worktree, commit, tag,
  push, and output-file behavior unchanged.
- Hook phases and cleanup guarantees remain in their existing order from
  `before:everything` through `after:everything`.
- Help, version, config schema, dry runs, upgrade checks, and agent inspection
  paths must not execute a version plan.
- `--no-color` takes effect before any output and restores patched process
  output after execution.
- JSON output remains machine-readable with no banner or notice in stdout.
- Usage failures retain `MirrorUsageError` semantics; operational failures
  retain `MirrorError` and existing exit codes.

## Implementation Boundaries

- Keep binary entrypoints thin and invoke a testable Citty-backed
  `runMirrorCli(rawArgs)` function.
- Define positionals and flags on the command that owns them.
- Use Citty metadata for ordinary usage. Keep `--help-tree`, `--help-docs`,
  banners, update notices, and extended Mirror help as custom output.
- Pass normalized typed values into existing domain functions; do not recreate
  a generic flags record that becomes a second parser.
- Preserve interactive init prompting and command-specific validation.

## Acceptance Signals

- `citty` is the sole runtime CLI parser/router dependency.
- `mirror/source/flags.ts`, `collectPositionals`, and the manual dispatch chain
  are gone.
- Every public command, nested command, positional, flag, alias, default route,
  and hidden worker has automated coverage.
- Tests cover contextual help, version outside a configured project, unknown
  input, missing targets, JSON, no-color, repeated values, init, dry-run,
  hooks, release apply, upgrade, uninstall, and agent automation.
- `bun run typecheck`, `bun test`, `bun run build`, and `bun run binary` pass
  from `mirror/`.
- The npm launcher and native executable expose matching help, version,
  routing, and errors without a Node.js runtime.
- Package inspection proves Citty is shipped and generated output was not
  hand-edited.
- Relevant XDocs metadata and documentation checks pass.

## Dependencies and Context

- Use the RunX Citty migration as the behavioral reference, not source to copy
  blindly.
- Preserve pre-existing worktree changes, especially contextual-help and
  self-upgrade work that overlaps CLI tests.
- Inspect installed Citty types before implementing aliases, nested defaults,
  repeated values, and contextual usage.

## Watch-outs

- A release must never run because an unknown token selected a default route.
- Global `--version` and `upgrade --version <target>` have different meanings.
- `--push` is externally visible; parsing changes must not weaken planning or
  confirmation boundaries.
- Preserve extended help and do not edit generated `bin/` output.

## Before Starting

- Confirm the worktree and branch and preserve overlapping user changes.
- Run the current typecheck and focused CLI tests for a baseline.
- Inventory flags and routes from CLI, flags, help, tests, and `DOCS.md`.

## While Working

- Migrate one command group at a time and add regressions before removing its
  handwritten path.
- Keep domain functions independent of Citty.
- Recheck non-mutation boundaries after every command group.

## After Finishing

- Run all Bun, package, native-binary, and XDocs validations above.
- Update public docs, skill guidance, descriptors, and release notes before any
  later version bump.
- Deliver through protected CI; plan publishing separately with GUIHO Mirror.

## References

- [TODO.md](../../TODO.md)
- [Implementation record](citty-cli-migration-implementation.md)
- [Validation report](../validation/citty-cli-migration.md)
- [CLI contextual help design](../cli-contextual-help-design.md)
- [Mirror package documentation](../../mirror/DOCS.md)
