---
name: Mirror Citty CLI Migration Implementation
purpose: Record the implementation decisions and completed changes for Mirror's Citty CLI migration.
description: Documents the Citty command tree, compatibility adapters, test isolation, documentation work, and implementation handoff.
created: 2026-07-14
flags:
  - completed
  - validated
tags:
  - cli
  - migration
  - implementation
keywords:
  - mirror
  - citty
  - command tree
  - compatibility
owner: mirror-docs-todo
---

# Mirror Citty CLI Migration Implementation

## Summary

Mirror now uses Citty as its declarative command router, argument parser, alias
registry, and ordinary usage renderer. Existing versioning, configuration,
agent automation, hooks, reporting, Git, upgrade, and uninstall modules remain
the domain implementations behind thin command handlers.

## Links

- [Task specification](citty-cli-migration.md)
- [Validation report](../validation/citty-cli-migration.md)
- [Package documentation](../../mirror/DOCS.md)

## Decisions

- Citty `0.2.2` is the sole general-purpose CLI parser and router.
- The declarative tree lives in `mirror/source/cli.ts`; the previous
  `mirror/source/flags.ts` parser and manual positional/router paths were
  removed.
- Two narrow compatibility normalizers remain because Citty `0.2.2` does not
  preserve the historical forms by itself: exact `-dy` is normalized to
  `--dry-run`, and repeated/comma-separated `--output` and `--auxiliary`
  values are collected for their owning commands.
- The root `README.md` remains the repository overview. A package-local
  `mirror/README.md` was restored so the published package contains concise
  CLI guidance.
- Windows test fixtures use `C:\tmp` so unrelated ancestor `AGENTS.md` files
  outside the repository cannot change fixture discovery behavior.

## Implemented Changes

- Added Citty as a runtime dependency and updated the Bun lockfile.
- Defined root, init, config, agents, version, upgrade, uninstall, and hidden
  worker routes with command-scoped arguments and contextual usage.
- Preserved global help/version behavior, extended help, JSON/no-color output,
  repeated init values, release safeguards, dry runs, hooks, upgrade checks,
  agent automation, and native executable behavior.
- Removed the obsolete parser export and parser module.
- Expanded regression coverage for routing, aliases, scoped errors, hidden
  worker behavior, native-safe uninstall dry runs, and package dependency
  expectations.
- Updated AGENTS, repository and package READMEs, `mirror/DOCS.md`, the bundled
  Mirror skill, and affected XDocs descriptors.

## Handoff

The migration is implemented and validated. No version bump, tag, push,
publish, or production mutation was performed as part of this task.
