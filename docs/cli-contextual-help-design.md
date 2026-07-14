---
name: CLI Contextual Help Design
purpose: Define how Mirror responds to incomplete commands, help aliases, and usage errors
description: Approved design and implementation plan for contextual CLI help without changing successful command behavior.
created: 2026-07-14
flags:
  - final
  - decision
tags:
  - cli
  - documentation
  - versioning
keywords:
  - mirror version
  - contextual help
  - usage error
  - short help
  - -h
owner: mirror-docs
---

# CLI Contextual Help Design

## Problem

Mirror defines `version` and its subcommands in the help model, but the command dispatcher treats a bare `mirror version` invocation as unknown. It also treats `-h` as a positional command and reports missing required arguments without showing the relevant help.

## Considered Approaches

1. Add isolated special cases for `version`, `version plan`, and `-h`. This is the smallest immediate diff, but it would duplicate routing rules and leave the same poor behavior available to other command groups.
2. Add contextual usage errors and normalize help aliases in the shared CLI path. This keeps the help model authoritative and gives all command groups consistent behavior without replacing the existing router.
3. Replace the internal router with a declarative command framework. This could unify parsing and help generation, but it is disproportionate to the defect and conflicts with Mirror's intentionally small internal router.

Approach 2 is approved.

## Behavior

- A recognized command group without a subcommand prints that group's help and exits successfully.
- `-h` is an alias for `--help` at root, group, and subcommand scopes.
- A recognized command missing a required argument prints a precise error followed by that command's help and exits with status 1.
- An unknown command still reports an error, then prints help for the nearest recognized command scope.
- Existing successful command execution and output formats remain unchanged.

## Implementation Plan

1. Normalize `-h` through the shared flag parser and positional collector.
2. Represent command-usage failures with their nearest help path.
3. Route bare recognized groups to contextual help instead of the unknown-command path.
4. Render contextual help after usage errors while retaining a nonzero exit status.
5. Add CLI subprocess tests for the reported invocations and update `mirror/DOCS.md`.
6. Run the focused CLI tests, full tests, typecheck, and diff checks before planning the patch release.

## Acceptance Criteria

- `mirror version` prints version command help and exits 0.
- `mirror version -h` prints the same help and exits 0.
- `mirror version plan` prints the missing-target error and plan help, then exits 1.
- Tests cover the exit codes and output streams.
- Package documentation describes contextual help and the `-h` alias.
