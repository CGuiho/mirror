---
name: Mirror Upgrade Reliability
purpose: Define the expected outcome and completion signals for Mirror issues 9 and 10.
description: Requires observable, verified self-upgrades, exact-version recovery commands, complete release listing, hardened installers, and Windows-native regression coverage.
created: 2026-07-15
flags:
  - testing
tags:
  - cli
  - reliability
keywords:
  - mirror upgrade
  - upgrade list
  - recovery install
  - GitHub issue 9
  - GitHub issue 10
owner: mirror-docs-todo
---

# Mirror Upgrade Reliability

## Todo Index

- Task: `Mirror Upgrade Reliability`
- Status: testing
- Index: [todo.md](../../todo.md)
- Implementation notes: [upgrade-reliability-implementation.md](./upgrade-reliability-implementation.md)

## Outcome

`mirror upgrade` performs a visible, verified installation transaction at the canonical executable path; `mirror upgrade list` returns the complete SemVer-sorted published catalog; and every bare upgrade outcome prints exact-version recovery and process-stop commands.

## Scope

### In scope

- GitHub issues [#9](https://github.com/CGuiho/mirror/issues/9) and [#10](https://github.com/CGuiho/mirror/issues/10).
- Domain contracts, Citty orchestration, cache timing, transactional replacement, rollback, installers, CI, tests, help, user docs, bundled skill, TODO, and XDocs.

### Out of scope

- Version bump, tag, publication, push, issue closure, stable launcher redesign, or checksum-signing architecture.

## Acceptance Signals

- A fresh process launched from the canonical path reports the exact target before success.
- Replacement or verification failure restores the prior executable or preserves/report artifacts when rollback fails.
- Plan and progress are observable before and during a delayed download.
- Recovery commands are exact-version and copy-paste tested.
- The catalog exhausts pagination and labels stable/prerelease channels, dates, current/latest markers, and compatible assets.
- Typecheck, tests, builds, installer smoke checks, Windows CI definition, and XDocs strict validation pass.

## Dependencies and Context

- [Approved design](../superpowers/specs/2026-07-15-upgrade-reliability-design.md)
- [Implementation plan](../plans/upgrade-reliability-implementation.md)
- Existing Citty migration and local `3.5.0-alpha.0` history must be preserved.
- [Implementation notes](./upgrade-reliability-implementation.md) record progress and validation handoff.

## Watch-outs

- Never claim success for a scheduled replacement.
- Defer only deletion of a noncanonical verified backup.
- Do not update cache before canonical verification.
- Do not let devops installers drift from canonical package installers.
- Keep global `--version` distinct from `upgrade --version`.

## Before Starting

- Confirm the isolated worktree/branch and read AGENTS, Mirror config, approved design, source descriptors, and installer scripts.

## While Working

- Commit coherent units with explicit file staging.
- Preserve unrelated history and avoid generated outputs.

## After Finishing

- Record exact validation evidence and remaining environment-only gates.
- Leave release/version/PR work to the root integrator.

## References

- [Mirror TODO](../../todo.md)
- [GitHub issue #9](https://github.com/CGuiho/mirror/issues/9)
- [GitHub issue #10](https://github.com/CGuiho/mirror/issues/10)
